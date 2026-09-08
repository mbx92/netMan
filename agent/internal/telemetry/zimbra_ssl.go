package telemetry

import (
	"crypto/x509"
	"encoding/pem"
	"io"
	"math"
	"os"
	"time"
)

// This checks the local certificate's validity period, not endpoint trust or deployment.
type ZimbraCertificate struct {
	Status        string     `json:"status"`
	Path          string     `json:"path"`
	Subject       string     `json:"subject,omitempty"`
	Issuer        string     `json:"issuer,omitempty"`
	DNSNames      []string   `json:"dnsNames,omitempty"`
	NotBefore     *time.Time `json:"notBefore,omitempty"`
	NotAfter      *time.Time `json:"notAfter,omitempty"`
	DaysRemaining int        `json:"daysRemaining"`
	Error         string     `json:"error,omitempty"`
}

func collectZimbraCertificate(path string, now time.Time) *ZimbraCertificate {
	if path == "" {
		path = "/opt/zimbra/ssl/zimbra/commercial/commercial.crt"
	}
	s := &ZimbraCertificate{Path: path, Status: "unknown"}
	f, err := os.Open(path)
	if err != nil {
		s.Error = "certificate_unavailable"
		if os.IsPermission(err) {
			s.Error = "permission_denied"
		}
		return s
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, 1024*1024+1))
	if err != nil || len(data) > 1024*1024 {
		s.Error = "certificate_read_failed"
		return s
	}
	block, _ := pem.Decode(data)
	if block == nil || block.Type != "CERTIFICATE" {
		s.Error = "invalid_certificate"
		return s
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		s.Error = "invalid_certificate"
		return s
	}
	s.Subject, s.Issuer, s.DNSNames = cert.Subject.CommonName, cert.Issuer.String(), cert.DNSNames
	s.NotBefore, s.NotAfter = &cert.NotBefore, &cert.NotAfter
	s.DaysRemaining = int(math.Floor(cert.NotAfter.Sub(now).Hours() / 24))
	s.Status = "valid"
	switch {
	case now.Before(cert.NotBefore):
		s.Status = "not_yet_valid"
	case !now.Before(cert.NotAfter):
		s.Status = "expired"
	case cert.NotAfter.Sub(now) <= 30*24*time.Hour:
		s.Status = "expiring"
	}
	return s
}
