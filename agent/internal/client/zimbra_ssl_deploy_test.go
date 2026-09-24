package client

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

func TestValidateSSLDomains(t *testing.T) {
	domains, err := validateSSLDomains([]string{"Mail.Example.com.", "mail.example.com", "webmail.example.com"})
	if err != nil || len(domains) != 2 || domains[0] != "mail.example.com" {
		t.Fatalf("unexpected domains: %#v, %v", domains, err)
	}
	for _, values := range [][]string{{}, {"localhost"}, {"-mail.example.com"}, {"*.example.com"}, {"127.0.0.1"}} {
		if _, err := validateSSLDomains(values); err == nil {
			t.Fatalf("accepted invalid domains: %#v", values)
		}
	}
}

func TestValidateSSLMaterial(t *testing.T) {
	dir := t.TempDir()
	certPath := filepath.Join(dir, "cert.pem")
	keyPath := filepath.Join(dir, "key.pem")
	chainPath := filepath.Join(dir, "chain.pem")
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "mail.example.com"},
		DNSNames:     []string{"mail.example.com", "webmail.example.com"},
		NotBefore:    now.Add(-time.Hour),
		NotAfter:     now.Add(90 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})
	if err := os.WriteFile(certPath, certPEM, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyPath, keyPEM, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(chainPath, certPEM, 0600); err != nil {
		t.Fatal(err)
	}
	leaf, err := validateSSLMaterial(certPath, keyPath, chainPath, []string{"mail.example.com", "webmail.example.com"})
	if err != nil || leaf.Subject.CommonName != "mail.example.com" {
		t.Fatalf("unexpected validation: %+v, %v", leaf, err)
	}
	if _, err := validateSSLMaterial(certPath, keyPath, chainPath, []string{"other.example.com"}); err == nil || err.Error() != "hostname_mismatch" {
		t.Fatalf("expected hostname mismatch, got %v", err)
	}
	otherKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	otherDER, _ := x509.MarshalPKCS8PrivateKey(otherKey)
	if err := os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: otherDER}), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := validateSSLMaterial(certPath, keyPath, chainPath, []string{"mail.example.com"}); err == nil || err.Error() != "key_mismatch" {
		t.Fatalf("expected key mismatch, got %v", err)
	}
}
