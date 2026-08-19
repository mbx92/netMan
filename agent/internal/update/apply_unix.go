//go:build !windows

package update

import (
	"log"
	"os"
)

func replaceExecutable(staged string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	newPath := exe + ".new"
	data, err := os.ReadFile(staged)
	if err != nil {
		return err
	}
	if err := os.WriteFile(newPath, data, 0755); err != nil {
		return err
	}
	return os.Rename(newPath, exe)
}

func restartProcess() {
	log.Printf("[agent] update applied; exiting so the supervisor starts the new binary")
	os.Exit(0)
}

func notifyUpdateReady(version string) {
	log.Printf("[agent] update %s ready (will apply automatically)", version)
}

func afterApply(m *Manager, version string) {
	log.Printf("[agent] update %s applied; exiting so the supervisor starts the new binary", version)
	m.signalExit()
	restartProcess()
}
