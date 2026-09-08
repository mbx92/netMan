package telemetry

import (
	"context"
	"errors"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/netman/agent/internal/config"
)

type commandRunner func(context.Context, string, ...string) (string, error)

// Keep output bounded, including when a broken command emits indefinitely.
type limitedOutput struct {
	data     []byte
	exceeded bool
}

func (b *limitedOutput) Write(p []byte) (int, error) {
	n := len(p)
	remaining := 1024*1024 - len(b.data)
	if len(p) > remaining {
		p = p[:remaining]
		b.exceeded = true
	}
	b.data = append(b.data, p...)
	return n, nil
}

func runMonitoringCommand(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.WaitDelay = time.Second
	configureMonitoringCommand(cmd)
	cmd.Env = append(os.Environ(), "LC_ALL=C", "LANG=C")
	var out, stderr limitedOutput
	cmd.Stdout, cmd.Stderr = &out, &stderr
	err := cmd.Run()
	if ctx.Err() != nil {
		return "", ctx.Err()
	}
	if out.exceeded || stderr.exceeded {
		return "", errors.New("output_limit")
	}
	if err != nil {
		// Never publish raw stderr: commands can include local sensitive data.
		s := strings.ToLower(string(stderr.data) + string(out.data))
		if strings.Contains(s, "permission denied") || strings.Contains(s, "password") || strings.Contains(s, "not allowed") || strings.Contains(s, "authentication failure") {
			return "", errors.New("permission_denied")
		}
	}
	return string(out.data), err
}

func monitoringError(err error) string {
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	if errors.Is(err, context.Canceled) {
		return "canceled"
	}
	if errors.Is(err, exec.ErrNotFound) || errors.Is(err, os.ErrNotExist) {
		return "not_installed"
	}
	switch err.Error() {
	case "permission_denied", "output_limit", "malformed_output":
		return err.Error()
	}
	return "command_failed"
}

func moduleDuration(raw string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(raw)
	if err != nil || d < time.Second || d > 24*time.Hour {
		return fallback
	}
	return d
}

// StartMonitoring follows the existing background worker/stop-channel pattern.
// Each module has one worker and publishes immutable snapshots under c.mu.
func (c *Collector) StartMonitoring(cfg config.Monitoring, stop <-chan struct{}) {
	start := func(name string, cfg config.Module, collect func(context.Context, config.Module)) {
		if !cfg.Enabled {
			return
		}
		if runtime.GOOS != "linux" {
			log.Printf("[monitoring] %s unsupported platform", name)
			return
		}
		go func() {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			go func() {
				select {
				case <-stop:
					cancel()
				case <-ctx.Done():
				}
			}()
			for {
				if ctx.Err() != nil {
					return
				}
				collect(ctx, cfg)
				timer := time.NewTimer(moduleDuration(cfg.Interval, 60*time.Second))
				select {
				case <-ctx.Done():
					timer.Stop()
					return
				case <-timer.C:
				}
			}
		}()
	}
	start("zimbra", cfg.Zimbra, func(ctx context.Context, cfg config.Module) {
		s := collectZimbra(ctx, cfg, runMonitoringCommand)
		c.mu.Lock()
		c.zimbra = &s
		c.mu.Unlock()
		if len(s.Errors) > 0 {
			log.Printf("[monitoring] zimbra: %v", s.Errors)
		}
	})
	start("fail2ban", cfg.Fail2Ban, func(ctx context.Context, cfg config.Module) {
		s := collectFail2Ban(ctx, cfg, runMonitoringCommand)
		c.mu.Lock()
		c.fail2ban = &s
		c.mu.Unlock()
		if s.Error != "" || s.Partial {
			log.Printf("[monitoring] fail2ban: error=%s partial=%t", s.Error, s.Partial)
		}
	})
}

func moduleCommand(ctx context.Context, cfg config.Module, run commandRunner, name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, moduleDuration(cfg.Timeout, 10*time.Second))
	defer cancel()
	return run(ctx, name, args...)
}
