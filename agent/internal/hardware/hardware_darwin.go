//go:build darwin

package hardware

import (
	"encoding/json"
	"os/exec"
)

func runSystemProfiler(dataType string, dst any) error {
	out, err := exec.Command("system_profiler", dataType, "-json").Output()
	if err != nil {
		return err
	}
	return json.Unmarshal(out, dst)
}

type spNVMe struct {
	Items []struct {
		DeviceModel string `json:"device_model"`
	} `json:"SPNVMeDataType"`
}

type spSATA struct {
	Items []struct {
		Items []struct {
			DeviceModel string `json:"device_model"`
		} `json:"_items"`
	} `json:"SPSerialATADataType"`
}

func collectDisks() []Disk {
	// Apple Silicon internal storage shows up under NVMe; older/Intel Macs
	// (and any external SATA/USB drives) show up under Serial-ATA. Try
	// both and merge — either can legitimately come back empty.
	var disks []Disk

	var nvme spNVMe
	if runSystemProfiler("SPNVMeDataType", &nvme) == nil {
		for _, it := range nvme.Items {
			if it.DeviceModel != "" {
				disks = append(disks, Disk{Model: it.DeviceModel})
			}
		}
	}

	var sata spSATA
	if runSystemProfiler("SPSerialATADataType", &sata) == nil {
		for _, bus := range sata.Items {
			for _, it := range bus.Items {
				if it.DeviceModel != "" {
					disks = append(disks, Disk{Model: it.DeviceModel})
				}
			}
		}
	}

	return disks
}

type spMemory struct {
	Items []struct {
		Items []struct {
			DimmType   string `json:"dimm_type"`
			DimmStatus string `json:"dimm_status"`
		} `json:"_items"`
	} `json:"SPMemoryDataType"`
}

// collectMemory only finds real slot data on Intel Macs with socketed RAM.
// Apple Silicon RAM is soldered/unified and system_profiler reports no per-
// slot breakdown for it, so this comes back nil there — an accurate
// "not applicable" rather than a guess.
func collectMemory() *Memory {
	var parsed spMemory
	if runSystemProfiler("SPMemoryDataType", &parsed) != nil {
		return nil
	}

	mem := &Memory{}
	for _, bank := range parsed.Items {
		for _, slot := range bank.Items {
			mem.SlotsTotal++
			if slot.DimmStatus != "empty" {
				mem.SlotsUsed++
				if mem.Type == "" && slot.DimmType != "" {
					mem.Type = slot.DimmType
				}
			}
		}
	}

	if mem.SlotsTotal == 0 {
		return nil
	}
	return mem
}
