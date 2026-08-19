// Package hardware collects a best-effort, mostly-static hardware
// inventory — disk models/capacity, RAM, and OS print queues — for
// display on the agent detail page. Go has no portable way to read
// DMI/SMBIOS data, so every platform file here shells out to that OS's
// own inventory tool (dmidecode / PowerShell CIM / system_profiler /
// lpstat). Soft-fail throughout: a missing tool, insufficient privilege,
// or unparseable output just means an empty field, never an agent crash.
package hardware

import (
	"net"
	"net/url"
	"strconv"
	"strings"

	"github.com/shirou/gopsutil/v3/mem"
)

// Disk describes one physical drive, as reported by the OS.
type Disk struct {
	Model     string `json:"model,omitempty"`
	Vendor    string `json:"vendor,omitempty"`
	SizeBytes uint64 `json:"sizeBytes,omitempty"`
}

// Memory describes installed RAM.
type Memory struct {
	SlotsTotal int    `json:"slotsTotal,omitempty"`
	SlotsUsed  int    `json:"slotsUsed,omitempty"`
	Type       string `json:"type,omitempty"` // e.g. "DDR3", "DDR4", "DDR5"
	TotalBytes uint64 `json:"totalBytes,omitempty"`
}

// Printer is one OS-configured print queue (USB, network, or shared).
type Printer struct {
	Name    string `json:"name"`
	Driver  string `json:"driver,omitempty"`
	Port    string `json:"port,omitempty"`
	Host    string `json:"host,omitempty"` // IP or hostname when the queue is networked
	Default bool   `json:"default,omitempty"`
	Shared  bool   `json:"shared,omitempty"`
	Network bool   `json:"network,omitempty"`
	Status  string `json:"status,omitempty"` // idle, printing, offline, paused, unknown
}

// Info is the full inventory sent to the server.
type Info struct {
	Disks    []Disk    `json:"disks,omitempty"`
	Memory   *Memory   `json:"memory,omitempty"`
	Printers []Printer `json:"printers,omitempty"`
}

// Collect gathers the inventory. It shells out to slow platform tools, so
// callers should run it once at startup and cache the result rather than
// calling it on every reconnect.
func Collect() Info {
	info := Info{
		Disks:    collectDisks(),
		Memory:   collectMemory(),
		Printers: collectPrinters(),
	}
	// OS-visible RAM is the number operators actually care about (and is
	// available without dmidecode / admin CIM). Fill it in when the
	// platform inventory didn't (Apple Silicon, missing dmidecode, etc.).
	if vm, err := mem.VirtualMemory(); err == nil && vm.Total > 0 {
		if info.Memory == nil {
			info.Memory = &Memory{}
		}
		if info.Memory.TotalBytes == 0 {
			info.Memory.TotalBytes = vm.Total
		}
	}
	return info
}

// parseCapacityBytes accepts strings like "8 GB", "8192 MB", "16384".
func parseCapacityBytes(s string) uint64 {
	s = strings.TrimSpace(s)
	if s == "" || strings.EqualFold(s, "No Module Installed") || strings.EqualFold(s, "Unknown") {
		return 0
	}
	parts := strings.Fields(s)
	n, err := strconv.ParseFloat(parts[0], 64)
	if err != nil || n <= 0 {
		return 0
	}
	unit := "B"
	if len(parts) > 1 {
		unit = strings.ToUpper(strings.TrimRight(parts[1], "s"))
	}
	switch unit {
	case "KB", "KIB":
		return uint64(n * 1024)
	case "MB", "MIB":
		return uint64(n * 1024 * 1024)
	case "GB", "GIB":
		return uint64(n * 1024 * 1024 * 1024)
	case "TB", "TIB":
		return uint64(n * 1024 * 1024 * 1024 * 1024)
	default:
		return uint64(n)
	}
}

func isSoftwarePrinter(name, port, driver string) bool {
	blob := strings.ToLower(strings.Join([]string{name, port, driver}, " "))
	for _, n := range []string{
		"microsoft print to pdf",
		"microsoft xps",
		"xps document writer",
		"onenote",
		"fax",
		"adobe pdf",
		"foxit reader pdf printer",
		"cups-pdf",
		"print to pdf",
	} {
		if strings.Contains(blob, n) {
			return true
		}
	}
	p := strings.ToUpper(strings.TrimSpace(port))
	return p == "FILE:" || p == "NUL:" || p == "PORTPROMPT:" || strings.HasPrefix(p, "XPS")
}

func hostFromPrinterURI(uri string) string {
	uri = strings.TrimSpace(uri)
	if uri == "" {
		return ""
	}
	upper := strings.ToUpper(uri)
	if strings.HasPrefix(upper, "IP_") {
		return strings.TrimSpace(uri[3:])
	}
	if i := strings.Index(uri, "://"); i >= 0 {
		u, err := url.Parse(uri)
		if err != nil {
			return ""
		}
		if ip := u.Query().Get("ip"); ip != "" {
			return ip
		}
		host := u.Hostname()
		if host == "" {
			host = u.Host
			if h, _, err := net.SplitHostPort(host); err == nil {
				host = h
			}
		}
		if host == "localhost" || host == "127.0.0.1" || host == "::1" {
			return ""
		}
		return host
	}
	return ""
}
