package client

import (
	"encoding/binary"
	"encoding/json"
	"log"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/netman/agent/internal/config"
	"github.com/netman/agent/internal/telemetry"
)

const (
	defaultHeartbeatInterval = 30 * time.Second
	minHeartbeatInterval     = 5 * time.Second
	minBackoff               = 1 * time.Second
	maxBackoff               = 60 * time.Second
)

type helloMessage struct {
	Type         string `json:"type"`
	AgentID      string `json:"agentId"`
	AuthKey      string `json:"authKey"`
	AgentVersion string `json:"agentVersion,omitempty"`
	MACAddress   string `json:"macAddress,omitempty"`
	LocalIP      string `json:"localIp,omitempty"`
	VNCPassword  string `json:"vncPassword,omitempty"`
}

type heartbeatMessage struct {
	Type        string  `json:"type"`
	CPUPercent  float64 `json:"cpuPercent"`
	MemPercent  float64 `json:"memPercent"`
	DiskPercent float64 `json:"diskPercent"`
	UptimeSec   uint64  `json:"uptimeSec"`

	CPUPerCore []float64 `json:"cpuPerCore,omitempty"`

	SwapPercent float64 `json:"swapPercent,omitempty"`

	NetRxBytesPerSec     *float64 `json:"netRxBytesPerSec,omitempty"`
	NetTxBytesPerSec     *float64 `json:"netTxBytesPerSec,omitempty"`
	DiskReadBytesPerSec  *float64 `json:"diskReadBytesPerSec,omitempty"`
	DiskWriteBytesPerSec *float64 `json:"diskWriteBytesPerSec,omitempty"`

	LoadAvg1  *float64 `json:"loadAvg1,omitempty"`
	LoadAvg5  *float64 `json:"loadAvg5,omitempty"`
	LoadAvg15 *float64 `json:"loadAvg15,omitempty"`

	Partitions    []telemetry.PartitionUsage `json:"partitions,omitempty"`
	TopProcesses  []telemetry.ProcessInfo    `json:"topProcesses,omitempty"`
	LoggedInUsers []string                   `json:"loggedInUsers,omitempty"`
}

type inboundMessage struct {
	Type      string `json:"type"`
	Message   string `json:"message"`
	ChannelID uint32 `json:"channelId"`
	Target    string `json:"target"`
	RequestID string `json:"requestId"`
	PID       int32  `json:"pid"`
}

// Run holds a persistent WebSocket connection to the server for as long as
// stop is open, sending a heartbeat on every heartbeatInterval() tick and
// reconnecting with exponential backoff + full jitter on any disconnect.
func Run(cfg *config.Config, version string, stop <-chan struct{}) {
	backoff := minBackoff
	collector := telemetry.NewCollector()

	for {
		select {
		case <-stop:
			return
		default:
		}

		connectedAt, err := runOnce(cfg, version, collector, stop)
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

// heartbeatInterval lets an operator tune the reporting cadence without a
// rebuild: NETMAN_HEARTBEAT_INTERVAL_SEC, clamped to
// [minHeartbeatInterval, ...] so a typo can't turn this into a hammer.
func heartbeatInterval() time.Duration {
	raw := os.Getenv("NETMAN_HEARTBEAT_INTERVAL_SEC")
	if raw == "" {
		return defaultHeartbeatInterval
	}
	sec, err := strconv.Atoi(raw)
	if err != nil || sec <= 0 {
		return defaultHeartbeatInterval
	}
	d := time.Duration(sec) * time.Second
	if d < minHeartbeatInterval {
		return minHeartbeatInterval
	}
	return d
}

func runOnce(cfg *config.Config, version string, collector *telemetry.Collector, stop <-chan struct{}) (connectedAt time.Time, err error) {
	wsURL := toWebSocketURL(cfg.ServerURL) + "/api/agents/connect"

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return time.Time{}, err
	}
	defer conn.Close()

	var writeMu sync.Mutex
	tm := newTunnelManager(conn, &writeMu)
	defer tm.closeAll()

	writeMu.Lock()
	helloErr := conn.WriteJSON(helloMessage{Type: "hello", AgentID: cfg.AgentID, AuthKey: cfg.AuthKey, AgentVersion: version, MACAddress: DetectMACAddress(), LocalIP: DetectLocalIP(), VNCPassword: ReadVNCPassword()})
	writeMu.Unlock()
	if helloErr != nil {
		return time.Time{}, helloErr
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
	go readLoop(conn, tm, &writeMu, done)

	ticker := time.NewTicker(heartbeatInterval())
	defer ticker.Stop()

	// Send one heartbeat immediately so telemetry shows up right away.
	sendHeartbeat(conn, collector, &writeMu)

	for {
		select {
		case <-stop:
			writeMu.Lock()
			_ = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			writeMu.Unlock()
			return connectedAt, nil
		case <-done:
			return connectedAt, nil
		case <-ticker.C:
			if err := sendHeartbeat(conn, collector, &writeMu); err != nil {
				return connectedAt, err
			}
		}
	}
}

// readLoop is the connection's sole reader (gorilla/websocket requires this)
// and dispatches every frame: binary = tunnel data, text = JSON control.
func readLoop(conn *websocket.Conn, tm *tunnelManager, writeMu *sync.Mutex, done chan<- struct{}) {
	defer close(done)
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			return
		}

		switch msgType {
		case websocket.BinaryMessage:
			if len(data) < 4 {
				continue
			}
			channelID := binary.BigEndian.Uint32(data[:4])
			tm.data(channelID, data[4:])

		case websocket.TextMessage:
			var msg inboundMessage
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			switch msg.Type {
			case "tunnel-open":
				tm.open(tunnelOpenControl{Type: msg.Type, ChannelID: msg.ChannelID, Target: msg.Target})
			case "tunnel-close", "tunnel-error":
				tm.remoteClose(msg.ChannelID)
			case "kill-process":
				// Runs off the read goroutine so a slow/hung kill (e.g. a
				// process wedged in uninterruptible I/O) can't stall
				// heartbeats or tunnel data.
				go handleKillProcess(conn, writeMu, msg.RequestID, msg.PID)
			case "error":
				log.Printf("[agent] server error: %s", msg.Message)
			}
		}
	}
}

func sendHeartbeat(conn *websocket.Conn, collector *telemetry.Collector, writeMu *sync.Mutex) error {
	snap := collector.Collect()
	writeMu.Lock()
	defer writeMu.Unlock()
	return conn.WriteJSON(heartbeatMessage{
		Type:                 "heartbeat",
		CPUPercent:           snap.CPUPercent,
		CPUPerCore:           snap.CPUPerCore,
		MemPercent:           snap.MemPercent,
		SwapPercent:          snap.SwapPercent,
		DiskPercent:          snap.DiskPercent,
		UptimeSec:            snap.UptimeSec,
		NetRxBytesPerSec:     snap.NetRxBytesPerSec,
		NetTxBytesPerSec:     snap.NetTxBytesPerSec,
		DiskReadBytesPerSec:  snap.DiskReadBytesPerSec,
		DiskWriteBytesPerSec: snap.DiskWriteBytesPerSec,
		LoadAvg1:             snap.LoadAvg1,
		LoadAvg5:             snap.LoadAvg5,
		LoadAvg15:            snap.LoadAvg15,
		Partitions:           snap.Partitions,
		TopProcesses:         snap.TopProcesses,
		LoggedInUsers:        snap.LoggedInUsers,
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
