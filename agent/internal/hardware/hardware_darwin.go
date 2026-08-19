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
		SizeInBytes int64  `json:"size_in_bytes"`
	} `json:"SPNVMeDataType"`
}

type spSATA struct {
	Items []struct {
		Items []struct {
			DeviceModel string `json:"device_model"`
			SizeInBytes int64  `json:"size_in_bytes"`
		} `json:"_items"`
	} `json:"SPSerialATADataType"`
}

func collectDisks() []Disk {
	var disks []Disk

	var nvme spNVMe
	if runSystemProfiler("SPNVMeDataType", &nvme) == nil {
		for _, it := range nvme.Items {
			if it.DeviceModel == "" && it.SizeInBytes <= 0 {
				continue
			}
			d := Disk{Model: it.DeviceModel}
			if it.SizeInBytes > 0 {
				d.SizeBytes = uint64(it.SizeInBytes)
			}
			disks = append(disks, d)
		}
	}

	var sata spSATA
	if runSystemProfiler("SPSerialATADataType", &sata) == nil {
		for _, bus := range sata.Items {
			for _, it := range bus.Items {
				if it.DeviceModel == "" && it.SizeInBytes <= 0 {
					continue
				}
				d := Disk{Model: it.DeviceModel}
				if it.SizeInBytes > 0 {
					d.SizeBytes = uint64(it.SizeInBytes)
				}
				disks = append(disks, d)
			}
		}
	}

	return disks
}

type spMemory struct {
	Items []struct {
		PhysicalMemory string `json:"physical_memory"`
		Items          []struct {
			DimmType   string `json:"dimm_type"`
			DimmStatus string `json:"dimm_status"`
			DimmSize   string `json:"dimm_size"`
		} `json:"_items"`
	} `json:"SPMemoryDataType"`
}

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
				mem.TotalBytes += parseCapacityBytes(slot.DimmSize)
			}
		}
		if mem.TotalBytes == 0 && bank.PhysicalMemory != "" {
			mem.TotalBytes = parseCapacityBytes(bank.PhysicalMemory)
		}
	}

	if mem.SlotsTotal == 0 && mem.TotalBytes == 0 {
		return nil
	}
	return mem
}
