# 🌐 OmniProcure — AI-Native Supply Chain & Sourcing Platform

OmniProcure is an **AI-Native Electronics Procurement & Supply Chain Monitoring Platform** engineered to streamline component sourcing for hardware engineers and purchasing teams. By consolidating real-time distributor inventories, automating volatility checks, and providing a tool-equipped agentic command center, OmniProcure collapses BOM analysis and sourcing workflows from hours to seconds.

The platform is designed to run entirely serverless inside a unified Next.js App Router structure, eliminating external automation platforms (like n8n, Make, or Zapier) to ensure low latency and native type safety.

---

## 📌 Table of Contents
1. [System Architecture](#-system-architecture)
2. [User Flows & Usage Guide](#-user-flows--usage-guide)
3. [Key Features](#-key-features)
4. [Tech Stack & Integrations](#-tech-stack--integrations)
5. [Database Schema & Data Models](#-database-schema--data-models)
6. [AI Sourcing & Decision Logic](#-ai-sourcing--decision-logic)
7. [Environment Configuration](#-environment-configuration)
8. [Local Development Setup](#-local-development-setup)

---

## 🏗️ System Architecture

OmniProcure consolidates user authentication, real-time inventory queries, AI model execution, database caching, Slack webhooks, and background cron schedules into a single nextjs codebase.

```mermaid
graph TD
    %% Styling
    classDef frontend fill:#1e293b,stroke:#5ebcf8,stroke-width:2px,color:#f1f5f9;
    classDef backend fill:#1e293b,stroke:#7dd3fc,stroke-width:2px,color:#f1f5f9;
    classDef db fill:#0f172a,stroke:#34d399,stroke-width:2px,color:#f1f5f9;
    classDef external fill:#0f172a,stroke:#fbbf24,stroke-width:2px,color:#f1f5f9;

    %% Frontend Layer
    subgraph Frontend [Next.js Neumorphic UI & Dashboard]
        Landing[Landing Page / app/page.tsx]:::frontend
        Overview[Overview Dashboard / app/dashboard/page.tsx]:::frontend
        ChatUI[Agent Command Center / app/dashboard/chat/page.tsx]:::frontend
        MonitorUI[Monitor & Telemetry Feed / app/dashboard/monitor/page.tsx]:::frontend
        AlertsUI[Alerts Inbox / app/dashboard/alerts/page.tsx]:::frontend
        SettingsUI[Settings & Webhooks / app/dashboard/settings/page.tsx]:::frontend
    end

    %% API Layer
    subgraph API [Serverless API Handlers]
        BOM_API[BOM Sourcing Stream / api/bom/route.ts]:::backend
        Chat_API[Agentic Chat API / api/chat/route.ts]:::backend
        Monitor_API[Monitor & Telemetry API / api/monitor/route.ts]:::backend
        Alerts_API[Alerts CRUD API / api/alerts/route.ts]:::backend
        Audit_API[Audit Logs API / api/audit/route.ts]:::backend
        Cron_API[Cron Trigger Endpoint / api/cron/route.ts]:::backend
    end

    %% Supabase Data Layer
    subgraph Database [Supabase & DB Layers]
        SupaDB[(PostgreSQL Database)]:::db
        Auth[Supabase Auth & RLS]:::db
    end

    %% Integrations
    subgraph External [Core Integrations]
        Claude[Anthropic Claude API]:::external
        OemSec[OEM Secrets API]:::external
        Resend[Resend Email Delivery]:::external
        LF[Langfuse LLM Tracing]:::external
    end

    %% UI Connections
    Landing -->|Upload BOM Test| BOM_API
    Overview -->|Load Metrics & Lists| SupaDB
    ChatUI -->|Interactive Conversation / BOM Drop| Chat_API
    MonitorUI -->|Add/Remove Watchlist / Toggle Status| Monitor_API
    AlertsUI -->|Fetch / Acknowledge / Delete Alerts| Alerts_API
    SettingsUI -->|Save Webhook Config / Run Integration Test| SupaDB
    SettingsUI -->|Send Verification Mail| Resend

    %% API Connections
    BOM_API -->|1. Parse BOM text| Claude
    BOM_API -->|2. Search stock| OemSec
    BOM_API -->|3. Record Sourced items| SupaDB
    BOM_API -->|4. Log traces| LF
    
    Chat_API -->|Agent Loops & Decisions| Claude
    Chat_API -->|Database & Sourcing Tools| SupaDB
    Chat_API -->|Live Sourcing Queries| OemSec
    Chat_API -->|Trace executions| LF

    Monitor_API -->|Batch Live stock check| OemSec
    Monitor_API -->|Run Risk Assessments| Claude
    Monitor_API -->|Write warnings & audit trails| SupaDB
    Monitor_API -->|Send Slack/Email Notifications| Resend

    Cron_API -->|Periodic Trigger check| Monitor_API
    Cron_API -->|Renew Mail PubSub| SupaDB
```

---

## 📖 User Flows & Usage Guide

OmniProcure features a logical user onboarding and operation loop. Follow this guide to fully utilize the platform:

### 1. Sourcing Sandbox (Public Landing Page)
*   **Action**: Go to `/` (Landing Page) and scroll down to the **BOM Sourcing Sandbox**.
*   **Use Case**: Paste raw BOM list lines (e.g., `10x STM32F103C8T6 LQFP-48, 5x ESP32-WROOM-32`) or drop a `.csv`/`.txt` file into the input area.
*   **Result**: The screen opens a real-time Server-Sent Events (SSE) stream. You will see:
    1.  *Claude Parsing*: Extracts structured manufacturer part numbers (MPNs), quantities, and package types.
    2.  *Real-time Sourcing*: Queries the distributor network for active pricing, stock, lead times, and region origins.
    3.  *Interactive Table*: Displays incremental line item results, highlighting the best pricing, stock status, and primary supplier.

### 2. User Sign-In & Dashboard Onboarding
*   **Action**: Log in using `/auth/login` (email/password or magic link) via Supabase Auth.
*   **Use Case**: All dashboard transactions (chat sessions, custom watchlists, settings, triggers, alerts inbox) are dynamically partitioned to your authenticated `user_id` using PostgreSQL **Row Level Security (RLS)**.
*   **Result**: You are redirected to `/dashboard`, presenting a **Bento Grid** overview of your procurement status:
    - *Stats Grid*: Total components monitored, active unread alerts, and distributor API call logs of the day.
    - *Active Feeds*: Split panels highlighting your watched components alongside active supply warnings.

### 3. Agentic Command Center (`/dashboard/chat`)
*   **Action**: Click **Chat** in the navigation bar. 
*   **Use Case**: Interact with the AI Procurement Agent or upload complete BOMs.
*   **Capabilities**:
    - **Natural Sourcing queries**: Ask *"Is there stock for ESP32-WROOM-32?"* or *"Compare pricing for STM32F405RGT6"*. The agent executes the `query_stock` tool under the hood, hits the distributor API, and gives you a sorted comparison table.
    - **Risk Logs**: Ask the agent to *"Show me current alerts"* or *"Check my watchlist parts"*.
    - **Watchlist Modifiers**: Ask the agent to *"Add STM32F103C8T6 to my watchlist"*. It runs the `add_to_watchlist` tool, caching the part inside Supabase and registering it for daily checks.
    - **BOM Ingestion**: Drag a CSV list and drop it into the chat window. The agent parses, sources, registers the parts for telemetry checks, and returns a detailed Excel-like markdown summary of your estimated cost.

### 4. Live Telemetry Feed (`/dashboard/monitor`)
*   **Action**: Click **Monitor** in the navigation bar.
*   **Use Case**: Keep track of the active inventory health of your parts.
*   **Operations**:
    - **Telemetry Status**: Shows parts categorised into *Monitoring* or *Paused*.
    - **Toggles**: Toggle the switch under the *Status* column to deactivate or reactivate daily market checks.
    - **Delete**: Click the trash icon to permanently remove parts from surveillance.
    - **Manual Sourcing Run**: Click **Sourcing Check** at the top right to force-run a market scan on all active parts.

### 5. Alerts Inbox (`/dashboard/alerts`)
*   **Action**: Click **Alerts** in the navigation bar.
*   **Use Case**: Act as the "Human-In-The-Loop" (HITL) gatekeeper to resolve risks.
*   **Alert Types**:
    - *High Priority*: Absolute stockout (0 stock globally) or critical single-source risk (only 1 supplier has stock).
    - *Medium Priority*: Lead times exceeding 8 weeks or low stock pools (less than 500 units globally).
    - *Low Priority*: Watchlist parts experiencing minor pricing adjustments.
*   **Resolutions**: Mark alerts as read/unread or delete them when the sourcing issue has been resolved.

### 6. Settings & Integration Config (`/dashboard/settings`)
*   **Action**: Click **Settings** in the navigation bar.
*   **Use Case**: Connect your supply chain to external messaging channels.
*   **Webhooks**:
    - **Slack**: Toggle Slack webhook, paste your webhook URL, and click **Test** to dispatch a verified check alert directly to your team's Slack channel.
    - **Email Alerts**: Toggle Email notifications, enter your target address, and click **Test** to send a warning notification via Resend.
    - **Danger Zone**: Erase your database configuration logs (clear all alerts, wipe all monitored parts) to start clean.

---

## 🌟 Key Features

1.  **AI Tool Execution Loop**: The chat interface uses Claude Sonnet equipped with functional database tools. The agent determines what tools to invoke, runs the execution block, feeds the results back to its context, and answers in natural markdown.
2.  **Server-Sent Events (SSE) Streaming**: BOM uploads stream results incrementally to prevent browser timeouts during massive batch searches.
3.  **Langfuse Observability**: Deep tracking of agent execution chains, tracing input/output tokens, latency metrics, and API errors on the observability dashboard.
4.  **Automatic Suffix Parsing**: The system splits base MPNs and packaging codes (e.g. `STM32F103C8T6` vs suffix variations) to match equivalents.
5.  **Multi-Currency Engine**: Normalizes foreign distributor currency listings (EUR, JPY, GBP, CAD, AUD, CNY) into USD using daily fixed rate parameters.

---

## 🛠️ Tech Stack & Integrations

*   **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
*   **Styling**: Custom CSS Neumorphic variables and utility classes ([glacier.css](file:///c:/Users/kunal/OneDrive/pineapple/OmniProcure/omniprocure/app/dashboard/glacier.css))
*   **Database**: Supabase PostgreSQL with Row Level Security (RLS) policies
*   **Large Language Models (LLMs)**:
    - Anthropic Claude Sonnet (`claude-sonnet-4-20250514`) (Chat agent, tool usage, decisions)
    - Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) (BOM text parsing, structured calculations)
*   **Sourcing Network**: OEM Secrets API (Aggregates real-time feeds from 140+ global suppliers like Mouser, DigiKey, Arrow, Farnell, LCSC)
*   **Observability**: Langfuse SDK (Serverless generation tracking)
*   **Notifications**: Resend API (Transactional alerts) & Slack Incoming Webhooks

---

## 📊 Database Schema & Data Models

Execute the SQL definitions in the [migration.sql](file:///c:/Users/kunal/OneDrive/pineapple/OmniProcure/omniprocure/supabase/migration.sql) file inside your Supabase dashboard:

```
                      +-------------------+
                      |   users (Profile) |
                      +---------+---------+
                                |
                                | (One-to-Many)
         +----------------------+----------------------+
         |                      |                      |
+--------v-------+      +-------v-------+      +-------v-------+
|   watchlist    |      |    alerts     |      |  bom_uploads  |
+----------------+      +---------------+      +---------------+
| id (PK)        |      | id (PK)       |      | id (PK)       |
| mpn (Normalized|      | mpn           |      | filename      |
| label          |      | urgency       |      | line_items    |
| threshold_stock|      | summary       |      | item_count    |
| user_id (FK)   |      | user_id (FK)  |      | user_id (FK)  |
+----------------+      +---------------+      +---------------+
```

### 1. `watchlist`
Stores component MPNs tracked by specific users for automated inventory checks.
*   `id` (BIGSERIAL, Primary Key)
*   `mpn` (TEXT, Unique)
*   `label` (TEXT)
*   `alert_threshold_stock` (INTEGER, Default: 100)
*   `last_checked_at` (TIMESTAMPTZ)
*   `last_alert_at` (TIMESTAMPTZ)
*   `user_id` (UUID, Foreign Key)

### 2. `alerts`
Stores logged supply warnings triggered by automated runs or AI agents.
*   `id` (BIGSERIAL, Primary Key)
*   `mpn` (TEXT)
*   `urgency` (TEXT) — `low` | `medium` | `high`
*   `summary` (TEXT)
*   `recommendation` (TEXT) — `buy_now` | `watch` | `hold`
*   `is_read` (BOOLEAN, Default: false)
*   `flagged_by` (TEXT) — `monitor` | `chat`
*   `user_id` (UUID, Foreign Key)

### 3. `audit_trail`
An immutable ledger tracking pricing and routing choices for SOC 2 security compliance.
*   `id` (BIGSERIAL, Primary Key)
*   `action` (TEXT)
*   `supplier` (TEXT)
*   `mpn` (TEXT)
*   `unit_price` (NUMERIC)
*   `total_value` (NUMERIC)
*   `decision` (TEXT)
*   `details` (JSONB)
*   `created_at` (TIMESTAMPTZ)

---

## 🧠 AI Sourcing & Decision Logic

### 1. Supplier Scoring Metric
Supplier lists retrieved from OEM Secrets are sorted using a custom metric block:
*   **Score 3**: Active pricing + In Stock.
*   **Score 2**: Active pricing + Out of Stock.
*   **Score 1**: Price on request + In Stock.
*   **Score 0**: No pricing + Out of Stock.
*   *Sort Priority*: High Score -> Low Price -> High Available Stock.

### 2. Suffix Replacements
To scan package variants, base part numbers are matched against a suffix table:
*   `T6` / `C8T6` -> LQFP-48
*   `RBT6` -> LQFP-64
*   `AU` -> TQFP-32 (SMD)
*   `PU` / `N` -> DIP (Through-hole)

---

## ⚙️ Environment Configuration

Create a `.env` file in the root `omniprocure` directory matching this configuration:

```env
# ── SUPABASE CREDENTIALS (Server Secret and Public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── API ACCESS KEYS
OEM_SECRETS_API_KEY=your_oem_secrets_api_key
ANTHROPIC_API_KEY=sk-ant-api03-...

# ── LANGFUSE OBSERVAIBILITY (Traces & Metrics)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
NEXT_PUBLIC_LANGFUSE_DASHBOARD_URL=https://cloud.langfuse.com/project/...

# ── NOTIFICATIONS & MAILS
NOTIFY_WEBHOOK_URL=https://hooks.slack.com/services/...
RESEND_API_KEY=re_...

# ── CRON SCHEDULER
CRON_SECRET=omni-cron-secure-string-xyz123
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🛠️ Local Development Setup

### 1. Install project dependencies
Ensure you have Node.js v20+ installed, navigate to the `omniprocure` folder, and install packages:
```bash
npm install
```

### 2. Launch the local development server
Start the dev server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) inside your web browser.

### 3. Build Verification
To ensure all TypeScript definitions and App Router imports compile clean:
```bash
npm run build
```
The static compiler should complete page building with zero errors.

---
*Developed and maintained by the OmniProcure Sourcing & Software Engineering teams.*
