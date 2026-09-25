package client

import (
	"testing"
	"time"
)

func TestHeartbeatInterval(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want time.Duration
	}{
		{name: "default", want: defaultHeartbeatInterval},
		{name: "invalid", raw: "invalid", want: defaultHeartbeatInterval},
		{name: "minimum", raw: "1", want: minHeartbeatInterval},
		{name: "configured", raw: "45", want: 45 * time.Second},
		{name: "maximum", raw: "600", want: maxHeartbeatInterval},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("NETMAN_HEARTBEAT_INTERVAL_SEC", test.raw)
			if got := heartbeatInterval(); got != test.want {
				t.Fatalf("heartbeatInterval() = %s, want %s", got, test.want)
			}
		})
	}
}
