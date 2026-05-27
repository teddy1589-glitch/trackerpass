# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TrackerPass is a Next.js application that tracks the status of truck cargo passes (пропуска) for Moscow freight transport. It integrates with AmoCRM as a CRM system and provides customers with a real-time tracking page to monitor their pass application status.

**Key Domain**: Freight pass tracking application for Moscow (РТЕ-Консалтинг)

## Tech Stack

- **Framework**: Next.js 16.1.2 (App Router)
- **Frontend**: React 19.2.3, TypeScript 5, Tailwind CSS 4
- **Backend**: Next.js API routes
- **Database**: PostgreSQL (managed via `pg` client)
- **Styling**: Tailwind CSS with PostCSS
- **External APIs**: AmoCRM OAuth, Pass Check API (api-cloud.ru), Image proxy service
- **Utilities**: `isdayoff` for Russian workday calculations, OpenAI SDK for image generation

## Build & Development Commands

```bash
# Development
npm run dev          # Start development server on http://localhost:3000

# Production
npm run build        # Build optimized production bundle
npm start           # Start production server

# Code Quality
npm run lint        # Run ESLint (Next.js + TypeScript rules)
```

## Architecture

### High-Level Flow

1. **Webhook Listener** (`/api/webhook/amo`) - Receives AmoCRM lead updates
2. **Data Processing** - Enriches lead data with pass information and generates car images
3. **Database Storage** - Persists order data in PostgreSQL
4. **Tracking Page** - Customer-facing page to view order status

### Key Components & Responsibilities

#### Database Layer (`lib/db.ts`)
- **Pool Management**: Singleton PostgreSQL pool (reused in dev)
- **Core Operations**:
  - `getOrderBySlug(slug)` - Fetch public tracking data by hash
  - `getOrderByLeadId(leadId)` - Fetch by AmoCRM lead ID
  - `upsertOrder(data)` - Create or update order, auto-generates hash slug for specific statuses
  - `getAmoTokens()` / `upsertAmoTokens()` - Manage OAuth token persistence

**Status Mapping**: AmoCRM status IDs are mapped to internal 1-4 step progression:
- Step 1: Document check (default)
- Step 2: Prep for submission (41138689)
- Step 3: Documents submitted (41138692)
- Step 4: Pass released (41138695) or Rejected (41138698)

#### AmoCRM Integration (`lib/amocrm.ts`)
- **AmoCRMClient Class**: Handles OAuth token lifecycle
  - Lazy loads tokens from DB, falls back to authorization code from env
  - Auto-refreshes expired tokens with retry logic
- **API Methods**: Account info, Lead/Contact/User fetching, adding notes to leads
- **Token Storage**: Persists access + refresh tokens in `rte.amocrm_tokens` table

#### Webhook Handler (`/api/webhook/amo`)
**Workflow** (all updates go through `processLead`):
1. Parse webhook payload (handles JSON, form-encoded, and fallback regex parsing)
2. For each lead ID:
   - Fetch lead details from AmoCRM
   - Map custom fields to car/permit info
   - Upsert order record
   - **Pass Checking** (async, non-blocking):
     - When lead transitions to "Pass Released" (41138695) status
     - Call Pass Check API (`PASS_CHECK_API_URL`) with registration number
     - Save pass details (number, zone, validity, type)
   - **Image Generation** (async):
     - When brand/model exists but no image
     - Call image proxy service (`IMAGE_PROXY_BASE_URL`)
     - Download and save generated image to `public/uploads/`
   - **Deadline Calculation**:
     - For "Documents Submitted" status: calculate expected permit ready date
     - Uses `calcPermitReadyAt()` for workday-aware deadline (1 day for temporary, 10 days for yearly)
   - **Manager Notes**: Add tracking link to lead if slug was generated

#### Tracking Page (`/app/track/[slug]/page.tsx`)
- **Dynamic**: `force-dynamic` (no caching), `revalidate: 0`
- **Data**: Fetches order by slug (hash-based, not lead ID)
- **Display**: 
  - Status stepper with permit readiness countdown
  - Car details with generated image
  - Pass validity with remaining days calculation
  - Manager contact info with WhatsApp/Telegram/email links
- **Date Handling**: Complex date parsing for Russian formats (DD.MM.YY with optional time) and permit validity calculations

#### Deadline Calculations (`lib/deadline.ts`)
- **Workday Logic**: Uses `isdayoff` API for Russian holidays/weekends
- **Permit Ready Dates**:
  - Temporary passes: 1 day after submission (if before 16:00 on workday, same day at 16:00)
  - Yearly passes: 10 workdays after submission
- **Time Zone**: All calculations in Moscow time (MSK, UTC+3)

#### Image Generation (`lib/openai.ts`)
- Polls external image proxy service (`IMAGE_PROXY_BASE_URL`)
- Downloads generated car images and saves to `IMAGE_UPLOAD_DIR`
- Constructs public URLs from `PUBLIC_BASE_URL`
- Configurable poll interval (default 3s) and timeout (default 60s)

### Database Schema (`db/step2_schema.sql`)

**Tables**:
- `public.orders`: Lead tracking data with JSONB fields for flexible data storage
  - Key fields: `amo_lead_id` (unique), `hash_slug` (unique, nullable)
  - JSON fields: `car_info`, `permit_info`, `manager_contact`
  - Auto-updated timestamps via trigger
- `rte.amocrm_tokens`: Single-row token store (uses boolean PK to enforce one row)
  - Fields: `access_token`, `refresh_token`, `expires_in`, `updated_at`

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `AMOCRM_CLIENT_ID`, `AMOCRM_CLIENT_SECRET`, `AMOCRM_REDIRECT_URI`, `AMOCRM_SUBDOMAIN` - OAuth credentials
- `AMOCRM_AUTHORIZATION_CODE` - Initial auth code (used once to exchange for tokens)
- `PASS_CHECK_API_TOKEN` - Token for Pass Check API
- `IMAGE_PROXY_BASE_URL` - Base URL of image generation service

### Optional
- `AMOCRM_ACCESS_TOKEN`, `AMOCRM_REFRESH_TOKEN` - Pre-loaded tokens (skips DB fetch)
- `PASS_CHECK_API_URL` - Defaults to `https://api-cloud.ru/api/transportMos.php`
- `PUBLIC_BASE_URL` - Defaults to `https://order.rte-consult.ru`
- `TRACK_BASE_URL` - Defaults to `https://order.rte-consult.ru/track`
- `IMAGE_UPLOAD_DIR` - Defaults to `public/uploads`
- `IMAGE_PROXY_POLL_INTERVAL_MS` - Defaults to 3000
- `IMAGE_PROXY_POLL_TIMEOUT_MS` - Defaults to 60000

## Manager Profiles

Manager contact information is configured in `lib/managerProfiles.ts`. The profiles map AmoCRM user IDs to contact details (phone, email, WhatsApp, Telegram, avatar URL, site). This data is merged with the order record in the webhook and displayed on the tracking page.

## Important Patterns & Constraints

1. **Hash Slugs**: Generated only for specific status IDs (41138302, 41138689) to control which leads get public tracking links
2. **JSON Fields**: `car_info`, `permit_info`, `manager_contact` are stored as JSONB but accessed as objects; conversion needed when reading from DB
3. **Async Webhooks**: Pass checking and image generation run in fire-and-forget promises to avoid blocking webhook response
4. **Workday Awareness**: All deadline calculations respect Russian holidays via `isdayoff` API
5. **Custom Field Mapping**: AmoCRM field IDs are hard-coded in webhook handler (1043841, 744115, 924745, etc.) — document these mappings in comments if you modify
6. **Image Storage**: Generated images saved to `public/uploads/`, URLs included in order record for caching/reuse
7. **API Robustness**: Webhook handler catches parsing errors for multiple payload formats and has graceful fallbacks

## Type Safety

TypeScript strict mode is enabled. Key interfaces:
- `UpsertOrderData` - Input for order updates
- `AmoTokens` - Token data shape
- `AmoCRMClient` - Public API for CRM operations
- `PermitType` - Union of "temporary" | "yearly"

