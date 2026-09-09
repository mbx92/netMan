package telemetry

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/netman/agent/internal/config"
)

func fixture(t *testing.T, name string) string {
	t.Helper()
	b, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestZimbraParsers(t *testing.T) {
	for _, tc := range []struct {
		file    string
		stopped bool
	}{{"zimbra-running.txt", false}, {"zimbra-stopped.txt", true}} {
		s, err := parseZimbraStatus(fixture(t, tc.file))
		if err != nil || len(s) != 13 {
			t.Fatalf("%s: %v %v", tc.file, s, err)
		}
		if (s["antivirus"].Status == "stopped") != tc.stopped {
			t.Fatal(s)
		}
	}
	for _, raw := range []string{"", fixture(t, "failure.txt")} {
		if _, err := parseZimbraStatus(raw); err == nil {
			t.Fatal("accepted invalid services")
		}
	}
	q, err := parseZimbraQueue(fixture(t, "queue.txt"))
	if err != nil || q.Total != 18 || q.Deferred != 3 || q.Active != 10 {
		t.Fatalf("%+v %v", q, err)
	}
	for _, raw := range []string{"", "active=0", strings.ReplaceAll(fixture(t, "queue.txt"), "active=10", "active=-1"), fixture(t, "queue.txt") + "active=1\n"} {
		if _, err := parseZimbraQueue(raw); err == nil {
			t.Fatal("accepted invalid queue")
		}
	}
	quota := parseZimbraQuotaUsage(fixture(t, "zimbra-quota.txt"))
	accounts, err := parseZimbraAccounts(fixture(t, "zimbra-accounts.txt"), quota, time.Date(2026, 9, 9, 0, 0, 0, 0, time.UTC), 90, 80, 10)
	if err != nil || accounts.Total != 3 || accounts.Active != 1 || accounts.Locked != 1 || accounts.Closed != 1 || accounts.QuotaWarningCount != 1 || accounts.InactiveCount != 1 {
		t.Fatalf("%+v %v", accounts, err)
	}
	if accounts.Entries[0].Email != "locked@example.com" || accounts.Entries[0].QuotaPercent == nil || *accounts.Entries[0].QuotaPercent < 89 {
		t.Fatalf("%+v", accounts.Entries[0])
	}
	if _, err := parseZimbraAccounts("", nil, time.Now(), 90, 80, 10); err == nil {
		t.Fatal("accepted invalid accounts")
	}
}

func TestFail2BanParsers(t *testing.T) {
	names, err := parseFail2BanStatus(fixture(t, "fail2ban.txt"))
	if err != nil || len(names) != 2 {
		t.Fatalf("%v %v", names, err)
	}
	j, err := parseFail2BanJail("sshd", fixture(t, "jail.txt"))
	if err != nil || j.CurrentlyBanned != 2 || len(j.BannedIPs) != 2 || j.TotalFailed != 514 {
		t.Fatalf("%+v %v", j, err)
	}
	j, err = parseFail2BanJail("zimbra-auth", fixture(t, "jail-empty.txt"))
	if err != nil || len(j.BannedIPs) != 0 {
		t.Fatalf("%+v %v", j, err)
	}
	if names, err = parseFail2BanStatus("Number of jail: 0\nJail list:"); err != nil || len(names) != 0 {
		t.Fatal(names, err)
	}
	for _, raw := range []string{"", fixture(t, "failure.txt"), "Number of jail: 1\nJail list: sshd;reboot", "Number of jail: 2\nJail list: sshd"} {
		if _, err := parseFail2BanStatus(raw); err == nil {
			t.Fatal("accepted malformed status")
		}
	}
	if _, err := parseFail2BanJail("sshd", "Currently banned: 0"); err == nil {
		t.Fatal("accepted incomplete jail")
	}
}

func TestFail2BanPartialAndFailures(t *testing.T) {
	run := func(ctx context.Context, name string, args ...string) (string, error) {
		if _, ok := ctx.Deadline(); !ok {
			t.Fatal("missing timeout")
		}
		if strings.Join(args, " ") == "status" {
			return fixture(t, "fail2ban.txt"), nil
		}
		if strings.Join(args, " ") == "status sshd" {
			return fixture(t, "jail.txt"), nil
		}
		return "", context.DeadlineExceeded
	}
	s := collectFail2Ban(context.Background(), config.Module{}, run)
	if !s.Running || !s.Partial || s.CurrentlyBanned != 2 || s.Jails[1].Error != "timeout" {
		t.Fatalf("%+v", s)
	}
	for _, err := range []error{exec.ErrNotFound, context.DeadlineExceeded, errors.New("permission_denied"), errMalformed} {
		s = collectFail2Ban(context.Background(), config.Module{}, func(context.Context, string, ...string) (string, error) { return "", err })
		if s.Running || s.Error != monitoringError(err) {
			t.Fatalf("%+v", s)
		}
	}
}

func TestZimbraStoppedWithExitFailure(t *testing.T) {
	s := collectZimbra(context.Background(), config.Module{}, func(ctx context.Context, name string, args ...string) (string, error) {
		if strings.Contains(strings.Join(args, " "), " status") {
			return fixture(t, "zimbra-stopped.txt"), errors.New("exit status 1")
		}
		if strings.Contains(strings.Join(args, " "), " -v") {
			return "Release 10.0.0.GA", nil
		}
		return fixture(t, "queue.txt"), nil
	})
	if s.Healthy || !s.Available || s.Services["antivirus"].Status != "stopped" || s.Queue.Total != 18 {
		t.Fatalf("%+v", s)
	}
}

func TestZimbraAccountsCollector(t *testing.T) {
	s := collectZimbra(context.Background(), config.Module{AccountsEnabled: true}, func(ctx context.Context, name string, args ...string) (string, error) {
		joined := strings.Join(append([]string{name}, args...), " ")
		switch {
		case strings.Contains(joined, "zmcontrol status"):
			return fixture(t, "zimbra-running.txt"), nil
		case strings.Contains(joined, "zmcontrol -v"):
			return "Release 10.0.0.GA", nil
		case strings.Contains(joined, "zmqstat"):
			return fixture(t, "queue.txt"), nil
		case strings.Contains(joined, "zmprov") && strings.Contains(joined, "gaa") && strings.Contains(joined, "-v"):
			return fixture(t, "zimbra-accounts.txt"), nil
		case strings.Contains(joined, "zmhostname"):
			return "mail.example.com\n", nil
		case strings.Contains(joined, "zmprov") && strings.Contains(joined, "gqu"):
			return fixture(t, "zimbra-quota.txt"), nil
		default:
			return "", exec.ErrNotFound
		}
	})
	if s.Accounts == nil || s.Accounts.Total != 3 || s.Accounts.QuotaWarningCount != 1 {
		t.Fatalf("%+v", s.Accounts)
	}
}

func TestCommandTimeout(t *testing.T) {
	if os.Getenv("NETMAN_TEST_COMMAND") == "1" {
		time.Sleep(5 * time.Second)
		os.Exit(0)
	}
	t.Setenv("NETMAN_TEST_COMMAND", "1")
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	_, err := runMonitoringCommand(ctx, os.Args[0], "-test.run=^TestCommandTimeout$")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal(err)
	}
}

func TestDisabledMonitoring(t *testing.T) {
	c := NewCollector()
	stop := make(chan struct{})
	c.StartMonitoring(config.Monitoring{}, stop)
	close(stop)
	if c.zimbra != nil || c.fail2ban != nil {
		t.Fatal("disabled modules produced data")
	}
}

func TestSnapshotJSON(t *testing.T) {
	s := Snapshot{Zimbra: &ZimbraSnapshot{CheckedAt: time.Now().UTC()}, Fail2Ban: &Fail2BanSnapshot{Jails: []Fail2BanJail{}}}
	b, err := json.Marshal(s)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(b, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["zimbra"] == nil || payload["fail2ban"] == nil {
		t.Fatal(string(b))
	}
	b, _ = json.Marshal(Snapshot{})
	if strings.Contains(string(b), "zimbra") || strings.Contains(string(b), "fail2ban") {
		t.Fatal("disabled modules not omitted")
	}
}

func TestFail2BanStoppedAndNoJails(t *testing.T) {
	s := collectFail2Ban(context.Background(), config.Module{}, func(_ context.Context, name string, _ ...string) (string, error) {
		if name == "systemctl" {
			return "inactive\n", errors.New("exit status 3")
		}
		return "", errors.New("socket unavailable")
	})
	if s.Running || s.Status != "stopped" {
		t.Fatalf("%+v", s)
	}
	s = collectFail2Ban(context.Background(), config.Module{}, func(context.Context, string, ...string) (string, error) {
		return "Number of jail: 0\nJail list:", nil
	})
	if !s.Running || s.JailCount != 0 || s.Jails == nil {
		t.Fatalf("%+v", s)
	}
}

func TestZimbraCommandFailures(t *testing.T) {
	for _, failure := range []error{context.DeadlineExceeded, errors.New("permission_denied"), exec.ErrNotFound} {
		s := collectZimbra(context.Background(), config.Module{}, func(context.Context, string, ...string) (string, error) { return "", failure })
		if s.Healthy || s.Queue != nil || s.Errors["services"] != monitoringError(failure) {
			t.Fatalf("%+v", s)
		}
	}
}

func TestModuleSettingsAndOutputLimit(t *testing.T) {
	var cfg config.Config
	if err := json.Unmarshal([]byte(`{"monitoring":{"zimbra":{"enabled":true,"interval":"90s"}}}`), &cfg); err != nil {
		t.Fatal(err)
	}
	if !cfg.Monitoring.Zimbra.Enabled || cfg.Monitoring.Fail2Ban.Enabled {
		t.Fatal(cfg.Monitoring)
	}
	if moduleDuration(cfg.Monitoring.Zimbra.Interval, time.Minute) != 90*time.Second || moduleDuration("-1s", time.Minute) != time.Minute {
		t.Fatal("duration defaults")
	}
	var out limitedOutput
	n, err := out.Write(make([]byte, 2*1024*1024))
	if err != nil || n != 2*1024*1024 || len(out.data) != 1024*1024 || !out.exceeded {
		t.Fatal("output not bounded")
	}
}
