package client

import (
	"encoding/binary"
	"log"
	"net"
	"sync"

	"github.com/gorilla/websocket"
)

// Symbolic targets only — the server tells the agent *what* to tunnel to
// ("ssh" or "vnc"), never an arbitrary host:port. The agent maps that to a
// hardcoded loopback address itself, so a compromised/MITM'd server can
// never turn this agent into an open relay into whatever network it sits on.
var localAddrByTarget = map[string]string{
	"ssh": "127.0.0.1:22",
	"vnc": "127.0.0.1:5900",
}

type tunnelOpenControl struct {
	Type      string `json:"type"`
	ChannelID uint32 `json:"channelId"`
	Target    string `json:"target"`
}

type tunnelControl struct {
	Type      string `json:"type"`
	ChannelID uint32 `json:"channelId"`
	Message   string `json:"message,omitempty"`
}

// tunnelManager owns the local TCP connections backing each active
// SSH/VNC relay channel, and serializes writes back onto the single shared
// WebSocket (gorilla/websocket allows exactly one concurrent writer).
type tunnelManager struct {
	conn    *websocket.Conn
	writeMu *sync.Mutex

	mu       sync.Mutex
	channels map[uint32]net.Conn
}

func newTunnelManager(conn *websocket.Conn, writeMu *sync.Mutex) *tunnelManager {
	return &tunnelManager{
		conn:     conn,
		writeMu:  writeMu,
		channels: make(map[uint32]net.Conn),
	}
}

func (tm *tunnelManager) open(msg tunnelOpenControl) {
	addr, ok := localAddrByTarget[msg.Target]
	if !ok {
		tm.sendControl(tunnelControl{Type: "tunnel-error", ChannelID: msg.ChannelID, Message: "unsupported target: " + msg.Target})
		return
	}

	conn, err := net.Dial("tcp", addr)
	if err != nil {
		log.Printf("[agent] tunnel dial to %s failed: %v", addr, err)
		tm.sendControl(tunnelControl{Type: "tunnel-error", ChannelID: msg.ChannelID, Message: err.Error()})
		return
	}

	tm.mu.Lock()
	tm.channels[msg.ChannelID] = conn
	tm.mu.Unlock()

	tm.sendControl(tunnelControl{Type: "tunnel-ready", ChannelID: msg.ChannelID})

	go tm.pump(msg.ChannelID, conn)
}

// pump forwards conn -> WebSocket until either side closes.
func (tm *tunnelManager) pump(channelID uint32, conn net.Conn) {
	defer tm.close(channelID)

	buf := make([]byte, 32*1024)
	for {
		n, err := conn.Read(buf)
		if n > 0 {
			frame := make([]byte, 4+n)
			binary.BigEndian.PutUint32(frame[:4], channelID)
			copy(frame[4:], buf[:n])

			tm.writeMu.Lock()
			werr := tm.conn.WriteMessage(websocket.BinaryMessage, frame)
			tm.writeMu.Unlock()
			if werr != nil {
				return
			}
		}
		if err != nil {
			return
		}
	}
}

// data forwards a WebSocket -> conn frame (received in the client readLoop).
func (tm *tunnelManager) data(channelID uint32, payload []byte) {
	tm.mu.Lock()
	conn, ok := tm.channels[channelID]
	tm.mu.Unlock()
	if !ok {
		return
	}
	if _, err := conn.Write(payload); err != nil {
		tm.close(channelID)
	}
}

// remoteClose handles a tunnel-close/tunnel-error control frame from the server.
func (tm *tunnelManager) remoteClose(channelID uint32) {
	tm.mu.Lock()
	conn, ok := tm.channels[channelID]
	delete(tm.channels, channelID)
	tm.mu.Unlock()
	if ok {
		conn.Close()
	}
}

// close tears down a channel from the agent side and tells the server.
func (tm *tunnelManager) close(channelID uint32) {
	tm.mu.Lock()
	conn, ok := tm.channels[channelID]
	delete(tm.channels, channelID)
	tm.mu.Unlock()

	if !ok {
		return
	}
	conn.Close()
	tm.sendControl(tunnelControl{Type: "tunnel-close", ChannelID: channelID})
}

// closeAll tears down every channel — called when the WebSocket connection itself drops.
func (tm *tunnelManager) closeAll() {
	tm.mu.Lock()
	conns := make([]net.Conn, 0, len(tm.channels))
	for _, c := range tm.channels {
		conns = append(conns, c)
	}
	tm.channels = make(map[uint32]net.Conn)
	tm.mu.Unlock()

	for _, c := range conns {
		c.Close()
	}
}

func (tm *tunnelManager) sendControl(msg tunnelControl) {
	tm.writeMu.Lock()
	defer tm.writeMu.Unlock()
	_ = tm.conn.WriteJSON(msg)
}
