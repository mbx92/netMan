// Package telemetry collects the CPU/memory/disk/uptime snapshot sent in
// each heartbeat, via gopsutil (cross-platform: works identically against
// /proc on Linux and WMI/perf counters on Windows).
package telemetry

import (
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

type Snapshot struct {
	CPUPercent  float64 `json:"cpuPercent"`
	MemPercent  float64 `json:"memPercent"`
	DiskPercent float64 `json:"diskPercent"`
	UptimeSec   uint64  `json:"uptimeSec"`
}

func Collect() Snapshot {
	snap := Snapshot{}

	if pcts, err := cpu.Percent(500*time.Millisecond, false); err == nil && len(pcts) > 0 {
		snap.CPUPercent = pcts[0]
	}

	if vm, err := mem.VirtualMemory(); err == nil {
		snap.MemPercent = vm.UsedPercent
	}

	if du, err := disk.Usage(systemDrive()); err == nil {
		snap.DiskPercent = du.UsedPercent
	}

	if uptime, err := host.Uptime(); err == nil {
		snap.UptimeSec = uptime
	}

	return snap
}

func systemDrive() string {
	if runtime.GOOS == "windows" {
		return `C:\`
	}
	return "/"
}
