//go:build linux

package hardware

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

func collectDisks() []Disk {
	entries, err := os.ReadDir("/sys/block")
	if err != nil {
		return nil
	}

	var disks []Disk
	for _, e := range entries {
		name := e.Name()
		// Only real physical drives (sdX, nvmeXnY, vdX, mmcblkX) carry a
		// vendor/model file in sysfs — skip loop devices, ramdisks,
		// device-mapper/LVM volumes, and optical drives.
		if strings.HasPrefix(name, "loop") || strings.HasPrefix(name, "ram") ||
			strings.HasPrefix(name, "dm-") || strings.HasPrefix(name, "sr") {
			continue
		}

		model := readSysfsTrimmed(filepath.Join("/sys/block", name, "device", "model"))
		vendor := readSysfsTrimmed(filepath.Join("/sys/block", name, "device", "vendor"))
		if model == "" && vendor == "" {
			continue
		}
		disks = append(disks, Disk{Model: model, Vendor: vendor})
	}
	return disks
}

func readSysfsTrimmed(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// collectMemory shells out to dmidecode -t memory, which needs root — the
// systemd unit (server/api/agents/install/linux.sh.get.ts) runs the agent
// as root, so that's satisfied. Covers DMI types 16 (Physical Memory
// Array — total slot count) and 17 (Memory Device — one block per slot,
// populated or not) in a single call.
func collectMemory() *Memory {
	out, err := exec.Command("dmidecode", "-t", "memory").Output()
	if err != nil {
		return nil
	}
	return parseDmidecodeMemory(string(out))
}

func parseDmidecodeMemory(out string) *Memory {
	mem := &Memory{}
	inDevice := false

	for _, line := range strings.Split(out, "\n") {
		trimmed := strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(trimmed, "Number Of Devices:"):
			if n, err := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(trimmed, "Number Of Devices:"))); err == nil {
				mem.SlotsTotal = n
			}
		case trimmed == "Memory Device":
			inDevice = true
		case inDevice && strings.HasPrefix(trimmed, "Size:"):
			if strings.TrimSpace(strings.TrimPrefix(trimmed, "Size:")) != "No Module Installed" {
				mem.SlotsUsed++
			}
		case inDevice && strings.HasPrefix(trimmed, "Type:") && !strings.HasPrefix(trimmed, "Type Detail"):
			if mem.Type == "" {
				if t := strings.TrimSpace(strings.TrimPrefix(trimmed, "Type:")); t != "" && t != "Unknown" {
					mem.Type = t
				}
			}
		}
	}

	if mem.SlotsTotal == 0 && mem.SlotsUsed == 0 && mem.Type == "" {
		return nil
	}
	return mem
}
