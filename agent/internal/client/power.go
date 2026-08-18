package client

import (
	"fmt"
	"os/exec"
	"runtime"
	"sync"

	"github.com/gorilla/websocket"
)

type powerActionResult struct {
	Type      string `json:"type"`
	RequestID string `json:"requestId"`
	Success   bool   `json:"success"`
	Error     string `json:"error,omitempty"`
}

// handlePowerAction restarts or shuts down the host machine. The ack is
// sent before the command is started, not after it finishes — a machine
// that's actually going down never gets the chance to report back, so this
// is the only ordering that lets the operator see a confirmation at all.
func handlePowerAction(conn *websocket.Conn, writeMu *sync.Mutex, requestID, action string) {
	result := powerActionResult{Type: "power-action-result", RequestID: requestID}

	cmd, err := powerCommand(action)
	if err != nil {
		result.Error = err.Error()
	} else if startErr := cmd.Start(); startErr != nil {
		result.Error = startErr.Error()
	} else {
		result.Success = true
	}

	writeMu.Lock()
	_ = conn.WriteJSON(result)
	writeMu.Unlock()
}

func powerCommand(action string) (*exec.Cmd, error) {
	switch runtime.GOOS {
	case "windows":
		switch action {
		case "restart":
			return exec.Command("shutdown", "/r", "/t", "0"), nil
		case "shutdown":
			return exec.Command("shutdown", "/s", "/t", "0"), nil
		}
	default: // linux, darwin
		switch action {
		case "restart":
			return exec.Command("shutdown", "-r", "now"), nil
		case "shutdown":
			return exec.Command("shutdown", "-h", "now"), nil
		}
	}
	return nil, fmt.Errorf("unsupported power action: %q", action)
}
