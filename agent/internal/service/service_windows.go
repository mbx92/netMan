//go:build windows

// Package service adapts main's run loop to the Windows Service Control
// Manager when running as an installed service, or to a plain foreground
// process (Ctrl+C to stop) when run interactively for testing.
package service

import (
	"log"
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
	stoppedBySCM := false

	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("[agent] service panic: %v", rec)
			}
			close(done)
		}()
		s.run(stop)
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
				stoppedBySCM = true
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
	if !stoppedBySCM {
		// Exit 1 so SCM recovery (restart) runs. Exit 0 is a clean stop
		// and leaves the agent offline until someone starts the service.
		log.Printf("[agent] worker exited unexpectedly; requesting SCM restart")
		return false, 1
	}
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
