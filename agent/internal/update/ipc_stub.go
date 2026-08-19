//go:build !windows

package update

func ipcServe(_ *Manager, _ <-chan struct{}) {}

func pushTrayStatus(_ *Manager) {}

func notifyProgress(_ string, _ int, _ string) {}
