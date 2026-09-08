package telemetry

import (
	"context"
	"errors"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/netman/agent/internal/config"
	"github.com/shirou/gopsutil/v3/disk"
)

var errMalformed = errors.New("malformed_output")

type ZimbraService struct {
	Status string `json:"status"`
}
type ZimbraQueue struct {
	Total    int64            `json:"total"`
	Deferred int64            `json:"deferred"`
	Active   int64            `json:"active"`
	Counts   map[string]int64 `json:"counts"`
}
type ZimbraSnapshot struct {
	Available bool                     `json:"available"`
	Healthy   bool                     `json:"healthy"`
	Status    string                   `json:"status"`
	Version   string                   `json:"version,omitempty"`
	Services  map[string]ZimbraService `json:"services"`
	Queue     *ZimbraQueue             `json:"queue,omitempty"`
	Storage   []PartitionUsage         `json:"storage,omitempty"`
	Errors    map[string]string        `json:"errors,omitempty"`
	CheckedAt time.Time                `json:"checkedAt"`
}

func parseZimbraStatus(raw string) (map[string]ZimbraService, error) {
	services := map[string]ZimbraService{}
	for _, line := range strings.Split(raw, "\n") {
		f := strings.Fields(line)
		if len(f) < 2 {
			continue
		}
		status := strings.ToLower(f[1])
		if status == "running" || status == "stopped" {
			services[f[0]] = ZimbraService{Status: status}
		}
	}
	if len(services) == 0 {
		return services, errMalformed
	}
	return services, nil
}

func parseZimbraQueue(raw string) (*ZimbraQueue, error) {
	q := &ZimbraQueue{Counts: map[string]int64{}}
	for _, line := range strings.Split(strings.TrimSpace(raw), "\n") {
		key, value, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok {
			return nil, errMalformed
		}
		switch key {
		case "hold", "corrupt", "deferred", "active", "incoming", "maildrop":
		default:
			return nil, errMalformed
		}
		n, err := strconv.ParseInt(value, 10, 64)
		if _, exists := q.Counts[key]; exists || err != nil || n < 0 || n > 1<<53 || q.Total > 1<<53-n {
			return nil, errMalformed
		}
		q.Counts[key] = n
		q.Total += n
	}
	for _, key := range []string{"hold", "corrupt", "deferred", "active", "incoming"} {
		if _, ok := q.Counts[key]; !ok {
			return nil, errMalformed
		}
	}
	q.Deferred = q.Counts["deferred"]
	q.Active = q.Counts["active"]
	return q, nil
}

func collectZimbra(ctx context.Context, cfg config.Module, run commandRunner) ZimbraSnapshot {
	s := ZimbraSnapshot{CheckedAt: time.Now().UTC(), Status: "unknown", Services: map[string]ZimbraService{}, Errors: map[string]string{}}
	if _, err := os.Stat("/opt/zimbra/bin/zmcontrol"); err == nil {
		s.Available = true
	}
	control := func(command string) (string, error) {
		if cfg.Sudo {
			return moduleCommand(ctx, cfg, run, "sudo", "-n", "-i", "-u", "zimbra", "--", "/opt/zimbra/bin/zmcontrol", command)
		}
		// Only these fixed literal shell strings are allowed; no external input.
		literal := "/opt/zimbra/bin/zmcontrol status"
		if command == "-v" {
			literal = "/opt/zimbra/bin/zmcontrol -v"
		}
		return moduleCommand(ctx, cfg, run, "su", "-", "zimbra", "-c", literal)
	}
	raw, cmdErr := control("status")
	services, parseErr := parseZimbraStatus(raw)
	if parseErr == nil {
		s.Services = services
		s.Available = true
		s.Healthy = true
		s.Status = "running"
		for _, svc := range services {
			if svc.Status != "running" {
				s.Healthy = false
				s.Status = "degraded"
			}
		}
	} else {
		s.Errors["services"] = monitoringError(parseErr)
	}
	if cmdErr != nil {
		s.Errors["services"] = monitoringError(cmdErr)
		s.Healthy = false
	}
	raw, err := control("-v")
	if err != nil {
		s.Errors["version"] = monitoringError(err)
	} else if strings.HasPrefix(strings.TrimSpace(raw), "Release ") {
		s.Version = strings.TrimSpace(raw)
		s.Available = true
	} else {
		s.Errors["version"] = "malformed_output"
	}
	if cfg.Sudo {
		raw, err = moduleCommand(ctx, cfg, run, "sudo", "-n", "--", "/opt/zimbra/libexec/zmqstat")
	} else {
		raw, err = moduleCommand(ctx, cfg, run, "/opt/zimbra/libexec/zmqstat")
	}
	if err == nil {
		s.Queue, err = parseZimbraQueue(raw)
	}
	if err != nil {
		s.Errors["queue"] = monitoringError(err)
	}
	for _, path := range []string{"/opt/zimbra/store", "/opt/zimbra/index"} {
		du, err := disk.UsageWithContext(ctx, path)
		if err != nil {
			s.Errors[path] = "storage_unavailable"
			continue
		}
		s.Storage = append(s.Storage, PartitionUsage{Mountpoint: path, Percent: du.UsedPercent, TotalBytes: du.Total, UsedBytes: du.Used})
	}
	return s
}
