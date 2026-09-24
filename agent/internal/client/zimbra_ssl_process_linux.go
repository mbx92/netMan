//go:build linux

package client

import (
	"os/exec"
	"syscall"
)

func configureZimbraSSLCommand(command *exec.Cmd) {
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	command.Cancel = func() error { return syscall.Kill(-command.Process.Pid, syscall.SIGKILL) }
}
