//go:build windows

package update

import (
	"log"
	"os"

	"golang.org/x/sys/windows/svc"
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
	oldPath := exe + ".old"
	_ = os.Remove(oldPath)
	if err := os.Rename(exe, oldPath); err != nil {
		_ = os.Remove(newPath)
		return err
	}
	if err := os.Rename(newPath, exe); err != nil {
		_ = os.Rename(oldPath, exe)
		return err
	}
	return nil
}

func restartProcess() {
	isSvc, err := svc.IsWindowsService()
	if err == nil && isSvc {
		log.Printf("[agent] update applied; exiting so SCM restarts the new binary")
		os.Exit(1)
	}
	log.Printf("[agent] update applied; restart netman-agent to run the new binary")
	os.Exit(0)
}

func notifyUpdateReady(version string) {
	broadcastToTrays(map[string]string{
		"type":    "update-available",
		"version": version,
	})
}
