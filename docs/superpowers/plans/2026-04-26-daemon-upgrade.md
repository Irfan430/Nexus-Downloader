# Media Downloader Daemon Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the downloader API safer for web/chatbot integrations by adding job dedupe, temporary job cleanup, clearer provider failures, and a lightweight dashboard.

**Architecture:** Keep the existing Express daemon and in-memory/Bull queue surface, but add deterministic job fingerprints and structured job listing APIs. Serve a static dashboard from the same process; it only provides UI shell while API calls still require the configured API key.

**Tech Stack:** Node.js, Express, Bull/ioredis fallback, yt-dlp/gallery-dl/ffmpeg, vanilla HTML/CSS/JS dashboard.

---

### Task 1: Job Fingerprints And Dedupe

**Files:**
- Modify: `src/services/queue.js`
- Modify: `src/utils/urlDetector.js`
- Test: `tests/daemon-upgrade.test.js`

- [x] Add URL canonicalization and option fingerprint tests.
- [x] Implement one active/ready job per canonical URL/options.
- [x] Return reused jobs instead of starting duplicate downloads.

### Task 2: Temporary Job Lifecycle

**Files:**
- Modify: `src/services/queue.js`
- Modify: `src/services/cleanup.js`
- Test: `tests/daemon-upgrade.test.js`

- [x] Add queue cleanup that removes expired job metadata when files expire.
- [x] Keep completed files temporary and report expiry in job metadata.

### Task 3: Stable API For Web And Chatbots

**Files:**
- Create: `src/routes/jobs.js`
- Modify: `src/routes/index.js`
- Modify: `src/middleware/errorHandler.js`
- Test: `tests/daemon-upgrade.test.js`

- [x] Add `GET /jobs` and `GET /jobs/:jobId`.
- [x] Return structured error codes for extractor/provider failures.

### Task 4: Telegram And Provider Hardening

**Files:**
- Modify: `src/services/telegramBot.js`
- Modify: `src/router.js`
- Modify: `src/engines/ytdlp.js`
- Test: `tests/telegram-bot.test.js`

- [x] Make resolver failure fall back to queued download.
- [x] Add human-safe failure messages and avoid raw engine dumps.
- [x] Add bounded Telegram startup retry behavior.

### Task 5: Dashboard UI

**Files:**
- Create: `src/routes/dashboard.js`
- Create: `src/public/dashboard.html`
- Create: `src/public/dashboard.css`
- Create: `src/public/dashboard.js`
- Modify: `src/routes/index.js`
- Modify: `src/middleware/auth.js`

- [x] Serve dashboard shell at `/dashboard`.
- [x] Let user enter API key locally and call daemon APIs.
- [x] Show health, queue, jobs, download form, and result links.

### Task 6: Verification

**Commands:**
- `node tests/daemon-upgrade.test.js`
- `node tests/telegram-bot.test.js`
- `npm run lint`
- `npm test`
- `timeout 6s npm start`
