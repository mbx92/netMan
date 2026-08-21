//go:build windows

package tray

import (
	"strings"
	"sync"
	"unsafe"

	"github.com/netman/agent/internal/client"
	"golang.org/x/sys/windows"
)

const (
	wmShowPanel    = wmUser + 11
	wmRefreshPanel = wmUser + 12

	idBtnRestart = 200
	idBtnUpdate  = 201
	idBtnCheck   = 202
	idBarPanel   = 203

	idValStatus  = 310
	idValVersion = 311
	idValServer  = 312
	idValAgent   = 313
	idValHost    = 314
	idValOS      = 315
	idValIP      = 316
	idValMAC     = 317
	idValMem     = 318
	idValDisk    = 319
	idValPrint   = 320
	idValNote    = 321

	bsOwnerDraw    = 0x0000000B
	wsMinimizeBox  = 0x00020000
	wmDrawItem     = 0x002B
	wmTimer        = 0x0113
	wmEraseBkgnd   = 0x0014
	colorBtnFace   = 15
	transparentBk  = 1
	dtCenter       = 0x00000001
	dtVCenter      = 0x00000004
	dtSingleLine   = 0x00000020
	dtEndEllipsis  = 0x00008000
	dtNoClip       = 0x00000100
	odsSelected    = 0x0001
	odsDisabled    = 0x0004
	fwLight    = 300
	fwRegular  = 400
	panelTimerID = 1
)

// COLORREF is 0x00BBGGRR
const (
	clrBlue     = 0x00FE620F // #0f62fe
	clrBlueHov  = 0x00E65000 // #0050e6
	clrInk      = 0x00161616
	clrMuted    = 0x00525252
	clrSubtle   = 0x008C8C8C
	clrCanvas   = 0x00FFFFFF
	clrSurface  = 0x00F4F4F4
	clrHairline = 0x00E0E0E0
	clrSuccess  = 0x0048A124 // #24a148
	clrError    = 0x00281EDA // #da1e28
	clrWhite    = 0x00FFFFFF
)

type drawItem struct {
	CtlType    uint32
	CtlID      uint32
	ItemID     uint32
	ItemAction uint32
	ItemState  uint32
	HwndItem   windows.HWND
	HDC        uintptr
	RcItem     rect
	ItemData   uintptr
}

type panelInfo struct {
	serviceOK bool
	connected bool
	lastError string
	version   string
	pending   string
	message   string
	hostname  string
	osVersion string
	localIP   string
	mac       string
	agentID   string
	serverURL string
	disks     string
	memory    string
	printers  string
}

var (
	procCreateFont      = gdi32.NewProc("CreateFontW")
	procCreateSolidBr   = gdi32.NewProc("CreateSolidBrush")
	procDeleteObject    = gdi32.NewProc("DeleteObject")
	procFillRect        = user32.NewProc("FillRect")
	procFrameRect       = user32.NewProc("FrameRect")
	procSetTextColor    = gdi32.NewProc("SetTextColor")
	procSetBkMode       = gdi32.NewProc("SetBkMode")
	procDrawText        = user32.NewProc("DrawTextW")
	procSelectObject    = gdi32.NewProc("SelectObject")
	procEnableWindow    = user32.NewProc("EnableWindow")
	procInvalidateRect  = user32.NewProc("InvalidateRect")
	procSetTimer        = user32.NewProc("SetTimer")
	procKillTimer       = user32.NewProc("KillTimer")
	procGetDlgCtrlID    = user32.NewProc("GetDlgCtrlID")
	procBeginPaint      = user32.NewProc("BeginPaint")
	procEndPaint        = user32.NewProc("EndPaint")

	panelMu       sync.Mutex
	panel         panelInfo
	hPanel        windows.HWND
	hBtnRestart   windows.HWND
	hBtnUpdate    windows.HWND
	hBtnCheck     windows.HWND
	hBarPanel     windows.HWND
	hVal          = map[int]windows.HWND{}
	panelClass    *uint16
	panelWndProcCb uintptr
	panelClassOnce sync.Once
	hFontTitle    uintptr
	hFontBody     uintptr
	hFontSmall    uintptr
	hBrCanvas     uintptr
	hBrSurface    uintptr
	hBrBlue       uintptr
	hBrBlueHov    uintptr
	hBrHairline   uintptr
	hBrInk        uintptr
)

func showStatusWindow() {
	if hwnd == 0 {
		return
	}
	procPostMessage.Call(uintptr(hwnd), wmShowPanel, 0, 0)
}

func refreshStatusWindow() {
	if hwnd == 0 {
		return
	}
	procPostMessage.Call(uintptr(hwnd), wmRefreshPanel, 0, 0)
}

func setPanelFromIPC(msg map[string]any) {
	panelMu.Lock()
	defer panelMu.Unlock()
	panel.serviceOK = true
	panel.connected, _ = msg["connected"].(bool)
	panel.lastError = ipcString(msg["lastError"])
	if v := ipcString(msg["version"]); v != "" {
		panel.version = v
	}
	panel.pending = ipcString(msg["pending"])
	panel.message = ipcString(msg["message"])
	if v := ipcString(msg["hostname"]); v != "" {
		panel.hostname = v
	}
	if v := ipcString(msg["osVersion"]); v != "" {
		panel.osVersion = v
	}
	if v := ipcString(msg["localIp"]); v != "" {
		panel.localIP = v
	}
	if v := ipcString(msg["mac"]); v != "" {
		panel.mac = v
	}
	if v := ipcString(msg["agentId"]); v != "" {
		panel.agentID = v
	}
	if v := ipcString(msg["serverUrl"]); v != "" {
		panel.serverURL = v
	}
	panel.disks = ipcString(msg["disks"])
	panel.memory = ipcString(msg["memory"])
	panel.printers = ipcString(msg["printers"])
}

func markServiceDown() {
	panelMu.Lock()
	panel.serviceOK = false
	panel.connected = false
	panelMu.Unlock()
	fillLocalIdentity()
	refreshStatusWindow()
}

func fillLocalIdentity() {
	panelMu.Lock()
	defer panelMu.Unlock()
	if panel.hostname == "" {
		panel.hostname = client.Hostname()
	}
	if panel.osVersion == "" {
		panel.osVersion = client.OSVersion()
	}
	if panel.localIP == "" {
		panel.localIP = client.DetectLocalIP()
	}
	if panel.mac == "" {
		panel.mac = client.DetectMACAddress()
	}
	if panel.version == "" {
		panel.version = current
	}
}

func ipcString(v any) string {
	s, _ := v.(string)
	return s
}

func snapshotPanel() panelInfo {
	panelMu.Lock()
	defer panelMu.Unlock()
	return panel
}

func ensureStatusWindow() {
	panelClassOnce.Do(func() {
		icc := initCommonControlsEx{Icc: iccProgress}
		icc.Size = uint32(unsafe.Sizeof(icc))
		procInitCommonControlsEx.Call(uintptr(unsafe.Pointer(&icc)))
		panelClass, _ = windows.UTF16PtrFromString("NetManAgentStatus")
		panelWndProcCb = windows.NewCallback(panelWndProc)
		instance, _, _ := procGetModuleHandle.Call(0)
		hBrCanvas, _, _ = procCreateSolidBr.Call(clrCanvas)
		hBrSurface, _, _ = procCreateSolidBr.Call(clrSurface)
		hBrBlue, _, _ = procCreateSolidBr.Call(clrBlue)
		hBrBlueHov, _, _ = procCreateSolidBr.Call(clrBlueHov)
		hBrHairline, _, _ = procCreateSolidBr.Call(clrHairline)
		hBrInk, _, _ = procCreateSolidBr.Call(clrInk)
		hFontTitle = createFont(22, fwLight)
		hFontBody = createFont(14, fwRegular)
		hFontSmall = createFont(12, fwRegular)
		wc := wndClassEx{
			LpfnWndProc:   panelWndProcCb,
			HInstance:     windows.Handle(instance),
			HbrBackground: windows.Handle(hBrCanvas),
			LpszClassName: panelClass,
			HIcon:         windows.Handle(hIcon),
		}
		wc.CbSize = uint32(unsafe.Sizeof(wc))
		procRegisterClassEx.Call(uintptr(unsafe.Pointer(&wc)))
	})

	fillLocalIdentity()

	if hPanel != 0 {
		applyPanelUI()
		procShowWindow.Call(uintptr(hPanel), swRestore)
		procSetForegroundWnd.Call(uintptr(hPanel))
		go request("progress-ack")
		go request("ping")
		return
	}

	title, _ := windows.UTF16PtrFromString("netMan Agent")
	instance, _, _ := procGetModuleHandle.Call(0)
	const w, h = 480, 620
	x, y := centerPos(w, h)
	style := uintptr(wsOverlapped | wsCaption | wsSysMenu | wsMinimizeBox)
	hwndNew, _, _ := procCreateWindowEx.Call(0, uintptr(unsafe.Pointer(panelClass)), uintptr(unsafe.Pointer(title)), style, uintptr(x), uintptr(y), w, h, 0, 0, instance, 0)
	if hwndNew == 0 {
		return
	}
	hPanel = windows.HWND(hwndNew)

	staticClass, _ := windows.UTF16PtrFromString("STATIC")
	btnClass, _ := windows.UTF16PtrFromString("BUTTON")
	barClass, _ := windows.UTF16PtrFromString("msctls_progress32")
	empty, _ := windows.UTF16PtrFromString("")

	addStatic := func(id int, y, ht int32) {
		st, _, _ := procCreateWindowEx.Call(0, uintptr(unsafe.Pointer(staticClass)), uintptr(unsafe.Pointer(empty)),
			wsChild|wsVisible|ssLeft, 32, uintptr(y), 416, uintptr(ht), hwndNew, uintptr(id), instance, 0)
		hVal[id] = windows.HWND(st)
		if hFontBody != 0 && st != 0 {
			procSendMessage.Call(st, wmSetFont, hFontBody, 1)
		}
	}

	// Header painted in WM_PAINT; values start below the blue rail.
	addStatic(idValStatus, 88, 22)
	addStatic(idValVersion, 128, 20)
	addStatic(idValServer, 150, 20)
	addStatic(idValAgent, 172, 20)
	addStatic(idValHost, 226, 20)
	addStatic(idValOS, 248, 20)
	addStatic(idValIP, 270, 20)
	addStatic(idValMAC, 292, 20)
	addStatic(idValMem, 314, 20)
	addStatic(idValDisk, 336, 40)
	addStatic(idValPrint, 378, 20)
	addStatic(idValNote, 414, 36)
	if st := hVal[idValStatus]; st != 0 && hFontTitle != 0 {
		procSendMessage.Call(uintptr(st), wmSetFont, hFontTitle, 1)
	}
	if st := hVal[idValNote]; st != 0 && hFontSmall != 0 {
		procSendMessage.Call(uintptr(st), wmSetFont, hFontSmall, 1)
	}

	mkBtn := func(id int, x, y, bw, bh int32) windows.HWND {
		b, _, _ := procCreateWindowEx.Call(0, uintptr(unsafe.Pointer(btnClass)), uintptr(unsafe.Pointer(empty)),
			wsChild|wsVisible|bsOwnerDraw, uintptr(x), uintptr(y), uintptr(bw), uintptr(bh), hwndNew, uintptr(id), instance, 0)
		return windows.HWND(b)
	}
	hBtnRestart = mkBtn(idBtnRestart, 32, 468, 200, 40)
	hBtnUpdate = mkBtn(idBtnUpdate, 248, 468, 200, 40)
	hBtnCheck = mkBtn(idBtnCheck, 32, 516, 416, 32)

	bar, _, _ := procCreateWindowEx.Call(0, uintptr(unsafe.Pointer(barClass)), 0,
		wsChild|pbsSmooth|pbsMarquee, 32, 556, 416, 12, hwndNew, idBarPanel, instance, 0)
	hBarPanel = windows.HWND(bar)

	procSetTimer.Call(hwndNew, panelTimerID, 3000, 0)
	applyPanelUI()
	procShowWindow.Call(hwndNew, swShow)
	procUpdateWindow.Call(hwndNew)
	procSetForegroundWnd.Call(hwndNew)
	go request("progress-ack")
	go request("ping")
}

func applyPanelUI() {
	if hPanel == 0 {
		return
	}
	p := snapshotPanel()
	status, statusClr := panelStatusText(p)
	setStatic(idValStatus, status)
	setStaticColor(idValStatus, statusClr)
	setStatic(idValVersion, "Agent version    "+dash(p.version))
	setStatic(idValServer, "Server           "+dash(p.serverURL))
	setStatic(idValAgent, "Agent ID         "+dash(p.agentID))
	setStatic(idValHost, "Host             "+dash(p.hostname))
	setStatic(idValOS, "OS               "+dash(p.osVersion))
	setStatic(idValIP, "LAN IP           "+dash(p.localIP))
	setStatic(idValMAC, "MAC              "+dash(p.mac))
	setStatic(idValMem, "Memory           "+dash(p.memory))
	setStatic(idValDisk, "Disks            "+dash(p.disks))
	setStatic(idValPrint, "Printers         "+dash(p.printers))

	note := p.message
	if !p.serviceOK {
		note = "Windows service is not running. Use Restart, or start netMan Agent in Services."
	} else if p.lastError != "" && !p.connected {
		note = p.lastError
	}
	setStatic(idValNote, note)

	progMu.Lock()
	phase := progPhase
	pct := progPct
	text := progText
	wanted := progressWanted
	progMu.Unlock()
	if hBarPanel != 0 {
		updating := wanted && phase != "" && phase != "complete" && phase != "failed"
		if updating || phase == "downloading" || phase == "applying" || phase == "preparing" {
			procShowWindow.Call(uintptr(hBarPanel), swShow)
			if pct < 0 {
				procSendMessage.Call(uintptr(hBarPanel), pbmSetMarquee, 1, 80)
			} else {
				procSendMessage.Call(uintptr(hBarPanel), pbmSetMarquee, 0, 0)
				procSendMessage.Call(uintptr(hBarPanel), pbmSetRange32, 0, 100)
				procSendMessage.Call(uintptr(hBarPanel), pbmSetPos, uintptr(pct), 0)
			}
			if text != "" {
				setStatic(idValNote, text)
			}
		} else {
			procShowWindow.Call(uintptr(hBarPanel), 0)
		}
	}

	if hBtnUpdate != 0 {
		procEnableWindow.Call(uintptr(hBtnUpdate), 1)
	}
	procInvalidateRect.Call(uintptr(hPanel), 0, 1)
}

func panelStatusText(p panelInfo) (string, uint32) {
	if !p.serviceOK {
		return "Service offline", clrError
	}
	if p.connected {
		return "Connected", clrSuccess
	}
	return "Offline", clrError
}

func dash(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "—"
	}
	return s
}

func setStatic(id int, text string) {
	h := hVal[id]
	if h == 0 {
		return
	}
	p, _ := windows.UTF16PtrFromString(text)
	procSetWindowText.Call(uintptr(h), uintptr(unsafe.Pointer(p)))
}

var staticColor = map[int]uint32{}

func setStaticColor(id int, c uint32) {
	staticColor[id] = c
}

func createFont(px, weight int32) uintptr {
	face, _ := windows.UTF16PtrFromString("IBM Plex Sans")
	h, _, _ := procCreateFont.Call(
		winCoord(-px), 0, 0, 0, uintptr(weight),
		0, 0, 0, 1, 0, 0, 5, 0,
		uintptr(unsafe.Pointer(face)),
	)
	if h == 0 {
		face, _ = windows.UTF16PtrFromString("Segoe UI")
		h, _, _ = procCreateFont.Call(
			winCoord(-px), 0, 0, 0, uintptr(weight),
			0, 0, 0, 1, 0, 0, 5, 0,
			uintptr(unsafe.Pointer(face)),
		)
	}
	return h
}

func panelWndProc(hwnd windows.HWND, msg uint32, wParam, lParam uintptr) uintptr {
	switch msg {
	case wmEraseBkgnd:
		var rc rect
		procGetClientRect.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&rc)))
		procFillRect.Call(wParam, uintptr(unsafe.Pointer(&rc)), hBrCanvas)
		return 1
	case 0x000F: // WM_PAINT
		paintPanelHeader(hwnd)
		return 0
	case wmCtlColorSt:
		id := int(ctrlID(lParam))
		hdc := wParam
		procSetBkMode.Call(hdc, transparentBk)
		if c, ok := staticColor[id]; ok {
			procSetTextColor.Call(hdc, uintptr(c))
		} else if id == idValNote {
			procSetTextColor.Call(hdc, clrMuted)
		} else {
			procSetTextColor.Call(hdc, clrInk)
		}
		return hBrCanvas
	case wmDrawItem:
		drawPanelButton((*drawItem)(unsafe.Pointer(lParam)))
		return 1
	case wmCommand:
		switch uint16(wParam) {
		case idBtnRestart:
			onRestartClicked()
		case idBtnUpdate:
			onUpdateClicked()
		case idBtnCheck:
			go request("check")
		}
		return 0
	case wmTimer:
		if wParam == panelTimerID {
			go request("ping")
		}
		return 0
	case wmClose:
		procShowWindow.Call(uintptr(hwnd), 0)
		return 0
	case wmDestroy:
		procKillTimer.Call(uintptr(hwnd), panelTimerID)
		hPanel = 0
		hBtnRestart = 0
		hBtnUpdate = 0
		hBtnCheck = 0
		hBarPanel = 0
		hVal = map[int]windows.HWND{}
		return 0
	}
	r, _, _ := procDefWindowProc.Call(uintptr(hwnd), uintptr(msg), wParam, lParam)
	return r
}

func ctrlID(hwnd uintptr) uintptr {
	id, _, _ := procGetDlgCtrlID.Call(hwnd)
	return id
}

func paintPanelHeader(hwnd windows.HWND) {
	type paintstruct struct {
		HDC         uintptr
		Erase       int32
		RcPaint     rect
		Restore     int32
		IncUpdate   int32
		RgbReserved [32]byte
	}
	var ps paintstruct
	hdc, _, _ := procBeginPaint.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&ps)))
	if hdc == 0 {
		return
	}
	defer procEndPaint.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&ps)))

	var rc rect
	procGetClientRect.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&rc)))
	procFillRect.Call(hdc, uintptr(unsafe.Pointer(&rc)), hBrCanvas)

	rail := rect{Left: 0, Top: 0, Right: 4, Bottom: rc.Bottom}
	procFillRect.Call(hdc, uintptr(unsafe.Pointer(&rail)), hBrBlue)

	band := rect{Left: 4, Top: 0, Right: rc.Right, Bottom: 72}
	procFillRect.Call(hdc, uintptr(unsafe.Pointer(&band)), hBrSurface)

	line := rect{Left: 4, Top: 72, Right: rc.Right, Bottom: 73}
	procFillRect.Call(hdc, uintptr(unsafe.Pointer(&line)), hBrHairline)

	sec := rect{Left: 32, Top: 204, Right: rc.Right - 16, Bottom: 205}
	procFillRect.Call(hdc, uintptr(unsafe.Pointer(&sec)), hBrHairline)

	procSetBkMode.Call(hdc, transparentBk)
	if hFontSmall != 0 {
		procSelectObject.Call(hdc, hFontSmall)
	}
	procSetTextColor.Call(hdc, clrMuted)
	drawOn(hdc, 32, 16, 400, 18, "netMan Agent")
	if hFontTitle != 0 {
		procSelectObject.Call(hdc, hFontTitle)
	}
	procSetTextColor.Call(hdc, clrInk)
	drawOn(hdc, 32, 34, 400, 28, "This PC")
	if hFontSmall != 0 {
		procSelectObject.Call(hdc, hFontSmall)
	}
	procSetTextColor.Call(hdc, clrMuted)
	drawOn(hdc, 32, 208, 400, 16, "Reported to netMan")
}

func drawOn(hdc uintptr, x, y, w, h int32, text string) {
	r := rect{Left: x, Top: y, Right: x + w, Bottom: y + h}
	p, _ := windows.UTF16PtrFromString(text)
	procDrawText.Call(hdc, uintptr(unsafe.Pointer(p)), uintptr(len([]rune(text))), uintptr(unsafe.Pointer(&r)), dtNoClip|dtSingleLine)
}

func drawPanelButton(di *drawItem) {
	if di == nil {
		return
	}
	primary := di.CtlID == idBtnUpdate
	disabled := di.ItemState&odsDisabled != 0
	pressed := di.ItemState&odsSelected != 0
	p := snapshotPanel()

	label := "Restart agent"
	if di.CtlID == idBtnUpdate {
		if p.pending != "" {
			label = "Update to v" + p.pending
		} else {
			label = "Update"
		}
	}
	if di.CtlID == idBtnCheck {
		label = "Check for updates"
		primary = false
	}

	fill := hBrCanvas
	frame := hBrInk
	fg := uintptr(clrInk)
	if primary && !disabled {
		if pressed {
			fill = hBrBlueHov
		} else {
			fill = hBrBlue
		}
		frame = fill
		fg = clrWhite
	} else if disabled {
		fill = hBrSurface
		frame = hBrHairline
		fg = clrSubtle
	} else if pressed {
		fill = hBrSurface
	}

	rc := di.RcItem
	procFillRect.Call(di.HDC, uintptr(unsafe.Pointer(&rc)), fill)
	procFrameRect.Call(di.HDC, uintptr(unsafe.Pointer(&rc)), frame)
	procSetBkMode.Call(di.HDC, transparentBk)
	procSetTextColor.Call(di.HDC, fg)
	if hFontBody != 0 {
		procSelectObject.Call(di.HDC, hFontBody)
	}
	txt, _ := windows.UTF16PtrFromString(label)
	procDrawText.Call(di.HDC, uintptr(unsafe.Pointer(txt)), uintptr(len([]rune(label))), uintptr(unsafe.Pointer(&rc)), dtCenter|dtVCenter|dtSingleLine|dtEndEllipsis)
}

func onRestartClicked() {
	progMu.Lock()
	phase := progPhase
	can := progCanClose
	progMu.Unlock()
	if can && phase == "complete" {
		go request("restart")
		return
	}
	go request("restart-service")
	panelMu.Lock()
	panel.message = "Restarting service…"
	panel.serviceOK = false
	panel.connected = false
	panelMu.Unlock()
	applyPanelUI()
}

func onUpdateClicked() {
	p := snapshotPanel()
	if p.pending != "" {
		beginUpdateUI()
		go request("apply")
		return
	}
	go request("check")
}