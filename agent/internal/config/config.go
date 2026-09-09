// Package config persists the agent's enrollment identity (agentId + authKey)
// to a locked-down local file so it can reconnect after a reboot without
// re-enrolling.
package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
)

type Config struct {
	Monitoring Monitoring `json:"monitoring,omitempty"`
	ServerURL  string     `json:"serverUrl"`
	AgentID    string     `json:"agentId"`
	AuthKey    string     `json:"authKey"`
}

type Monitoring struct {
	Zimbra   Module `json:"zimbra"`
	Fail2Ban Module `json:"fail2ban"`
}

// Durations use Go notation, e.g. "60s". Modules are disabled by default.
type Module struct {
	CertificatePath         string  `json:"certificatePath,omitempty"`
	AccountTimeout          string  `json:"accountTimeout,omitempty"`
	Enabled                 bool    `json:"enabled"`
	Interval                string  `json:"interval,omitempty"`
	Timeout                 string  `json:"timeout,omitempty"`
	Sudo                    bool    `json:"sudo,omitempty"`
	AccountsEnabled         bool    `json:"accountsEnabled,omitempty"`
	AccountMaxEntries       int     `json:"accountMaxEntries,omitempty"`
	AccountInactiveDays     int     `json:"accountInactiveDays,omitempty"`
	AccountQuotaWarnPercent float64 `json:"accountQuotaWarnPercent,omitempty"`
}

var ErrNotEnrolled = errors.New("agent is not enrolled — run with -enroll -token <token> -server <url> first")

// Path returns the OS-appropriate config file location. Both are restricted
// to admin/root-only read access by Save (ACLs on Windows via the directory
// creation flow, 0600 file mode on Linux).
func Path() string {
	if runtime.GOOS == "windows" {
		base := os.Getenv("ProgramData")
		if base == "" {
			base = `C:\ProgramData`
		}
		return filepath.Join(base, "netMan-agent", "config.json")
	}
	return "/etc/netman-agent/config.json"
}

func Load() (*Config, error) {
	data, err := os.ReadFile(Path())
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNotEnrolled
	}
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	if cfg.AgentID == "" || cfg.AuthKey == "" {
		return nil, ErrNotEnrolled
	}
	return &cfg, nil
}

func Save(cfg *Config) error {
	dir := filepath.Dir(Path())
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	// 0600: owner (SYSTEM on Windows, root on Linux — the service account) read/write only.
	return os.WriteFile(Path(), data, 0600)
}
