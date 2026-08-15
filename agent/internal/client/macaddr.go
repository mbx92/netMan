package client

import "net"

// DetectMACAddress picks the hardware address of the first active,
// non-virtual network interface — the same heuristic a human would use to
// answer "what's this machine's MAC": up, not loopback, has a real MAC, and
// currently holds a routable IP (not just link-local) — this is what rules
// out virtual adapters like macOS's Thunderbolt Bridge, which are "up" with
// a real-looking MAC but only ever get a link-local address, and would
// otherwise win by simply appearing first in the interface list.
func DetectMACAddress() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if len(iface.HardwareAddr) == 0 {
			continue
		}
		if !hasRoutableAddr(iface) {
			continue
		}
		return iface.HardwareAddr.String()
	}
	return ""
}

func hasRoutableAddr(iface net.Interface) bool {
	addrs, err := iface.Addrs()
	if err != nil {
		return false
	}
	for _, a := range addrs {
		ipNet, ok := a.(*net.IPNet)
		if !ok {
			continue
		}
		if ipNet.IP.IsLinkLocalUnicast() || ipNet.IP.IsLoopback() {
			continue
		}
		return true
	}
	return false
}
