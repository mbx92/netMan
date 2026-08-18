//go:build windows

package tray

import (
	"bufio"
	"encoding/json"
	"log"
	"os"
	"sync"
	"time"
	"unsafe"

	"github.com/Microsoft/go-winio"
	"golang.org/x/sys/windows"
)

const (
	pipeName = `\\.\pipe\netman-agent`
	wmUser   = 0x0400
	wmTray   = wmUser + 1
	nidID    = 1

	wmDestroy   = 0x0002
	wmCommand   = 0x0111
	wmLButtonUp = 0x0202
	wmRButtonUp = 0x0205

	hwndMessage = ^windows.HWND(2) // HWND_MESSAGE

	nimAdd    = 0
	nimModify = 1
	nimDelete = 2

	nifMessage = 0x00000001
	nifIcon    = 0x00000002
	nifTip     = 0x00000004
	nifInfo    = 0x00000010

	niifInfo = 0x00000001

	ninBalloonUserClick = wmUser + 5

	imageIcon      = 1
	lrLoadFromFile = 0x00000010

	mfString    = 0x00000000
	mfGrayed    = 0x00000001
	mfSeparator = 0x00000800

	cmdUpdate = 1
	cmdCheck  = 2
	cmdQuit   = 3
)

type notifyIconData struct {
	Size            uint32
	Wnd             uintptr
	ID              uint32
	Flags           uint32
	CallbackMessage uint32
	Icon            uintptr
	Tip             [128]uint16
	State           uint32
	StateMask       uint32
	Info            [256]uint16
	Timeout         uint32
	InfoTitle       [64]uint16
	InfoFlags       uint32
	GuidItem        windows.GUID
	BalloonIcon     uintptr
}

var (
	shell32  = windows.NewLazySystemDLL("shell32.dll")
	user32   = windows.NewLazySystemDLL("user32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")

	procShellNotifyIcon = shell32.NewProc("Shell_NotifyIconW")
	procLoadImage       = user32.NewProc("LoadImageW")
	procCreatePopupMenu = user32.NewProc("CreatePopupMenu")
	procAppendMenu      = user32.NewProc("AppendMenuW")
	procTrackPopupMenu  = user32.NewProc("TrackPopupMenu")
	procDestroyMenu     = user32.NewProc("DestroyMenu")
	procGetCursorPos    = user32.NewProc("GetCursorPos")
	procSetForeground   = user32.NewProc("SetForegroundWindow")
	procDefWindowProc   = user32.NewProc("DefWindowProcW")
	procGetConsoleWnd   = kernel32.NewProc("GetConsoleWindow")
	procShowWindow      = user32.NewProc("ShowWindow")
	procPostQuit        = user32.NewProc("PostQuitMessage")
	procRegisterClassEx = user32.NewProc("RegisterClassExW")
	procCreateWindowEx  = user32.NewProc("CreateWindowExW")
	procGetMessage      = user32.NewProc("GetMessageW")
	procTranslateMsg    = user32.NewProc("TranslateMessage")
	procDispatchMsg     = user32.NewProc("DispatchMessageW")
	procGetModuleHandle = kernel32.NewProc("GetModuleHandleW")

	hwnd      windows.HWND
	hIcon     uintptr
	pendingMu sync.Mutex
	pending   string
	current   = "0.0.0"
)

type point struct{ X, Y int32 }

type wndClassEx struct {
	CbSize        uint32
	Style         uint32
	LpfnWndProc   uintptr
	CbClsExtra    int32
	CbWndExtra    int32
	HInstance     windows.Handle
	HIcon         windows.Handle
	HCursor       windows.Handle
	HbrBackground windows.Handle
	LpszMenuName  *uint16
	LpszClassName *uint16
	HIconSm       windows.Handle
}

type winMsg struct {
	Hwnd    windows.HWND
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      point
}

func Run() error {
	hideConsole()
	if !singleInstance() {
		return nil
	}

	className, err := windows.UTF16PtrFromString("NetManAgentTray")
	if err != nil {
		return err
	}
	instance, _, _ := procGetModuleHandle.Call(0)
	wndProc := windows.NewCallback(trayWndProc)
	wc := wndClassEx{
		LpfnWndProc:   wndProc,
		HInstance:     windows.Handle(instance),
		LpszClassName: className,
	}
	wc.CbSize = uint32(unsafe.Sizeof(wc))
	if atom, _, err := procRegisterClassEx.Call(uintptr(unsafe.Pointer(&wc))); atom == 0 {
		return err
	}

	h, _, err := procCreateWindowEx.Call(0, uintptr(unsafe.Pointer(className)), uintptr(unsafe.Pointer(className)), 0, 0, 0, 0, 0, uintptr(hwndMessage), 0, instance, 0)
	if h == 0 {
		return err
	}
	hwnd = windows.HWND(h)

	hIcon = loadIcon()
	if err := notify(nimAdd, "", ""); err != nil {
		return err
	}
	defer notify(nimDelete, "", "")

	go pipeLoop()

	var msg winMsg
	for {
		r, _, _ := procGetMessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if int32(r) <= 0 {
			break
		}
		procTranslateMsg.Call(uintptr(unsafe.Pointer(&msg)))
		procDispatchMsg.Call(uintptr(unsafe.Pointer(&msg)))
	}
	return nil
}

func trayWndProc(hwnd windows.HWND, msg uint32, wParam, lParam uintptr) uintptr {
	switch msg {
	case wmTray:
		switch lParam {
		case wmLButtonUp, wmRButtonUp:
			showMenu(hwnd)
		case ninBalloonUserClick:
			request("apply")
		}
		return 0
	case wmCommand:
		switch uint16(wParam) {
		case cmdUpdate:
			request("apply")
		case cmdCheck:
			request("check")
		case cmdQuit:
			procPostQuit.Call(0)
		}
		return 0
	case wmDestroy:
		procPostQuit.Call(0)
		return 0
	}
	r, _, _ := procDefWindowProc.Call(uintptr(hwnd), uintptr(msg), wParam, lParam)
	return r
}

func showMenu(hwnd windows.HWND) {
	h, _, _ := procCreatePopupMenu.Call()
	if h == 0 {
		return
	}
	defer procDestroyMenu.Call(h)

	pendingMu.Lock()
	p := pending
	ver := current
	pendingMu.Unlock()

	appendMenu(h, mfString|mfGrayed, 0, "netMan Agent v"+ver)
	appendMenu(h, mfSeparator, 0, "")
	if p != "" {
		appendMenu(h, mfString, cmdUpdate, "Update to v"+p)
	} else {
		appendMenu(h, mfString|mfGrayed, cmdUpdate, "No update available")
	}
	appendMenu(h, mfString, cmdCheck, "Check for updates")
	appendMenu(h, mfSeparator, 0, "")
	appendMenu(h, mfString, cmdQuit, "Quit tray")

	var pt point
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
	procSetForeground.Call(uintptr(hwnd))
	const tpmRightAlign = 0x0008
	const tpmBottomAlign = 0x0020
	const tpmRightButton = 0x0002
	procTrackPopupMenu.Call(h, tpmRightAlign|tpmBottomAlign|tpmRightButton, uintptr(pt.X), uintptr(pt.Y), 0, uintptr(hwnd), 0)
}

func appendMenu(h uintptr, flags uintptr, id uintptr, text string) {
	p, _ := windows.UTF16PtrFromString(text)
	procAppendMenu.Call(h, flags, id, uintptr(unsafe.Pointer(p)))
}

func notify(action uint32, title, info string) error {
	nid := notifyIconData{
		Wnd:             uintptr(hwnd),
		ID:              nidID,
		Flags:           nifMessage | nifIcon | nifTip,
		CallbackMessage: wmTray,
		Icon:            hIcon,
	}
	nid.Size = uint32(unsafe.Sizeof(nid))
	utf16Copy(nid.Tip[:], "netMan Agent")
	if title != "" || info != "" {
		nid.Flags |= nifInfo
		nid.InfoFlags = niifInfo
		utf16Copy(nid.InfoTitle[:], title)
		utf16Copy(nid.Info[:], info)
	}
	r, _, err := procShellNotifyIcon.Call(uintptr(action), uintptr(unsafe.Pointer(&nid)))
	if r == 0 {
		return err
	}
	return nil
}

func utf16Copy(dst []uint16, s string) {
	u, _ := windows.UTF16FromString(s)
	n := len(u)
	if n > len(dst) {
		n = len(dst)
		u[n-1] = 0
	}
	copy(dst, u[:n])
}

func loadIcon() uintptr {
	path := os.TempDir() + `\netman-agent-tray.ico`
	_ = os.WriteFile(path, iconBytes, 0644)
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0
	}
	h, _, _ := procLoadImage.Call(0, uintptr(unsafe.Pointer(p)), imageIcon, 16, 16, lrLoadFromFile)
	return h
}

func hideConsole() {
	hwnd, _, _ := procGetConsoleWnd.Call()
	if hwnd != 0 {
		procShowWindow.Call(hwnd, 0)
	}
}

func singleInstance() bool {
	name, _ := windows.UTF16PtrFromString(`Global\NetManAgentTray`)
	_, err := windows.CreateMutex(nil, true, name)
	if err == windows.ERROR_ALREADY_EXISTS {
		return false
	}
	return true
}

func pipeLoop() {
	for {
		conn, err := winio.DialPipe(pipeName, nil)
		if err != nil {
			time.Sleep(2 * time.Second)
			continue
		}
		sc := bufio.NewScanner(conn)
		for sc.Scan() {
			var msg map[string]any
			if json.Unmarshal(sc.Bytes(), &msg) != nil {
				continue
			}
			handleIPC(msg)
		}
		_ = conn.Close()
		time.Sleep(time.Second)
	}
}

func handleIPC(msg map[string]any) {
	typ, _ := msg["type"].(string)
	switch typ {
	case "status":
		if v, ok := msg["version"].(string); ok && v != "" {
			pendingMu.Lock()
			current = v
			if p, ok := msg["pending"].(string); ok {
				pending = p
			} else {
				pending = ""
			}
			p := pending
			pendingMu.Unlock()
			if p != "" {
				_ = notify(nimModify, "Update available", "netMan Agent v"+p+" is ready. Click to install silently.")
			}
		}
	case "update-available":
		ver, _ := msg["version"].(string)
		if ver == "" {
			return
		}
		pendingMu.Lock()
		pending = ver
		pendingMu.Unlock()
		_ = notify(nimModify, "Update available", "netMan Agent v"+ver+" is ready. Click to install silently.")
	}
}

func request(typ string) {
	timeout := 2 * time.Second
	conn, err := winio.DialPipe(pipeName, &timeout)
	if err != nil {
		log.Printf("[tray] agent service not reachable: %v", err)
		return
	}
	defer conn.Close()
	data, _ := json.Marshal(map[string]string{"type": typ})
	_, _ = conn.Write(append(data, '\n'))
}
