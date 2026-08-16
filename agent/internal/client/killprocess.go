package client

import (
	"os"
	"sync"

	"github.com/gorilla/websocket"
)

type killProcessResult struct {
	Type      string `json:"type"`
	RequestID string `json:"requestId"`
	Success   bool   `json:"success"`
	Error     string `json:"error,omitempty"`
}

// handleKillProcess terminates the given PID and reports the outcome back to
// the server. Killing is best-effort — a PID that's already gone, or one the
// agent's OS user lacks permission for, just comes back as a failure; it
// never brings the agent connection down.
func handleKillProcess(conn *websocket.Conn, writeMu *sync.Mutex, requestID string, pid int32) {
	result := killProcessResult{Type: "kill-process-result", RequestID: requestID}

	proc, err := os.FindProcess(int(pid))
	if err != nil {
		result.Error = err.Error()
	} else if err := proc.Kill(); err != nil {
		result.Error = err.Error()
	} else {
		result.Success = true
	}

	writeMu.Lock()
	defer writeMu.Unlock()
	_ = conn.WriteJSON(result)
}
