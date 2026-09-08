//go:build linux

package telemetry

import (
	"os/exec"
	"syscall"
)

// Kill the entire command group, including su's child, on timeout/shutdown.
func configureMonitoringCommand(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
}
