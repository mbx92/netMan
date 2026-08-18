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
	iface := primaryInterface()
	if iface == nil {
		return ""
	}
	return iface.HardwareAddr.String()
}

// DetectLocalIP returns the routable IPv4 address of the same interface
// DetectMACAddress picks. The server can't learn this on its own: agent
// traffic arrives over a Cloudflare Tunnel, so the request's source IP is
// always the client's public IP, never its LAN address — the agent is the
// only side that actually knows it.
func DetectLocalIP() string {
	iface := primaryInterface()
	if iface == nil {
		return ""
	}
	addrs, err := iface.Addrs()
	if err != nil {
		return ""
	}
	for _, a := range addrs {
		ipNet, ok := a.(*net.IPNet)
		if !ok || ipNet.IP.IsLinkLocalUnicast() || ipNet.IP.IsLoopback() {
			continue
		}
		if v4 := ipNet.IP.To4(); v4 != nil {
			return v4.String()
		}
	}
	return ""
}

// primaryInterface finds the first active, non-virtual network interface:
// up, not loopback, has a real MAC, and currently holds a routable IP (not
// just link-local) — this is what rules out virtual adapters like macOS's
// Thunderbolt Bridge, which are "up" with a real-looking MAC but only ever
// get a link-local address, and would otherwise win by simply appearing
// first in the interface list.
func primaryInterface() *net.Interface {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	for i, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if len(iface.HardwareAddr) == 0 {
			continue
		}
		if !hasRoutableAddr(iface) {
			continue
		}
		return &ifaces[i]
	}
	return nil
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
