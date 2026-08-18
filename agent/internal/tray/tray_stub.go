//go:build !windows

package tray

import "fmt"

func Run() error {
	return fmt.Errorf("system tray is only supported on Windows")
}
