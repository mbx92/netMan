package client

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net"
	"net/mail"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	zimbraCommercialDir = "/opt/zimbra/ssl/zimbra/commercial"
	zimbraCertManager   = "/opt/zimbra/bin/zmcertmgr"
	zimbraControl       = "/opt/zimbra/bin/zmcontrol"
	maxSSLPEMSize       = 256 * 1024
)

type zimbraSSLDeployRequest struct {
	RequestID       string
	Mode            string
	Domains         []string
	Email           string
	CertificatePEM  string
	PrivateKeyPEM   string
	CAChainPEM      string
	SecureTransport bool
}

type zimbraSSLDeployDetails struct {
	Mode        string `json:"mode"`
	Subject     string `json:"subject"`
	NotAfter    string `json:"notAfter"`
	Fingerprint string `json:"fingerprint"`
	BackupID    string `json:"backupId"`
}

type zimbraSSLDeployResult struct {
	Type      string                  `json:"type"`
	RequestID string                  `json:"requestId"`
	Success   bool                    `json:"success"`
	Error     string                  `json:"error,omitempty"`
	Details   *zimbraSSLDeployDetails `json:"details,omitempty"`
}

var zimbraSSLDeployMu sync.Mutex

func handleZimbraSSLDeploy(conn *websocket.Conn, writeMu *sync.Mutex, request zimbraSSLDeployRequest) {
	result := zimbraSSLDeployResult{Type: "zimbra-ssl-deploy-result", RequestID: request.RequestID}
	if !zimbraSSLDeployMu.TryLock() {
		result.Error = "ssl_deployment_in_progress"
	} else {
		defer zimbraSSLDeployMu.Unlock()
		ctx, cancel := context.WithTimeout(context.Background(), 12*time.Minute)
		defer cancel()

		details, code := deployZimbraSSL(ctx, request)
		if code != "" {
			result.Error = code
		} else {
			result.Success = true
			result.Details = details
		}
	}

	writeMu.Lock()
	defer writeMu.Unlock()
	_ = conn.WriteJSON(result)
}

func deployZimbraSSL(ctx context.Context, request zimbraSSLDeployRequest) (*zimbraSSLDeployDetails, string) {
	if runtime.GOOS != "linux" {
		return nil, "unsupported_platform"
	}
	if os.Geteuid() != 0 {
		return nil, "root_required"
	}
	if _, err := os.Stat(zimbraCertManager); err != nil {
		return nil, "zimbra_not_installed"
	}
	domains, err := validateSSLDomains(request.Domains)
	if err != nil {
		return nil, "invalid_domains"
	}

	workDir, err := os.MkdirTemp("", "netman-zimbra-ssl-")
	if err != nil {
		return nil, "temporary_directory_failed"
	}
	defer os.RemoveAll(workDir)
	_ = os.Chmod(workDir, 0700)
	if err := chownZimbra(workDir); err != nil {
		return nil, "zimbra_account_unavailable"
	}

	certPath := filepath.Join(workDir, "certificate.pem")
	keyPath := filepath.Join(workDir, "private.key")
	chainPath := filepath.Join(workDir, "ca-chain.pem")

	switch request.Mode {
	case "letsencrypt":
		if err := validateSSLEmail(request.Email); err != nil {
			return nil, "invalid_email"
		}
		if _, err := exec.LookPath("certbot"); err != nil {
			return nil, "certbot_not_installed"
		}
		args := []string{"certonly", "--standalone", "--non-interactive", "--agree-tos", "--keep-until-expiring", "--preferred-challenges", "http", "--key-type", "rsa", "--rsa-key-size", "2048", "--email", request.Email, "--cert-name", domains[0]}
		for _, domain := range domains {
			args = append(args, "-d", domain)
		}
		if err := runSSLCommand(ctx, "certbot", args...); err != nil {
			return nil, "acme_issue_failed"
		}
		liveDir := filepath.Join("/etc/letsencrypt/live", domains[0])
		if err := copySSLFile(filepath.Join(liveDir, "cert.pem"), certPath, 0644); err != nil {
			return nil, "acme_certificate_unavailable"
		}
		if err := copySSLFile(filepath.Join(liveDir, "privkey.pem"), keyPath, 0600); err != nil {
			return nil, "acme_private_key_unavailable"
		}
		if err := copySSLFile(filepath.Join(liveDir, "chain.pem"), chainPath, 0644); err != nil {
			return nil, "acme_chain_unavailable"
		}
		if err := appendSystemRoot(chainPath); err != nil {
			return nil, "acme_root_ca_unavailable"
		}
	case "premium":
		if !request.SecureTransport {
			return nil, "secure_transport_required"
		}
		if err := writeSSLPEM(certPath, request.CertificatePEM, 0644); err != nil {
			return nil, "invalid_certificate"
		}
		if err := writeSSLPEM(keyPath, request.PrivateKeyPEM, 0600); err != nil {
			return nil, "invalid_private_key"
		}
		if err := writeSSLPEM(chainPath, request.CAChainPEM, 0644); err != nil {
			return nil, "invalid_ca_chain"
		}
	default:
		return nil, "invalid_ssl_mode"
	}

	leaf, err := validateSSLMaterial(certPath, keyPath, chainPath, domains)
	if err != nil {
		return nil, sslValidationCode(err)
	}

	backupDir, backupID, err := backupZimbraCertificate()
	if err != nil {
		return nil, "backup_failed"
	}

	targetKey := filepath.Join(zimbraCommercialDir, "commercial.key")
	if err := copySSLFile(keyPath, targetKey, 0640); err != nil {
		_ = restoreZimbraKey(backupDir)
		return nil, "private_key_install_failed"
	}
	if err := chownZimbra(targetKey); err != nil {
		_ = restoreZimbraKey(backupDir)
		return nil, "private_key_install_failed"
	}
	if err := runAsZimbra(ctx, zimbraCertManager, "verifycrt", "comm", targetKey, certPath, chainPath); err != nil {
		_ = restoreZimbraKey(backupDir)
		return nil, "certificate_verify_failed"
	}
	if err := runAsZimbra(ctx, zimbraCertManager, "deploycrt", "comm", certPath, chainPath); err != nil {
		return nil, deploymentFailure(ctx, backupDir, "certificate_deploy_failed")
	}
	if err := runAsZimbra(ctx, zimbraControl, "restart"); err != nil {
		return nil, deploymentFailure(ctx, backupDir, "zimbra_restart_failed")
	}

	fingerprint := certificateFingerprint(leaf)
	if err := waitForDeployedCertificate(ctx, domains[0], fingerprint); err != nil {
		return nil, deploymentFailure(ctx, backupDir, "endpoint_verification_failed")
	}

	return &zimbraSSLDeployDetails{
		Mode:        request.Mode,
		Subject:     leaf.Subject.String(),
		NotAfter:    leaf.NotAfter.UTC().Format(time.RFC3339),
		Fingerprint: fingerprint,
		BackupID:    backupID,
	}, ""
}

func validateSSLDomains(values []string) ([]string, error) {
	if len(values) == 0 || len(values) > 20 {
		return nil, errors.New("invalid domain count")
	}
	seen := map[string]bool{}
	domains := make([]string, 0, len(values))
	for _, value := range values {
		domain := strings.ToLower(strings.TrimSpace(strings.TrimSuffix(value, ".")))
		if domain == "" || len(domain) > 253 || net.ParseIP(domain) != nil || strings.Contains(domain, "*") {
			return nil, errors.New("invalid domain")
		}
		labels := strings.Split(domain, ".")
		if len(labels) < 2 {
			return nil, errors.New("invalid domain")
		}
		for _, label := range labels {
			if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
				return nil, errors.New("invalid domain")
			}
			for _, char := range label {
				if (char < 'a' || char > 'z') && (char < '0' || char > '9') && char != '-' {
					return nil, errors.New("invalid domain")
				}
			}
		}
		if !seen[domain] {
			seen[domain] = true
			domains = append(domains, domain)
		}
	}
	return domains, nil
}

func validateSSLEmail(value string) error {
	address, err := mail.ParseAddress(strings.TrimSpace(value))
	if err != nil || address.Address != strings.TrimSpace(value) || len(value) > 254 {
		return errors.New("invalid email")
	}
	return nil
}

func writeSSLPEM(path, value string, mode os.FileMode) error {
	if value == "" || len(value) > maxSSLPEMSize {
		return errors.New("invalid pem")
	}
	return os.WriteFile(path, []byte(value), mode)
}

func validateSSLMaterial(certPath, keyPath, chainPath string, domains []string) (*x509.Certificate, error) {
	certPEM, err := os.ReadFile(certPath)
	if err != nil || len(certPEM) > maxSSLPEMSize {
		return nil, errors.New("certificate")
	}
	keyPEM, err := os.ReadFile(keyPath)
	if err != nil || len(keyPEM) > maxSSLPEMSize {
		return nil, errors.New("private_key")
	}
	chainPEM, err := os.ReadFile(chainPath)
	if err != nil || len(chainPEM) > maxSSLPEMSize || countCertificates(chainPEM) == 0 {
		return nil, errors.New("ca_chain")
	}
	pair, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil || len(pair.Certificate) == 0 {
		return nil, errors.New("key_mismatch")
	}
	leaf, err := x509.ParseCertificate(pair.Certificate[0])
	if err != nil {
		return nil, errors.New("certificate")
	}
	now := time.Now()
	if now.Before(leaf.NotBefore) || !now.Before(leaf.NotAfter) {
		return nil, errors.New("certificate_dates")
	}
	for _, domain := range domains {
		if err := leaf.VerifyHostname(domain); err != nil {
			return nil, errors.New("hostname_mismatch")
		}
	}
	return leaf, nil
}

func countCertificates(data []byte) int {
	count := 0
	for len(data) > 0 {
		block, rest := pem.Decode(data)
		if block == nil {
			break
		}
		if block.Type == "CERTIFICATE" {
			if _, err := x509.ParseCertificate(block.Bytes); err != nil {
				return 0
			}
			count++
		}
		data = rest
	}
	return count
}

func parseCertificates(data []byte) ([]*x509.Certificate, error) {
	certificates := []*x509.Certificate{}
	for len(data) > 0 {
		block, rest := pem.Decode(data)
		if block == nil {
			break
		}
		data = rest
		if block.Type != "CERTIFICATE" {
			continue
		}
		certificate, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, err
		}
		certificates = append(certificates, certificate)
	}
	if len(certificates) == 0 {
		return nil, errors.New("no certificates")
	}
	return certificates, nil
}

// Certbot's chain.pem normally stops at the intermediate, while Zimbra's
// certificate manager expects the CA bundle to include its root. Complete the
// chain from the host trust store instead of downloading trust material.
func appendSystemRoot(chainPath string) error {
	chainPEM, err := os.ReadFile(chainPath)
	if err != nil {
		return err
	}
	chain, err := parseCertificates(chainPEM)
	if err != nil {
		return err
	}
	last := chain[len(chain)-1]
	if last.Subject.String() == last.Issuer.String() && last.CheckSignatureFrom(last) == nil {
		return nil
	}
	entries, err := os.ReadDir("/etc/ssl/certs")
	if err != nil {
		return err
	}
	for _, entry := range entries {
		path := filepath.Join("/etc/ssl/certs", entry.Name())
		info, err := os.Stat(path)
		if err != nil || !info.Mode().IsRegular() || info.Size() > 128*1024 {
			continue
		}
		candidatePEM, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		candidates, err := parseCertificates(candidatePEM)
		if err != nil {
			continue
		}
		for _, candidate := range candidates {
			if !candidate.IsCA || candidate.Subject.String() != last.Issuer.String() || last.CheckSignatureFrom(candidate) != nil {
				continue
			}
			file, err := os.OpenFile(chainPath, os.O_APPEND|os.O_WRONLY, 0644)
			if err != nil {
				return err
			}
			rootPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: candidate.Raw})
			_, writeErr := file.Write(append([]byte("\n"), rootPEM...))
			closeErr := file.Close()
			if writeErr != nil {
				return writeErr
			}
			return closeErr
		}
	}
	return errors.New("root CA not found")
}

func sslValidationCode(err error) string {
	switch err.Error() {
	case "private_key":
		return "invalid_private_key"
	case "ca_chain":
		return "invalid_ca_chain"
	case "key_mismatch":
		return "certificate_key_mismatch"
	case "certificate_dates":
		return "certificate_not_currently_valid"
	case "hostname_mismatch":
		return "certificate_hostname_mismatch"
	default:
		return "invalid_certificate"
	}
}

func backupZimbraCertificate() (string, string, error) {
	root := "/var/lib/netman-agent/zimbra-ssl-backups"
	if err := os.MkdirAll(root, 0700); err != nil {
		return "", "", err
	}
	backupID := time.Now().UTC().Format("20060102T150405Z")
	backupDir := filepath.Join(root, backupID)
	for suffix := 1; ; suffix++ {
		err := os.Mkdir(backupDir, 0700)
		if err == nil {
			break
		}
		if !os.IsExist(err) {
			return "", "", err
		}
		backupID = fmt.Sprintf("%s-%d", time.Now().UTC().Format("20060102T150405Z"), suffix)
		backupDir = filepath.Join(root, backupID)
	}
	for _, name := range []string{"commercial.key", "commercial.crt", "commercial_ca.crt"} {
		source := filepath.Join(zimbraCommercialDir, name)
		if _, err := os.Stat(source); err != nil {
			return "", "", err
		}
		mode := os.FileMode(0644)
		if strings.HasSuffix(name, ".key") {
			mode = 0600
		}
		if err := copySSLFile(source, filepath.Join(backupDir, name), mode); err != nil {
			return "", "", err
		}
	}
	return backupDir, backupID, nil
}

func deploymentFailure(ctx context.Context, backupDir, code string) string {
	rollbackCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	if err := rollbackZimbraCertificate(rollbackCtx, backupDir); err != nil {
		return code + "_rollback_failed"
	}
	return code + "_rolled_back"
}

func restoreZimbraKey(backupDir string) error {
	target := filepath.Join(zimbraCommercialDir, "commercial.key")
	if err := copySSLFile(filepath.Join(backupDir, "commercial.key"), target, 0640); err != nil {
		return err
	}
	return chownZimbra(target)
}

func rollbackZimbraCertificate(ctx context.Context, backupDir string) error {
	if err := restoreZimbraKey(backupDir); err != nil {
		return err
	}
	rollbackDir, err := os.MkdirTemp("", "netman-zimbra-rollback-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(rollbackDir)
	if err := os.Chmod(rollbackDir, 0700); err != nil {
		return err
	}
	if err := chownZimbra(rollbackDir); err != nil {
		return err
	}
	cert := filepath.Join(rollbackDir, "commercial.crt")
	chain := filepath.Join(rollbackDir, "commercial_ca.crt")
	if err := copySSLFile(filepath.Join(backupDir, "commercial.crt"), cert, 0644); err != nil {
		return err
	}
	if err := copySSLFile(filepath.Join(backupDir, "commercial_ca.crt"), chain, 0644); err != nil {
		return err
	}
	if err := runAsZimbra(ctx, zimbraCertManager, "verifycrt", "comm", filepath.Join(zimbraCommercialDir, "commercial.key"), cert, chain); err != nil {
		return err
	}
	if err := runAsZimbra(ctx, zimbraCertManager, "deploycrt", "comm", cert, chain); err != nil {
		return err
	}
	return runAsZimbra(ctx, zimbraControl, "restart")
}

func chownZimbra(path string) error {
	account, err := user.Lookup("zimbra")
	if err != nil {
		return err
	}
	uid, errUID := strconv.Atoi(account.Uid)
	gid, errGID := strconv.Atoi(account.Gid)
	if errUID != nil || errGID != nil {
		return errors.New("invalid zimbra account")
	}
	return os.Chown(path, uid, gid)
}

func runAsZimbra(ctx context.Context, binary string, args ...string) error {
	parts := []string{shellEscape(binary)}
	for _, arg := range args {
		parts = append(parts, shellEscape(arg))
	}
	if runuser, err := exec.LookPath("runuser"); err == nil {
		return runSSLCommand(ctx, runuser, "-l", "zimbra", "-c", strings.Join(parts, " "))
	}
	return runSSLCommand(ctx, "su", "-", "zimbra", "-c", strings.Join(parts, " "))
}

func shellEscape(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\\''") + "'"
}

func runSSLCommand(ctx context.Context, name string, args ...string) error {
	command := exec.CommandContext(ctx, name, args...)
	command.WaitDelay = time.Second
	configureZimbraSSLCommand(command)
	command.Stdout = io.Discard
	command.Stderr = io.Discard
	return command.Run()
}

func copySSLFile(source, destination string, mode os.FileMode) error {
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()
	info, err := in.Stat()
	if err != nil || info.Size() > maxSSLPEMSize {
		return errors.New("file too large")
	}
	out, err := os.OpenFile(destination, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(out, io.LimitReader(in, maxSSLPEMSize+1))
	closeErr := out.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Chmod(destination, mode)
}

func certificateFingerprint(cert *x509.Certificate) string {
	sum := sha256.Sum256(cert.Raw)
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

func waitForDeployedCertificate(ctx context.Context, serverName, fingerprint string) error {
	deadline := time.Now().Add(2 * time.Minute)
	ports := []string{"443", "465", "993", "995"}
	for time.Now().Before(deadline) {
		matchingPorts := 0
		mismatchedPort := false
		for _, port := range ports {
			dialer := &net.Dialer{Timeout: 3 * time.Second}
			conn, err := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort("127.0.0.1", port), &tls.Config{
				ServerName:         serverName,
				InsecureSkipVerify: true, // Fingerprint equality below is the trust decision for deployment verification.
				MinVersion:         tls.VersionTLS12,
			})
			if err == nil {
				state := conn.ConnectionState()
				_ = conn.Close()
				if len(state.PeerCertificates) > 0 {
					if certificateFingerprint(state.PeerCertificates[0]) == fingerprint {
						matchingPorts++
					} else {
						mismatchedPort = true
					}
				}
			}
		}
		if matchingPorts > 0 && !mismatchedPort {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(5 * time.Second):
		}
	}
	return errors.New("deployed certificate not served")
}
