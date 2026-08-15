package client

import (
	"log"
	"math/rand"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"github.com/netman/agent/internal/config"
	"github.com/netman/agent/internal/telemetry"
)

const (
	heartbeatInterval = 30 * time.Second
	minBackoff        = 1 * time.Second
	maxBackoff        = 60 * time.Second
)

type helloMessage struct {
	Type    string `json:"type"`
	AgentID string `json:"agentId"`
	AuthKey string `json:"authKey"`
}

type heartbeatMessage struct {
	Type        string  `json:"type"`
	CPUPercent  float64 `json:"cpuPercent"`
	MemPercent  float64 `json:"memPercent"`
	DiskPercent float64 `json:"diskPercent"`
	UptimeSec   uint64  `json:"uptimeSec"`
}

type inboundMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// Run holds a persistent WebSocket connection to the server for as long as
// stop is open, sending a heartbeat every heartbeatInterval and
// reconnecting with exponential backoff + full jitter on any disconnect.
func Run(cfg *config.Config, stop <-chan struct{}) {
	backoff := minBackoff

	for {
		select {
		case <-stop:
			return
		default:
		}

		connectedAt, err := runOnce(cfg, stop)
		if err != nil {
			log.Printf("[agent] connection error: %v", err)
		}

		// A connection that stayed up a while resets backoff — only a
		// tight crash-connect-crash loop should back off aggressively.
		if !connectedAt.IsZero() && time.Since(connectedAt) > 2*minBackoff {
			backoff = minBackoff
		} else {
			backoff = nextBackoff(backoff)
		}

		select {
		case <-stop:
			return
		case <-time.After(withJitter(backoff)):
		}
	}
}

func runOnce(cfg *config.Config, stop <-chan struct{}) (connectedAt time.Time, err error) {
	wsURL := toWebSocketURL(cfg.ServerURL) + "/api/agents/connect"

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return time.Time{}, err
	}
	defer conn.Close()

	if err := conn.WriteJSON(helloMessage{Type: "hello", AgentID: cfg.AgentID, AuthKey: cfg.AuthKey}); err != nil {
		return time.Time{}, err
	}

	// Wait for hello-ack before starting the heartbeat loop.
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	var ack inboundMessage
	if err := conn.ReadJSON(&ack); err != nil {
		return time.Time{}, err
	}
	if ack.Type == "error" {
		return time.Time{}, &authError{ack.Message}
	}
	conn.SetReadDeadline(time.Time{})
	connectedAt = time.Now()
	log.Printf("[agent] connected (agentId=%s)", cfg.AgentID)

	done := make(chan struct{})
	go readLoop(conn, done)

	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()

	// Send one heartbeat immediately so telemetry shows up right away.
	sendHeartbeat(conn)

	for {
		select {
		case <-stop:
			_ = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			return connectedAt, nil
		case <-done:
			return connectedAt, nil
		case <-ticker.C:
			if err := sendHeartbeat(conn); err != nil {
				return connectedAt, err
			}
		}
	}
}

func readLoop(conn *websocket.Conn, done chan<- struct{}) {
	defer close(done)
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
	}
}

func sendHeartbeat(conn *websocket.Conn) error {
	snap := telemetry.Collect()
	return conn.WriteJSON(heartbeatMessage{
		Type:        "heartbeat",
		CPUPercent:  snap.CPUPercent,
		MemPercent:  snap.MemPercent,
		DiskPercent: snap.DiskPercent,
		UptimeSec:   snap.UptimeSec,
	})
}

func toWebSocketURL(serverURL string) string {
	url := strings.TrimRight(serverURL, "/")
	switch {
	case strings.HasPrefix(url, "https://"):
		return "wss://" + strings.TrimPrefix(url, "https://")
	case strings.HasPrefix(url, "http://"):
		return "ws://" + strings.TrimPrefix(url, "http://")
	default:
		return "wss://" + url
	}
}

func nextBackoff(current time.Duration) time.Duration {
	next := current * 2
	if next > maxBackoff {
		return maxBackoff
	}
	return next
}

func withJitter(d time.Duration) time.Duration {
	// Full jitter: random value in [0, d).
	return time.Duration(rand.Int63n(int64(d)))
}

type authError struct{ msg string }

func (e *authError) Error() string { return "server rejected connection: " + e.msg }
