package client

import (
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/shirou/gopsutil/v3/host"

	"github.com/netman/agent/internal/hardware"
)

// OSVersion is the string sent at enroll and shown in the agent window —
// platform + version from the OS, e.g. "windows 10.0.19045".
func OSVersion() string {
	info, err := host.Info()
	if err != nil {
		return runtime.GOOS
	}
	return fmt.Sprintf("%s %s", info.Platform, info.PlatformVersion)
}

// Hostname is the value sent at enroll.
func Hostname() string {
	h, err := os.Hostname()
	if err != nil || h == "" {
		return "unknown-host"
	}
	return h
}

func formatDisks(disks []hardware.Disk) string {
	if len(disks) == 0 {
		return ""
	}
	parts := make([]string, 0, len(disks))
	for _, d := range disks {
		label := strings.TrimSpace(d.Model)
		if label == "" {
			continue
		}
		if d.Vendor != "" && !strings.Contains(strings.ToLower(label), strings.ToLower(d.Vendor)) {
			label = d.Vendor + " " + label
		}
		if d.SizeBytes > 0 {
			label += " (" + formatBytes(d.SizeBytes) + ")"
		}
		parts = append(parts, label)
	}
	return strings.Join(parts, "; ")
}

func formatMemory(m *hardware.Memory) string {
	if m == nil {
		return ""
	}
	var b strings.Builder
	if m.TotalBytes > 0 {
		b.WriteString(formatBytes(m.TotalBytes))
	}
	if m.Type != "" {
		if b.Len() > 0 {
			b.WriteByte(' ')
		}
		b.WriteString(m.Type)
	}
	if m.SlotsUsed > 0 && m.SlotsTotal > 0 {
		if b.Len() > 0 {
			b.WriteString(" · ")
		}
		fmt.Fprintf(&b, "%d/%d slots", m.SlotsUsed, m.SlotsTotal)
	}
	return b.String()
}

func formatPrinters(printers []hardware.Printer) string {
	if len(printers) == 0 {
		return ""
	}
	names := make([]string, 0, len(printers))
	for _, p := range printers {
		if p.Name == "" {
			continue
		}
		names = append(names, p.Name)
		if len(names) == 4 {
			break
		}
	}
	return strings.Join(names, "; ")
}

func formatBytes(n uint64) string {
	const (
		kb = 1024
		mb = kb * 1024
		gb = mb * 1024
		tb = gb * 1024
	)
	switch {
	case n >= tb:
		return fmt.Sprintf("%.1f TB", float64(n)/float64(tb))
	case n >= gb:
		return fmt.Sprintf("%.1f GB", float64(n)/float64(gb))
	case n >= mb:
		return fmt.Sprintf("%.0f MB", float64(n)/float64(mb))
	default:
		return fmt.Sprintf("%d B", n)
	}
}
