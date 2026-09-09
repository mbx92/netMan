package telemetry

import (
	"context"
	"errors"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/netman/agent/internal/config"
	"github.com/shirou/gopsutil/v3/disk"
)

var errMalformed = errors.New("malformed_output")

type ZimbraService struct {
	Status string `json:"status"`
}
type ZimbraQueue struct {
	Total    int64            `json:"total"`
	Deferred int64            `json:"deferred"`
	Active   int64            `json:"active"`
	Counts   map[string]int64 `json:"counts"`
}
type ZimbraAccountHealth struct {
	QuotaPercent     *float64   `json:"quotaPercent,omitempty"`
	LastLogonAt      *time.Time `json:"lastLogonAt,omitempty"`
	Email            string     `json:"email"`
	DisplayName      string     `json:"displayName,omitempty"`
	Status           string     `json:"status,omitempty"`
	Warnings         []string   `json:"warnings,omitempty"`
	QuotaUsedBytes   *int64     `json:"quotaUsedBytes,omitempty"`
	QuotaLimitBytes  *int64     `json:"quotaLimitBytes,omitempty"`
	MailboxSizeBytes *int64     `json:"mailboxSizeBytes,omitempty"`
}
type ZimbraAccountSnapshot struct {
	CheckedAt         time.Time             `json:"checkedAt"`
	ByStatus          map[string]int        `json:"byStatus,omitempty"`
	Entries           []ZimbraAccountHealth `json:"entries,omitempty"`
	Errors            map[string]string     `json:"errors,omitempty"`
	Total             int                   `json:"total"`
	Active            int                   `json:"active"`
	Locked            int                   `json:"locked"`
	Closed            int                   `json:"closed"`
	Maintenance       int                   `json:"maintenance"`
	QuotaWarningCount int                   `json:"quotaWarningCount"`
	InactiveCount     int                   `json:"inactiveCount"`
	Truncated         bool                  `json:"truncated,omitempty"`
}
type ZimbraSnapshot struct {
	SSL       *ZimbraCertificate       `json:"ssl,omitempty"`
	Accounts  *ZimbraAccountSnapshot   `json:"accounts,omitempty"`
	Available bool                     `json:"available"`
	Healthy   bool                     `json:"healthy"`
	Status    string                   `json:"status"`
	Version   string                   `json:"version,omitempty"`
	Services  map[string]ZimbraService `json:"services"`
	Queue     *ZimbraQueue             `json:"queue,omitempty"`
	Storage   []PartitionUsage         `json:"storage,omitempty"`
	Errors    map[string]string        `json:"errors,omitempty"`
	CheckedAt time.Time                `json:"checkedAt"`
}

type zimbraAccountAttrs struct {
	email       string
	displayName string
	status      string
	quotaLimit  *int64
	lastLogon   *time.Time
}

type zimbraQuotaUsage struct {
	limit int64
	used  int64
}

func parseZimbraStatus(raw string) (map[string]ZimbraService, error) {
	services := map[string]ZimbraService{}
	for _, line := range strings.Split(raw, "\n") {
		f := strings.Fields(line)
		if len(f) < 2 {
			continue
		}
		status := strings.ToLower(f[1])
		if status == "running" || status == "stopped" {
			services[f[0]] = ZimbraService{Status: status}
		}
	}
	if len(services) == 0 {
		return services, errMalformed
	}
	return services, nil
}

func parseZimbraQueue(raw string) (*ZimbraQueue, error) {
	q := &ZimbraQueue{Counts: map[string]int64{}}
	for _, line := range strings.Split(strings.TrimSpace(raw), "\n") {
		key, value, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok {
			return nil, errMalformed
		}
		switch key {
		case "hold", "corrupt", "deferred", "active", "incoming", "maildrop":
		default:
			return nil, errMalformed
		}
		n, err := strconv.ParseInt(value, 10, 64)
		if _, exists := q.Counts[key]; exists || err != nil || n < 0 || n > 1<<53 || q.Total > 1<<53-n {
			return nil, errMalformed
		}
		q.Counts[key] = n
		q.Total += n
	}
	for _, key := range []string{"hold", "corrupt", "deferred", "active", "incoming"} {
		if _, ok := q.Counts[key]; !ok {
			return nil, errMalformed
		}
	}
	q.Deferred = q.Counts["deferred"]
	q.Active = q.Counts["active"]
	return q, nil
}

func parseZimbraAccounts(raw string, quota map[string]zimbraQuotaUsage, now time.Time, inactiveDays int, quotaWarnPercent float64, maxEntries int) (*ZimbraAccountSnapshot, error) {
	var accounts []zimbraAccountAttrs
	current := map[string][]string{}
	currentEmail := ""
	flush := func() {
		if currentEmail == "" {
			currentEmail = firstAttr(current, "mail", "zimbraMailDeliveryAddress", "name")
		}
		if !validZimbraIdentity(currentEmail) {
			current = map[string][]string{}
			currentEmail = ""
			return
		}
		limit := parseOptionalInt(firstAttr(current, "zimbraMailQuota"))
		account := zimbraAccountAttrs{
			email:       strings.ToLower(currentEmail),
			displayName: firstAttr(current, "displayName", "cn"),
			status:      strings.ToLower(firstAttr(current, "zimbraAccountStatus")),
			quotaLimit:  limit,
			lastLogon:   parseZimbraTime(firstAttr(current, "zimbraLastLogonTimestamp")),
		}
		if account.status == "" {
			account.status = "unknown"
		}
		accounts = append(accounts, account)
		current = map[string][]string{}
		currentEmail = ""
	}
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			flush()
			continue
		}
		if email, ok := strings.CutPrefix(line, "# name "); ok {
			flush()
			currentEmail = strings.TrimSpace(email)
			current["name"] = append(current["name"], currentEmail)
			continue
		}
		key, value, ok := strings.Cut(line, ":")
		if ok {
			key = strings.TrimSpace(key)
			value = strings.TrimSpace(value)
			if strings.EqualFold(key, "name") && currentEmail != "" {
				flush()
			}
			current[key] = append(current[key], value)
			if strings.EqualFold(key, "name") || strings.EqualFold(key, "mail") || strings.EqualFold(key, "zimbraMailDeliveryAddress") {
				if currentEmail == "" && validZimbraIdentity(value) {
					currentEmail = value
				}
			}
			continue
		}
		if validZimbraIdentity(line) {
			flush()
			currentEmail = line
			current["name"] = append(current["name"], line)
		}
	}
	flush()
	if len(accounts) == 0 {
		return nil, errMalformed
	}

	if inactiveDays <= 0 {
		inactiveDays = 90
	}
	if quotaWarnPercent <= 0 || quotaWarnPercent > 100 {
		quotaWarnPercent = 80
	}
	if maxEntries <= 0 {
		maxEntries = 500
	}

	s := &ZimbraAccountSnapshot{CheckedAt: now.UTC(), ByStatus: map[string]int{}, Errors: map[string]string{}}
	entries := make([]ZimbraAccountHealth, 0, len(accounts))
	for _, account := range accounts {
		status := account.status
		s.Total++
		s.ByStatus[status]++
		switch status {
		case "active":
			s.Active++
		case "locked", "lockout":
			s.Locked++
		case "closed":
			s.Closed++
		case "maintenance":
			s.Maintenance++
		}

		health := ZimbraAccountHealth{
			Email:       account.email,
			DisplayName: account.displayName,
			Status:      status,
			LastLogonAt: account.lastLogon,
		}
		if account.quotaLimit != nil {
			health.QuotaLimitBytes = account.quotaLimit
		}
		if usage, ok := quota[account.email]; ok {
			used, limit := usage.used, usage.limit
			health.QuotaUsedBytes = &used
			health.MailboxSizeBytes = &used
			health.QuotaLimitBytes = &limit
			if limit > 0 {
				pct := float64(used) * 100 / float64(limit)
				health.QuotaPercent = &pct
				if pct >= quotaWarnPercent {
					health.Warnings = append(health.Warnings, "quota")
					s.QuotaWarningCount++
				}
			}
		}
		if status != "active" {
			health.Warnings = append(health.Warnings, "status")
		}
		if account.lastLogon != nil && now.Sub(*account.lastLogon) >= time.Duration(inactiveDays)*24*time.Hour {
			health.Warnings = append(health.Warnings, "inactive")
			s.InactiveCount++
		}
		entries = append(entries, health)
	}
	sort.Slice(entries, func(i, j int) bool {
		if len(entries[i].Warnings) != len(entries[j].Warnings) {
			return len(entries[i].Warnings) > len(entries[j].Warnings)
		}
		if entries[i].Status != entries[j].Status {
			return entries[i].Status < entries[j].Status
		}
		return entries[i].Email < entries[j].Email
	})
	if len(entries) > maxEntries {
		s.Truncated = true
		s.Errors["entries"] = "truncated"
		entries = entries[:maxEntries]
	}
	s.Entries = entries
	if len(s.Errors) == 0 {
		s.Errors = nil
	}
	return s, nil
}

func parseZimbraQuotaUsage(raw string) map[string]zimbraQuotaUsage {
	out := map[string]zimbraQuotaUsage{}
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		switch {
		case validZimbraIdentity(fields[0]):
			limit, errLimit := strconv.ParseInt(fields[1], 10, 64)
			used, errUsed := strconv.ParseInt(fields[2], 10, 64)
			if errLimit == nil && errUsed == nil && limit >= 0 && used >= 0 {
				out[strings.ToLower(fields[0])] = zimbraQuotaUsage{limit: limit, used: used}
			}
		case validZimbraIdentity(fields[2]):
			used, errUsed := strconv.ParseInt(fields[0], 10, 64)
			limit, errLimit := strconv.ParseInt(fields[1], 10, 64)
			if errLimit == nil && errUsed == nil && limit >= 0 && used >= 0 {
				out[strings.ToLower(fields[2])] = zimbraQuotaUsage{limit: limit, used: used}
			}
		}
	}
	return out
}

func firstAttr(attrs map[string][]string, keys ...string) string {
	for _, key := range keys {
		for attrKey, values := range attrs {
			if !strings.EqualFold(attrKey, key) || len(values) == 0 {
				continue
			}
			return values[0]
		}
	}
	return ""
}

func parseOptionalInt(raw string) *int64 {
	if raw == "" {
		return nil
	}
	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || n < 0 {
		return nil
	}
	return &n
}

func parseZimbraTime(raw string) *time.Time {
	if raw == "" {
		return nil
	}
	for _, layout := range []string{"20060102150405Z", time.RFC3339} {
		t, err := time.Parse(layout, raw)
		if err == nil {
			utc := t.UTC()
			return &utc
		}
	}
	return nil
}

func validZimbraIdentity(value string) bool {
	if value == "" || strings.HasPrefix(value, "-") || strings.ContainsAny(value, " \t\r\n'\"`$\\;&|<>") {
		return false
	}
	at := strings.Count(value, "@")
	return at == 1 && !strings.HasSuffix(value, "@") && !strings.HasPrefix(value, "@")
}

func validZimbraHostname(value string) bool {
	if value == "" || strings.HasPrefix(value, "-") || len(value) > 253 {
		return false
	}
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '-' {
			continue
		}
		return false
	}
	return true
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\\''") + "'"
}

func shellCommand(args ...string) string {
	quoted := make([]string, 0, len(args))
	for _, arg := range args {
		quoted = append(quoted, shellQuote(arg))
	}
	return strings.Join(quoted, " ")
}

func zimbraBinCommand(ctx context.Context, cfg config.Module, run commandRunner, binary string, args ...string) (string, error) {
	if cfg.Sudo {
		sudoArgs := []string{"-n", "-i", "-u", "zimbra", "--", binary}
		sudoArgs = append(sudoArgs, args...)
		return moduleCommand(ctx, cfg, run, "sudo", sudoArgs...)
	}
	cmdArgs := append([]string{binary}, args...)
	return moduleCommand(ctx, cfg, run, "su", "-", "zimbra", "-c", shellCommand(cmdArgs...))
}

func collectZimbraAccounts(ctx context.Context, cfg config.Module, run commandRunner) *ZimbraAccountSnapshot {
	if !cfg.AccountsEnabled {
		return nil
	}
	accountCfg := cfg
	if cfg.AccountTimeout != "" {
		accountCfg.Timeout = cfg.AccountTimeout
	}
	now := time.Now().UTC()
	s := &ZimbraAccountSnapshot{CheckedAt: now, ByStatus: map[string]int{}, Errors: map[string]string{}}
	rawAccounts, err := zimbraBinCommand(ctx, accountCfg, run, "/opt/zimbra/bin/zmprov", "-l", "gaa", "-v")
	if err != nil {
		s.Errors["accounts"] = monitoringError(err)
		return s
	}
	rawHostname, err := zimbraBinCommand(ctx, accountCfg, run, "/opt/zimbra/bin/zmhostname")
	quota := map[string]zimbraQuotaUsage{}
	if err != nil {
		s.Errors["quota"] = monitoringError(err)
	} else {
		hostname := strings.TrimSpace(rawHostname)
		if validZimbraHostname(hostname) {
			rawQuota, err := zimbraBinCommand(ctx, accountCfg, run, "/opt/zimbra/bin/zmprov", "gqu", hostname)
			if err != nil {
				s.Errors["quota"] = monitoringError(err)
			} else {
				quota = parseZimbraQuotaUsage(rawQuota)
			}
		} else {
			s.Errors["quota"] = "malformed_output"
		}
	}
	parsed, err := parseZimbraAccounts(rawAccounts, quota, now, cfg.AccountInactiveDays, cfg.AccountQuotaWarnPercent, cfg.AccountMaxEntries)
	if err != nil {
		s.Errors["accounts"] = monitoringError(err)
		return s
	}
	if len(s.Errors) > 0 {
		parsed.Errors = s.Errors
	}
	return parsed
}

func collectZimbra(ctx context.Context, cfg config.Module, run commandRunner) ZimbraSnapshot {
	s := ZimbraSnapshot{CheckedAt: time.Now().UTC(), Status: "unknown", Services: map[string]ZimbraService{}, Errors: map[string]string{}}
	if _, err := os.Stat("/opt/zimbra/bin/zmcontrol"); err == nil {
		s.Available = true
	}
	control := func(command string) (string, error) {
		if cfg.Sudo {
			return moduleCommand(ctx, cfg, run, "sudo", "-n", "-i", "-u", "zimbra", "--", "/opt/zimbra/bin/zmcontrol", command)
		}
		// Only these fixed literal shell strings are allowed; no external input.
		literal := "/opt/zimbra/bin/zmcontrol status"
		if command == "-v" {
			literal = "/opt/zimbra/bin/zmcontrol -v"
		}
		return moduleCommand(ctx, cfg, run, "su", "-", "zimbra", "-c", literal)
	}
	raw, cmdErr := control("status")
	services, parseErr := parseZimbraStatus(raw)
	if parseErr == nil {
		s.Services = services
		s.Available = true
		s.Healthy = true
		s.Status = "running"
		for _, svc := range services {
			if svc.Status != "running" {
				s.Healthy = false
				s.Status = "degraded"
			}
		}
	} else {
		s.Errors["services"] = monitoringError(parseErr)
	}
	if cmdErr != nil {
		s.Errors["services"] = monitoringError(cmdErr)
		s.Healthy = false
	}
	raw, err := control("-v")
	if err != nil {
		s.Errors["version"] = monitoringError(err)
	} else if strings.HasPrefix(strings.TrimSpace(raw), "Release ") {
		s.Version = strings.TrimSpace(raw)
		s.Available = true
	} else {
		s.Errors["version"] = "malformed_output"
	}
	if cfg.Sudo {
		raw, err = moduleCommand(ctx, cfg, run, "sudo", "-n", "--", "/opt/zimbra/libexec/zmqstat")
	} else {
		raw, err = moduleCommand(ctx, cfg, run, "/opt/zimbra/libexec/zmqstat")
	}
	if err == nil {
		s.Queue, err = parseZimbraQueue(raw)
	}
	if err != nil {
		s.Errors["queue"] = monitoringError(err)
	}
	for _, path := range []string{"/opt/zimbra/store", "/opt/zimbra/index"} {
		du, err := disk.UsageWithContext(ctx, path)
		if err != nil {
			s.Errors[path] = "storage_unavailable"
			continue
		}
		s.Storage = append(s.Storage, PartitionUsage{Mountpoint: path, Percent: du.UsedPercent, TotalBytes: du.Total, UsedBytes: du.Used})
	}
	s.SSL = collectZimbraCertificate(cfg.CertificatePath, time.Now().UTC())
	s.Accounts = collectZimbraAccounts(ctx, cfg, run)
	return s
}
