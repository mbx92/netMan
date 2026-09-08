package telemetry

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestZimbraCertificate(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "cert.pem")
	for _, tc := range []struct {
		name       string
		start, end time.Duration
	}{
		{"valid", -time.Hour, 90 * 24 * time.Hour},
		{"expiring", -time.Hour, 30 * 24 * time.Hour},
		{"expired", -24 * time.Hour, 0},
		{"not_yet_valid", time.Hour, 90 * 24 * time.Hour},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cert := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "mail.example.test"}, DNSNames: []string{"mail.example.test"}, NotBefore: now.Add(tc.start), NotAfter: now.Add(tc.end)}
			der, err := x509.CreateCertificate(rand.Reader, cert, cert, &key.PublicKey, key)
			if err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(path, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0600); err != nil {
				t.Fatal(err)
			}
			s := collectZimbraCertificate(path, now)
			if s.Status != tc.name || s.Subject != cert.Subject.CommonName || s.NotAfter == nil || !s.NotAfter.Equal(cert.NotAfter) {
				t.Fatalf("unexpected certificate: %+v", s)
			}
		})
	}
	if err := os.WriteFile(path, []byte("invalid"), 0600); err != nil {
		t.Fatal(err)
	}
	if s := collectZimbraCertificate(path, now); s.Status != "unknown" || s.Error != "invalid_certificate" {
		t.Fatal(s)
	}
	if s := collectZimbraCertificate(path+"-missing", now); s.Error != "certificate_unavailable" {
		t.Fatal(s)
	}
}
