// Command netman-agent is the phone-home agent installed on a Windows PC,
// Linux server, or Mac so it can be monitored (and, in a later release, remotely
// accessed) from netMan even when it isn't directly reachable on the LAN.
//
// Usage:
//
//	netman-agent -enroll -token <token> -server https://netman.example.com
//	  Enrolls this machine using the one-time token from the "Add Agent"
//	  install command, persists the resulting credentials, then exits.
//	  Run this once before installing/starting the service.
//
//	netman-agent
//	  Normal run mode: loads the saved config and holds a persistent
//	  connection to the server, sending a heartbeat every 30s. This is what
//	  the Windows Service / systemd unit invokes.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"runtime"

	"github.com/shirou/gopsutil/v3/host"

	"github.com/netman/agent/internal/client"
	"github.com/netman/agent/internal/config"
	"github.com/netman/agent/internal/service"
)

const (
	agentVersion = "0.5.3"
	serviceName  = "netman-agent"
)

func main() {
	enroll := flag.Bool("enroll", false, "Enroll this machine with a netMan server using a one-time install token, then exit")
	token := flag.String("token", "", "One-time enrollment token (required with -enroll)")
	server := flag.String("server", "", "netMan server base URL, e.g. https://netman.example.com (required with -enroll)")
	version := flag.Bool("version", false, "Print the agent version and exit")
	flag.Parse()

	if *version {
		fmt.Println(agentVersion)
		return
	}

	if *enroll {
		runEnroll(*token, *server)
		return
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[agent] %v", err)
	}

	service.Run(serviceName, func(stop <-chan struct{}) {
		client.Run(cfg, agentVersion, stop)
	})
}

func runEnroll(token, server string) {
	if token == "" || server == "" {
		fmt.Fprintln(os.Stderr, "usage: netman-agent -enroll -token <token> -server <https://netman-host>")
		os.Exit(2)
	}

	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown-host"
	}
	osVersion := detectOSVersion()
	macAddress := client.DetectMACAddress()

	agentID, authKey, err := client.Enroll(server, token, hostname, osVersion, agentVersion, macAddress)
	if err != nil {
		log.Fatalf("[agent] enrollment failed: %v", err)
	}

	if err := config.Save(&config.Config{ServerURL: server, AgentID: agentID, AuthKey: authKey}); err != nil {
		log.Fatalf("[agent] failed to save config: %v", err)
	}

	fmt.Printf("Enrolled successfully as agent %s. Install/start the %s service to begin sending heartbeats.\n", agentID, serviceName)
}

func detectOSVersion() string {
	info, err := host.Info()
	if err != nil {
		return runtime.GOOS
	}
	return fmt.Sprintf("%s %s", info.Platform, info.PlatformVersion)
}

