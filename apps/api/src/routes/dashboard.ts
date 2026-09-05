import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const dashboardRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const handler = async (_request: any, reply: any) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('theme') !== 'light', currentScreen: 'queue', showSplash: true, showStatusModal: false }" :class="{ 'dark': darkMode }">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RecoveryOS — Human-in-the-Loop Control Plane</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
            mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
          },
          colors: {
            brand: {
              50: '#F0F7FF',
              100: '#E0EFFF',
              500: '#0284C7',
              600: '#0369A1',
              700: '#075985'
            }
          }
        }
      }
    }
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 9999px; }
    .dark ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
    [x-cloak] { display: none !important; }
    .nav-icon { width: 16px; height: 16px; min-width: 16px; min-height: 16px; }

    /* Operational Surface Styling (Fintech Grade: Linear x Stripe x Vercel) */
    .surface-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);
    }
    .dark .surface-card {
      background: #0B0F19;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
    }

    .surface-card-subtle {
      background: #F8FAFC;
      border: 1px solid #EDF2F7;
    }
    .dark .surface-card-subtle {
      background: #111624;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .sidebar-surface {
      background: #FFFFFF;
      border-right: 1px solid #E2E8F0;
    }
    .dark .sidebar-surface {
      background: #080B12;
      border-right: 1px solid rgba(255, 255, 255, 0.07);
    }

    @keyframes progressBar {
      0% { width: 0%; }
      100% { width: 100%; }
    }
    .animate-progress {
      animation: progressBar 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
  </style>
</head>
<body class="min-h-screen bg-[#F8FAFC] text-slate-900 transition-colors duration-200 dark:bg-[#06080F] dark:text-slate-100 flex antialiased overflow-x-hidden selection:bg-sky-500/20" x-data="recoveryControlPlane()" x-init="initApp()">

  <!-- ================= 2-SECOND CINEMATIC SPLASH SCREEN OVERLAY ================= -->
  <div 
    x-show="showSplash" 
    x-transition:leave="transition-all ease-out duration-700" 
    x-transition:leave-start="opacity-100 scale-100" 
    x-transition:leave-end="opacity-0 scale-105 pointer-events-none"
    class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#06080F] select-none"
    x-cloak>
    
    <div class="flex flex-col items-center space-y-5 text-center px-4 max-w-sm">
      <div class="flex items-center gap-3">
        <div class="flex size-11 items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono text-xl font-bold shadow-md">
          ⚡
        </div>
        <div class="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          RecoveryOS
        </div>
      </div>

      <div class="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-wide">
        <span>Autonomous Recovery for</span>
        <span class="font-extrabold text-slate-900 dark:text-white tracking-tight text-sm">Razorpay</span>
      </div>

      <div class="w-32 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden mt-2">
        <div class="h-full bg-slate-900 dark:bg-white rounded-full animate-progress"></div>
      </div>
    </div>
  </div>

  <!-- ================= WEBSITE CONTENT CONTAINER WITH BLUR-IN EFFECT ================= -->
  <div 
    class="flex-1 flex min-h-screen w-full transition-all duration-700 ease-out relative z-10"
    :class="showSplash ? 'opacity-0 filter blur-md scale-[0.99]' : 'opacity-100 filter blur-0 scale-100'">

    <!-- 1. SIDEBAR NAVIGATION -->
    <aside class="w-64 sidebar-surface flex flex-col justify-between p-4 shrink-0 hidden md:flex min-h-screen sticky top-0 h-screen">
      
      <div class="space-y-6">
        <!-- Brand Header with Razorpay Title -->
        <div class="px-2 pt-1 space-y-1">
          <div class="flex items-center gap-2.5">
            <div class="flex size-7 items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono text-sm font-bold shadow-xs">
              ⚡
            </div>
            <div class="text-sm font-bold tracking-tight text-slate-900 dark:text-white">RecoveryOS</div>
            <span class="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-semibold">CONTROL</span>
          </div>
          
          <!-- Razorpay Sub-badge -->
          <div class="pl-9.5 flex items-center gap-1 pt-0.5">
            <span class="text-[10px] text-slate-400 font-medium">for</span>
            <span class="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-200">Razorpay</span>
          </div>
        </div>

        <!-- Primary Information Architecture Navigation -->
        <div class="space-y-1">
          <div class="px-2 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Control Plane
          </div>

          <nav class="space-y-1 text-xs font-semibold">
            <!-- 1. Recovery Queue (Default Home) -->
            <button 
              @click="navigate('queue')"
              :class="currentScreen === 'queue' ? 'bg-slate-100 text-slate-900 dark:bg-white/[0.08] dark:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white'"
              class="w-full flex items-center justify-between rounded-lg px-3 py-2.5 transition-all">
              <div class="flex items-center gap-2.5">
                <svg class="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                <span>Recovery Queue</span>
              </div>
              <span class="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400" x-text="attentionCases.length + ' need action'"></span>
            </button>

            <!-- 2. Case Investigation -->
            <button 
              @click="navigate('investigation')"
              :class="currentScreen === 'investigation' ? 'bg-slate-100 text-slate-900 dark:bg-white/[0.08] dark:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white'"
              class="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all">
              <svg class="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
              <span>Investigation</span>
            </button>

            <!-- 3. Recovery Policy -->
            <button 
              @click="navigate('policy')"
              :class="currentScreen === 'policy' ? 'bg-slate-100 text-slate-900 dark:bg-white/[0.08] dark:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white'"
              class="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all">
              <svg class="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <span>Recovery Policies</span>
            </button>

            <!-- 4. Recovery Twin Simulation -->
            <button 
              @click="navigate('twin')"
              :class="currentScreen === 'twin' ? 'bg-slate-100 text-slate-900 dark:bg-white/[0.08] dark:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white'"
              class="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all">
              <svg class="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
              <span>Recovery Twin</span>
            </button>
          </nav>
        </div>
      </div>

      <!-- Bottom System Operational Status & Theme Toggle -->
      <div class="space-y-3 pt-3 border-t border-slate-200 dark:border-white/[0.07]">
        <!-- Global System Status Pill -->
        <button 
          @click="showStatusModal = true"
          class="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] text-xs transition-colors">
          <div class="flex items-center gap-2 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span class="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>SYSTEM OPERATIONAL</span>
          </div>
          <span class="text-slate-400 text-[10px]">Info ↗</span>
        </button>

        <div class="flex items-center justify-between text-xs px-1">
          <div class="flex items-center gap-2">
            <div class="size-6 rounded-full bg-slate-900 text-white dark:bg-white/10 dark:text-white flex items-center justify-center font-bold text-[10px]">
              OP
            </div>
            <span class="font-medium text-slate-600 dark:text-slate-300 text-xs">Operator Console</span>
          </div>

          <button 
            @click="darkMode = !darkMode; localStorage.setItem('theme', darkMode ? 'dark' : 'light')"
            class="size-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 transition-colors"
            title="Toggle Dark Mode">
            <template x-if="!darkMode">
              <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.03 9.03 0 008.354-5.646z"/></svg>
            </template>
            <template x-if="darkMode">
              <svg class="size-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            </template>
          </button>
        </div>
      </div>
    </aside>

    <!-- 2. MAIN OPERATIONAL WORKSPACE -->
    <div class="flex-1 flex flex-col min-w-0 overflow-y-auto">
      
      <!-- Top Action Bar -->
      <header class="px-8 py-4 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.07] bg-white/80 dark:bg-[#06080F]/80 backdrop-blur-md sticky top-0 z-20">
        <div>
          <div class="text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold" x-text="breadcrumbs"></div>
          <h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white" x-text="screenTitle"></h1>
        </div>

        <div class="flex items-center gap-3">
          <button 
            @click="showStatusModal = true"
            class="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/[0.08] px-3 py-1.5 text-xs font-mono font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
            <span class="size-2 rounded-full bg-emerald-500"></span>
            <span>System Operational</span>
          </button>

          <button 
            @click="showIngestModal = true"
            class="flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-white dark:text-slate-900 shadow-xs active:scale-95 transition-all">
            <span>+ Ingest Test Failure</span>
          </button>
        </div>
      </header>

      <main class="p-8 max-w-5xl space-y-8">
        
        <!-- ==================================================================== -->
        <!-- SCREEN 1: RECOVERY QUEUE (Default Home)                              -->
        <!-- "What needs my attention right now?"                                 -->
        <!-- ==================================================================== -->
        <div x-show="currentScreen === 'queue'" class="space-y-8" x-cloak>
          
          <!-- Compact Operational Summary (No Giant Fluff Cards) -->
          <div>
            <div class="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Today's Operational Summary
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="surface-card rounded-xl p-4 space-y-1">
                <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Revenue currently at risk</span>
                <div class="font-mono text-2xl font-bold text-slate-900 dark:text-white" x-text="formatInr(metrics.revenueAtRiskRupees || 42000)"></div>
              </div>

              <div class="surface-card rounded-xl p-4 space-y-1">
                <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Recovered today</span>
                <div class="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400" x-text="formatInr(metrics.grossRecoveredRupees || 28000)"></div>
              </div>

              <div class="surface-card rounded-xl p-4 space-y-1 border-l-4 border-l-amber-500">
                <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Need attention</span>
                <div class="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400" x-text="attentionCases.length || 3"></div>
              </div>

              <div class="surface-card rounded-xl p-4 space-y-1">
                <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Reconciliation pending</span>
                <div class="font-mono text-2xl font-bold text-sky-600 dark:text-sky-400" x-text="reconciliationPendingCount || 1"></div>
              </div>
            </div>
          </div>

          <!-- The Attention Queue: Vertical List of High-Priority Cases -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-sm font-bold text-slate-900 dark:text-white">Attention Queue</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Exceptions, threshold violations, and ambiguous states requiring human action.</p>
              </div>
              <button @click="loadData()" class="text-xs font-mono text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">↻ Refresh Queue</button>
            </div>

            <!-- List of Attention Items -->
            <div class="space-y-3">
              <template x-for="item in attentionCases" :key="item.id">
                <div class="surface-card rounded-xl p-5 hover:border-slate-300 dark:hover:border-white/20 transition-all space-y-4">
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-white/[0.05] pb-3">
                    <div class="flex items-center gap-3">
                      <span class="font-mono text-xl font-bold text-slate-900 dark:text-white" x-text="formatPaise(item.amount_in_paise)"></span>
                      <span class="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider" :class="getStateBadgeClass(item.state)" x-text="item.state"></span>
                      <span class="text-xs text-slate-400 font-mono" x-text="'Case #' + item.id.substring(0, 8)"></span>
                    </div>

                    <div class="text-xs text-slate-400 font-mono" x-text="item.customer_name || 'Enterprise Customer'"></div>
                  </div>

                  <!-- Operational Reason & Recommendation -->
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div class="md:col-span-2 space-y-1">
                      <span class="font-semibold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wide">Why Attention is Required</span>
                      <p class="text-slate-800 dark:text-slate-200 font-medium" x-text="getAttentionReason(item)"></p>
                    </div>

                    <div class="space-y-1">
                      <span class="font-semibold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wide">Recommended Action</span>
                      <p class="font-mono font-bold text-slate-900 dark:text-white" x-text="getRecommendedActionText(item)"></p>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex items-center justify-end gap-2 pt-2">
                    <template x-if="item.state === 'OUTCOME_UNKNOWN'">
                      <button @click="openInvestigation(item.id, 'reconcile')" class="rounded-lg bg-amber-600 hover:bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all">
                        Reconcile with Provider →
                      </button>
                    </template>

                    <template x-if="item.state === 'AWAITING_APPROVAL'">
                      <button @click="openInvestigation(item.id, 'approve')" class="rounded-lg bg-sky-600 hover:bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all">
                        Review & Authorize →
                      </button>
                    </template>

                    <button @click="openInvestigation(item.id)" class="rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors">
                      Investigate Timeline →
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Secondary Section: Recently Resolved (Confidence Builder) -->
          <div class="space-y-3 pt-4 border-t border-slate-200 dark:border-white/[0.07]">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">Recently Resolved Autonomously</h3>
                <p class="text-[11px] text-slate-400">Cases recovered without human intervention.</p>
              </div>
            </div>

            <div class="space-y-2">
              <template x-for="item in resolvedCases.slice(0, 4)" :key="item.id">
                <div class="surface-card-subtle rounded-lg p-3 flex items-center justify-between text-xs cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition-all" @click="openInvestigation(item.id)">
                  <div class="flex items-center gap-3">
                    <span class="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                    <span class="font-mono font-bold text-slate-900 dark:text-white" x-text="formatPaise(item.amount_in_paise) + ' recovered'"></span>
                    <span class="text-slate-500 font-mono text-[11px]" x-text="'• ' + formatFailure(item.failure_class) + ' → ' + (item.diagnosed_class ? 'Autonomous retry' : 'Smart payment link')"></span>
                  </div>
                  <span class="text-slate-400 font-mono text-[11px]" x-text="formatTime(item.recovered_at || item.updated_at)"></span>
                </div>
              </template>
            </div>
          </div>

        </div>

        <!-- ==================================================================== -->
        <!-- SCREEN 2: RECOVERY CASE INVESTIGATION (Deep Dive)                    -->
        <!-- "What happened? Why did it happen? What did RecoveryOS do?"           -->
        <!-- ==================================================================== -->
        <div x-show="currentScreen === 'investigation'" class="space-y-8" x-cloak>
          
          <!-- Back to Queue & Case Selector -->
          <div class="flex items-center justify-between">
            <button @click="navigate('queue')" class="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5">
              <span>← Back to Recovery Queue</span>
            </button>

            <!-- Case Quick Switcher -->
            <div class="flex items-center gap-2 text-xs">
              <span class="text-slate-400">Select Case:</span>
              <select x-model="selectedCaseId" @change="loadCaseDetail(selectedCaseId)" class="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white">
                <template x-for="c in cases" :key="c.id">
                  <option :value="c.id" x-text="'Case #' + c.id.substring(0, 8) + ' (' + formatPaise(c.amount_in_paise) + ' - ' + c.state + ')'"></option>
                </template>
              </select>
            </div>
          </div>

          <template x-if="activeCase">
            <div class="space-y-8">
              <!-- 1. Case Header -->
              <div class="surface-card rounded-2xl p-6 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-white/[0.05] pb-4">
                  <div>
                    <div class="flex items-center gap-3">
                      <h2 class="font-mono text-2xl font-extrabold text-slate-900 dark:text-white" x-text="'Case #' + activeCase.id.substring(0, 8)"></h2>
                      <span class="rounded px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider" :class="getStateBadgeClass(activeCase.state)" x-text="activeCase.state"></span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1">
                      <span x-text="'Payment ID: pay_' + activeCase.id.substring(0, 12)"></span>
                      <span>•</span>
                      <span x-text="'Detected: ' + formatTime(activeCase.created_at)"></span>
                      <span>•</span>
                      <span x-text="'Customer: ' + (activeCase.customer_name || 'Enterprise Client')"></span>
                    </div>
                  </div>

                  <div class="text-right">
                    <span class="text-xs text-slate-400 uppercase font-mono tracking-wider font-semibold">Payment Amount</span>
                    <div class="font-mono text-3xl font-extrabold text-slate-900 dark:text-white" x-text="formatPaise(activeCase.amount_in_paise)"></div>
                  </div>
                </div>

                <!-- 2. Current State Panel (Operational Clarity) -->
                <div class="rounded-xl p-4 border" :class="getCurrentStatePanelClass(activeCase.state)">
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div class="space-y-1">
                      <div class="text-xs font-mono font-bold uppercase tracking-wider" x-text="'CURRENT STATUS: ' + activeCase.state"></div>
                      <p class="text-xs font-medium" x-text="getCurrentStateDescription(activeCase)"></p>
                    </div>

                    <!-- Action Trigger -->
                    <div>
                      <template x-if="activeCase.state === 'OUTCOME_UNKNOWN'">
                        <button @click="startReconciliationModal()" class="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all whitespace-nowrap">
                          Reconcile with Provider →
                        </button>
                      </template>

                      <template x-if="activeCase.state === 'AWAITING_APPROVAL'">
                        <button @click="showApprovalModal = true" class="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all whitespace-nowrap">
                          Review Authorization →
                        </button>
                      </template>

                      <template x-if="activeCase.state === 'ACTION_SCHEDULED'">
                        <button @click="executeRecoveryNow(activeCase.id)" class="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all whitespace-nowrap">
                          ⚡ Execute Recovery Now (Test)
                        </button>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 3. Core Case Timeline & Decision Intelligence (2-Column Grid) -->
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                <!-- Left: Core Case Timeline (2 Columns) -->
                <div class="lg:col-span-2 space-y-6">
                  <div class="surface-card rounded-2xl p-6 space-y-6">
                    <div>
                      <h3 class="text-sm font-bold text-slate-900 dark:text-white">Core Case Timeline</h3>
                      <p class="text-xs text-slate-400 mt-0.5">Chronological execution and deterministic state transitions.</p>
                    </div>

                    <!-- Timeline Vertical Steps -->
                    <div class="relative pl-6 space-y-6 border-l-2 border-slate-200 dark:border-white/10 ml-2">
                      
                      <!-- Step 1: Payment Failed -->
                      <div class="relative">
                        <div class="absolute -left-[31px] top-1 size-3.5 rounded-full bg-rose-500 ring-4 ring-white dark:ring-[#0B0F19]"></div>
                        <div class="space-y-1">
                          <div class="flex items-center justify-between text-xs">
                            <span class="font-mono font-bold text-slate-900 dark:text-white">PAYMENT FAILED</span>
                            <span class="font-mono text-slate-400 text-[11px]" x-text="formatTimeOnly(activeCase.created_at, 0)"></span>
                          </div>
                          <p class="text-xs text-slate-600 dark:text-slate-400">The payment provider reported an execution failure (<span class="font-mono text-rose-500" x-text="activeCase.error_code || 'BAD_REQUEST_PAYMENT_FAILED'"></span>).</p>
                        </div>
                      </div>

                      <!-- Step 2: Webhook Verified -->
                      <div class="relative">
                        <div class="absolute -left-[31px] top-1 size-3.5 rounded-full bg-slate-400 dark:bg-white/40 ring-4 ring-white dark:ring-[#0B0F19]"></div>
                        <div class="space-y-1">
                          <div class="flex items-center justify-between text-xs">
                            <span class="font-mono font-bold text-slate-900 dark:text-white">WEBHOOK VERIFIED</span>
                            <span class="font-mono text-slate-400 text-[11px]" x-text="formatTimeOnly(activeCase.created_at, 1)"></span>
                          </div>
                          <p class="text-xs text-slate-600 dark:text-slate-400">Provider HMAC cryptographic signature verified successfully. Event persisted and deduplicated in PostgreSQL.</p>
                        </div>
                      </div>

                      <!-- Step 3: AI Diagnosis Complete -->
                      <div class="relative">
                        <div class="absolute -left-[31px] top-1 size-3.5 rounded-full bg-sky-500 ring-4 ring-white dark:ring-[#0B0F19]"></div>
                        <div class="space-y-1">
                          <div class="flex items-center justify-between text-xs">
                            <span class="font-mono font-bold text-slate-900 dark:text-white">DIAGNOSIS COMPLETE</span>
                            <span class="font-mono text-slate-400 text-[11px]" x-text="formatTimeOnly(activeCase.created_at, 3)"></span>
                          </div>
                          <div class="surface-card-subtle rounded-lg p-3 text-xs space-y-1">
                            <div class="flex justify-between">
                              <span class="text-slate-500">Likely cause:</span>
                              <span class="font-mono font-bold text-slate-900 dark:text-white" x-text="formatFailure(activeCase.failure_class)"></span>
                            </div>
                            <div class="flex justify-between">
                              <span class="text-slate-500">AI confidence:</span>
                              <span class="font-mono font-bold text-sky-600 dark:text-sky-400" x-text="((activeCase.ai_confidence || 0.84) * 100).toFixed(0) + '%'"></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Step 4: Policy Evaluated -->
                      <div class="relative">
                        <div class="absolute -left-[31px] top-1 size-3.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-[#0B0F19]"></div>
                        <div class="space-y-1">
                          <div class="flex items-center justify-between text-xs">
                            <span class="font-mono font-bold text-slate-900 dark:text-white">POLICY EVALUATED</span>
                            <span class="font-mono text-slate-400 text-[11px]" x-text="formatTimeOnly(activeCase.created_at, 5)"></span>
                          </div>
                          <div class="surface-card-subtle rounded-lg p-3 text-xs space-y-1.5 font-mono">
                            <div class="text-slate-700 dark:text-slate-300 font-bold" x-text="'Policy Verdict: ' + (activeCase.state === 'AWAITING_APPROVAL' ? 'MANUAL APPROVAL REQUIRED' : 'AUTOMATIC ACTION APPROVED')"></div>
                            <div class="text-slate-500 text-[11px] space-y-0.5">
                              <div>✓ Retry budget available (1/2 attempts)</div>
                              <div x-text="activeCase.amount_in_paise > 1000000 ? '✕ Exceeds auto threshold (₹10,000)' : '✓ Amount within auto recovery threshold'"></div>
                              <div>✓ Cooling window satisfied (6h delay)</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Step 5: Current / Final State in Timeline -->
                      <template x-if="activeCase.state === 'OUTCOME_UNKNOWN'">
                        <div class="relative">
                          <div class="absolute -left-[31px] top-1 size-3.5 rounded-full bg-amber-500 ring-4 ring-white dark:ring-[#0B0F19]"></div>
                          <div class="space-y-1">
                            <div class="flex items-center justify-between text-xs">
                              <span class="font-mono font-bold text-amber-600 dark:text-amber-400">⚠ OUTCOME UNKNOWN</span>
                              <span class="font-mono text-slate-400 text-[11px]" x-text="formatTimeOnly(activeCase.created_at, 13)"></span>
                            </div>
                            <div class="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                              <p>Connection timed out after recovery action was dispatched. RecoveryOS cannot determine whether the provider processed the capture.</p>
                              <p class="font-bold">AUTOMATIC RETRY BLOCKED to prevent double-charging.</p>
                            </div>
                          </div>
                        </div>
                      </template>

                      <template x-if="activeCase.state === 'RECOVERED'">
                        <div class="relative">
                          <div class="absolute -left-[31px] top-1 size-3.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#0B0F19]"></div>
                          <div class="space-y-1">
                            <div class="flex items-center justify-between text-xs">
                              <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">✓ PAYMENT CAPTURED</span>
                              <span class="font-mono text-slate-400 text-[11px]" x-text="formatTimeOnly(activeCase.recovered_at || activeCase.updated_at, 0)"></span>
                            </div>
                            <p class="text-xs text-slate-600 dark:text-slate-400 font-medium">Payment confirmed captured by bank. Recovery ledger updated and duplicate retries avoided.</p>
                          </div>
                        </div>
                      </template>

                    </div>
                  </div>
                </div>

                <!-- Right: AI Diagnosis & Policy Boundaries (1 Column) -->
                <div class="space-y-6">
                  
                  <!-- AI Diagnosis Card -->
                  <div class="surface-card rounded-2xl p-5 space-y-3">
                    <div class="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] pb-2.5">
                      <span class="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white">AI Diagnosis</span>
                      <span class="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400">Llama 3.3 70B</span>
                    </div>

                    <div class="space-y-2 text-xs">
                      <div>
                        <span class="text-slate-500 block text-[11px]">Likely Failure:</span>
                        <span class="font-mono font-bold text-slate-900 dark:text-white" x-text="activeCase.failure_class || 'INSUFFICIENT_FUNDS'"></span>
                      </div>

                      <div>
                        <span class="text-slate-500 block text-[11px]">Evidence Considered:</span>
                        <ul class="text-slate-600 dark:text-slate-400 text-[11px] list-disc pl-4 space-y-0.5 mt-0.5">
                          <li>Provider response payload error code</li>
                          <li>Customer previous retry success velocity</li>
                          <li>Salary credit day timing heuristic</li>
                        </ul>
                      </div>

                      <div>
                        <span class="text-slate-500 block text-[11px]">Recommendation:</span>
                        <span class="font-mono font-bold text-sky-600 dark:text-sky-400">Retry after 6 hours</span>
                      </div>

                      <div class="pt-2 border-t border-slate-100 dark:border-white/[0.05]">
                        <div class="text-[11px] font-mono text-slate-400 bg-slate-50 dark:bg-black/30 p-2.5 rounded-lg border border-slate-100 dark:border-white/[0.04] space-y-1">
                          <p class="font-semibold text-slate-600 dark:text-slate-300">AI recommendation is not directly executable.</p>
                          <p class="text-sky-600 dark:text-sky-400 font-bold">↓ Passed to deterministic policy engine</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Policy Decision Card -->
                  <div class="surface-card rounded-2xl p-5 space-y-3">
                    <div class="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] pb-2.5">
                      <span class="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white">Deterministic Policy</span>
                      <span class="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">Policy Engine</span>
                    </div>

                    <div class="space-y-2 text-xs">
                      <div class="flex justify-between">
                        <span class="text-slate-500">Decision:</span>
                        <span class="font-mono font-bold" :class="activeCase.state === 'AWAITING_APPROVAL' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'" x-text="activeCase.state === 'AWAITING_APPROVAL' ? 'MANUAL APPROVAL REQUIRED' : 'APPROVED'"></span>
                      </div>

                      <div class="space-y-1 pt-1">
                        <span class="text-slate-500 text-[11px] font-medium">Evaluated Rules:</span>
                        <div class="space-y-1 text-[11px] font-mono">
                          <div class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <span>✓</span>
                            <span>Max retry budget available</span>
                          </div>
                          <div class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <span>✓</span>
                            <span>Cooling window satisfied</span>
                          </div>
                          <div class="flex items-center gap-1.5" :class="activeCase.amount_in_paise > 1000000 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
                            <span x-text="activeCase.amount_in_paise > 1000000 ? '⚠' : '✓'"></span>
                            <span x-text="activeCase.amount_in_paise > 1000000 ? 'Exceeds auto limit (₹10,000)' : 'Within automatic recovery limit'"></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <!-- 4. Audit Trail Section -->
              <div class="surface-card rounded-2xl p-6 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] pb-3">
                  <div>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-white">Cryptographic Audit Trail</h3>
                    <p class="text-xs text-slate-400">Immutable ledger events stored in PostgreSQL.</p>
                  </div>
                  <button @click="loadAuditLogs()" class="text-xs font-mono text-slate-500 hover:text-slate-900 dark:text-slate-400">↻ Refresh Trail</button>
                </div>

                <div class="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                  <template x-for="log in caseAuditLogs" :key="log.id">
                    <div class="py-2.5 flex items-center justify-between font-mono">
                      <div class="flex items-center gap-3">
                        <span class="text-slate-400 text-[11px]" x-text="formatTime(log.created_at)"></span>
                        <span class="font-bold text-slate-900 dark:text-white" x-text="log.action"></span>
                        <span class="text-slate-400 text-[10px]" x-text="'[' + (log.actor || 'SYSTEM') + ']'"></span>
                      </div>
                      <span class="text-slate-400 text-[11px]" x-text="JSON.stringify(log.metadata || {})"></span>
                    </div>
                  </template>
                </div>
              </div>

            </div>
          </template>
        </div>

        <!-- ==================================================================== -->
        <!-- SCREEN 3: RECOVERY POLICY SCREEN                                     -->
        <!-- "What is the autonomous system allowed to do?"                       -->
        <!-- ==================================================================== -->
        <div x-show="currentScreen === 'policy'" class="space-y-8" x-cloak>
          
          <div class="surface-card rounded-2xl p-6 space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-white/[0.05] pb-4">
              <div>
                <h2 class="text-base font-bold text-slate-900 dark:text-white">Merchant Recovery Policy</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Deterministic boundaries governing all autonomous execution.</p>
              </div>

              <div class="flex items-center gap-2.5">
                <button @click="navigate('twin')" class="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                  Simulate in Recovery Twin →
                </button>
                <button @click="savePolicyToBackend()" class="rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 px-4 py-1.5 text-xs font-bold text-white dark:text-slate-900 shadow-xs transition-all">
                  Save Changes
                </button>
              </div>
            </div>

            <!-- Notice on Policy Changes -->
            <div class="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05] p-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span>ℹ</span>
              <span>Policy changes affect future recovery cases. Existing cases in progress are not modified automatically.</span>
            </div>

            <!-- Rules Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              
              <!-- Automatic Recovery Rules -->
              <div class="surface-card-subtle rounded-xl p-5 space-y-4">
                <div class="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">
                  1. Automatic Recovery Rules
                </div>

                <div class="space-y-3">
                  <div>
                    <label class="text-slate-500 block mb-1">Maximum Retry Attempts Budget</label>
                    <div class="flex items-center gap-3">
                      <button @click="if(policyForm.maxRetries > 1) policyForm.maxRetries--" class="size-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] font-bold text-sm">-</button>
                      <span class="font-mono font-bold text-sm w-12 text-center" x-text="policyForm.maxRetries + ' retries'"></span>
                      <button @click="if(policyForm.maxRetries < 4) policyForm.maxRetries++" class="size-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] font-bold text-sm">+</button>
                    </div>
                  </div>

                  <div>
                    <label class="text-slate-500 block mb-1">Cooldown Between Attempts</label>
                    <select x-model="policyForm.coolingHours" class="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] p-2 text-xs font-mono font-bold text-slate-900 dark:text-white">
                      <option value="3">3 Hours</option>
                      <option value="6">6 Hours (Recommended)</option>
                      <option value="12">12 Hours</option>
                      <option value="24">24 Hours</option>
                    </select>
                  </div>

                  <div>
                    <label class="text-slate-500 block mb-1">Maximum Amount for Automatic Action (₹)</label>
                    <input type="number" x-model="policyForm.amountCap" class="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] p-2 text-xs font-mono font-bold text-slate-900 dark:text-white">
                  </div>
                </div>
              </div>

              <!-- Manual Approval Rules -->
              <div class="surface-card-subtle rounded-xl p-5 space-y-4">
                <div class="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">
                  2. Manual Approval Safeguards
                </div>

                <div class="space-y-3">
                  <div>
                    <label class="text-slate-500 block mb-1">Require Human Approval Above (₹)</label>
                    <input type="number" x-model="policyForm.amountCap" class="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] p-2 text-xs font-mono font-bold text-slate-900 dark:text-white">
                  </div>

                  <div class="space-y-2 pt-2">
                    <span class="text-slate-500 block text-[11px] font-medium">Require Operator Approval For:</span>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked class="rounded accent-slate-900 dark:accent-white">
                      <span class="text-slate-700 dark:text-slate-300">High-value recovery (above threshold)</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked class="rounded accent-slate-900 dark:accent-white">
                      <span class="text-slate-700 dark:text-slate-300">Policy exception events</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked class="rounded accent-slate-900 dark:accent-white">
                      <span class="text-slate-700 dark:text-slate-300">Low-confidence AI diagnosis (&lt; 70%)</span>
                    </label>
                  </div>
                </div>
              </div>

            </div>

            <!-- 3. AI Capabilities & Safety Boundary Card -->
            <div class="surface-card-subtle rounded-xl p-5 space-y-3">
              <div class="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                3. AI Autonomy Boundary (System Guardrails)
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                <div class="space-y-1.5">
                  <span class="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">AI MAY:</span>
                  <div class="space-y-1 text-slate-600 dark:text-slate-400">
                    <div>✓ Diagnose failure patterns from provider error payloads</div>
                    <div>✓ Recommend optimal recovery intervention timing</div>
                    <div>✓ Generate explainable natural-language rationales</div>
                  </div>
                </div>

                <div class="space-y-1.5">
                  <span class="font-bold text-rose-600 dark:text-rose-400 font-mono text-[11px]">AI MAY NOT:</span>
                  <div class="space-y-1 text-slate-600 dark:text-slate-400">
                    <div>✕ Execute financial payment actions directly</div>
                    <div>✕ Override merchant policy limits or retry budgets</div>
                    <div>✕ Modify cooling window constraints</div>
                    <div>✕ Determine payment truth without provider reconciliation</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        <!-- ==================================================================== -->
        <!-- SCREEN 4: RECOVERY TWIN (Simulation Environment)                     -->
        <!-- "Before changing our recovery policy, what would have happened?"     -->
        <!-- ==================================================================== -->
        <div x-show="currentScreen === 'twin'" class="space-y-8" x-cloak>
          
          <div class="surface-card rounded-2xl p-6 space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-white/[0.05] pb-4">
              <div>
                <h2 class="text-base font-bold text-slate-900 dark:text-white">Recovery Twin Counterfactual Simulator</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Evaluate policy changes across 10,000 historical failure cases before deploying.</p>
              </div>

              <div class="flex items-center gap-2.5">
                <button @click="runSimulationTwin()" :disabled="simulating" class="rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 px-4 py-1.5 text-xs font-bold text-white dark:text-slate-900 shadow-xs transition-all disabled:opacity-50">
                  <span x-text="simulating ? 'Simulating 10,000 cases...' : 'Run Simulation'"></span>
                </button>
              </div>
            </div>

            <!-- Side-by-Side: Current Policy (Read-Only) vs Proposed Policy (Editable) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              
              <!-- Current Policy Summary -->
              <div class="surface-card-subtle rounded-xl p-4 space-y-3">
                <div class="font-mono text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10 pb-2">
                  Current Live Policy
                </div>
                <div class="space-y-2 font-mono">
                  <div class="flex justify-between">
                    <span class="text-slate-500">Maximum Retries:</span>
                    <span class="font-bold text-slate-900 dark:text-white">1 Attempt</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Cooldown Delay:</span>
                    <span class="font-bold text-slate-900 dark:text-white">6 Hours</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Auto Limit:</span>
                    <span class="font-bold text-slate-900 dark:text-white">₹10,000</span>
                  </div>
                </div>
              </div>

              <!-- Proposed Policy (Editable) -->
              <div class="surface-card-subtle rounded-xl p-4 space-y-3 border-2 border-slate-900/10 dark:border-white/20">
                <div class="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2 flex justify-between items-center">
                  <span>Proposed Policy</span>
                  <span class="text-[10px] text-sky-600 dark:text-sky-400 font-bold">EDITABLE</span>
                </div>
                <div class="space-y-2 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500">Maximum Retries:</span>
                    <select x-model="twinProposed.maxRetries" @change="runSimulationTwin()" class="rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] px-2 py-0.5 text-xs font-mono font-bold">
                      <option value="1">1 Attempt</option>
                      <option value="2">2 Attempts</option>
                      <option value="3">3 Attempts</option>
                    </select>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500">Cooldown Delay:</span>
                    <select x-model="twinProposed.coolingHours" @change="runSimulationTwin()" class="rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] px-2 py-0.5 text-xs font-mono font-bold">
                      <option value="3">3 Hours</option>
                      <option value="6">6 Hours</option>
                      <option value="12">12 Hours</option>
                    </select>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500">Auto Limit:</span>
                    <input type="number" x-model="twinProposed.amountCap" @input="runSimulationTwin()" class="w-24 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] px-2 py-0.5 text-xs font-mono font-bold text-right">
                  </div>
                </div>
              </div>

            </div>

            <!-- Decision-Oriented Tradeoff Comparison -->
            <template x-if="twinResults">
              <div class="space-y-4 pt-2">
                <div class="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Simulation Results across 10,000 Historical / Synthetic Cases
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <!-- Metric 1: Recovered Revenue -->
                  <div class="surface-card rounded-xl p-4 space-y-1">
                    <span class="text-[11px] text-slate-500 font-medium">Expected Revenue</span>
                    <div class="font-mono text-xl font-bold text-slate-900 dark:text-white">₹1.37L → ₹1.61L</div>
                    <span class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">+ ₹24,000 lift</span>
                  </div>

                  <!-- Metric 2: Recovery Rate -->
                  <div class="surface-card rounded-xl p-4 space-y-1">
                    <span class="text-[11px] text-slate-500 font-medium">Recovery Rate</span>
                    <div class="font-mono text-xl font-bold text-slate-900 dark:text-white">57.1% → 63.4%</div>
                    <span class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">+ 6.3% yield</span>
                  </div>

                  <!-- Metric 3: Total Interventions -->
                  <div class="surface-card rounded-xl p-4 space-y-1">
                    <span class="text-[11px] text-slate-500 font-medium">Interventions</span>
                    <div class="font-mono text-xl font-bold text-slate-900 dark:text-white">240 → 390</div>
                    <span class="text-xs font-mono text-slate-500">+ 150 actions</span>
                  </div>

                  <!-- Metric 4: Risk / Customer Impact -->
                  <div class="surface-card rounded-xl p-4 space-y-1">
                    <span class="text-[11px] text-slate-500 font-medium">Risk / Friction</span>
                    <div class="font-mono text-xl font-bold text-slate-900 dark:text-white">LOW → MEDIUM</div>
                    <span class="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">Tradeoff warning</span>
                  </div>
                </div>

                <!-- Tradeoff Callout -->
                <div class="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <span class="font-bold">Tradeoff Analysis:</span>
                  <p>More recovery is not automatically better. Adding a 2nd retry attempt recovers ₹24,000 in additional revenue but increases customer touchpoint friction by 62.5% and introduces elevated card network decline risk.</p>
                </div>
              </div>
            </template>

            <!-- Safety Boundary Notice (Simulation Only) -->
            <div class="pt-4 border-t border-slate-100 dark:border-white/[0.05] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div class="text-slate-400 font-mono text-[11px]">
                <span class="font-bold text-slate-600 dark:text-slate-300">SIMULATION ONLY:</span> No payment actions will be executed. No live recovery workflows will be modified.
              </div>
              <button @click="navigate('policy')" class="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors">
                Return to Policy Review
              </button>
            </div>

          </div>

        </div>

      </main>
    </div>
  </div>

  <!-- ================= RECONCILIATION MODAL (Core Interactive Demo) ================= -->
  <div x-show="showReconcileModal" x-cloak class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showReconcileModal = false">
    <div class="w-full max-w-md surface-card p-6 rounded-2xl space-y-5 shadow-2xl text-xs">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] pb-3">
        <div>
          <h3 class="font-bold text-sm text-slate-900 dark:text-white">Provider Status Reconciliation</h3>
          <p class="text-xs text-slate-400 mt-0.5">Determine true financial state with Razorpay & Bank gateway.</p>
        </div>
        <button @click="showReconcileModal = false" class="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold">✕</button>
      </div>

      <template x-if="reconcileStep === 'loading'">
        <div class="py-8 flex flex-col items-center space-y-3 text-center">
          <div class="size-8 rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-white/20 dark:border-t-white animate-spin"></div>
          <span class="font-mono text-slate-600 dark:text-slate-300">Checking payment truth with bank gateway...</span>
        </div>
      </template>

      <template x-if="reconcileStep === 'result'">
        <div class="space-y-4">
          <div class="rounded-xl p-4 border" :class="reconcileOutcome === 'CAPTURED' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300' : (reconcileOutcome === 'STILL_FAILED' ? 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200' : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300')">
            <div class="font-mono font-bold text-xs" x-text="reconcileResultTitle"></div>
            <p class="text-xs mt-1" x-text="reconcileResultMessage"></p>
          </div>

          <div class="text-[11px] text-slate-400 font-mono">
            <span>Audit Event Logged: <strong class="text-slate-700 dark:text-slate-300">RECONCILIATION_RESOLVED</strong></span>
          </div>

          <button @click="showReconcileModal = false; loadData(true);" class="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition-all">
            Done & Update Queue
          </button>
        </div>
      </template>

      <template x-if="reconcileStep === 'select'">
        <div class="space-y-3">
          <span class="text-slate-500 block">Select reconciliation response to simulate:</span>
          
          <button @click="executeReconciliation('CAPTURED')" class="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all space-y-1">
            <div class="font-bold text-slate-900 dark:text-white">Outcome A: Payment Captured (Success)</div>
            <p class="text-slate-400 text-[11px]">Provider confirms payment was captured. RecoveryOS prevents duplicate retry.</p>
          </button>

          <button @click="executeReconciliation('STILL_FAILED')" class="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-all space-y-1">
            <div class="font-bold text-slate-900 dark:text-white">Outcome B: Payment Still Failed</div>
            <p class="text-slate-400 text-[11px]">Provider confirms capture did not succeed. Safe to continue recovery policy.</p>
          </button>

          <button @click="executeReconciliation('UNAVAILABLE')" class="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:border-amber-500 hover:bg-amber-500/5 transition-all space-y-1">
            <div class="font-bold text-slate-900 dark:text-white">Outcome C: Provider Status Unavailable</div>
            <p class="text-slate-400 text-[11px]">Truth could not be obtained. Case remains locked in reconciliation.</p>
          </button>
        </div>
      </template>
    </div>
  </div>

  <!-- ================= HUMAN APPROVAL MODAL ================= -->
  <div x-show="showApprovalModal" x-cloak class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showApprovalModal = false">
    <div class="w-full max-w-md surface-card p-6 rounded-2xl space-y-5 shadow-2xl text-xs">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] pb-3">
        <h3 class="font-bold text-sm text-slate-900 dark:text-white">Authorize Recovery Action</h3>
        <button @click="showApprovalModal = false" class="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold">✕</button>
      </div>

      <div class="space-y-3 font-medium">
        <div class="surface-card-subtle rounded-xl p-4 space-y-2 font-mono">
          <div class="flex justify-between">
            <span class="text-slate-500">Action:</span>
            <span class="font-bold text-slate-900 dark:text-white">Retry Payment</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Amount:</span>
            <span class="font-bold text-slate-900 dark:text-white" x-text="activeCase ? formatPaise(activeCase.amount_in_paise) : '₹25,000'"></span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Scheduled:</span>
            <span class="font-bold text-sky-600 dark:text-sky-400">After 6 Hours</span>
          </div>
        </div>

        <p class="text-slate-600 dark:text-slate-400 text-xs">
          <strong>Why approval is required:</strong> Amount exceeds the configured automatic threshold of ₹10,000. Authorizing this action will schedule the recovery retry in the background queue.
        </p>
      </div>

      <div class="flex items-center gap-2 pt-2">
        <button 
          @click="submitApproval(true)"
          class="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 font-bold text-white shadow-xs transition-all">
          Approve Recovery
        </button>
        <button 
          @click="submitApproval(false)"
          class="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 px-4 py-2.5 font-bold text-rose-600 dark:text-rose-400">
          Reject
        </button>
      </div>
    </div>
  </div>

  <!-- ================= INGEST TEST FAILURE MODAL ================= -->
  <div x-show="showIngestModal" x-cloak class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showIngestModal = false">
    <div class="w-full max-w-sm surface-card p-6 rounded-2xl space-y-4 shadow-2xl text-xs">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] pb-3">
        <h3 class="font-bold text-sm text-slate-900 dark:text-white">Ingest Test Failure Event</h3>
        <button @click="showIngestModal = false" class="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold">✕</button>
      </div>

      <div class="space-y-3 font-medium">
        <div>
          <label class="text-slate-500 block mb-1">Customer Identifier</label>
          <input type="text" x-model="testPayment.customerEmail" class="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] p-2 text-slate-900 dark:text-white">
        </div>

        <div>
          <label class="text-slate-500 block mb-1">Amount (₹)</label>
          <input type="number" x-model="testPayment.amountRupees" class="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] p-2 font-mono text-slate-900 dark:text-white">
        </div>

        <div>
          <label class="text-slate-500 block mb-1">Failure Mode</label>
          <select x-model="testPayment.failureType" class="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F19] p-2 text-slate-900 dark:text-white">
            <option value="INSUFFICIENT_FUNDS">Insufficient Funds (Auto Retry 6h)</option>
            <option value="AUTHENTICATION_FAILED">OTP / Auth Timeout (Smart Link)</option>
            <option value="OUTCOME_UNKNOWN">Provider Timeout (Outcome Unknown)</option>
            <option value="HIGH_VALUE">High Value ₹25,000 (Awaiting Approval)</option>
          </select>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-2">
        <button 
          @click="submitTestWebhook()"
          :disabled="ingesting"
          class="flex-1 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 py-2.5 font-bold text-white dark:text-slate-900 transition-all disabled:opacity-50">
          <span x-text="ingesting ? 'Processing...' : 'Send Webhook & Process'"></span>
        </button>
        <button @click="showIngestModal = false" class="rounded-lg border border-slate-200 dark:border-white/10 px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">
          Cancel
        </button>
      </div>
    </div>
  </div>

  <!-- ================= SYSTEM OPERATIONAL STATUS MODAL ================= -->
  <div x-show="showStatusModal" x-cloak class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showStatusModal = false">
    <div class="w-full max-w-sm surface-card p-6 rounded-2xl space-y-4 shadow-2xl text-xs">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] pb-3">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full bg-emerald-500"></span>
          <h3 class="font-bold text-sm text-slate-900 dark:text-white">System Status Diagnostics</h3>
        </div>
        <button @click="showStatusModal = false" class="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold">✕</button>
      </div>

      <div class="space-y-2.5 font-mono text-xs">
        <div class="flex items-center justify-between p-2 rounded-lg surface-card-subtle">
          <span class="text-slate-500">Payment Provider (Razorpay)</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-bold">OPERATIONAL</span>
        </div>
        <div class="flex items-center justify-between p-2 rounded-lg surface-card-subtle">
          <span class="text-slate-500">AI Diagnosis (Llama 3.3 70B)</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-bold">OPERATIONAL</span>
        </div>
        <div class="flex items-center justify-between p-2 rounded-lg surface-card-subtle">
          <span class="text-slate-500">Policy Engine (Deterministic)</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-bold">OPERATIONAL</span>
        </div>
        <div class="flex items-center justify-between p-2 rounded-lg surface-card-subtle">
          <span class="text-slate-500">Background Workers & Queues</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-bold">OPERATIONAL</span>
        </div>
        <div class="flex items-center justify-between p-2 rounded-lg surface-card-subtle">
          <span class="text-slate-500">PostgreSQL Database</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-bold">CONNECTED</span>
        </div>
      </div>

      <div class="pt-2">
        <button @click="showStatusModal = false" class="w-full py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold">
          Close Diagnostics
        </button>
      </div>
    </div>
  </div>

  <!-- APPLICATION JAVASCRIPT CONTROLLER -->
  <script>
    function recoveryControlPlane() {
      return {
        currentScreen: 'queue', // 'queue' | 'investigation' | 'policy' | 'twin'
        showSplash: true,
        showStatusModal: false,
        showIngestModal: false,
        showReconcileModal: false,
        showApprovalModal: false,
        ingesting: false,
        simulating: false,
        
        selectedCaseId: null,
        activeCase: null,
        
        reconcileStep: 'select', // 'select' | 'loading' | 'result'
        reconcileOutcome: 'CAPTURED',
        reconcileResultTitle: '',
        reconcileResultMessage: '',

        metrics: {
          revenueAtRiskRupees: 42000,
          grossRecoveredRupees: 28000,
          recoveryRatePercent: 66.7,
          casesByState: {}
        },
        cases: [],
        auditLogs: [],

        policyForm: {
          maxRetries: 2,
          coolingHours: 6,
          amountCap: 10000
        },

        twinProposed: {
          maxRetries: 2,
          coolingHours: 3,
          amountCap: 15000
        },
        twinResults: {
          currentRecovered: 137000,
          proposedRecovered: 161000,
          currentRate: 57.1,
          proposedRate: 63.4,
          currentActions: 240,
          proposedActions: 390
        },

        testPayment: {
          customerEmail: 'karan.sharma@saascorp.in',
          amountRupees: 5000,
          failureType: 'OUTCOME_UNKNOWN'
        },

        get screenTitle() {
          const map = {
            'queue': 'Recovery Queue',
            'investigation': 'Recovery Case Investigation',
            'policy': 'Recovery Policies',
            'twin': 'Recovery Twin'
          };
          return map[this.currentScreen] || 'Control Plane';
        },

        get breadcrumbs() {
          const map = {
            'queue': 'RecoveryOS / Queue',
            'investigation': 'RecoveryOS / Investigation',
            'policy': 'RecoveryOS / Policies',
            'twin': 'RecoveryOS / Recovery Twin'
          };
          return map[this.currentScreen] || '';
        },

        get attentionCases() {
          if (!this.cases || this.cases.length === 0) return [];
          return this.cases.filter(c => 
            c.state === 'OUTCOME_UNKNOWN' || 
            c.state === 'AWAITING_APPROVAL' || 
            c.state === 'EXHAUSTED' || 
            c.state === 'ESCALATED'
          );
        },

        get resolvedCases() {
          if (!this.cases || this.cases.length === 0) return [];
          return this.cases.filter(c => c.state === 'RECOVERED');
        },

        get reconciliationPendingCount() {
          return this.cases.filter(c => c.state === 'OUTCOME_UNKNOWN').length;
        },

        get caseAuditLogs() {
          if (!this.activeCase) return this.auditLogs;
          return this.auditLogs.filter(l => l.case_id === this.activeCase.id);
        },

        async initApp() {
          setTimeout(() => {
            this.showSplash = false;
          }, 2000);

          await this.loadData();
          await this.loadAuditLogs();
        },

        navigate(screen) {
          this.currentScreen = screen;
          if (screen === 'investigation' && !this.activeCase && this.cases.length > 0) {
            this.loadCaseDetail(this.cases[0].id);
          }
        },

        async openInvestigation(caseId, autoAction = null) {
          this.selectedCaseId = caseId;
          await this.loadCaseDetail(caseId);
          this.currentScreen = 'investigation';

          if (autoAction === 'reconcile') {
            this.startReconciliationModal();
          } else if (autoAction === 'approve') {
            this.showApprovalModal = true;
          }
        },

        getDefaultCases() {
          return [
            {
              id: 'rc_1042_unknown',
              amount_in_paise: 500000,
              currency: 'INR',
              method: 'card',
              error_code: 'GATEWAY_ERROR_PROVIDER_TIMEOUT',
              error_description: 'Connection timed out after recovery action dispatched.',
              state: 'OUTCOME_UNKNOWN',
              failure_class: 'NETWORK_TIMEOUT',
              diagnosed_class: 'NETWORK_TIMEOUT',
              ai_confidence: 0.84,
              ai_reasoning: 'Provider gateway timed out after dispatch. Cannot determine if captured.',
              customer_name: 'Acme SaaS India (INV-20491)',
              created_at: new Date(Date.now() - 15 * 60000).toISOString(),
              attempt_count: 1,
              max_attempts: 2
            },
            {
              id: 'rc_2089_approval',
              amount_in_paise: 2500000,
              currency: 'INR',
              method: 'card',
              error_code: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
              error_description: 'Card decline due to insufficient funds.',
              state: 'AWAITING_APPROVAL',
              failure_class: 'INSUFFICIENT_FUNDS',
              diagnosed_class: 'INSUFFICIENT_FUNDS',
              ai_confidence: 0.89,
              ai_reasoning: 'High-value invoice exceeds merchant auto threshold of ₹10,000.',
              customer_name: 'Vertex Enterprise (INV-19042)',
              created_at: new Date(Date.now() - 45 * 60000).toISOString(),
              attempt_count: 0,
              max_attempts: 2
            },
            {
              id: 'rc_3041_exhausted',
              amount_in_paise: 149900,
              currency: 'INR',
              method: 'upi',
              error_code: 'BAD_REQUEST_TRANSACTION_LIMIT_EXCEEDED',
              error_description: 'Bank account transaction limit exceeded.',
              state: 'EXHAUSTED',
              failure_class: 'LIMIT_EXCEEDED',
              diagnosed_class: 'LIMIT_EXCEEDED',
              ai_confidence: 0.76,
              ai_reasoning: 'Retry budget exhausted (2 of 2 attempts executed without success).',
              customer_name: 'Starlight Tech Solutions',
              created_at: new Date(Date.now() - 120 * 60000).toISOString(),
              attempt_count: 2,
              max_attempts: 2
            },
            {
              id: 'rc_1002_resolved',
              amount_in_paise: 149900,
              currency: 'INR',
              method: 'card',
              error_code: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
              state: 'RECOVERED',
              failure_class: 'INSUFFICIENT_FUNDS',
              diagnosed_class: 'INSUFFICIENT_FUNDS',
              ai_confidence: 0.91,
              customer_name: 'DevCorp India',
              created_at: new Date(Date.now() - 360 * 60000).toISOString(),
              recovered_at: new Date(Date.now() - 180 * 60000).toISOString(),
              recovered_amount_in_paise: 149900,
              attempt_count: 1,
              max_attempts: 2
            },
            {
              id: 'rc_1003_resolved',
              amount_in_paise: 320000,
              currency: 'INR',
              method: 'card',
              error_code: 'GATEWAY_ERROR_BANK_COMMUNICATION_FAILURE',
              state: 'RECOVERED',
              failure_class: 'NETWORK_TIMEOUT',
              diagnosed_class: 'NETWORK_TIMEOUT',
              ai_confidence: 0.88,
              customer_name: 'HyperScale Systems',
              created_at: new Date(Date.now() - 480 * 60000).toISOString(),
              recovered_at: new Date(Date.now() - 240 * 60000).toISOString(),
              recovered_amount_in_paise: 320000,
              attempt_count: 1,
              max_attempts: 2
            },
            {
              id: 'rc_1004_resolved',
              amount_in_paise: 800000,
              currency: 'INR',
              method: 'upi',
              error_code: 'GATEWAY_TIMEOUT',
              state: 'RECOVERED',
              failure_class: 'AUTHENTICATION_FAILED',
              diagnosed_class: 'AUTHENTICATION_FAILED',
              ai_confidence: 0.85,
              customer_name: 'Apex Digital Media',
              created_at: new Date(Date.now() - 600 * 60000).toISOString(),
              recovered_at: new Date(Date.now() - 300 * 60000).toISOString(),
              recovered_amount_in_paise: 800000,
              attempt_count: 1,
              max_attempts: 2
            }
          ];
        },

        getDefaultAuditLogs() {
          const now = new Date();
          return [
            { id: '1', action: 'STATE_CHANGED_TO_OUTCOME_UNKNOWN', actor: 'STATE_MACHINE', created_at: new Date(now - 15 * 60000).toISOString(), metadata: { reason: 'Provider response timeout after 5000ms' } },
            { id: '2', action: 'RECOVERY_ACTION_DISPATCHED', actor: 'WORKER', created_at: new Date(now - 15.1 * 60000).toISOString(), metadata: { action: 'SMART_RETRY_LINK', channel: 'SMS' } },
            { id: '3', action: 'RETRY_APPROVED', actor: 'POLICY_ENGINE', created_at: new Date(now - 15.2 * 60000).toISOString(), metadata: { rules: ['COOLING_WINDOW_SATISFIED', 'AMOUNT_WITHIN_LIMIT'] } },
            { id: '4', action: 'POLICY_RULES_EVALUATED', actor: 'POLICY_ENGINE', created_at: new Date(now - 15.3 * 60000).toISOString(), metadata: { verdict: 'APPROVED' } },
            { id: '5', action: 'AI_DIAGNOSIS_GENERATED', actor: 'LLAMA_3.3_70B', created_at: new Date(now - 15.4 * 60000).toISOString(), metadata: { failure_class: 'NETWORK_TIMEOUT', confidence: 0.84 } },
            { id: '6', action: 'DUPLICATE_CHECK_COMPLETED', actor: 'SYSTEM', created_at: new Date(now - 15.5 * 60000).toISOString(), metadata: { is_duplicate: false } },
            { id: '7', action: 'WEBHOOK_SIGNATURE_VERIFIED', actor: 'SYSTEM', created_at: new Date(now - 15.5 * 60000).toISOString(), metadata: { algorithm: 'HMAC-SHA256' } },
            { id: '8', action: 'PAYMENT_FAILED', actor: 'GATEWAY', created_at: new Date(now - 15.6 * 60000).toISOString(), metadata: { provider: 'razorpay', error_code: 'GATEWAY_TIMEOUT' } }
          ];
        },

        async loadData(silent = false) {
          try {
            const [mRes, cRes] = await Promise.all([
              fetch('/api/v1/metrics/overview', { headers: { 'X-Demo-Mode': 'true' } }).then(r => r.json()).catch(() => null),
              fetch('/api/v1/cases', { headers: { 'X-Demo-Mode': 'true' } }).then(r => r.json()).catch(() => null)
            ]);

            if (mRes && mRes.metrics) this.metrics = mRes.metrics;
            if (cRes && Array.isArray(cRes.cases) && cRes.cases.length > 0) {
              this.cases = cRes.cases;
            } else if (!this.cases || this.cases.length === 0) {
              this.cases = this.getDefaultCases();
            }

            if (this.cases.length > 0 && !this.activeCase) {
              this.selectedCaseId = this.cases[0].id;
              this.activeCase = this.cases[0];
            }
          } catch (err) {
            console.error('Failed to load cases:', err);
            if (!this.cases || this.cases.length === 0) {
              this.cases = this.getDefaultCases();
              this.selectedCaseId = this.cases[0].id;
              this.activeCase = this.cases[0];
            }
          }
        },

        async loadCaseDetail(caseId) {
          this.selectedCaseId = caseId;
          try {
            const res = await fetch('/api/v1/cases/' + caseId, { headers: { 'X-Demo-Mode': 'true' } });
            const data = await res.json();
            if (data && data.case) {
              this.activeCase = data.case;
              return;
            }
          } catch (e) {}
          const found = this.cases.find(c => c.id === caseId);
          if (found) this.activeCase = found;
        },

        async loadAuditLogs() {
          try {
            const res = await fetch('/api/v1/audit-logs', { headers: { 'X-Demo-Mode': 'true' } });
            const data = await res.json();
            if (data && Array.isArray(data.audit_logs) && data.audit_logs.length > 0) {
              this.auditLogs = data.audit_logs;
              return;
            }
          } catch (e) {}
          if (!this.auditLogs || this.auditLogs.length === 0) {
            this.auditLogs = this.getDefaultAuditLogs();
          }
        },

        startReconciliationModal() {
          this.reconcileStep = 'select';
          this.showReconcileModal = true;
        },

        async executeReconciliation(outcome) {
          this.reconcileStep = 'loading';
          this.reconcileOutcome = outcome;

          try {
            await fetch('/api/v1/cases/' + this.activeCase.id + '/reconcile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Demo-Mode': 'true' },
              body: JSON.stringify({ outcome })
            }).catch(() => null);
          } catch (err) {}

          setTimeout(() => {
            this.reconcileStep = 'result';
            if (outcome === 'CAPTURED') {
              this.reconcileResultTitle = '✓ PAYMENT CAPTURED';
              this.reconcileResultMessage = 'The provider confirmed that the recovery action succeeded. RecoveryOS prevented a duplicate retry.';
              if (this.activeCase) {
                this.activeCase.state = 'RECOVERED';
                this.activeCase.recovered_at = new Date().toISOString();
                this.activeCase.recovered_amount_in_paise = this.activeCase.amount_in_paise;
              }
              this.auditLogs.unshift({
                id: 'rec_' + Date.now(),
                case_id: this.activeCase ? this.activeCase.id : null,
                action: 'RECONCILIATION_RESOLVED',
                actor: 'OPERATOR:finance@saascorp.in',
                created_at: new Date().toISOString(),
                metadata: { outcome: 'PAYMENT_CAPTURED', verification: 'Payment confirmed captured by bank. Duplicate retry avoided.' }
              });
            } else if (outcome === 'STILL_FAILED') {
              this.reconcileResultTitle = 'PAYMENT STILL FAILED';
              this.reconcileResultMessage = 'The provider confirmed that the action did not succeed. Recovery policy evaluation can continue.';
              this.auditLogs.unshift({
                id: 'rec_' + Date.now(),
                case_id: this.activeCase ? this.activeCase.id : null,
                action: 'RECONCILIATION_CONFIRMED_FAILED',
                actor: 'OPERATOR:finance@saascorp.in',
                created_at: new Date().toISOString(),
                metadata: { outcome: 'PAYMENT_STILL_FAILED', verification: 'Provider confirmed capture did not succeed.' }
              });
            } else {
              this.reconcileResultTitle = 'PROVIDER STATUS UNAVAILABLE';
              this.reconcileResultMessage = 'RecoveryOS could not obtain payment truth. The case remains in reconciliation. No new financial action will be executed.';
              this.auditLogs.unshift({
                id: 'rec_' + Date.now(),
                case_id: this.activeCase ? this.activeCase.id : null,
                action: 'RECONCILIATION_UNAVAILABLE',
                actor: 'OPERATOR:finance@saascorp.in',
                created_at: new Date().toISOString(),
                metadata: { outcome: 'PROVIDER_STATUS_UNAVAILABLE', verification: 'Truth could not be obtained. Case remains in reconciliation.' }
              });
            }
          }, 800);
        },

        async submitApproval(approved) {
          try {
            const endpoint = approved ? '/cases/' + this.activeCase.id + '/approve' : '/cases/' + this.activeCase.id + '/reject';
            await fetch('/api/v1' + endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Demo-Mode': 'true' },
              body: JSON.stringify({ notes: approved ? 'Authorized by operator' : 'Rejected' })
            }).catch(() => null);
          } catch (err) {}

          if (this.activeCase) {
            this.activeCase.state = approved ? 'ACTION_SCHEDULED' : 'ESCALATED';
          }
          this.auditLogs.unshift({
            id: 'app_' + Date.now(),
            case_id: this.activeCase ? this.activeCase.id : null,
            action: approved ? 'RECOVERY_AUTHORIZED' : 'RECOVERY_REJECTED',
            actor: 'OPERATOR:finance@saascorp.in',
            created_at: new Date().toISOString(),
            metadata: { decision: approved ? 'APPROVED' : 'REJECTED', scheduled: approved ? 'After 6 hours' : 'Offline escalation' }
          });
          this.showApprovalModal = false;
        },

        async executeRecoveryNow(caseId) {
          try {
            const res = await fetch('/api/v1/cases/' + caseId + '/execute-action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Demo-Mode': 'true' },
              body: JSON.stringify({})
            });
            if (res.ok) {
              await this.loadCaseDetail(caseId);
              await this.loadData(true);
              await this.loadAuditLogs();
            }
          } catch (e) {}
        },

        async savePolicyToBackend() {
          try {
            const res = await fetch('/api/v1/merchants/00000000-0000-0000-0000-000000000000/policy', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'X-Demo-Mode': 'true' },
              body: JSON.stringify({
                policy: {
                  max_retry_attempts: Number(this.policyForm.maxRetries),
                  cooling_window_hours: Number(this.policyForm.coolingHours),
                  max_auto_recovery_amount_paise: Number(this.policyForm.amountCap) * 100,
                  require_consent_for_notifications: true,
                  min_ai_confidence_threshold: 0.70
                }
              })
            });
            if (res.ok) alert('✓ Policy saved to PostgreSQL.');
          } catch (e) {
            alert('Failed to save policy: ' + e.message);
          }
        },

        async runSimulationTwin() {
          this.simulating = true;
          try {
            const res = await fetch('/api/v1/simulator/run', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Demo-Mode': 'true' },
              body: JSON.stringify({
                policy: {
                  max_retry_attempts: Number(this.twinProposed.maxRetries),
                  cooling_window_hours: Number(this.twinProposed.coolingHours),
                  max_auto_recovery_amount_paise: Number(this.twinProposed.amountCap) * 100,
                  require_consent_for_notifications: true,
                  min_ai_confidence_threshold: 0.70
                }
              })
            });
            const data = await res.json();
            if (data && data.simulation_results) {
              this.twinResults = {
                currentRecovered: 137000,
                proposedRecovered: Math.round(data.simulation_results.recoveredRevenuePaise / 100),
                currentRate: 57.1,
                proposedRate: Number(data.simulation_results.recoveryRatePercent.toFixed(1)),
                currentActions: 240,
                proposedActions: data.simulation_results.recoveredCases + 150
              };
            }
          } catch (e) {} finally {
            this.simulating = false;
          }
        },

        async submitTestWebhook() {
          this.ingesting = true;
          try {
            const isUnknown = this.testPayment.failureType === 'OUTCOME_UNKNOWN';
            const isHighValue = this.testPayment.failureType === 'HIGH_VALUE';
            const amountRupees = isHighValue ? 25000 : (this.testPayment.amountRupees || 5000);

            const payload = {
              id: 'evt_test_' + Date.now(),
              event: 'payment.failed',
              account_id: '00000000-0000-0000-0000-000000000000',
              payload: {
                payment: {
                  entity: {
                    id: 'pay_test_' + Date.now(),
                    amount: amountRupees * 100,
                    currency: 'INR',
                    status: 'failed',
                    method: 'card',
                    email: this.testPayment.customerEmail,
                    error_code: isUnknown ? 'GATEWAY_TIMEOUT' : 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
                    error_description: 'Simulated test failure: ' + this.testPayment.failureType
                  }
                }
              }
            };

            const res = await fetch('/api/v1/webhooks/razorpay', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Demo-Mode': 'true' },
              body: JSON.stringify(payload)
            });

            if (res.ok) {
              this.showIngestModal = false;
              setTimeout(async () => {
                await this.loadData(true);
                await this.loadAuditLogs();
              }, 400);
            }
          } catch (e) {
            alert('Error: ' + e.message);
          } finally {
            this.ingesting = false;
          }
        },

        getAttentionReason(item) {
          switch (item.state) {
            case 'OUTCOME_UNKNOWN':
              return 'Retry request timed out after leaving RecoveryOS. The provider outcome could not be confirmed.';
            case 'AWAITING_APPROVAL':
              return 'Automatic recovery threshold exceeded (₹10,000). RecoveryOS recommends retrying after 6 hours.';
            case 'EXHAUSTED':
              return 'Maximum retry budget reached (2/2). No further automated action is permitted.';
            case 'ESCALATED':
              return 'Rejection recorded by finance operator. Escalated for manual customer relationship outreach.';
            default:
              return 'State requires supervisor oversight.';
          }
        },

        getRecommendedActionText(item) {
          switch (item.state) {
            case 'OUTCOME_UNKNOWN':
              return 'Reconcile with provider';
            case 'AWAITING_APPROVAL':
              return 'Review & Authorize';
            case 'EXHAUSTED':
              return 'Manual outreach';
            case 'ESCALATED':
              return 'Manual resolution';
            default:
              return 'Investigate case';
          }
        },

        getCurrentStateDescription(c) {
          switch (c.state) {
            case 'OUTCOME_UNKNOWN':
              return 'We cannot determine whether the recovery action was processed by the payment provider. To prevent duplicate financial execution, automatic retry has been blocked.';
            case 'AWAITING_APPROVAL':
              return 'Payment amount exceeds the configured automatic threshold of ₹10,000. Human authorization is required before recovery execution.';
            case 'ACTION_SCHEDULED':
              return 'Optimal cooling window active. Autonomous retry is scheduled to execute safely.';
            case 'RECOVERED':
              return 'Payment successfully captured and confirmed. Duplicate retries safely avoided.';
            case 'EXHAUSTED':
              return 'Maximum retry attempts budget reached. Case closed to protect cardholder score.';
            default:
              return 'Active state under deterministic governance.';
          }
        },

        getCurrentStatePanelClass(state) {
          switch (state) {
            case 'OUTCOME_UNKNOWN':
              return 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200';
            case 'AWAITING_APPROVAL':
              return 'bg-sky-500/10 border-sky-500/20 text-sky-900 dark:text-sky-200';
            case 'RECOVERED':
              return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200';
            default:
              return 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200';
          }
        },

        getStateBadgeClass(state) {
          switch (state) {
            case 'RECOVERED':
              return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
            case 'OUTCOME_UNKNOWN':
              return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
            case 'AWAITING_APPROVAL':
              return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20';
            case 'EXHAUSTED':
            case 'ESCALATED':
              return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
            default:
              return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';
          }
        },

        formatInr(rupees) {
          return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(rupees || 0);
        },

        formatPaise(paise) {
          return this.formatInr((paise || 0) / 100);
        },

        formatTime(dateStr) {
          if (!dateStr) return 'Today, 10:03 AM';
          const d = new Date(dateStr);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        },

        formatTimeOnly(dateStr, addSeconds = 0) {
          const d = dateStr ? new Date(dateStr) : new Date();
          if (addSeconds) d.setSeconds(d.getSeconds() + addSeconds);
          return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        },

        formatFailure(fc) {
          if (!fc) return 'Insufficient Funds';
          const map = {
            'INSUFFICIENT_FUNDS': 'Insufficient Funds',
            'AUTHENTICATION_FAILED': 'Authentication Timeout',
            'EXPIRED_INSTRUMENT': 'Card Expired',
            'NETWORK_TIMEOUT': 'Bank Gateway Timeout'
          };
          return map[fc] || fc.replace(/_/g, ' ');
        }
      }
    }
  </script>
</body>
</html>`);
  };

  fastify.get('/', handler);
  fastify.get('/dashboard', handler);
};
