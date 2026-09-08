//go:build !linux

package telemetry

import "os/exec"

func configureMonitoringCommand(cmd *exec.Cmd) {}
