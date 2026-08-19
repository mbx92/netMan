package update

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/netman/agent/internal/config"
)

const (
	checkInterval = time.Hour
	maxBinarySize = 80 << 20
)

type Latest struct {
	Version   string `json:"version"`
	SHA256    string `json:"sha256"`
	URL       string `json:"url"`
	Available bool   `json:"available"`
}

type Status struct {
	Current string  `json:"current"`
	Pending *Latest `json:"pending,omitempty"`
	Message string  `json:"message,omitempty"`
}

type Manager struct {
	cfg     *config.Config
	current string

	mu        sync.Mutex
	pending   *Latest
	staged    string // verified payload on disk
	status    string
	stageBusy bool
	applying  bool

	applyCh     chan struct{}
	exitCh      chan struct{}
	exitOnce    sync.Once
	restartCh   chan struct{}
	restartOnce sync.Once
	ackCh       chan struct{}
	ackOnce     sync.Once
}

func New(cfg *config.Config, currentVersion string) *Manager {
	return &Manager{
		cfg:       cfg,
		current:   currentVersion,
		applyCh:   make(chan struct{}, 1),
		exitCh:    make(chan struct{}),
		restartCh: make(chan struct{}),
		ackCh:     make(chan struct{}),
	}
}

func (m *Manager) ExitRequested() <-chan struct{} { return m.exitCh }

func (m *Manager) CurrentVersion() string { return m.current }

func (m *Manager) Snapshot() Status {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := Status{Current: m.current, Message: m.status}
	if m.pending != nil {
		cp := *m.pending
		s.Pending = &cp
	}
	return s
}

func (m *Manager) RequestApply() {
	select {
	case m.applyCh <- struct{}{}:
	default:
	}
}

func (m *Manager) RequestRestart() {
	m.restartOnce.Do(func() { close(m.restartCh) })
}

func (m *Manager) RequestProgressAck() {
	m.ackOnce.Do(func() { close(m.ackCh) })
}

func (m *Manager) HandleLatest(l Latest) {
	if !shouldOffer(l, m.current) {
		return
	}
	if runtime.GOOS == "windows" {
		m.offer(l)
		return
	}
	go m.stage(l)
}

func (m *Manager) CheckNow() {
	l, err := FetchLatest(m.cfg.ServerURL)
	if err != nil {
		log.Printf("[agent] update check failed: %v", err)
		m.setStatus("update check failed")
		pushTrayStatus(m)
		return
	}
	if !shouldOffer(l, m.current) {
		m.setStatus("up to date")
		pushTrayStatus(m)
		return
	}
	m.mu.Lock()
	forceStage := m.applying
	m.mu.Unlock()
	if runtime.GOOS == "windows" && !forceStage {
		m.offer(l)
		return
	}
	m.stage(l)
}

func (m *Manager) offer(l Latest) {
	m.mu.Lock()
	m.pending = &Latest{Version: l.Version, SHA256: l.SHA256, URL: l.URL, Available: true}
	m.status = "update " + l.Version + " available"
	m.mu.Unlock()
	notifyUpdateReady(l.Version)
	pushTrayStatus(m)
}

func (m *Manager) Loop(stop <-chan struct{}) {
	CleanupOldBinary()
	go ipcServe(m, stop)

	m.CheckNow()
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-m.exitCh:
			return
		case <-ticker.C:
			m.CheckNow()
		case <-m.applyCh:
			m.mu.Lock()
			m.applying = true
			m.mu.Unlock()
			notifyProgress("preparing", -1, "Preparing update…")
			m.CheckNow()
			m.waitUntilStaged()
			if err := m.applyStaged(); err != nil {
				log.Printf("[agent] update apply failed: %v", err)
				m.setStatus("update failed: " + err.Error())
				notifyProgress("failed", 0, "Update failed: "+err.Error())
				pushTrayStatus(m)
				m.mu.Lock()
				m.applying = false
				m.mu.Unlock()
			}
		}
	}
}

func (m *Manager) setStatus(msg string) {
	m.mu.Lock()
	m.status = msg
	m.mu.Unlock()
}

func shouldOffer(l Latest, current string) bool {
	if l.Version == "" || l.SHA256 == "" || l.URL == "" {
		return false
	}
	return isNewer(l.Version, current)
}

func (m *Manager) stage(l Latest) {
	m.mu.Lock()
	if m.stageBusy || (m.pending != nil && m.pending.SHA256 == l.SHA256 && m.staged != "") {
		m.mu.Unlock()
		return
	}
	m.stageBusy = true
	m.pending = &Latest{Version: l.Version, SHA256: l.SHA256, URL: l.URL, Available: true}
	m.status = "downloading " + l.Version
	m.mu.Unlock()
	notifyProgress("downloading", 0, "Downloading v"+l.Version+"…")
	defer func() {
		m.mu.Lock()
		m.stageBusy = false
		m.mu.Unlock()
	}()

	path, err := m.download(l)
	if err != nil {
		log.Printf("[agent] update download failed: %v", err)
		m.mu.Lock()
		m.staged = ""
		m.status = "download failed: " + err.Error()
		m.mu.Unlock()
		pushTrayStatus(m)
		return
	}

	m.mu.Lock()
	m.staged = path
	m.status = "update " + l.Version + " ready"
	m.mu.Unlock()
	log.Printf("[agent] update %s staged (waiting to apply)", l.Version)
	notifyUpdateReady(l.Version)
	pushTrayStatus(m)
	if runtime.GOOS != "windows" {
		m.RequestApply()
	}
}

func (m *Manager) download(l Latest) (string, error) {
	url := l.URL
	if strings.HasPrefix(url, "/") {
		url = strings.TrimRight(m.cfg.ServerURL, "/") + url
	}
	if !strings.HasPrefix(url, strings.TrimRight(m.cfg.ServerURL, "/")) {
		return "", fmt.Errorf("refusing download from unexpected host")
	}

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download status %d", resp.StatusCode)
	}

	dir := filepath.Dir(config.Path())
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	dest := filepath.Join(dir, "update.bin")
	f, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return "", err
	}

	h := sha256.New()
	prog := &progressReader{r: io.LimitReader(resp.Body, maxBinarySize+1), total: resp.ContentLength, version: l.Version}
	written, err := io.Copy(io.MultiWriter(f, h), prog)
	closeErr := f.Close()
	if err != nil {
		return "", err
	}
	if closeErr != nil {
		return "", closeErr
	}
	if written > maxBinarySize {
		_ = os.Remove(dest)
		return "", fmt.Errorf("binary exceeds %d bytes", maxBinarySize)
	}

	sum := hex.EncodeToString(h.Sum(nil))
	if !strings.EqualFold(sum, l.SHA256) {
		_ = os.Remove(dest)
		return "", fmt.Errorf("checksum mismatch")
	}
	return dest, nil
}

func (m *Manager) applyStaged() error {
	m.mu.Lock()
	staged := m.staged
	pending := m.pending
	m.mu.Unlock()
	if staged == "" || pending == nil {
		return fmt.Errorf("no staged update")
	}

	log.Printf("[agent] applying update %s", pending.Version)
	m.setStatus("applying " + pending.Version)
	notifyProgress("applying", -1, "Installing v"+pending.Version+"…")
	if err := replaceExecutable(staged); err != nil {
		return err
	}
	_ = os.Remove(staged)
	afterApply(m, pending.Version)
	return nil
}

func (m *Manager) waitUntilStaged() {
	deadline := time.Now().Add(6 * time.Minute)
	for time.Now().Before(deadline) {
		m.mu.Lock()
		ready := m.staged != "" && m.pending != nil
		busy := m.stageBusy
		m.mu.Unlock()
		if ready || !busy {
			return
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func (m *Manager) signalExit() {
	m.exitOnce.Do(func() { close(m.exitCh) })
}

type progressReader struct {
	r       io.Reader
	total   int64
	got     int64
	last    time.Time
	version string
}

func (p *progressReader) Read(b []byte) (int, error) {
	n, err := p.r.Read(b)
	if n > 0 {
		p.got += int64(n)
		now := time.Now()
		if p.last.IsZero() || now.Sub(p.last) > 200*time.Millisecond || err == io.EOF {
			p.last = now
			pct := -1
			msg := "Downloading v" + p.version + "…"
			if p.total > 0 {
				pct = int(p.got * 100 / p.total)
				if pct > 100 {
					pct = 100
				}
				msg = fmt.Sprintf("Downloading v%s… %d%%", p.version, pct)
			}
			notifyProgress("downloading", pct, msg)
		}
	}
	return n, err
}

func FetchLatest(serverURL string) (Latest, error) {
	platform := runtime.GOOS
	if platform == "darwin" {
		platform = "macos"
	}
	url := strings.TrimRight(serverURL, "/") + "/api/agents/latest?platform=" + platform
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return Latest{}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return Latest{}, err
	}
	if resp.StatusCode != http.StatusOK {
		return Latest{}, fmt.Errorf("latest status %d", resp.StatusCode)
	}
	var l Latest
	if err := json.Unmarshal(body, &l); err != nil {
		return Latest{}, err
	}
	return l, nil
}

func isNewer(latest, current string) bool {
	lp := parseVer(latest)
	cp := parseVer(current)
	for i := 0; i < 3; i++ {
		if lp[i] != cp[i] {
			return lp[i] > cp[i]
		}
	}
	return false
}

func parseVer(v string) [3]int {
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	var out [3]int
	parts := strings.Split(v, ".")
	for i := 0; i < 3 && i < len(parts); i++ {
		n, _ := strconv.Atoi(parts[i])
		out[i] = n
	}
	return out
}

func CleanupOldBinary() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	_ = os.Remove(exe + ".old")
}
