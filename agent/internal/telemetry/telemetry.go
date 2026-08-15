// Package telemetry collects the metrics snapshot sent in each heartbeat,
// via gopsutil (cross-platform: works identically against /proc on Linux,
// WMI/perf counters on Windows, and host calls on macOS).
package telemetry

import (
	"os/exec"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

type PartitionUsage struct {
	Mountpoint string  `json:"mountpoint"`
	Percent    float64 `json:"percent"`
}

type ProcessInfo struct {
	Name       string  `json:"name"`
	PID        int32   `json:"pid"`
	CPUPercent float64 `json:"cpuPercent"`
	MemPercent float32 `json:"memPercent"`
}

type Snapshot struct {
	CPUPercent  float64   `json:"cpuPercent"`
	CPUPerCore  []float64 `json:"cpuPerCore,omitempty"`
	MemPercent  float64   `json:"memPercent"`
	SwapPercent float64   `json:"swapPercent"`
	DiskPercent float64   `json:"diskPercent"`
	UptimeSec   uint64    `json:"uptimeSec"`

	// Rates, computed from the delta against the previous Collect() call —
	// nil (omitted) on the very first sample of a process's lifetime.
	NetRxBytesPerSec     *float64 `json:"netRxBytesPerSec,omitempty"`
	NetTxBytesPerSec     *float64 `json:"netTxBytesPerSec,omitempty"`
	DiskReadBytesPerSec  *float64 `json:"diskReadBytesPerSec,omitempty"`
	DiskWriteBytesPerSec *float64 `json:"diskWriteBytesPerSec,omitempty"`

	// Unix only — gopsutil returns an error for these on Windows.
	LoadAvg1  *float64 `json:"loadAvg1,omitempty"`
	LoadAvg5  *float64 `json:"loadAvg5,omitempty"`
	LoadAvg15 *float64 `json:"loadAvg15,omitempty"`

	Partitions    []PartitionUsage `json:"partitions,omitempty"`
	TopProcesses  []ProcessInfo    `json:"topProcesses,omitempty"`
	LoggedInUsers []string         `json:"loggedInUsers,omitempty"`
}

// Collector holds the previous cumulative I/O counters so Collect can report
// rates (bytes/sec) instead of raw since-boot totals, which is what's
// actually useful for graphing/alerting. Safe for the single heartbeat
// goroutine that owns it; not meant to be shared across goroutines.
type Collector struct {
	mu sync.Mutex

	prevAt        time.Time
	prevNetRx     uint64
	prevNetTx     uint64
	prevDiskRead  uint64
	prevDiskWrite uint64
	havePrevIO    bool
}

func NewCollector() *Collector {
	return &Collector{}
}

func (c *Collector) Collect() Snapshot {
	c.mu.Lock()
	defer c.mu.Unlock()

	snap := Snapshot{}
	now := time.Now()

	if pcts, err := cpu.Percent(500*time.Millisecond, false); err == nil && len(pcts) > 0 {
		snap.CPUPercent = pcts[0]
	}
	if perCore, err := cpu.Percent(0, true); err == nil && len(perCore) > 0 {
		snap.CPUPerCore = perCore
	}

	if vm, err := mem.VirtualMemory(); err == nil {
		snap.MemPercent = vm.UsedPercent
	}
	if sm, err := mem.SwapMemory(); err == nil {
		snap.SwapPercent = sm.UsedPercent
	}

	if du, err := disk.Usage(systemDrive()); err == nil {
		snap.DiskPercent = du.UsedPercent
	}
	snap.Partitions = collectPartitions()

	if uptime, err := host.Uptime(); err == nil {
		snap.UptimeSec = uptime
	}

	if avg, err := load.Avg(); err == nil {
		snap.LoadAvg1 = &avg.Load1
		snap.LoadAvg5 = &avg.Load5
		snap.LoadAvg15 = &avg.Load15
	}

	elapsed := now.Sub(c.prevAt).Seconds()
	if rx, tx, ok := netTotals(); ok {
		if c.havePrevIO && elapsed > 0 {
			snap.NetRxBytesPerSec = rate(c.prevNetRx, rx, elapsed)
			snap.NetTxBytesPerSec = rate(c.prevNetTx, tx, elapsed)
		}
		c.prevNetRx, c.prevNetTx = rx, tx
	}
	if read, write, ok := diskTotals(); ok {
		if c.havePrevIO && elapsed > 0 {
			snap.DiskReadBytesPerSec = rate(c.prevDiskRead, read, elapsed)
			snap.DiskWriteBytesPerSec = rate(c.prevDiskWrite, write, elapsed)
		}
		c.prevDiskRead, c.prevDiskWrite = read, write
	}
	c.havePrevIO = true
	c.prevAt = now

	snap.TopProcesses = collectTopProcesses(5)
	snap.LoggedInUsers = collectLoggedInUsers()

	return snap
}

func rate(prev, cur uint64, elapsedSec float64) *float64 {
	if cur < prev {
		// Counter reset (interface restarted, disk hot-swapped, etc.) — skip this sample.
		return nil
	}
	v := float64(cur-prev) / elapsedSec
	return &v
}

func netTotals() (rx, tx uint64, ok bool) {
	counters, err := net.IOCounters(false)
	if err != nil || len(counters) == 0 {
		return 0, 0, false
	}
	return counters[0].BytesRecv, counters[0].BytesSent, true
}

func diskTotals() (read, write uint64, ok bool) {
	counters, err := disk.IOCounters()
	if err != nil || len(counters) == 0 {
		return 0, 0, false
	}
	for _, c := range counters {
		read += c.ReadBytes
		write += c.WriteBytes
	}
	return read, write, true
}

func collectPartitions() []PartitionUsage {
	parts, err := disk.Partitions(false)
	if err != nil {
		return nil
	}
	out := make([]PartitionUsage, 0, len(parts))
	for _, p := range parts {
		du, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}
		out = append(out, PartitionUsage{Mountpoint: p.Mountpoint, Percent: du.UsedPercent})
	}
	return out
}

// collectTopProcesses returns the top-N processes by memory usage. CPU% here
// is gopsutil's since-process-start average (cumulative CPU time / wall
// time), not a fresh delta — accurate enough for "what's heavy right now"
// without the cost of a second, sleep-gated sample per process every
// heartbeat.
func collectTopProcesses(n int) []ProcessInfo {
	procs, err := process.Processes()
	if err != nil {
		return nil
	}

	infos := make([]ProcessInfo, 0, len(procs))
	for _, p := range procs {
		memPct, err := p.MemoryPercent()
		if err != nil {
			continue
		}
		name, err := p.Name()
		if err != nil || name == "" {
			continue
		}
		cpuPct, _ := p.CPUPercent()
		infos = append(infos, ProcessInfo{Name: name, PID: p.Pid, CPUPercent: cpuPct, MemPercent: memPct})
	}

	sort.Slice(infos, func(i, j int) bool { return infos[i].MemPercent > infos[j].MemPercent })
	if len(infos) > n {
		infos = infos[:n]
	}
	return infos
}

func collectLoggedInUsers() []string {
	if users := gopsutilLoggedInUsers(); len(users) > 0 {
		return users
	}
	// gopsutil's host.Users() hand-parses /var/run/utmpx on macOS, but Apple's
	// actual on-disk record format has drifted from what that parser expects
	// — confirmed live: the file has real, current session data, gopsutil
	// still returns zero entries. `who` is what the OS itself keeps correct,
	// so fall back to shelling out to it. Windows doesn't have `who` (and
	// gopsutil's own Windows implementation already works), so skip there.
	if runtime.GOOS == "windows" {
		return nil
	}
	return whoLoggedInUsers()
}

func gopsutilLoggedInUsers() []string {
	users, err := host.Users()
	if err != nil {
		return nil
	}
	seen := make(map[string]bool, len(users))
	out := make([]string, 0, len(users))
	for _, u := range users {
		if u.User == "" || seen[u.User] {
			continue
		}
		seen[u.User] = true
		out = append(out, u.User)
	}
	return out
}

func whoLoggedInUsers() []string {
	raw, err := exec.Command("who").Output()
	if err != nil {
		return nil
	}
	seen := make(map[string]bool)
	var out []string
	for _, line := range strings.Split(string(raw), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		name := fields[0]
		if seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, name)
	}
	return out
}

func systemDrive() string {
	if runtime.GOOS == "windows" {
		return `C:\`
	}
	return "/"
}
