# Graph Report - .  (2026-08-15)

## Corpus Check
- Large corpus: 894 files · ~841,228 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2250 nodes · 3429 edges · 177 communities (116 shown, 61 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 121 edges (avg confidence: 0.64)
- Token cost: 90,000 input · 12,262 output

## Community Hubs (Navigation)
- Vendor: Zlib Module
- Devices Module
- Vendor: Zlib Module
- Nas Adapter (utils)
- Vendor: Guacamole Module
- Vendor: Input Module
- Devices ([id])
- Net Man Module
- Topology (pages)
- Hotspot ([id])
- Vendor: Guacamole Common
- Vendor: Guacamole Common
- Utils Module
- Vendor: Websock
- Vendor: Trees
- Vendor: Trees
- Discovery (utils)
- Ipam
- Vendor: Display
- Vendor: Rfb
- Utils Module
- Mikrotik V6 (utils)
- Devices
- Vendor: Decoders Module
- Mikrotik V7 (utils)
- Utils Module
- Nas ([id])
- Vendor: Gesturehandler
- Discovery (pages)
- Pages
- Ssh Terminal (components)
- Hikvision ([id])
- Proxmox ([id])
- Hikvision (utils)
- Server Chassis (server)
- Vendor: Cursor
- Ssh (remote)
- Audit (pages)
- Edit ([id])
- App Dropdown (ui)
- Vnc Viewer (components)
- Mikrotik ([id])
- Package
- Vendor: Rfb
- Utils Module
- Proxmox (utils)
- Port Grid (components)
- Default (layouts)
- Vendor: Des
- Vendor: Rfb
- Vendor: Ra2
- Create (devices)
- Login (pages)
- Vendor: Des
- Vendor: Tight
- Mikrotik (utils)
- Proxmox (utils)
- Vendor: Aes
- Vendor: Crypto Module
- Vendor: Md5
- Vendor: Logging
- Hikvision (utils)
- Vendor: Rfb
- Vnc (remote)
- Stats (api)
- Vendor: Guacamole Common D
- Nas Chassis Rs1221 (nas)
- Use Notifications (composables)
- Edit ([id])
- Edit ([id])
- Types Module
- Vendor: Display
- Vendor: Rfb
- Guac Vnc (remote)
- Use Confirm (composables)
- Edit ([id])
- Edit ([id])
- Mikrotik
- Vendor: Core Module
- Vendor: Rfb
- Remote Manager (utils)
- Nas Chassis Ts873a (nas)
- Nas Disk Bay (nas)
- Edit ([id])
- Device (utils)
- Package
- Vendor: Eventtarget
- Vendor: Rfb
- Port Grid (mikrotik)
- Port Bay (ports)
- Topology Edge (topology)
- Error (app)
- Hikvision
- Create (ranges)
- Create (nas)
- Proxmox
- Edit ([id])
- Edit ([id])
- Nas Models (utils)
- Vendor: Crypto
- Vendor: Rsa
- Nas Chassis (nas)
- Topology Device Node (topology)
- Create (hikvision)
- Nas
- Create (proxmox)
- Create (mikrotik)
- Edit ([id])
- Users
- Package
- Vendor: Guacamole Lite D
- Device Types (device-types)
- Package
- Vendor: Hextile
- Capture ([id])
- Use Ip Mask (composables)
- Use Theme (composables)
- Callback (auth)
- Nuxt Config
- Vendor: Jpeg
- Vendor: Rfb
- Nas Disk Chassis (nas)
- App Confirm Dialog (ui)
- Create (device-types)
- Create (sites)
- Sites
- Create (users)
- Seed Types (prisma)
- Vendor: Dh
- Remote Manager (utils)
- Seed (prisma)
- Tsconfig
- Auth (stores)
- Package
- Package
- Docker Entrypoint
- Unified Infrastructure Management Agent (docs)
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Vendor: Package
- Vendor: Browser
- Robots (public)

## God Nodes (most connected - your core abstractions)
1. `RFB` - 100 edges
2. `prisma` - 89 edges
3. `Websock` - 31 edges
4. `Display` - 30 edges
5. `GestureHandler` - 22 edges
6. `HikvisionClient` - 22 edges
7. `MikroTikV6Client` - 20 edges
8. `MikroTikClient` - 19 edges
9. `Carbon Design System` - 19 edges
10. `Cursor` - 18 edges

## Surprising Connections (you probably didn't know these)
- `SVG Favicon Glyph` --conceptually_related_to--> `Flat Square-Corner Aesthetic`  [INFERRED]
  public/favicon.svg → DESIGN-ibm.md
- `fetchAvailableDevices()` --indirect_call--> `e()`  [INFERRED]
  app/pages/devices/[id]/index.vue → public/guacamole/guacamole.js
- `SVG Favicon Glyph` --shares_data_with--> `IBM Blue Single Accent Color`  [INFERRED]
  public/favicon.svg → DESIGN-ibm.md
- `Nuxt Minimal Starter README` --conceptually_related_to--> `Unified Infrastructure Management Master System Prompt`  [AMBIGUOUS]
  README.md → docs/unified_infrastructure_management_agent_prompt.md
- `SVG Favicon Glyph` --conceptually_related_to--> `Unified Infrastructure Management Master System Prompt`  [INFERRED]
  public/favicon.svg → docs/unified_infrastructure_management_agent_prompt.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Carbon Design System Button Family** — design_ibm_button_primary, design_ibm_button_secondary, design_ibm_button_tertiary, design_ibm_button_ghost, design_ibm_button_danger [EXTRACTED 1.00]
- **Nuxt SSO OIDC Authentication Flow** — docs_nuxt_4_integration_auth_store, docs_nuxt_4_integration_useauth_composable, docs_nuxt_4_integration_auth_middleware, docs_nuxt_4_integration_api_plugin, docs_nuxt_4_integration_pkce_utility, docs_nuxt_4_integration_auth_utils [EXTRACTED 1.00]
- **VNC Jump-Host Remote Access Implementations** — public_guacamole_vnc_client, public_novnc_vnc_client, public_test_manual_ws_harness, public_test_vnc_harness, docs_unified_infrastructure_management_agent_prompt_remote_access_model [INFERRED 0.85]

## Communities (177 total, 61 thin omitted)

### Community 0 - "Vendor: Zlib Module"
Cohesion: 0.05
Nodes (46): TODO: reduce number of calculations inside loop, ZRLEDecoder, Inflate, adler32(), crc32(), makeTable(), deflate(), deflate_fast() (+38 more)

### Community 1 - "Devices Module"
Cohesion: 0.05
Nodes (19): UpdateDeviceTypeBody, CreateDeviceTypeBody, CreatePortsBody, UpdateDeviceBody, CreateDeviceBody, ImportBody, ImportDeviceRequest, UpdateHikvisionBody (+11 more)

### Community 2 - "Vendor: Zlib Module"
Cohesion: 0.07
Nodes (42): adler32(), crc32(), makeTable(), deflate(), deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow() (+34 more)

### Community 3 - "Nas Adapter (utils)"
Cohesion: 0.07
Nodes (24): adapters, baseUrls(), defaultNasPort(), fetchJson(), fetchText(), httpGetText(), NasAdapter, NasDisk (+16 more)

### Community 4 - "Vendor: Guacamole Module"
Cohesion: 0.10
Nodes (43): buildHddSlots(), buildNvmeSlots(), buildQnapHddSlots(), buildQnapNvmeSlots(), DiskBaySlot, DiskBayStatus, isNvmeBay(), slotNum() (+35 more)

### Community 5 - "Vendor: Input Module"
Cohesion: 0.06
Nodes (14): DOMKeyTable, FIXME: Japanese/Korean keys, Keyboard, FIXME: We fail to detect this if either Ctrl key is, codepoints, getKey(), getKeycode(), getKeysym() (+6 more)

### Community 6 - "Devices ([id])"
Cohesion: 0.05
Nodes (39): addPorts(), availableDevices, canSSH, canVNC, closeSSE(), ConnectedDevice, connectedToPort, connectSSE() (+31 more)

### Community 7 - "Net Man Module"
Cohesion: 0.05
Nodes (47): NetMan Theme Bootstrap Script, button-danger Component, button-ghost Component, button-primary Component, button-secondary Component, button-tertiary Component, Carbon Design System, cta-banner Component (+39 more)

### Community 8 - "Topology (pages)"
Cohesion: 0.06
Nodes (35): buildFlowGraph(), computeSiblingFanoutOffsets(), debouncedSearch(), DeviceTypeInfo, deviceTypes, edgeStyle(), edgeTypes, { fitView, onNodesInitialized } (+27 more)

### Community 9 - "Hotspot ([id])"
Cohesion: 0.06
Nodes (34): activeHosts, ActiveHotspotHost, activeLoading, addBinding(), addingBinding, bindings, bindingSearch, bindingsLoading (+26 more)

### Community 10 - "Vendor: Guacamole Common"
Cohesion: 0.08
Nodes (19): addExtraHeaders(), __append_utf8(), close_tunnel(), draw_layer(), __encode_utf8(), __expand(), __flush_frames(), get_children() (+11 more)

### Community 11 - "Vendor: Guacamole Common"
Cohesion: 0.08
Nodes (19): addExtraHeaders(), __append_utf8(), close_tunnel(), draw_layer(), __encode_utf8(), __expand(), __flush_frames(), get_children() (+11 more)

### Community 12 - "Utils Module"
Cohesion: 0.11
Nodes (16): LookupMacBody, CreateHotspotBindingBody, VALID_TYPES, UpdateMikrotikBody, CreateMikrotikBody, clearClientCache(), clientCache, createMikroTikClient() (+8 more)

### Community 14 - "Vendor: Trees"
Cohesion: 0.16
Nodes (26): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+18 more)

### Community 15 - "Vendor: Trees"
Cohesion: 0.16
Nodes (26): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+18 more)

### Community 16 - "Discovery (utils)"
Cohesion: 0.11
Nodes (24): safeAudit(), StartDiscoveryBody, checkPort(), COMMON_PORTS, detectDeviceType(), DEVICE_FINGERPRINTS, DeviceFingerprint, DiscoveredDevice (+16 more)

### Community 17 - "Ipam"
Cohesion: 0.08
Nodes (21): addAllocation(), addingAllocation, handleIpClick(), IPAllocation, ipGrid, IPGridItem, IPRange, loadingDetail (+13 more)

### Community 20 - "Utils Module"
Cohesion: 0.11
Nodes (17): DeviceStatus, createNotificationsForUnbound(), EXTRA_LG_MAC_PREFIXES, resolveClearedNotifications(), scanAllRouters(), pingHost(), MikroTikConfig, Listener (+9 more)

### Community 21 - "Mikrotik V6 (utils)"
Cohesion: 0.14
Nodes (7): ArpEntry, DhcpLease, HotspotActiveRaw, HotspotIpBindingRaw, InterfaceInfo, MikroTikV6Client, MikroTikV6Config

### Community 22 - "Devices"
Cohesion: 0.08
Nodes (16): closeSSE(), connectSSE(), { data: deviceTypesData }, Device, devices, devicesWithStatus, DeviceType, deviceTypes (+8 more)

### Community 23 - "Vendor: Decoders Module"
Cohesion: 0.10
Nodes (10): CopyRectDecoder, RawDecoder, RREDecoder, TightPNGDecoder, encodings, FIXME: if we're in view-only and not dragging,, FIXME: Should probably verify that this data was actually requested, FIXME: support syncNext (+2 more)

### Community 24 - "Mikrotik V7 (utils)"
Cohesion: 0.10
Nodes (7): ArpEntry, DhcpLease, HotspotActiveRaw, HotspotIpBindingRaw, InterfaceInfo, MikroTikClient, MikroTikConfig

### Community 25 - "Utils Module"
Cohesion: 0.15
Nodes (16): deviceTypes, main(), prisma, UpdateUserBody, CreateUserBody, mapRole(), resolveSsoUser(), SsoUserInfo (+8 more)

### Community 26 - "Nas ([id])"
Cohesion: 0.09
Nodes (17): captureData(), captureError, captureSummary, capturing, diskBays, effectiveBayCount, { format: formatTimeAgo }, freeCapacity (+9 more)

### Community 28 - "Discovery (pages)"
Cohesion: 0.10
Nodes (14): currentJob, DiscoveredDevice, discoveredDevices, filteredDevices, filterType, ImportResult, isImporting, isScanning (+6 more)

### Community 29 - "Pages"
Cohesion: 0.09
Nodes (12): DashboardStats, { data: sitesData }, { data: stats, refresh: refreshStats }, { format: formatTimeAgo }, integrationSummary, ipamProgressClass, route, router (+4 more)

### Community 30 - "Ssh Terminal (components)"
Cohesion: 0.14
Nodes (17): cleanupTerminal(), connect(), connected, connecting, disconnect(), emit, error, handleConnected() (+9 more)

### Community 31 - "Hikvision ([id])"
Cohesion: 0.10
Nodes (17): { data: device, refresh, pending }, hasNetData, hasTimeData, HikvisionChannel, HikvisionDevice, HikvisionDisk, HikvisionNetwork, HikvisionRtsp (+9 more)

### Community 32 - "Proxmox ([id])"
Cohesion: 0.10
Nodes (13): { data: node, refresh, pending }, id, ipForm, ProxmoxBackupInfo, ProxmoxGuest, ProxmoxNetworkInfo, ProxmoxNodeDetail, ProxmoxNodeStatus (+5 more)

### Community 34 - "Server Chassis (server)"
Cohesion: 0.10
Nodes (16): ariaLabel, bayH, bayW, cols, earHoles, gridCells, healthLed, modelLabel (+8 more)

### Community 35 - "Vendor: Cursor"
Cohesion: 0.18
Nodes (3): supportsCursorURIs, Cursor, FIXME: How can we tell that a sub element has an

### Community 36 - "Ssh (remote)"
Cohesion: 0.17
Nodes (12): cleanup(), close(), error(), handleConnect(), handleData(), handleDisconnect(), handleResize(), message() (+4 more)

### Community 37 - "Audit (pages)"
Cohesion: 0.11
Nodes (9): AuditLog, filters, hasFilters, logs, offset, queryParams, selectedLog, showDetailsModal (+1 more)

### Community 38 - "Edit ([id])"
Cohesion: 0.11
Nodes (15): availableHosts, { data: deviceTypesData }, deviceId, DeviceType, deviceTypes, errorMessage, form, HostOption (+7 more)

### Community 39 - "App Dropdown (ui)"
Cohesion: 0.16
Nodes (15): close(), onDocClick(), onKeydown(), onScroll(), open, openMenu(), panelRef, panelStyle (+7 more)

### Community 40 - "Vnc Viewer (components)"
Cohesion: 0.13
Nodes (14): connect(), connected, connecting, disconnect(), emit, error, host, iframeSrc (+6 more)

### Community 41 - "Mikrotik ([id])"
Cohesion: 0.12
Nodes (13): captureError, capturing, deleting, feedback, { format: formatTimeAgo }, id, MikroTikSnapshot, ports (+5 more)

### Community 42 - "Package"
Cohesion: 0.12
Nodes (17): axios, guacamole-lite, jose, @novnc/novnc, nuxt, dependencies, axios, guacamole-lite (+9 more)

### Community 44 - "Utils Module"
Cohesion: 0.26
Nodes (11): SnapshotBag, findDeviceByHost(), LinkedDevice, linkProxmoxInventory(), normalizeMac(), upsertDeviceByIp(), enrichIpam(), IpamEnrichResult (+3 more)

### Community 45 - "Proxmox (utils)"
Cohesion: 0.15
Nodes (14): SnapshotBag, applyGuestIps(), buildMacIpMap(), GuestIpSource, normalizeMacKey(), createProxmoxClientById(), mergeGuestNets(), ProxmoxBackupInfo (+6 more)

### Community 46 - "Port Grid (components)"
Cohesion: 0.15
Nodes (12): assignDeviceId, assignedPorts, assignPort(), deletePort(), Device, emit, ethernetPorts, Port (+4 more)

### Community 47 - "Default (layouts)"
Cohesion: 0.12
Nodes (12): clockLabel, configLinks, { isDark, toggleTheme }, mobileOpen, now, observeLinks, opsLinks, sidebarCollapsed (+4 more)

### Community 48 - "Vendor: Des"
Cohesion: 0.16
Nodes (3): AESECBCipher, DESCBCCipher, DESECBCipher

### Community 51 - "Create (devices)"
Cohesion: 0.14
Nodes (11): { data: deviceTypesData }, DeviceType, deviceTypes, errorMessage, form, lookingUpMac, macLookupMessage, macLookupSuccess (+3 more)

### Community 52 - "Login (pages)"
Cohesion: 0.14
Nodes (11): config, email, errorMessage, isRedirectUriError, localSubmitting, { login, loginLocal, isLoading, ssoEnabled }, password, redirectUriHint (+3 more)

### Community 53 - "Vendor: Des"
Cohesion: 0.14
Nodes (11): DES, PC2, SP1, SP2, SP3, SP4, SP5, SP6 (+3 more)

### Community 58 - "Vendor: Crypto Module"
Cohesion: 0.36
Nodes (4): bigIntToU8Array(), modPow(), u8ArrayToBigInt(), DHCipher

### Community 59 - "Vendor: Md5"
Cohesion: 0.35
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 60 - "Vendor: Logging"
Cohesion: 0.15
Nodes (4): DataChannel, TODO: make this just use set with views when using a ArrayBuffer to store the rQ, rawChannelProps, ReadyStates

### Community 61 - "Hikvision (utils)"
Cohesion: 0.17
Nodes (10): CreateHikvisionBody, createHikvisionClientById(), HikvisionChannelInfo, HikvisionConfig, HikvisionDeviceInfo, HikvisionNetworkInfo, HikvisionRtspInfo, HikvisionSnapshot (+2 more)

### Community 63 - "Vnc (remote)"
Cohesion: 0.32
Nodes (11): cleanup(), clientPacketCounts, close(), ConnectParams, error(), handleBinaryData(), handleDisconnect(), message() (+3 more)

### Community 64 - "Stats (api)"
Cohesion: 0.17
Nodes (6): AttentionItem, AttentionKind, AttentionSeverity, IntegrationItem, SyncKind, SyncStatus

### Community 65 - "Vendor: Guacamole Common D"
Cohesion: 0.17
Nodes (6): Display, Guacamole, guacamole-common-js, Keyboard, Mouse, WebSocketTunnel

### Community 66 - "Nas Chassis Rs1221 (nas)"
Cohesion: 0.18
Nodes (4): earHoles, props, slots, vents

### Community 67 - "Use Notifications (composables)"
Cohesion: 0.27
Nodes (10): connectStream(), disconnectStream(), fetchNotifications(), loaded, markAllRead(), markRead(), NotificationItem, notifications (+2 more)

### Community 68 - "Edit ([id])"
Cohesion: 0.18
Nodes (9): { data: device, pending }, { data: sitesResp }, formData, HikvisionDevice, id, route, saving, Site (+1 more)

### Community 69 - "Edit ([id])"
Cohesion: 0.18
Nodes (9): errorMessage, id, IPRange, range, rangeForm, route, saving, Site (+1 more)

### Community 70 - "Types Module"
Cohesion: 0.27
Nodes (8): AuthProvider, AuthState, AuthTokens, User, consumeHandoff(), getHandoffSession(), handoffPassword(), HandoffPayload

### Community 71 - "Vendor: Display"
Cohesion: 0.24
Nodes (5): draw_layer(), __flush_frames(), get_children(), NOTE: We do not use Blobs and createImageBitmap() here, as doing so, Task()

### Community 72 - "Vendor: Rfb"
Cohesion: 0.31
Nodes (7): Deflator, _buildExtendedClipboardFlags(), clientCutText(), extendedClipboardCaps(), extendedClipboardNotify(), extendedClipboardProvide(), extendedClipboardRequest()

### Community 73 - "Guac Vnc (remote)"
Cohesion: 0.31
Nodes (9): cleanup(), close(), ConnectionParams, error(), guacdSockets, message(), open(), startGuacConnection() (+1 more)

### Community 74 - "Use Confirm (composables)"
Cohesion: 0.31
Nodes (9): alertDialog(), close(), confirmDialog(), ConfirmMode, ConfirmOptions, ConfirmState, ConfirmVariant, state (+1 more)

### Community 75 - "Edit ([id])"
Cohesion: 0.20
Nodes (7): form, id, modelOptions, route, saving, Site, sites

### Community 76 - "Edit ([id])"
Cohesion: 0.20
Nodes (8): { data: nodeResp, pending }, { data: sitesResp }, formData, id, route, saving, Site, sites

### Community 77 - "Mikrotik"
Cohesion: 0.20
Nodes (6): devices, { format: formatTimeAgo }, MikrotikDevice, Site, syncing, testing

### Community 78 - "Vendor: Core Module"
Cohesion: 0.22
Nodes (3): FIXME: We may need to disable image smoothing here, toSigned32bit(), toUnsigned32bit()

### Community 81 - "Nas Chassis Ts873a (nas)"
Cohesion: 0.22
Nodes (4): m2Rows, props, slots, statusRows

### Community 82 - "Nas Disk Bay (nas)"
Cohesion: 0.22
Nodes (8): fill, groove, labelFill, latchFill, led, props, stroke, tooltip

### Community 83 - "Edit ([id])"
Cohesion: 0.22
Nodes (7): deviceForm, deviceId, errorMessage, route, saving, Site, sites

### Community 84 - "Device (utils)"
Cohesion: 0.22
Nodes (3): deviceStatusInfo, deviceTypeInfo, protocolInfo

### Community 85 - "Package"
Cohesion: 0.22
Nodes (9): scripts, build, db:migrate, dev, generate, postinstall, preview, sso:pack (+1 more)

### Community 87 - "Vendor: Rfb"
Cohesion: 0.22
Nodes (3): clientEncodings(), fbUpdateRequest(), pixelFormat()

### Community 89 - "Port Grid (mikrotik)"
Cohesion: 0.29
Nodes (6): ethernetPorts, gridStyle(), MikroTikPortView, props, rowCols(), sfpPorts

### Community 90 - "Port Bay (ports)"
Cohesion: 0.25
Nodes (7): faceFill, latchFill, led, pinFill, props, stroke, tooltip

### Community 91 - "Topology Edge (topology)"
Cohesion: 0.25
Nodes (7): HandlePosition, labelText, labelX, labelY, path, props, TopologyEdgeData

### Community 92 - "Error (app)"
Cohesion: 0.25
Nodes (6): config, detail, isSsoCallback, props, statusCode, title

### Community 93 - "Hikvision"
Cohesion: 0.25
Nodes (4): { data: response, refresh, pending }, devices, HikvisionDevice, syncing

### Community 94 - "Create (ranges)"
Cohesion: 0.25
Nodes (6): errorMessage, rangeForm, route, saving, Site, sites

### Community 95 - "Create (nas)"
Cohesion: 0.25
Nodes (5): form, modelOptions, saving, Site, sites

### Community 96 - "Proxmox"
Cohesion: 0.25
Nodes (4): { data: response, refresh, pending }, nodes, ProxmoxNode, syncing

### Community 97 - "Edit ([id])"
Cohesion: 0.25
Nodes (6): { data: deviceTypesData, pending }, DeviceType, formData, id, route, saving

### Community 98 - "Edit ([id])"
Cohesion: 0.25
Nodes (6): AppUser, { data: user, pending }, formData, id, route, saving

### Community 99 - "Nas Models (utils)"
Cohesion: 0.32
Nodes (6): chassisForNas(), NAS_MODELS, NasChassisId, NasModelInfo, normalizeNasModelId(), resolveNasModel()

### Community 102 - "Nas Chassis (nas)"
Cohesion: 0.29
Nodes (6): chassisId, effectiveBayCount, hddSlots, known, nvmeSlots, props

### Community 103 - "Topology Device Node (topology)"
Cohesion: 0.29
Nodes (6): accentColor, props, statusClass, TopologyNodeData, truncatedName, typeLabel

### Community 104 - "Create (hikvision)"
Cohesion: 0.29
Nodes (5): { data: sitesResp }, formData, saving, Site, sites

### Community 105 - "Nas"
Cohesion: 0.29
Nodes (3): devices, NASDevice, Site

### Community 106 - "Create (proxmox)"
Cohesion: 0.29
Nodes (5): { data: sitesResp }, formData, saving, Site, sites

### Community 107 - "Create (mikrotik)"
Cohesion: 0.29
Nodes (5): deviceForm, errorMessage, saving, Site, sites

### Community 108 - "Edit ([id])"
Cohesion: 0.29
Nodes (5): form, id, route, saving, Site

### Community 109 - "Users"
Cohesion: 0.29
Nodes (3): AppUser, { data: usersData, refresh, pending }, users

### Community 110 - "Package"
Cohesion: 0.29
Nodes (7): devDependencies, tsx, @types/node, @types/ssh2, tsx, @types/node, @types/ssh2

### Community 112 - "Device Types (device-types)"
Cohesion: 0.33
Nodes (3): { data: deviceTypesData, refresh }, DeviceType, deviceTypes

### Community 113 - "Package"
Cohesion: 0.33
Nodes (5): name, prisma, seed, private, type

### Community 117 - "Use Ip Mask (composables)"
Cohesion: 0.60
Nodes (3): isValidIp(), normalizeIpInput(), useIpMask()

### Community 118 - "Use Theme (composables)"
Cohesion: 0.50
Nodes (3): normalizeTheme(), ThemeName, useTheme()

### Community 119 - "Callback (auth)"
Cohesion: 0.40
Nodes (3): { completeSsoHandoff }, hasError, message

### Community 120 - "Nuxt Config"
Cohesion: 0.50
Nodes (4): appPort, appUrl, listenPort(), resolveAppUrl()

### Community 123 - "Nas Disk Chassis (nas)"
Cohesion: 0.50
Nodes (3): hddSlots, nvmeSlots, props

## Ambiguous Edges - Review These
- `Nuxt Minimal Starter README` → `Unified Infrastructure Management Master System Prompt`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **702 isolated node(s):** `Port`, `Device`, `props`, `selectedPort`, `assignDeviceId` (+697 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **61 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Nuxt Minimal Starter README` and `Unified Infrastructure Management Master System Prompt`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `e()` connect `Vendor: Guacamole Module` to `Nas Adapter (utils)`, `Ssh (remote)`, `Devices ([id])`, `Guac Vnc (remote)`, `Vendor: Websock`, `Devices`, `Vnc (remote)`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `Websock` connect `Vendor: Websock` to `Vendor: Logging`, `Vendor: Decoders Module`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `prisma` connect `Devices Module` to `Stats (api)`, `Nas Adapter (utils)`, `Ssh (remote)`, `Guac Vnc (remote)`, `Utils Module`, `Utils Module`, `Proxmox (utils)`, `Discovery (utils)`, `Utils Module`, `Capture ([id])`, `Utils Module`, `Hikvision (utils)`, `Vnc (remote)`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `Port`, `Device`, `props` to the rest of the system?**
  _702 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Vendor: Zlib Module` be split into smaller, more focused modules?**
  _Cohesion score 0.05290490100616683 - nodes in this community are weakly interconnected._
- **Should `Devices Module` be split into smaller, more focused modules?**
  _Cohesion score 0.05406746031746032 - nodes in this community are weakly interconnected._