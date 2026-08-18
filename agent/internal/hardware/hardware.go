// Package hardware collects a best-effort, mostly-static hardware
// inventory — disk models and RAM slot count/type — for display on the
// agent detail page. Go has no portable way to read DMI/SMBIOS data, so
// every platform file here shells out to that OS's own inventory tool
// (dmidecode / PowerShell CIM / system_profiler). Soft-fail throughout: a
// missing tool, insufficient privilege, or unparseable output just means an
// empty field, never an agent crash or a dropped connection.
package hardware

// Disk describes one physical drive, as reported by the OS.
type Disk struct {
	Model  string `json:"model,omitempty"`
	Vendor string `json:"vendor,omitempty"`
}

// Memory describes the motherboard's RAM slots.
type Memory struct {
	SlotsTotal int    `json:"slotsTotal,omitempty"`
	SlotsUsed  int    `json:"slotsUsed,omitempty"`
	Type       string `json:"type,omitempty"` // e.g. "DDR3", "DDR4", "DDR5"
}

// Info is the full inventory sent to the server.
type Info struct {
	Disks  []Disk  `json:"disks,omitempty"`
	Memory *Memory `json:"memory,omitempty"`
}

// Collect gathers the inventory. It shells out to slow platform tools, so
// callers should run it once at startup and cache the result rather than
// calling it on every reconnect.
func Collect() Info {
	return Info{
		Disks:  collectDisks(),
		Memory: collectMemory(),
	}
}
