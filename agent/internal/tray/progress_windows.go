//go:build windows

package tray

import (
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	wmShowProgress = wmUser + 10

	wsVisible      = 0x10000000
	wsCaption      = 0x00C00000
	wsSysMenu      = 0x00080000
	wsChild        = 0x40000000
	wsOverlapped   = 0x00000000
	ssLeft         = 0x00000000
	pbsSmooth      = 0x00000001
	pbsMarquee     = 0x00000008
	iccProgress    = 0x00000020
	wmSetFont      = 0x0030
	wmClose        = 0x0010
	wmCtlColorSt   = 0x0138
	colorWindow    = 5
	defaultGUIFont = 17
	swShow         = 5
	swRestore      = 9

	pbmSetPos     = wmUser + 2
	pbmSetRange32 = wmUser + 6
	pbmSetMarquee = wmUser + 10

	idStatus = 100
	idBar    = 101
)

type initCommonControlsEx struct {
	Size uint32
	Icc  uint32
}

type rect struct {
	Left, Top, Right, Bottom int32
}

var (
	gdi32    = windows.NewLazySystemDLL("gdi32.dll")
	comctl32 = windows.NewLazySystemDLL("comctl32.dll")

	procPostMessage          = user32.NewProc("PostMessageW")
	procDestroyWindow        = user32.NewProc("DestroyWindow")
	procSetWindowText        = user32.NewProc("SetWindowTextW")
	procSendMessage          = user32.NewProc("SendMessageW")
	procGetClientRect        = user32.NewProc("GetClientRect")
	procMoveWindow           = user32.NewProc("MoveWindow")
	procGetSystemMetrics     = user32.NewProc("GetSystemMetrics")
	procGetStockObject       = gdi32.NewProc("GetStockObject")
	procGetSysColorBrush     = user32.NewProc("GetSysColorBrush")
	procInitCommonControlsEx = comctl32.NewProc("InitCommonControlsEx")
	procSetForegroundWnd     = user32.NewProc("SetForegroundWindow")
	procUpdateWindow         = user32.NewProc("UpdateWindow")

	progMu         sync.Mutex
	progPhase      string
	progPct        int
	progText       string
	progCanClose   bool
	progressWanted bool

	progressClassOnce sync.Once
	hProgress         windows.HWND
	hStatus           windows.HWND
	hBar              windows.HWND
	hFont             uintptr
	progressClass     *uint16
	progressWndProcCb uintptr
)

func postProgress(phase string, percent int, text string) {
	progMu.Lock()
	progPhase = phase
	progPct = percent
	progText = text
	progCanClose = phase == "complete" || phase == "failed"
	if phase != "downloading" {
		progressWanted = true
	}
	wanted := progressWanted
	progMu.Unlock()
		if !wanted || hwnd == 0 {
			return
		}
		procPostMessage.Call(uintptr(hwnd), wmShowPanel, 0, 0)
}

func beginUpdateUI() {
	postProgress("preparing", -1, "Preparing update…")
}

func ensureProgressWindow() {
	progressClassOnce.Do(func() {
		icc := initCommonControlsEx{Icc: iccProgress}
		icc.Size = uint32(unsafe.Sizeof(icc))
		procInitCommonControlsEx.Call(uintptr(unsafe.Pointer(&icc)))
		progressClass, _ = windows.UTF16PtrFromString("NetManAgentUpdate")
		progressWndProcCb = windows.NewCallback(progressWndProc)
		instance, _, _ := procGetModuleHandle.Call(0)
		wc := wndClassEx{
			LpfnWndProc:   progressWndProcCb,
			HInstance:     windows.Handle(instance),
			HbrBackground: windows.Handle(mustSysColorBrush()),
			LpszClassName: progressClass,
			HIcon:         windows.Handle(hIcon),
		}
		wc.CbSize = uint32(unsafe.Sizeof(wc))
		procRegisterClassEx.Call(uintptr(unsafe.Pointer(&wc)))
		hFont, _, _ = procGetStockObject.Call(defaultGUIFont)
	})

	if hProgress != 0 {
		procShowWindow.Call(uintptr(hProgress), swRestore)
		procSetForegroundWnd.Call(uintptr(hProgress))
		applyProgressUI()
		return
	}

	title, _ := windows.UTF16PtrFromString("netMan Agent Update")
	instance, _, _ := procGetModuleHandle.Call(0)
	const w, h = 440, 160
	x, y := centerPos(w, h)
	style := uintptr(wsOverlapped | wsCaption | wsSysMenu | wsVisible)
	hwndNew, _, _ := procCreateWindowEx.Call(0, uintptr(unsafe.Pointer(progressClass)), uintptr(unsafe.Pointer(title)), style, uintptr(x), uintptr(y), w, h, 0, 0, instance, 0)
	if hwndNew == 0 {
		return
	}
	hProgress = windows.HWND(hwndNew)

	staticClass, _ := windows.UTF16PtrFromString("STATIC")
	barClass, _ := windows.UTF16PtrFromString("msctls_progress32")
	empty, _ := windows.UTF16PtrFromString("")

	st, _, _ := procCreateWindowEx.Call(0, uintptr(unsafe.Pointer(staticClass)), uintptr(unsafe.Pointer(empty)), wsChild|wsVisible|ssLeft, 16, 16, 400, 48, hwndNew, idStatus, instance, 0)
	hStatus = windows.HWND(st)
	bar, _, _ := procCreateWindowEx.Call(0, uintptr(unsafe.Pointer(barClass)), 0, wsChild|wsVisible|pbsSmooth|pbsMarquee, 16, 80, 400, 18, hwndNew, idBar, instance, 0)
	hBar = windows.HWND(bar)

	if hFont != 0 && st != 0 {
		procSendMessage.Call(st, wmSetFont, hFont, 1)
	}
	layoutProgress(hProgress)
	applyProgressUI()
	procShowWindow.Call(hwndNew, swShow)
	procUpdateWindow.Call(hwndNew)
	procSetForegroundWnd.Call(hwndNew)
	go request("progress-ack")
}

func layoutProgress(hwnd windows.HWND) {
	var rc rect
	procGetClientRect.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&rc)))
	width := rc.Right - rc.Left
	if hStatus != 0 {
		procMoveWindow.Call(uintptr(hStatus), 16, 16, uintptr(width-32), 48, 1)
	}
	if hBar != 0 {
		procMoveWindow.Call(uintptr(hBar), 16, uintptr(rc.Bottom-40), uintptr(width-32), 18, 1)
	}
}

func applyProgressUI() {
	progMu.Lock()
	text := progText
	pct := progPct
	canClose := progCanClose
	progMu.Unlock()
	if text == "" {
		text = "Updating netMan Agent…"
	}
	if hStatus != 0 {
		p, _ := windows.UTF16PtrFromString(text)
		procSetWindowText.Call(uintptr(hStatus), uintptr(unsafe.Pointer(p)))
	}
	if hBar != 0 {
		if pct < 0 {
			procSendMessage.Call(uintptr(hBar), pbmSetMarquee, 1, 80)
		} else {
			procSendMessage.Call(uintptr(hBar), pbmSetMarquee, 0, 0)
			procSendMessage.Call(uintptr(hBar), pbmSetRange32, 0, 100)
			procSendMessage.Call(uintptr(hBar), pbmSetPos, uintptr(pct), 0)
		}
	}
	if hProgress != 0 && canClose {
		procShowWindow.Call(uintptr(hProgress), swShow)
	}
}

func progressWndProc(hwnd windows.HWND, msg uint32, wParam, lParam uintptr) uintptr {
	switch msg {
	case 0x0005: // WM_SIZE
		layoutProgress(hwnd)
		return 0
	case wmCtlColorSt:
		br, _, _ := procGetSysColorBrush.Call(colorWindow)
		return br
	case wmClose:
		progMu.Lock()
		ok := progCanClose
		phase := progPhase
		progMu.Unlock()
		if !ok {
			return 0
		}
		finishUpdateAndQuit(phase)
		return 0
	case wmDestroy:
		hProgress = 0
		hStatus = 0
		hBar = 0
		return 0
	}
	r, _, _ := procDefWindowProc.Call(uintptr(hwnd), uintptr(msg), wParam, lParam)
	return r
}

func finishUpdateAndQuit(phase string) {
	if phase == "complete" {
		go request("restart")
	}
	if hProgress != 0 {
		procDestroyWindow.Call(uintptr(hProgress))
	}
	procPostQuit.Call(0)
}

func centerPos(w, h int) (x, y uintptr) {
	cx, _, _ := procGetSystemMetrics.Call(0)
	cy, _, _ := procGetSystemMetrics.Call(1)
	x = uintptr((int(cx) - w) / 2)
	y = uintptr((int(cy) - h) / 2)
	return
}

func mustSysColorBrush() uintptr {
	br, _, _ := procGetSysColorBrush.Call(colorWindow)
	return br
}
