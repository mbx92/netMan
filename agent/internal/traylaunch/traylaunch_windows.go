//go:build windows

// Package traylaunch starts the user-session tray helper from the SYSTEM
// service so a logged-in desktop gets the icon without waiting for the next
// logon (HKLM Run still covers subsequent logons).
package traylaunch

import (
	"log"
	"os"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	wtsapi32                    = windows.NewLazySystemDLL("wtsapi32.dll")
	kernel32                    = windows.NewLazySystemDLL("kernel32.dll")
	userenv                     = windows.NewLazySystemDLL("userenv.dll")
	procWTSGetActiveConsole     = kernel32.NewProc("WTSGetActiveConsoleSessionId")
	procWTSQueryUserToken       = wtsapi32.NewProc("WTSQueryUserToken")
	procCreateEnvironmentBlock  = userenv.NewProc("CreateEnvironmentBlock")
	procDestroyEnvironmentBlock = userenv.NewProc("DestroyEnvironmentBlock")
	user32                      = windows.NewLazySystemDLL("user32.dll")
	procFindWindow              = user32.NewProc("FindWindowW")
)

func TryStart() {
	sessionID, _, _ := procWTSGetActiveConsole.Call()
	if sessionID == 0xFFFFFFFF || sessionID == 0 {
		return
	}

	className, err := windows.UTF16PtrFromString("NetManAgentTray")
	if err == nil {
		if h, _, _ := procFindWindow.Call(uintptr(unsafe.Pointer(className)), 0); h != 0 {
			return
		}
	}

	var token windows.Token
	r, _, err := procWTSQueryUserToken.Call(sessionID, uintptr(unsafe.Pointer(&token)))
	if r == 0 {
		log.Printf("[agent] tray launch skipped (no interactive token): %v", err)
		return
	}
	defer token.Close()

	exe, err := os.Executable()
	if err != nil {
		return
	}

	var env *uint16
	if r, _, _ := procCreateEnvironmentBlock.Call(uintptr(unsafe.Pointer(&env)), uintptr(token), 0); r != 0 {
		defer procDestroyEnvironmentBlock.Call(uintptr(unsafe.Pointer(env)))
	}

	cmdLine, err := windows.UTF16PtrFromString(`"` + exe + `" -tray`)
	if err != nil {
		return
	}
	appName, err := windows.UTF16PtrFromString(exe)
	if err != nil {
		return
	}
	desktop, err := windows.UTF16PtrFromString(`winsta0\default`)
	if err != nil {
		return
	}

	var si windows.StartupInfo
	si.Cb = uint32(unsafe.Sizeof(si))
	si.Desktop = desktop
	var pi windows.ProcessInformation

	const createUnicodeEnv = 0x00000400
	const detached = 0x00000008
	const createNoWindow = 0x08000000

	err = windows.CreateProcessAsUser(
		token,
		appName,
		cmdLine,
		nil,
		nil,
		false,
		createUnicodeEnv|detached|createNoWindow,
		env,
		nil,
		&si,
		&pi,
	)
	if err != nil {
		log.Printf("[agent] tray launch failed: %v", err)
		return
	}
	_ = windows.CloseHandle(pi.Thread)
	_ = windows.CloseHandle(pi.Process)
}
