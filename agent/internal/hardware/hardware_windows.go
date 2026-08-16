//go:build windows

package hardware

import (
	"encoding/json"
	"os/exec"
	"strconv"
	"strings"
)

// runPS runs a PowerShell command and returns its trimmed stdout. wmic is
// deprecated/removed on recent Windows builds, so CIM cmdlets are the
// reliable path here.
func runPS(script string) (string, error) {
	out, err := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script).Output()
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
	Model        string `json:"Model"`
	Manufacturer string `json:"Manufacturer"`
}

func collectDisks() []Disk {
	raw, err := runPS("Get-CimInstance Win32_DiskDrive | Select-Object Model,Manufacturer | ConvertTo-Json -Compress")
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
		// Win32_DiskDrive.Manufacturer is usually the generic "(Standard
		// disk drives)" rather than a real brand — not worth surfacing.
		if vendor == "(Standard disk drives)" {
			vendor = ""
		}
		disks = append(disks, Disk{Model: model, Vendor: vendor})
	}
	return disks
}

type wmiMemChip struct {
	SMBIOSMemoryType int `json:"SMBIOSMemoryType"`
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

func collectMemory() *Memory {
	raw, err := runPS("Get-CimInstance Win32_PhysicalMemory | Select-Object SMBIOSMemoryType | ConvertTo-Json -Compress")
	if err != nil {
		return nil
	}
	var chips []wmiMemChip
	if unmarshalOneOrMany(raw, &chips) != nil || len(chips) == 0 {
		return nil
	}

	mem := &Memory{SlotsUsed: len(chips), Type: ddrTypeFromSMBIOS(chips[0].SMBIOSMemoryType)}

	// Total physical slots (including empty ones) lives on the memory array,
	// not the individual chips — fall back to "used" if this fails.
	mem.SlotsTotal = mem.SlotsUsed
	if slotsRaw, err := runPS("(Get-CimInstance Win32_PhysicalMemoryArray | Measure-Object -Property MemoryDevices -Sum).Sum"); err == nil {
		if n, convErr := strconv.Atoi(strings.TrimSpace(slotsRaw)); convErr == nil && n > 0 {
			mem.SlotsTotal = n
		}
	}

	return mem
}
