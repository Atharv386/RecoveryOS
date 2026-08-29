# RecoveryOS — System Architecture Specification

## 1. Architectural Overview & Philosophy

**RecoveryOS** is designed as a high-reliability **Modular Monolith** for AI-assisted payment recovery. The core architectural philosophy is:

> **"AI handles ambiguity; deterministic software handles authority."**

* **AI Role**: Observes heterogeneous, messy failure data (Razorpay error codes, error descriptions, metadata, card network responses, customer history), performs probabilistic classification, and suggests ranked interventions.
* **Deterministic Role**: Enforces strict financial limits, evaluates policy constraints, executes idempotent recovery actions against Razorpay, tracks transactional state transitions, handles network timeouts without double charging, and manages audit trails.
* **Razorpay as Ground Truth**: The payment gateway's status is the ultimate source of truth. System state reflects verified gateway states rather than optimistic assumptions.

---

## 2. Directory Layout & Monorepo Structure

```
.
├── apps/
│   └── api/                       # Fastify REST API & Webhook Ingestion Service
│       ├── src/
│       │   ├── routes/            # Webhooks, cases, policy configs, metrics, chaos
│       │   ├── middleware/        # Auth, tenant scoping, HMAC verification, rate limits
│       │   ├── workers/           # BullMQ worker initialization & queue listeners
│       │   └── server.ts
│       └── package.json
│
├── packages/
│   ├── db/                        # PostgreSQL schema, migrations, and repository layer
│   │   ├── prisma/ or drizzle/    # Migrations & schema definitions
│   │   └── src/                   # Typed queries, transactions, row-locking helpers
│   │
│   ├── state-machine/             # Authoritative RecoveryCase state engine
│   │   ├── src/
│   │   │   ├── transitions.ts     # Valid transition definitions & transition guard logic
│   │   │   └── errors.ts          # IllegalStateTransitionError definitions
│   │
│   ├── policy-engine/             # Deterministic rules engine (≥6 isolated rules)
│   │   ├── src/
│   │   │   ├── engine.ts          # Rule runner & aggregator
│   │   │   ├── rules/             # Discrete rule implementations
│   │   │   └── types.ts           # Policy input/output interfaces
│   │
│   ├── ai-diagnosis/              # Isolated AI client & Fallback classifier
│   │   ├── src/
│   │   │   ├── client.ts          # LLM API caller (Gemini / Groq)
│   │   │   ├── prompt.ts          # Sanitized prompt builder
│   │   │   ├── schema.ts          # Zod validation schema for LLM structured output
│   │   │   └── fallback.ts        # Pure deterministic error-code mapping fallback
│   │
│   ├── razorpay-adapter/          # Bounded Razorpay API client & Webhook HMAC verifier
│   │   ├── src/
│   │   │   ├── client.ts          # Payment fetch, refund, payment links, invoice client
│   │   │   └── webhook.ts         # Cryptographic HMAC SHA256 signature verification
│   │
│   └── simulator/                 # Recovery Twin non-executing counterfactual engine
│       └── src/
│           ├── scenario-runner.ts # Replays historical/seeded cases against policies
│           └── comparator.ts      # Computes delta recovery rates, costs, and risk
│
├── docs/                          # Architectural and technical specifications (Phase 0)
├── docker-compose.yml             # Postgres, Redis, API services
└── package.json
```

---

## 3. End-to-End Logical Flow & Queue Topology

```
                  ┌────────────────────────────────────────────────┐
                  │            Razorpay Payment Gateway            │
                  └───────────────────────┬────────────────────────┘
                                          │
                                          │ 1. POST /webhooks/razorpay
                                          │    (payment.failed, payment.captured)
                                          ▼
                      ┌───────────────────────────────────────┐
                      │            Webhook Gateway            │
                      │  - HMAC SHA256 Signature Verification │
                      │  - WebhookEvent Persistence           │
                      │  - Event ID Deduplication             │
                      └───────────────────┬───────────────────┘
                                          │
                                          │ 2. Enqueue Job
                                          ▼
                  ┌────────────────────────────────────────────────┐
                  │                 BullMQ / Redis                 │
                  └───────┬───────────────┬────────────────┬───────┘
                          │               │                │
            Job: DIAGNOSE │  Job: EXECUTE │ Job: RECONCILE │
                          ▼               │                │
┌───────────────────────────────┐         │                │
│       Diagnosis Worker        │         │                │
│  - Sanitize payment context   │         │                │
│  - Call AI (with timeout)     │         │                │
│  - Validate via Zod schema    │         │                │
│  - Fallback if AI disabled    │         │                │
└───────────────┬───────────────┘         │                │
                │                         │                │
                ▼                         │                │
┌───────────────────────────────┐         │                │
│     Policy Engine Worker      │         │                │
│  - Evaluate 6+ deterministic  │         │                │
│    rules against merchant cfg │         │                │
│  - Override/Downgrade AI recs │         │                │
│  - Schedule bounded action    │         │                │
└───────────────┬───────────────┘         │                │
                │                         │                │
                └────────────────────────►│                │
                                          ▼                │
                      ┌─────────────────────────────────┐  │
                      │         Recovery Worker         │  │
                      │  - Pre-flight Razorpay check    │  │
                      │  - Idempotency key acquisition  │  │
                      │  - Execute bounded action       │  │
                      │  - Handle network timeouts      │  │
                      └────────────────┬────────────────┘  │
                                       │                   │
                     If Network Error/ │                   │
                     Ambiguous Timeout ▼                   │
                      ┌─────────────────────────────────┐  │
                      │     OUTCOME_UNKNOWN Status      │  │
                      │     (HALT BLIND RETRIES)        │  │
                      └────────────────┬────────────────┘  │
                                       │                   │
                                       └──────────────────►│
                                                           ▼
                                       ┌─────────────────────────────────┐
                                       │       Reconciler Worker         │
                                       │  - Poll Razorpay API for ground │
                                       │    truth status                 │
                                       │  - Transition to RECOVERED or   │
                                       │    allow bounded retry          │
                                       └─────────────────────────────────┘
```

---

## 4. Subsystem Responsibilities

### 4.1 Webhook Ingestion & Deduplication Gateway
* **Fast Return**: Webhook endpoint validates the `X-Razorpay-Signature` using the merchant's webhook secret and stores the raw payload in the `webhook_events` table within `< 50ms`, returning `HTTP 200 OK`.
* **Deduplication**: Uses a unique database constraint on `(merchant_id, razorpay_event_id)` and BullMQ unique job IDs (`jobId = razorpay_event_id`) to prevent duplicate processing.

### 4.2 AI Isolation Boundary
* The AI service operates strictly as a pure function:
  $$\text{Diagnosis} = f(\text{SanitizedFailureContext})$$
* **No Database Access**: AI module cannot query or mutate database state.
* **No Razorpay API Credentials**: AI module cannot call payment endpoints.
* **Strict Output Schema**: Responses must parse through Zod schemas. If the model outputs malformed JSON or times out ($> 3000\text{ms}$), the system smoothly transitions to deterministic fallback classification.

### 4.3 Deterministic Policy Engine
* Evaluates merchant-configured safety constraints.
* Produces a structured `PolicyDecision` containing `decision` (`APPROVED`, `DOWNGRADED`, `REJECTED`, `MANUAL_REVIEW_REQUIRED`) and a list of `rules_fired`.
* Can completely override AI output.

### 4.4 Bounded Recovery Execution & Reconciliation
* Before attempting any payment action (e.g. creating a payment link or retrying mandate), the worker executes a **Pre-Flight Verification** against Razorpay to check if the payment was already settled.
* Generates a deterministic `idempotency_key = hash(merchant_id, case_id, attempt_number)`.
* Employs the `OUTCOME_UNKNOWN` circuit breaker on network timeouts to prevent duplicate charging.
