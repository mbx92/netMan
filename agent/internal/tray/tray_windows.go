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
	"github.com/netman/agent/internal/client"
	"golang.org/x/sys/windows"
)

const (
	pipeName = `\\.\pipe\netman-agent`
	wmUser   = 0x0400
	wmTray   = wmUser + 1
	nidID    = 1

	wmDestroy       = 0x0002
	wmCommand       = 0x0111
	wmContextMenu   = 0x007B
	wmLButtonDown   = 0x0201
	wmLButtonUp     = 0x0202
	wmLButtonDblClk = 0x0203
	wmRButtonDown   = 0x0204
	wmRButtonUp     = 0x0205
	wmNull          = 0x0000

	ninSelect    = wmUser     // NOTIFYICON_VERSION_4 left click
	ninKeySelect = wmUser + 1 // keyboard activate

	wsPopup        = 0x80000000
	wsExToolwindow = 0x00000080
	wsExTopmost    = 0x00000008
	swShowNA       = 8

	nimAdd        = 0
	nimModify     = 1
	nimDelete     = 2
	nimSetVersion = 4
	notifyIconV4  = 4

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
	cmdOpen   = 4
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
	procGetModuleHandle          = kernel32.NewProc("GetModuleHandleW")
	procFindWindow               = user32.NewProc("FindWindowW")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
	procSetWindowPos             = user32.NewProc("SetWindowPos")

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
	closeStaleTray()
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

	// A real (off-screen) popup is required so SetForegroundWindow works.
	// HWND_MESSAGE / 0×0 hidden windows never own the tray menu on Win11.
	h, _, err := procCreateWindowEx.Call(
		wsExToolwindow|wsExTopmost,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(className)),
		wsPopup,
		uintptr(int32(-10000)),
		uintptr(int32(-10000)),
		1, 1,
		0, 0, instance, 0,
	)
	if h == 0 {
		return err
	}
	hwnd = windows.HWND(h)
	procShowWindow.Call(h, swShowNA)

	hIcon = loadIcon()
	if err := notify(nimAdd, "", ""); err != nil {
		return err
	}
	notifySetVersion()
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
		switch lParam & 0xFFFF {
		case wmLButtonUp, wmLButtonDblClk, ninSelect, ninKeySelect:
			showStatusWindow()
		case wmRButtonUp, wmRButtonDown, wmContextMenu:
			showMenu(hwnd)
		case ninBalloonUserClick:
			showStatusWindow()
			beginUpdateUI()
			go request("apply")
		}
		return 0
	case wmCommand:
		handleTrayCommand(uint16(wParam))
		return 0
	case wmDestroy:
		procPostQuit.Call(0)
		return 0
	case wmShowProgress:
		ensureStatusWindow()
		return 0
	case wmShowPanel:
		ensureStatusWindow()
		return 0
	case wmRefreshPanel:
		applyPanelUI()
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
	ip := client.DetectLocalIP()
	if ip == "" {
		ip = "unknown"
	}
	appendMenu(h, mfString|mfGrayed, 0, "IP  "+ip)
	appendMenu(h, mfSeparator, 0, "")
	appendMenu(h, mfString, cmdOpen, "Open netMan Agent")
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
	const swpNoSize = 0x0001
	const swpShowWindow = 0x0040
	const hwndTopmost = ^uintptr(0) // HWND_TOPMOST = -1
	procSetWindowPos.Call(uintptr(hwnd), hwndTopmost, uintptr(pt.X), uintptr(pt.Y), 0, 0, swpNoSize|swpShowWindow)
	procSetForeground.Call(uintptr(hwnd))
	const tpmRightAlign = 0x0008
	const tpmBottomAlign = 0x0020
	const tpmNoNotify = 0x0080
	const tpmReturnCmd = 0x0100
	cmd, _, _ := procTrackPopupMenu.Call(
		h,
		tpmRightAlign|tpmBottomAlign|tpmNoNotify|tpmReturnCmd,
		uintptr(pt.X), uintptr(pt.Y),
		0, uintptr(hwnd), 0,
	)
	procPostMessage.Call(uintptr(hwnd), wmNull, 0, 0)
	if cmd != 0 {
		handleTrayCommand(uint16(cmd))
	}
}

func handleTrayCommand(id uint16) {
	switch id {
	case cmdOpen:
		showStatusWindow()
	case cmdUpdate:
		beginUpdateUI()
		go request("apply")
	case cmdCheck:
		go request("check")
	case cmdQuit:
		progMu.Lock()
		phase := progPhase
		can := progCanClose
		progMu.Unlock()
		if can && phase == "complete" {
			finishUpdateAndQuit(phase)
			return
		}
		procPostQuit.Call(0)
	}
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

func notifySetVersion() {
	nid := notifyIconData{
		Wnd:     uintptr(hwnd),
		ID:      nidID,
		Timeout: notifyIconV4,
	}
	nid.Size = uint32(unsafe.Sizeof(nid))
	_, _, _ = procShellNotifyIcon.Call(nimSetVersion, uintptr(unsafe.Pointer(&nid)))
}

func closeStaleTray() {
	className, err := windows.UTF16PtrFromString("NetManAgentTray")
	if err != nil {
		return
	}
	h, _, _ := procFindWindow.Call(uintptr(unsafe.Pointer(className)), 0)
	if h == 0 {
		return
	}
	var pid uint32
	_, _, _ = procGetWindowThreadProcessId.Call(h, uintptr(unsafe.Pointer(&pid)))
	_, _, _ = procPostMessage.Call(h, wmClose, 0, 0)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		h2, _, _ := procFindWindow.Call(uintptr(unsafe.Pointer(className)), 0)
		if h2 == 0 {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	if pid == 0 || pid == uint32(os.Getpid()) {
		return
	}
	ph, err := windows.OpenProcess(windows.PROCESS_TERMINATE, false, pid)
	if err != nil {
		return
	}
	_ = windows.TerminateProcess(ph, 1)
	_ = windows.CloseHandle(ph)
	log.Printf("[tray] stopped stale tray pid %d", pid)
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
	for i := 0; i < 15; i++ {
		h, err := windows.CreateMutex(nil, false, name)
		if err == windows.ERROR_ALREADY_EXISTS {
			if h != 0 {
				_ = windows.CloseHandle(h)
			}
			time.Sleep(200 * time.Millisecond)
			continue
		}
		return err == nil
	}
	return false
}

func pipeLoop() {
	for {
		conn, err := winio.DialPipe(pipeName, nil)
		if err != nil {
			markServiceDown()
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
		markServiceDown()
		time.Sleep(time.Second)
	}
}

func handleIPC(msg map[string]any) {
	typ, _ := msg["type"].(string)
	switch typ {
	case "status":
		setPanelFromIPC(msg)
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
				_ = notify(nimModify, "Update available", "netMan Agent v"+p+" is ready. Click to install.")
			}
		}
		refreshStatusWindow()
	case "update-available":
		ver, _ := msg["version"].(string)
		if ver == "" {
			return
		}
		pendingMu.Lock()
		pending = ver
		pendingMu.Unlock()
		panelMu.Lock()
		panel.pending = ver
		panelMu.Unlock()
		refreshStatusWindow()
		_ = notify(nimModify, "Update available", "netMan Agent v"+ver+" is ready. Click to install.")
	case "progress":
		phase, _ := msg["phase"].(string)
		text, _ := msg["message"].(string)
		percent := -1
		switch v := msg["percent"].(type) {
		case float64:
			percent = int(v)
		}
		if phase == "" {
			return
		}
		postProgress(phase, percent, text)
	}
}

func request(typ string) {
	timeout := 3 * time.Second
	if typ == "check" {
		timeout = 25 * time.Second
	}
	conn, err := winio.DialPipe(pipeName, &timeout)
	if err != nil {
		log.Printf("[tray] agent service not reachable: %v", err)
		markServiceDown()
		return
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(timeout))

	sc := bufio.NewScanner(conn)
	if sc.Scan() {
		var msg map[string]any
		if json.Unmarshal(sc.Bytes(), &msg) == nil {
			handleIPC(msg)
		}
	}
	if typ == "ping" || typ == "" {
		return
	}
	data, _ := json.Marshal(map[string]string{"type": typ})
	if _, err := conn.Write(append(data, '\n')); err != nil {
		return
	}
	if typ == "check" && sc.Scan() {
		var msg map[string]any
		if json.Unmarshal(sc.Bytes(), &msg) == nil {
			handleIPC(msg)
		}
	}
}
