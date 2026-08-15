package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type enrollRequest struct {
	Token        string `json:"token"`
	Hostname     string `json:"hostname"`
	OSVersion    string `json:"osVersion"`
	AgentVersion string `json:"agentVersion"`
	MACAddress   string `json:"macAddress,omitempty"`
}

type enrollResponse struct {
	AgentID string `json:"agentId"`
	AuthKey string `json:"authKey"`
}

type apiError struct {
	StatusMessage string `json:"statusMessage"`
}

// Enroll exchanges the one-time install token for a long-lived agentId+authKey pair.
func Enroll(serverURL, token, hostname, osVersion, agentVersion, macAddress string) (agentID, authKey string, err error) {
	body, err := json.Marshal(enrollRequest{
		Token:        token,
		Hostname:     hostname,
		OSVersion:    osVersion,
		AgentVersion: agentVersion,
		MACAddress:   macAddress,
	})
	if err != nil {
		return "", "", err
	}

	url := strings.TrimRight(serverURL, "/") + "/api/agents/enroll"
	httpClient := &http.Client{Timeout: 15 * time.Second}

	resp, err := httpClient.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return "", "", fmt.Errorf("could not reach %s: %w", url, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

	if resp.StatusCode != http.StatusOK {
		var apiErr apiError
		_ = json.Unmarshal(respBody, &apiErr)
		if apiErr.StatusMessage != "" {
			return "", "", fmt.Errorf("enrollment failed (%d): %s", resp.StatusCode, apiErr.StatusMessage)
		}
		return "", "", fmt.Errorf("enrollment failed with status %d", resp.StatusCode)
	}

	var result enrollResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", "", err
	}
	if result.AgentID == "" || result.AuthKey == "" {
		return "", "", fmt.Errorf("enrollment response missing agentId/authKey")
	}

	return result.AgentID, result.AuthKey, nil
}
