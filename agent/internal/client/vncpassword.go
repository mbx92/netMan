package client

import (
	"os"
	"runtime"
	"strings"
)

// ReadVNCPassword returns the VNC password the install/update PowerShell
// script wrote to disk after (re)configuring TightVNC — reported back to the
// server on every enroll/hello so the operator can see it in the UI instead
// of having to catch it once from install-time console output and remember
// it forever. Windows-only; returns "" everywhere else since only Windows
// agents run a VNC server at all.
func ReadVNCPassword() string {
	if runtime.GOOS != "windows" {
		return ""
	}
	base := os.Getenv("ProgramData")
	if base == "" {
		base = `C:\ProgramData`
	}
	data, err := os.ReadFile(base + `\netMan-agent\vnc-password.txt`)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}
