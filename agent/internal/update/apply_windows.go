//go:build windows

package update

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
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

func notifyUpdateReady(version string) {
	broadcastToTrays(map[string]string{
		"type":    "update-available",
		"version": version,
	})
}

func afterApply(m *Manager, version string) {
	notifyProgress("complete", 100, "Update to v"+version+" installed. Close this window to restart the netMan agent service.")
	waitForWindow := false
	select {
	case <-m.ackCh:
		waitForWindow = true
	case <-time.After(2 * time.Second):
	}
	if waitForWindow {
		log.Printf("[agent] update %s installed; waiting for tray window close to restart service", version)
		select {
		case <-m.restartCh:
		case <-time.After(2 * time.Minute):
			log.Printf("[agent] restart wait timed out; restarting service")
		}
		time.Sleep(500 * time.Millisecond)
	}
	// Drop leftover tray processes (including v0.6.0 trays that never quit)
	// so the restarted service can launch a tray from the new binary.
	terminateOtherAgentProcesses()

	isSvc, err := svc.IsWindowsService()
	if err == nil && isSvc {
		log.Printf("[agent] update applied; exiting so SCM restarts the new binary")
		os.Exit(1)
	}
	log.Printf("[agent] update applied; exiting so the new binary can be started")
	os.Exit(0)
}

func terminateOtherAgentProcesses() {
	self := uint32(os.Getpid())
	exe, err := os.Executable()
	if err != nil {
		return
	}
	want := strings.ToLower(filepath.Base(exe))
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return
	}
	defer windows.CloseHandle(snap)

	var e windows.ProcessEntry32
	e.Size = uint32(unsafe.Sizeof(e))
	if err := windows.Process32First(snap, &e); err != nil {
		return
	}
	for {
		name := strings.ToLower(windows.UTF16ToString(e.ExeFile[:]))
		if e.ProcessID != self && name == want {
			h, err := windows.OpenProcess(windows.PROCESS_TERMINATE, false, e.ProcessID)
			if err == nil {
				_ = windows.TerminateProcess(h, 1)
				_ = windows.CloseHandle(h)
				log.Printf("[agent] stopped leftover agent process pid %d", e.ProcessID)
			}
		}
		if err := windows.Process32Next(snap, &e); err != nil {
			break
		}
	}
}
