# Testing and Simulation Suite

This directory is dedicated to testing workflows, load/traffic simulations, benchmark suites, and autonomous recovery validations for **RecoveryOS**.

---

## Directory Structure

```
testing-simulation/
├── scenarios/          # Pre-configured failure and recovery test scenarios
├── simulations/        # Simulation runners and load generation scripts
├── fixtures/           # Mock payloads, webhook fixtures, and mock Razorpay events
└── README.md           # Documentation and execution guides
```

---

## Available Simulation & Testing Workflows

### 1. Live Traffic & Multi-Scenario Simulation
Simulate realistic payment traffic, gateway outages, network timeouts, and bank downtimes:
```bash
npx tsx scripts/simulate-live-traffic.ts
```

### 2. High-Load "Crazy Strike" Recovery Stress Test
Test system under massive surge conditions and verify rate limits, fallback routing, and priority queue handling:
```bash
npx tsx scripts/crazy-strike-simulation.ts
```

### 3. Autonomous Recovery Flow Verification
Verify the end-to-end autonomous healing loop:
```bash
npx tsx scripts/demo-autonomous-recovery.ts
```

### 4. Latency Benchmarks
Measure end-to-end latencies for policy evaluation, state machine transitions, and AI diagnosis:
```bash
npx tsx scripts/measure-latencies.ts
```

### 5. Automated Unit & Integration Tests
Run Vitest across all monorepo packages and apps:
```bash
npm test
```
