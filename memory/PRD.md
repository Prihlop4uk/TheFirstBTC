# Мой первый Биткоин Kids — Landing Page + Lead Capture

## Original Problem
GitHub repo `TheFirstBTC` — static HTML landing for a kids' Bitcoin/financial-literacy course (RU). User asked to (1) build a high-converting landing page redesign, then (2) capture lead-form submissions into Telegram.

## Target Audience
Parents enrolling a child (9–16) into a 10-week financial-literacy + Bitcoin/Lightning course. Tone: trustworthy, safe, fun. NOT investment advice.

## Tech Stack
- Frontend: static HTML/CSS/JS served by zero-dep Node server `/app/frontend/server.mjs` on port 3000. Server ALSO proxies `/api/*` → backend `http://localhost:8001`.
- Styling: Tailwind CDN + custom `style.css`; fonts Unbounded (headings) + Manrope (body).
- Backend: FastAPI (`/app/backend/server.py`) + MongoDB (motor). Endpoints under `/api`.

## Backend Endpoints
- `POST /api/leads` {name, contact, age} → saves lead to Mongo `leads` collection + sends Telegram notification (if configured). Returns lead with `_id`.
- `GET /api/leads` → list leads (newest first).
- `GET /api/health` → {status, telegram_configured}.
- Validation: empty name/contact → 400.

## Env (/app/backend/.env)
- MONGO_URL, DB_NAME=bitcoin_kids
- TELEGRAM_TOKEN (EMPTY — pending user), TELEGRAM_CHAT_ID (EMPTY — pending user)

## Implemented (2026-06)
- Full redesigned landing: sticky header, asymmetric hero + floating Satoshi mascot, marquee, bento benefits, Satoshi dark card, 10-week program accordion, format cards, FAQ accordion, signup section, footer legal links.
- Lead form → POST /api/leads → persists to MongoDB, success/error toast.
- Tested: backend pytest 6/6, real-browser UI submission persists lead + toast (iteration_2.json, 100%).

## PENDING / Next
- P1: (optional) move rate-limit fully to Redis-only if scaling to multiple backend workers (already Redis-backed with in-memory fallback).
- P2: Build Tailwind via CLI/PostCSS (CDN warning); add testimonials/pricing/enrollment dates.
- P2: Simple admin page to view leads (currently GET /api/leads returns JSON).

## Anti-spam (2026-06)
- Honeypot hidden field `website` on lead form → bot submissions silently dropped (not saved/notified).
- Rate limit: 5 submissions / 10 min per IP (X-Forwarded-For), Redis-backed (survives backend restart) with in-memory fallback. Redis runs under supervisor (`/etc/supervisor/conf.d/redis.conf`, 127.0.0.1:6379). `/api/health` reports `redis_connected`.
- Verified: honeypot excluded, 6th rapid request → 429, 429 persists across backend restart.

## Legal / Footer documents (2026-06)
- All 6 pages redesigned to match the landing (Tailwind + Unbounded/Manrope, header + "На главную" + shared footer with active-link highlight): disclaimer.html, privacy.html, offer.html, refunds.html, cookies.html, consent.html.
- Filled with real operator data: ИП Титов Егор Михайлович, ИНН 330104074886, ОГРНИП 324330000004563, адрес 601655 г. Александров, ул. Базунова 17-46, email cryptoschooltoyou@gmail.com, тел +7 999 710-75-62.
- Domain-agnostic wording ("Сайт, на котором размещён документ"). Pricing/refund specifics kept as neutral, law-based clauses (user chose to skip exact prices).
- Deferred: exact course price & payment method in offer/refunds when user decides.

## Deployment / Domain
- User wants custom domain. Emergent: Deploy (50 credits/month, paid sub) then attach custom domain via Entri (DNS). Handled via support_agent.
- User chose to self-host on Timeweb (PHP 8.2). Added a PHP lead handler so the form works without Python/Mongo/Redis:
  - `/app/frontend/public/send.php` — receives form POST, honeypot, file-based rate-limit (5/600s), sends to Telegram via cURL; reads creds from `config.php`.
  - `/app/frontend/public/config.sample.php` — template; user creates `config.php` on server with real TELEGRAM_TOKEN/CHAT_ID.
  - `/app/frontend/public/.gitignore` — excludes config.php (secret) from Git.
  - `main.js` now posts to relative `send.php`. Emergent Node `server.mjs` proxies `POST /send.php` → backend `/api/leads`, so the SAME frontend works on both Emergent and Timeweb.
- Timeweb deploy: Save to GitHub → SSH clone → copy `frontend/public/*` into site docroot → create `config.php` from sample.
