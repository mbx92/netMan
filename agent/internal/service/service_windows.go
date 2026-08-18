//go:build windows

// Package service adapts main's run loop to the Windows Service Control
// Manager when running as an installed service, or to a plain foreground
// process (Ctrl+C to stop) when run interactively for testing.
package service

import (
	"os"
	"os/signal"

	"golang.org/x/sys/windows/svc"
)

type winService struct {
	run func(stop <-chan struct{})
}

func (s *winService) Execute(_ []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (svcSpecificEC bool, exitCode uint32) {
	changes <- svc.Status{State: svc.StartPending}

	stop := make(chan struct{})
	done := make(chan struct{})

	go func() {
		s.run(stop)
		close(done)
	}()

	changes <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}

loop:
	for {
		select {
		case req := <-r:
			switch req.Cmd {
			case svc.Interrogate:
				changes <- req.CurrentStatus
			case svc.Stop, svc.Shutdown:
				changes <- svc.Status{State: svc.StopPending}
				close(stop)
				break loop
			}
		case <-done:
			break loop
		}
	}

	<-done
	changes <- svc.Status{State: svc.Stopped}
	return false, 0
}

func Run(name string, run func(stop <-chan struct{})) {
	isService, err := svc.IsWindowsService()
	if err != nil || !isService {
		// Interactive/dev run — behave like Linux: block until Ctrl+C.
		stop := make(chan struct{})
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt)
		go func() {
			<-sigCh
			close(stop)
		}()
		run(stop)
		return
	}

	_ = svc.Run(name, &winService{run: run})
}
