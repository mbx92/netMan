<template>
  <div class="animate-fade-in">
    <div class="mb-6">
      <h1 class="text-3xl font-bold">IP Address Management</h1>
      <p class="text-base-content/60 mt-1">Manage IP ranges and allocations</p>
    </div>

    <!-- Placeholder for IPAM -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-8">
      <div class="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div class="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </div>
        <h2 class="text-2xl font-bold mb-2">IP Address Management</h2>
        <p class="text-base-content/60 max-w-md mb-6">
          This feature will allow you to manage IP ranges, track allocations, 
          detect conflicts, and integrate with DHCP data from your network.
        </p>
        
        <!-- Feature list -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mt-4">
          <div class="bg-base-200/50 rounded-lg p-4">
            <div class="font-semibold mb-2">📋 IP Ranges</div>
            <p class="text-sm text-base-content/60">Define and manage subnet ranges</p>
          </div>
          <div class="bg-base-200/50 rounded-lg p-4">
            <div class="font-semibold mb-2">🔗 DHCP Sync</div>
            <p class="text-sm text-base-content/60">Automatic sync with DHCP leases</p>
          </div>
          <div class="bg-base-200/50 rounded-lg p-4">
            <div class="font-semibold mb-2">⚠️ Conflict Detection</div>
            <p class="text-sm text-base-content/60">Automatic IP conflict alerts</p>
          </div>
        </div>

        <div class="mt-8 px-6 py-3 bg-info/10 border border-info/30 rounded-lg inline-flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span class="text-info">Coming in Phase 3 - IPAM Implementation</span>
        </div>
      </div>
    </div>
  </div>
</template>
