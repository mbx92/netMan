//go:build windows

package main

// NetMan-Agent-Setup is the Windows installer EXE (UAC elevation, service,
// TightVNC, enroll). Built GOOS=windows; Docker embeds netman-agent.exe.

import (
	"bufio"
	"crypto/des"
	"crypto/rand"
	_ "embed"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

//go:embed payload/netman-agent.exe
var embeddedAgent []byte

// defaultServer is stamped at build with -ldflags "-X main.defaultServer=https://..."
var defaultServer = "http://localhost:3001"

const (
	serviceName = "netman-agent"
	vncMSIURL   = "https://www.tightvnc.com/download/2.8.85/tightvnc-2.8.85-gpl-setup-64bit.msi"
	vncRegPath  = `SOFTWARE\TightVNC\Server`
)

func main() {
	server := flag.String("server", defaultServer, "netMan server base URL")
	token := flag.String("token", "", "enrollment token from Agents > Add Agent")
	flag.Parse()

	if !isElevated() {
		fmt.Println("Requesting Administrator permission...")
		if err := relaunchElevated(); err != nil {
			fatalf("could not elevate: %v", err)
		}
		return
	}

	*server = strings.TrimRight(strings.TrimSpace(*server), "/")
	tok := strings.TrimSpace(*token)
	if tok == "" {
		fmt.Println()
		fmt.Println("NetMan Agent Setup")
		fmt.Println("Server:", *server)
		fmt.Println()
		fmt.Print("Enrollment token (Agents > Add Agent): ")
		line, _ := bufio.NewReader(os.Stdin).ReadString('\n')
		tok = strings.TrimSpace(line)
	}
	if tok == "" {
		fatalf("token is required")
	}

	installDir := filepath.Join(os.Getenv("ProgramFiles"), "netMan Agent")
	exePath := filepath.Join(installDir, "netman-agent.exe")
	dataDir := filepath.Join(programData(), "netMan-agent")

	fmt.Println("Copying agent...")
	if err := os.MkdirAll(installDir, 0755); err != nil {
		fatalf("%v", err)
	}
	agent, err := loadAgent(*server)
	if err != nil {
		fatalf("agent binary: %v", err)
	}
	if err := os.WriteFile(exePath, agent, 0755); err != nil {
		fatalf("%v", err)
	}
	unblock(exePath)

	vncPassword := randomPassword(8)
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		fatalf("%v", err)
	}
	_ = os.WriteFile(filepath.Join(dataDir, "vnc-password.txt"), []byte(vncPassword), 0600)
	grantSystemACL(dataDir)

	fmt.Println("Installing TightVNC (loopback only)...")
	if err := installTightVNC(); err != nil {
		fmt.Println("WARNING:", err)
	}
	if err := configureTightVNC(vncPassword); err != nil {
		fmt.Println("WARNING: VNC config:", err)
	}

	fmt.Println("Enrolling...")
	cmd := exec.Command(exePath, "-enroll", "-token", tok, "-server", *server)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fatalf("enrollment failed")
	}
	grantSystemACL(dataDir)

	fmt.Println("Installing Windows service...")
	if err := installService(exePath); err != nil {
		fatalf("service: %v", err)
	}
	installTray(exePath)

	fmt.Println()
	fmt.Println("Agent installed. It will start automatically after reboot.")
	fmt.Println("Press Enter to close.")
	_, _ = bufio.NewReader(os.Stdin).ReadString('\n')
}

func loadAgent(server string) ([]byte, error) {
	if len(embeddedAgent) > 32 {
		return embeddedAgent, nil
	}
	resp, err := http.Get(server + "/api/agents/download/windows")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func isElevated() bool {
	return windows.GetCurrentProcessToken().IsElevated()
}

func relaunchElevated() error {
	verb, _ := windows.UTF16PtrFromString("runas")
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exePtr, _ := windows.UTF16PtrFromString(exe)
	args, _ := windows.UTF16PtrFromString(strings.Join(os.Args[1:], " "))
	cwd, _ := windows.UTF16PtrFromString("")
	return windows.ShellExecute(0, verb, exePtr, args, cwd, windows.SW_SHOWNORMAL)
}

func installService(exePath string) error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	if s, err := m.OpenService(serviceName); err == nil {
		_, _ = s.Control(svc.Stop)
		_ = s.Delete()
		s.Close()
		deadline := time.Now().Add(15 * time.Second)
		for time.Now().Before(deadline) {
			if _, err := m.OpenService(serviceName); err != nil {
				break
			}
			time.Sleep(400 * time.Millisecond)
		}
	}

	s, err := m.CreateService(serviceName, exePath, mgr.Config{
		DisplayName:      "netMan Agent",
		StartType:        mgr.StartAutomatic,
		DelayedAutoStart: true,
		Description:      "netMan monitoring and remote-access agent",
	})
	if err != nil {
		return err
	}
	defer s.Close()
	_ = s.SetRecoveryActions([]mgr.RecoveryAction{
		{Type: mgr.ServiceRestart, Delay: 5 * time.Second},
		{Type: mgr.ServiceRestart, Delay: 5 * time.Second},
		{Type: mgr.ServiceRestart, Delay: 5 * time.Second},
	}, 86400)
	return s.Start()
}

func installTightVNC() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()
	if s, err := m.OpenService("tvnserver"); err == nil {
		s.Close()
		return nil
	}

	msi := filepath.Join(os.TempDir(), "tightvnc-setup.msi")
	resp, err := http.Get(vncMSIURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("TightVNC download HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if err := os.WriteFile(msi, data, 0644); err != nil {
		return err
	}
	unblock(msi)

	cmd := exec.Command("msiexec.exe", "/i", msi, "/quiet", "/norestart",
		"ADDLOCAL=Server",
		"SERVER_REGISTER_AS_SERVICE=1",
		"SERVER_START_SERVICE=1",
		"SERVER_ADD_FIREWALL_EXCEPTION=0",
	)
	if err := cmd.Run(); err != nil {
		if ee, ok := err.(*exec.ExitError); ok && ee.ExitCode() == 3010 {
			return nil
		}
		return err
	}
	return nil
}

func configureTightVNC(password string) error {
	key, _, err := registry.CreateKey(registry.LOCAL_MACHINE, vncRegPath, registry.ALL_ACCESS)
	if err != nil {
		return err
	}
	defer key.Close()
	enc, err := encryptVNCPassword(password)
	if err != nil {
		return err
	}
	_ = key.SetDWordValue("LoopbackOnly", 1)
	_ = key.SetDWordValue("AllowLoopback", 1)
	_ = key.SetDWordValue("UseVncAuthentication", 1)
	if err := key.SetBinaryValue("Password", enc); err != nil {
		return err
	}

	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()
	s, err := m.OpenService("tvnserver")
	if err != nil {
		return err
	}
	defer s.Close()
	_, _ = s.Control(svc.Stop)
	time.Sleep(2 * time.Second)
	return s.Start()
}

func encryptVNCPassword(password string) ([]byte, error) {
	key := []byte{0xE8, 0x4A, 0xD6, 0x60, 0xC4, 0x72, 0x1A, 0xE0}
	block, err := des.NewCipher(key)
	if err != nil {
		return nil, err
	}
	buf := make([]byte, 8)
	copy(buf, []byte(password))
	out := make([]byte, 8)
	block.Encrypt(out, buf)
	return out, nil
}

func installTray(exePath string) {
	vbsPath := filepath.Join(filepath.Dir(exePath), "start-tray.vbs")
	vbs := "Set sh = CreateObject(\"Wscript.Shell\")\r\n" +
		"sh.Run Chr(34) & \"" + strings.ReplaceAll(exePath, `"`, "") + "\" & Chr(34) & \" -tray\", 0, False\r\n"
	_ = os.WriteFile(vbsPath, []byte(vbs), 0644)
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.ALL_ACCESS)
	if err != nil {
		return
	}
	defer k.Close()
	_ = k.SetStringValue("NetManAgentTray", `wscript.exe //nologo "`+vbsPath+`"`)
	_ = exec.Command(exePath, "-tray").Start()
}

func grantSystemACL(dir string) {
	_ = exec.Command("icacls", dir, "/grant", "*S-1-5-18:(OI)(CI)F", "/grant", "*S-1-5-32-544:(OI)(CI)F", "/T").Run()
}

func unblock(path string) {
	_ = os.Remove(path + ":Zone.Identifier")
}

func programData() string {
	if v := os.Getenv("ProgramData"); v != "" {
		return v
	}
	return `C:\ProgramData`
}

func randomPassword(n int) string {
	const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b)
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "ERROR: "+format+"\n", args...)
	fmt.Println("Press Enter to close.")
	_, _ = bufio.NewReader(os.Stdin).ReadString('\n')
	os.Exit(1)
}
