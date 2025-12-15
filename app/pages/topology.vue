<template>
  <div class="animate-fade-in">
    <div class="mb-6">
      <h1 class="text-3xl font-bold">Network Topology</h1>
      <p class="text-base-content/60 mt-1">Visual overview of your network infrastructure</p>
    </div>

    <!-- Placeholder for topology visualization -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-8">
      <div class="flex flex-col items-center justify-center min-h-[500px] text-center">
        <div class="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="3"/>
            <circle cx="5" cy="19" r="3"/>
            <circle cx="19" cy="19" r="3"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="12" x2="5" y2="16"/>
            <line x1="12" y1="12" x2="19" y2="16"/>
          </svg>
        </div>
        <h2 class="text-2xl font-bold mb-2">Network Topology Visualization</h2>
        <p class="text-base-content/60 max-w-md mb-6">
          This feature will display an interactive network topology map showing device connections, 
          VLANs, and network paths. Requires MikroTik API integration to discover network relationships.
        </p>
        
        <!-- Feature list -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mt-4">
          <div class="bg-base-200/50 rounded-lg p-4">
            <div class="font-semibold mb-2">🔍 Device Discovery</div>
            <p class="text-sm text-base-content/60">Automatic detection of network devices via LLDP and ARP</p>
          </div>
          <div class="bg-base-200/50 rounded-lg p-4">
            <div class="font-semibold mb-2">🌐 VLAN Mapping</div>
            <p class="text-sm text-base-content/60">Visual representation of VLAN segmentation</p>
          </div>
          <div class="bg-base-200/50 rounded-lg p-4">
            <div class="font-semibold mb-2">📊 Port Connections</div>
            <p class="text-sm text-base-content/60">Switch port to device mapping and status</p>
          </div>
        </div>

        <!-- Coming soon notice -->
        <div class="mt-8 px-6 py-3 bg-warning/10 border border-warning/30 rounded-lg inline-flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span class="text-warning">Coming in Phase 4 - MikroTik Integration Required</span>
        </div>
      </div>
    </div>
  </div>
</template>
