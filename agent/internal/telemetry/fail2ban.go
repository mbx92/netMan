package telemetry

import (
	"context"
	"net"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/netman/agent/internal/config"
)

type Fail2BanJail struct {
	Name            string   `json:"name"`
	CurrentlyFailed int64    `json:"currentlyFailed"`
	TotalFailed     int64    `json:"totalFailed"`
	CurrentlyBanned int64    `json:"currentlyBanned"`
	TotalBanned     int64    `json:"totalBanned"`
	BannedIPs       []string `json:"bannedIps"`
	Error           string   `json:"error,omitempty"`
}
type Fail2BanSnapshot struct {
	Available       bool           `json:"available"`
	Running         bool           `json:"running"`
	Status          string         `json:"status"`
	JailCount       int            `json:"jailCount"`
	CurrentlyBanned int64          `json:"currentlyBanned"`
	TotalBanned     int64          `json:"totalBanned"`
	Jails           []Fail2BanJail `json:"jails"`
	Partial         bool           `json:"partial,omitempty"`
	Error           string         `json:"error,omitempty"`
	CheckedAt       time.Time      `json:"checkedAt"`
}

var jailName = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$`)

func statusFields(raw string) map[string]string {
	out := map[string]string{}
	for _, line := range strings.Split(raw, "\n") {
		key, value, ok := strings.Cut(strings.TrimLeft(line, " \t|`-+"), ":")
		if ok {
			out[strings.TrimSpace(key)] = strings.TrimSpace(value)
		}
	}
	return out
}

func parseFail2BanStatus(raw string) ([]string, error) {
	f := statusFields(raw)
	n, err := strconv.Atoi(f["Number of jail"])
	list, ok := f["Jail list"]
	if err != nil || !ok || n < 0 || n > 4096 {
		return nil, errMalformed
	}
	jails := []string{}
	seen := map[string]bool{}
	if list != "" {
		for _, name := range strings.Split(list, ",") {
			name = strings.TrimSpace(name)
			if !jailName.MatchString(name) || seen[name] {
				return nil, errMalformed
			}
			seen[name] = true
			jails = append(jails, name)
		}
	}
	if len(jails) != n {
		return nil, errMalformed
	}
	return jails, nil
}

func parseFail2BanJail(name, raw string) (Fail2BanJail, error) {
	j := Fail2BanJail{Name: name, BannedIPs: []string{}}
	f := statusFields(raw)
	if f["Status for the jail"] != name {
		return j, errMalformed
	}
	for key, dest := range map[string]*int64{"Currently failed": &j.CurrentlyFailed, "Total failed": &j.TotalFailed, "Currently banned": &j.CurrentlyBanned, "Total banned": &j.TotalBanned} {
		n, err := strconv.ParseInt(f[key], 10, 64)
		if err != nil || n < 0 || n > 1<<40 {
			return j, errMalformed
		}
		*dest = n
	}
	ips, ok := f["Banned IP list"]
	if !ok {
		return j, errMalformed
	}
	for _, ip := range strings.Fields(ips) {
		if net.ParseIP(ip) == nil {
			return j, errMalformed
		}
		j.BannedIPs = append(j.BannedIPs, ip)
	}
	return j, nil
}

func collectFail2Ban(ctx context.Context, cfg config.Module, run commandRunner) Fail2BanSnapshot {
	s := Fail2BanSnapshot{CheckedAt: time.Now().UTC(), Status: "unknown", Jails: []Fail2BanJail{}}
	// Bound the whole jail sweep as well as each individual command.
	ctx, cancel := context.WithTimeout(ctx, moduleDuration(cfg.Interval, 60*time.Second))
	defer cancel()
	command := func(args ...string) (string, error) {
		if cfg.Sudo {
			return moduleCommand(ctx, cfg, run, "sudo", append([]string{"-n", "--", "/usr/bin/fail2ban-client"}, args...)...)
		}
		return moduleCommand(ctx, cfg, run, "fail2ban-client", args...)
	}
	if _, err := exec.LookPath("fail2ban-client"); err == nil {
		s.Available = true
	}
	raw, err := command("status")
	if err != nil {
		s.Error = monitoringError(err)
		state, _ := moduleCommand(ctx, cfg, run, "systemctl", "is-active", "fail2ban.service")
		if strings.TrimSpace(state) == "inactive" || strings.TrimSpace(state) == "failed" {
			s.Status = "stopped"
		}
		return s
	}
	s.Available = true
	names, err := parseFail2BanStatus(raw)
	if err != nil {
		s.Error = monitoringError(err)
		return s
	}
	s.Running = true
	s.Status = "running"
	s.JailCount = len(names)
	for _, name := range names {
		j := Fail2BanJail{Name: name, BannedIPs: []string{}}
		raw, err = command("status", name)
		if err == nil {
			j, err = parseFail2BanJail(name, raw)
		}
		if err != nil {
			j = Fail2BanJail{Name: name, BannedIPs: []string{}, Error: monitoringError(err)}
			s.Partial = true
		} else {
			s.CurrentlyBanned += j.CurrentlyBanned
			s.TotalBanned += j.TotalBanned
		}
		s.Jails = append(s.Jails, j)
	}
	return s
}
