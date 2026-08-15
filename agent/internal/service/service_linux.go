//go:build !windows

// Package service adapts main's run loop to the host OS's service model.
// On Linux, systemd owns the process lifecycle (see scripts/netman-agent.service,
// Restart=always) — the binary just needs to exit cleanly on SIGTERM.
package service

import (
	"os"
	"os/signal"
	"syscall"
)

func Run(_ string, run func(stop <-chan struct{})) {
	stop := make(chan struct{})
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		close(stop)
	}()

	run(stop)
}
