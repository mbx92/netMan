//go:build windows

package hardware

import (
	"context"
	"encoding/json"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// runPS runs a PowerShell command and returns its trimmed stdout. wmic is
// deprecated/removed on recent Windows builds, so CIM cmdlets are the
// reliable path here.
func runPS(script string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", script).Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// unmarshalOneOrMany handles ConvertTo-Json's quirk of emitting a single
// object (not a one-element array) when the source collection has exactly
// one item.
func unmarshalOneOrMany[T any](raw string, dst *[]T) error {
	if raw == "" {
		return nil
	}
	if strings.HasPrefix(raw, "[") {
		return json.Unmarshal([]byte(raw), dst)
	}
	var one T
	if err := json.Unmarshal([]byte(raw), &one); err != nil {
		return err
	}
	*dst = []T{one}
	return nil
}

type wmiDisk struct {
	Model        string  `json:"Model"`
	Manufacturer string  `json:"Manufacturer"`
	Size         float64 `json:"Size"`
}

func collectDisks() []Disk {
	raw, err := runPS("Get-CimInstance Win32_DiskDrive | Select-Object Model,Manufacturer,Size | ConvertTo-Json -Compress")
	if err != nil {
		return nil
	}
	var chips []wmiDisk
	if unmarshalOneOrMany(raw, &chips) != nil {
		return nil
	}
	var disks []Disk
	for _, d := range chips {
		model := strings.TrimSpace(d.Model)
		if model == "" {
			continue
		}
		vendor := strings.TrimSpace(d.Manufacturer)
		if vendor == "(Standard disk drives)" {
			vendor = ""
		}
		disk := Disk{Model: model, Vendor: vendor}
		if d.Size > 0 {
			disk.SizeBytes = uint64(d.Size)
		}
		disks = append(disks, disk)
	}
	return disks
}

type wmiMemChip struct {
	SMBIOSMemoryType int     `json:"SMBIOSMemoryType"`
	Capacity         float64 `json:"Capacity"`
}

func collectMemory() *Memory {
	raw, err := runPS("Get-CimInstance Win32_PhysicalMemory | Select-Object SMBIOSMemoryType,Capacity | ConvertTo-Json -Compress")
	if err != nil {
		return nil
	}
	var chips []wmiMemChip
	if unmarshalOneOrMany(raw, &chips) != nil || len(chips) == 0 {
		return nil
	}

	mem := &Memory{SlotsUsed: len(chips), Type: ddrTypeFromSMBIOS(chips[0].SMBIOSMemoryType)}
	for _, c := range chips {
		if c.Capacity > 0 {
			mem.TotalBytes += uint64(c.Capacity)
		}
	}

	mem.SlotsTotal = mem.SlotsUsed
	if slotsRaw, err := runPS("(Get-CimInstance Win32_PhysicalMemoryArray | Measure-Object -Property MemoryDevices -Sum).Sum"); err == nil {
		if n, convErr := strconv.Atoi(strings.TrimSpace(slotsRaw)); convErr == nil && n > 0 {
			mem.SlotsTotal = n
		}
	}

	return mem
}

func ddrTypeFromSMBIOS(code int) string {
	// https://learn.microsoft.com/windows/win32/cimwin32prov/win32-physicalmemory
	switch code {
	case 20:
		return "DDR"
	case 21:
		return "DDR2"
	case 24:
		return "DDR3"
	case 26:
		return "DDR4"
	case 34:
		return "DDR5"
	default:
		return ""
	}
}

type wmiPrinter struct {
	Name          string `json:"Name"`
	DriverName    string `json:"DriverName"`
	PortName      string `json:"PortName"`
	Default       bool   `json:"Default"`
	Shared        bool   `json:"Shared"`
	Network       bool   `json:"Network"`
	WorkOffline   bool   `json:"WorkOffline"`
	PrinterStatus int    `json:"PrinterStatus"`
}

func collectPrinters() []Printer {
	raw, err := runPS("Get-CimInstance Win32_Printer | Select-Object Name,DriverName,PortName,Default,Shared,Network,WorkOffline,PrinterStatus | ConvertTo-Json -Compress")
	if err != nil {
		return nil
	}
	var rows []wmiPrinter
	if unmarshalOneOrMany(raw, &rows) != nil {
		return nil
	}
	var out []Printer
	for _, r := range rows {
		name := strings.TrimSpace(r.Name)
		if name == "" || isSoftwarePrinter(name, r.PortName, r.DriverName) {
			continue
		}
		p := Printer{
			Name:    name,
			Driver:  strings.TrimSpace(r.DriverName),
			Port:    strings.TrimSpace(r.PortName),
			Host:    hostFromPrinterURI(r.PortName),
			Default: r.Default,
			Shared:  r.Shared,
			Network: r.Network || hostFromPrinterURI(r.PortName) != "",
			Status:  windowsPrinterStatus(r.WorkOffline, r.PrinterStatus),
		}
		out = append(out, p)
	}
	return out
}

func windowsPrinterStatus(workOffline bool, code int) string {
	if workOffline {
		return "offline"
	}
	switch code {
	case 3:
		return "idle"
	case 4:
		return "printing"
	case 5:
		return "idle"
	case 6, 7:
		return "offline"
	default:
		return "unknown"
	}
}
