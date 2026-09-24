//go:build !linux

package client

import "os/exec"

func configureZimbraSSLCommand(_ *exec.Cmd) {}
