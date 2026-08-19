//go:build linux || darwin

package hardware

import (
	"os/exec"
	"strings"
)

func collectPrinters() []Printer {
	vOut, err := exec.Command("lpstat", "-v").Output()
	if err != nil {
		return nil
	}
	defaultName := cupsDefault()
	statusByName := cupsQueueStatus()

	var out []Printer
	for _, line := range strings.Split(string(vOut), "\n") {
		line = strings.TrimSpace(line)
		name, uri, ok := parseLpstatDevice(line)
		if !ok || isSoftwarePrinter(name, uri, "") {
			continue
		}
		host := hostFromPrinterURI(uri)
		out = append(out, Printer{
			Name:    name,
			Port:    uri,
			Host:    host,
			Default: defaultName != "" && strings.EqualFold(name, defaultName),
			Network: host != "" || isNetworkURI(uri),
			Status:  statusByName[name],
		})
	}
	return out
}

func cupsDefault() string {
	out, err := exec.Command("lpstat", "-d").Output()
	if err != nil {
		return ""
	}
	s := strings.TrimSpace(string(out))
	const prefix = "system default destination:"
	if i := strings.Index(strings.ToLower(s), prefix); i >= 0 {
		return strings.TrimSpace(s[i+len(prefix):])
	}
	return ""
}

func cupsQueueStatus() map[string]string {
	out, err := exec.Command("lpstat", "-p").Output()
	if err != nil {
		return nil
	}
	res := map[string]string{}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "printer ") {
			continue
		}
		rest := strings.TrimPrefix(line, "printer ")
		name, rest, _ := strings.Cut(rest, " ")
		low := strings.ToLower(rest)
		switch {
		case strings.Contains(low, "disabled"), strings.Contains(low, "stopped"):
			res[name] = "paused"
		case strings.Contains(low, "printing"):
			res[name] = "printing"
		case strings.Contains(low, "idle"):
			res[name] = "idle"
		case strings.Contains(low, "offline"):
			res[name] = "offline"
		default:
			res[name] = "unknown"
		}
	}
	return res
}

func parseLpstatDevice(line string) (name, uri string, ok bool) {
	// "device for Queue_Name: socket://192.168.1.50:9100"
	const lead = "device for "
	if !strings.HasPrefix(strings.ToLower(line), lead) {
		return "", "", false
	}
	rest := strings.TrimSpace(line[len(lead):])
	name, uri, found := strings.Cut(rest, ":")
	if !found {
		return "", "", false
	}
	name = strings.TrimSpace(name)
	uri = strings.TrimSpace(uri)
	if name == "" || uri == "" {
		return "", "", false
	}
	return name, uri, true
}

func isNetworkURI(uri string) bool {
	u := strings.ToLower(uri)
	for _, p := range []string{"socket://", "ipp://", "ipps://", "http://", "https://", "lpd://", "smb://", "dnssd://", "ipp14://"} {
		if strings.HasPrefix(u, p) {
			return true
		}
	}
	return strings.Contains(u, "://") && !strings.HasPrefix(u, "usb://") && !strings.HasPrefix(u, "file://") && !strings.HasPrefix(u, "serial://")
}
