//go:build windows

package update

import (
	"bufio"
	"encoding/json"
	"io"
	"log"
	"net"
	"sync"

	"github.com/Microsoft/go-winio"
)

const pipeName = `\\.\pipe\netman-agent`

var (
	hubMu sync.Mutex
	hub   = map[net.Conn]struct{}{}
)

func ipcServe(m *Manager, stop <-chan struct{}) {
	l, err := winio.ListenPipe(pipeName, &winio.PipeConfig{
		SecurityDescriptor: "D:P(A;;GA;;;BA)(A;;GA;;;SY)(A;;GRGW;;;AU)",
		MessageMode:        false,
		InputBufferSize:    4096,
		OutputBufferSize:   4096,
	})
	if err != nil {
		log.Printf("[agent] tray pipe listen failed: %v", err)
		return
	}
	defer l.Close()

	go func() {
		<-stop
		_ = l.Close()
	}()

	for {
		conn, err := l.Accept()
		if err != nil {
			select {
			case <-stop:
				return
			default:
				log.Printf("[agent] tray pipe accept: %v", err)
				return
			}
		}
		go serveTrayConn(m, conn)
	}
}

func serveTrayConn(m *Manager, conn net.Conn) {
	defer conn.Close()
	hubMu.Lock()
	hub[conn] = struct{}{}
	hubMu.Unlock()
	defer func() {
		hubMu.Lock()
		delete(hub, conn)
		hubMu.Unlock()
	}()

	writeJSON(conn, snapshotMessage(m))

	sc := bufio.NewScanner(conn)
	for sc.Scan() {
		var msg map[string]string
		if err := json.Unmarshal(sc.Bytes(), &msg); err != nil {
			continue
		}
		switch msg["type"] {
		case "apply":
			m.RequestApply()
		case "restart":
			m.RequestRestart()
		case "progress-ack":
			m.RequestProgressAck()
		case "check":
			go func() {
				m.CheckNow()
				writeJSON(conn, snapshotMessage(m))
			}()
		case "ping":
			writeJSON(conn, snapshotMessage(m))
		}
	}
}

func snapshotMessage(m *Manager) map[string]any {
	s := m.Snapshot()
	out := map[string]any{
		"type":    "status",
		"version": s.Current,
		"message": s.Message,
	}
	if s.Pending != nil {
		out["pending"] = s.Pending.Version
	}
	return out
}

func broadcastToTrays(msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	data = append(data, '\n')
	hubMu.Lock()
	defer hubMu.Unlock()
	for c := range hub {
		_, _ = c.Write(data)
	}
}

func writeJSON(w io.Writer, msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	_, _ = w.Write(append(data, '\n'))
}

func pushTrayStatus(m *Manager) {
	broadcastToTrays(snapshotMessage(m))
}

func notifyProgress(phase string, percent int, message string) {
	msg := map[string]any{
		"type":    "progress",
		"phase":   phase,
		"percent": percent,
		"message": message,
	}
	broadcastToTrays(msg)
}
