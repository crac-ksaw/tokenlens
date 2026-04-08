# TokenLens

[![CI](https://img.shields.io/github/actions/workflow/status/crac-ksaw/tokenlens/test.yml?branch=main&label=ci)](https://github.com/crac-ksaw/tokenlens/actions/workflows/test.yml)
[![Deploy](https://img.shields.io/github/actions/workflow/status/crac-ksaw/tokenlens/deploy.yml?branch=main&label=deploy)](https://github.com/crac-ksaw/tokenlens/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Python](https://img.shields.io/badge/Python-Optimizer-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-0F766E)](#)

TokenLens is a cost intelligence platform for teams shipping LLM features in production. It captures usage events from application code, enriches them asynchronously, stores them for analytics, and surfaces spend, anomalies, budgets, and optimization opportunities in a dashboard.

## What It Does

- Tracks LLM usage per workspace, feature, user, session, model, and provider
- Publishes SDK events asynchronously so application calls are not blocked
- Enriches raw usage with token-cost calculations
- Detects anomalous spend using a rolling baseline
- Enforces budget guardrails with kill-switch support
- Exposes REST and GraphQL analytics APIs
- Shows cost analytics and optimization suggestions in a React dashboard
- Runs a Python optimizer to recommend cheaper model routes

## Architecture

TokenLens is organized as a pnpm monorepo with an event-driven backend:

1. The SDK wraps LLM provider calls and emits usage events.
2. The API accepts authenticated ingest events and pushes them to Redis Streams.
3. The worker consumes the stream, calculates costs, checks budgets, and writes analytics data.
4. ClickHouse stores time-series event data.
5. PostgreSQL stores workspaces, users, API keys, budgets, alerts, and recommendations.
6. Redis handles event streaming, deduplication, budget counters, and kill-switch flags.
7. The dashboard consumes the API for analytics and controls.
8. The optimizer analyzes usage patterns and writes model recommendations back to PostgreSQL.

## System Diagram

[TokenLens system diagram](<img width="1440" height="1186" alt="image" src="https://github.com/user-attachments/assets/d2bc0d0d-2715-4861-8d95-ee23a1869f3a" />)

```mermaid
flowchart LR
    A[Customer Application] --> B[TokenLens SDK]
    B --> C[Fastify API]
    C --> D[Redis Streams]
    D --> E[Worker]
    E --> F[ClickHouse]
    E --> G[PostgreSQL]
    E --> H[Redis budget counters / kill-switch]
    C --> I[React Dashboard]
    F --> C
    G --> C
    F --> J[Python Optimizer]
    J --> G
```

## Repository Layout

```text
tokenlens/
|-- apps/
|   |-- api/         Fastify API gateway
|   |-- optimizer/   Python batch optimizer
|   |-- web/         React + Vite dashboard
|   `-- worker/      Redis Streams enrichment worker
|-- packages/
|   |-- sdk/         Provider-wrapping TypeScript SDK
|   `-- shared/      Shared types, schemas, pricing, helpers
|-- infra/
|   |-- clickhouse/  ClickHouse schema
|   |-- docker/      Service Dockerfiles
|   |-- k8s/         Kubernetes manifests
|   |-- postgres/    SQL migrations
|   `-- terraform/   AWS infrastructure
`-- scripts/         Migration and seed helpers
```

## Core Components

### `packages/shared`

Shared contract package used by all TypeScript services.

- Zod schemas for auth, analytics, budgets, alerts, and ingest events
- Shared domain types
- Provider pricing table
- Utility helpers for hashing and trace IDs

### `packages/sdk`

Drop-in SDK for LLM instrumentation.

- Supports OpenAI, Anthropic, Gemini, and Bedrock adapters
- Publishes events asynchronously to the ingest endpoint
- Supports per-call context overrides
- Reads kill-switch state before forwarding requests

Example:

```ts
import { TokenLens } from "@tokenlens/sdk";

const client = new TokenLens({
  apiKey: process.env.TOKENLENS_API_KEY,
  workspaceId: "workspace_123",
  provider: "openai",
  feature: "summarization",
  environment: "production",
});

const result = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Summarize this file." }],
});
```

### `apps/api`

Fastify API gateway.

- Auth routes for register, login, and API key creation
- Ingest endpoint for SDK events
- Analytics endpoints for overview, breakdowns, timeseries, anomalies, and forecast
- Budget and alert configuration APIs
- GraphQL endpoint via Mercurius

### `apps/worker`

Asynchronous enrichment worker.

- Consumes Redis Stream messages
- Calculates USD cost from prompt and completion token counts
- Detects anomalies using a rolling Z-score baseline
- Applies feature budget rules and sets kill-switch flags
- Sends alerts to webhook, PagerDuty, or email channels

### `apps/web`

React dashboard built with Vite, Tailwind, Recharts, Zustand, and TanStack Query.

- Login and registration screens
- Cost overview with charts
- Feature breakdowns
- Anomaly log
- Budget settings
- Optimizer recommendation view

### `apps/optimizer`

Python batch job for cost optimization.

- Queries historical usage patterns
- Scores features for downgrade candidacy
- Estimates savings from cheaper model swaps
- Produces forecast data from daily cost trends
- Writes recommendations back to PostgreSQL

## Prerequisites

Local development expects:

- Node.js 20+
- `corepack`
- Docker and Docker Compose
- Python 3.10+ for local verification, ideally Python 3.12 for parity with the blueprint

## Environment Setup

Copy the template and fill in values:

```bash
cp .env.example .env
```

Important variables:

- `DATABASE_URL`
- `CLICKHOUSE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `TOKENLENS_API_KEY`
- `TOKENLENS_INGEST_URL`
- `VITE_API_URL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

## Running the Project

### 1. Install dependencies

```bash
corepack pnpm install
python -m venv .venv
.\.venv\Scripts\python -m pip install -r apps/optimizer/requirements.txt
```

### 2. Start infrastructure

```bash
docker compose up -d postgres redis clickhouse
```

### 3. Run database migrations

```bash
$env:DATABASE_URL="postgresql://tokenlens:secret@localhost:5432/tokenlens"
corepack pnpm db:migrate
```

### 4. Start the application services

```bash
corepack pnpm dev
```

This starts:

- API on `http://localhost:3001`
- Dashboard on `http://localhost:3000`
- Worker in watch mode

### 5. Run the optimizer

```bash
.\.venv\Scripts\python apps/optimizer/src/main.py
```

## Build Commands

Type-check everything:

```bash
corepack pnpm typecheck
```

Run tests:

```bash
corepack pnpm test
.\.venv\Scripts\python -m pytest apps/optimizer/tests
```

Build all TypeScript packages and apps:

```bash
corepack pnpm build
```

## Testing Coverage

Current automated verification includes:

- SDK unit tests
- API integration tests with Fastify inject
- Worker unit and integration-style tests around enrichment and budget logic
- Optimizer pytest coverage for recommendation generation and forecasting

## Data Flow

```text
App Code
  -> TokenLens SDK
  -> POST /ingest/event
  -> Redis Stream
  -> Worker
     -> ClickHouse (analytics)
     -> PostgreSQL (anomalies, budgets, recommendations)
     -> Redis (budget counters, kill-switch)
  -> API
  -> Dashboard
```

## Local Deployment Assets

The repository includes:

- `docker-compose.yml` for local infrastructure
- Dockerfiles for API, worker, web, and optimizer
- Terraform for AWS base infrastructure
- Kubernetes manifests for API, worker, web, and observability
- GitHub Actions for test and deploy pipelines

## Production Notes

The included infrastructure targets:

- ECS Fargate for API and worker
- CloudFront/S3 for the web app
- RDS PostgreSQL
- ElastiCache Redis
- ClickHouse Cloud or self-managed ClickHouse

Before production deployment, you should:

1. Configure AWS credentials and state for Terraform
2. Provision secrets in a secure store
3. Run database migrations against managed Postgres
4. Point DNS and TLS certificates at deployed services
5. Validate end-to-end ingestion against a live ClickHouse/Redis/Postgres stack

## Useful Files

- `apps/api/src/app.ts`
- `apps/worker/src/index.ts`
- `packages/sdk/src/tokenlens.ts`
- `apps/web/src/App.tsx`
- `apps/optimizer/src/main.py`
- `infra/terraform/main.tf`
- `docker-compose.yml`

## Current Verification Status

Verified locally in this workspace:

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `.\.venv\Scripts\python -m pytest apps/optimizer/tests`

Not verified locally in this workspace:

- Live Docker compose boot
- Live Postgres/Redis/ClickHouse migrations against running containers
- GitHub Actions execution
- AWS deployment rollout
