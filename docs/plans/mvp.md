# Instai MVP Plan — Instagram Profile Viewer

## Context

Building a personal-use MVP web app where a user logs in with their Instagram username/password, and the app fetches and displays their profile info, recent posts in an IG-style grid, and per-post engagement insights. This is a learning project using unofficial Instagram APIs.

---

## Architecture

**Monorepo: Next.js frontend + FastAPI (Python) backend**

- `instagrapi` (Python) is the only reliable unofficial Instagram library — no good Node.js alternative
- Vercel natively supports Python serverless functions alongside Next.js
- In dev: Next.js on :3000, FastAPI on :8000 with proxy rewrites
- In prod: both deploy as one Vercel project

```
Browser → Next.js (Vercel) → FastAPI Python functions (Vercel) → Instagram (via instagrapi)
```

---

## Project Structure

```
instai/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # Login page
│   ├── dashboard/
│   │   └── page.tsx              # Dashboard (profile + grid + insights)
│   └── globals.css
├── components/
│   ├── LoginForm.tsx
│   ├── ProfileHeader.tsx
│   ├── PostGrid.tsx
│   ├── PostCard.tsx
│   ├── PostModal.tsx
│   └── InsightsSummary.tsx
├── lib/
│   ├── api.ts                    # Typed fetch wrappers
│   └── types.ts                  # Profile, Post interfaces
├── api/                          # Vercel Python serverless functions
│   ├── login.py
│   ├── profile.py
│   ├── posts.py
│   ├── challenge.py
│   └── utils/
│       ├── instagram.py          # instagrapi wrapper
│       └── crypto.py             # Fernet encryption for sessions
├── next.config.ts
├── package.json
├── requirements.txt              # instagrapi, fastapi, cryptography
├── vercel.json
└── .env.local                    # SESSION_SECRET (never committed)
```

---

## Authentication Flow

1. User enters IG username + password in `LoginForm`
2. Frontend POSTs to `/api/py/login` over HTTPS
3. Backend calls `Client().login(username, password)`
4. On success: serialize session via `cl.get_settings()`, encrypt with Fernet, return as httpOnly secure cookie (`ig_session`)
5. **Credentials are used once then discarded** — only the encrypted session persists
6. Subsequent requests: decrypt cookie → `cl.set_settings()` to restore session without re-auth

**Cookie flags:** `httpOnly=True`, `secure=True`, `sameSite="strict"`, `max_age=3600`

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/py/login` | Login with username/password (+ optional 2FA code) → sets session cookie |
| GET | `/api/py/profile` | Fetch profile info (pic, bio, followers, following, post count) |
| GET | `/api/py/posts?count=12` | Fetch recent posts with engagement data |
| POST | `/api/py/challenge` | Submit challenge verification code |
| POST | `/api/py/logout` | Clear session cookie |

---

## Data Fetching (instagrapi methods)

- **Profile:** `cl.user_info_by_username(username)` → pk, username, full_name, biography, profile_pic_url, follower_count, following_count, media_count
- **Posts:** `cl.user_medias(user_pk, amount=12)` → pk, code, taken_at, media_type, thumbnail_url, like_count, comment_count, caption_text
- **Insights:** `cl.insights_media(media_pk)` → impressions, reach, likes, comments, saves, shares (Business/Creator accounts only)

---

## Frontend Pages & Components

**2 pages:**
- `/` → Login form, redirects to `/dashboard` on success
- `/dashboard` → Profile header + post grid + insights summary

**Components:**
- `LoginForm` — username/password fields, conditional 2FA input, loading/error states
- `ProfileHeader` — circular profile pic, name, bio, follower/following/post counts
- `PostGrid` — 3-column CSS grid (`grid-cols-3 gap-1`), Instagram-style
- `PostCard` — square thumbnail, hover overlay with like/comment counts
- `PostModal` — full-size image, caption, timestamp, detailed engagement stats
- `InsightsSummary` — aggregate cards: total likes, total comments, avg engagement rate, best post

**Styling:** Tailwind CSS

---

## 2FA / Challenge Handling

**Two-Factor Auth:**
1. Backend catches `TwoFactorRequired` → returns `{ status: "2fa_required" }` (HTTP 202)
2. Frontend shows 6-digit code input
3. User enters code → re-POSTs to `/api/py/login` with `verification_code`

**Challenge Required (suspicious login):**
1. Instagram sends code to user's email/phone
2. Backend returns `{ status: "challenge_required" }` + saves partial session in encrypted cookie
3. User enters code → POSTs to `/api/py/challenge`
4. Backend restores partial session, resolves challenge, completes login

---

## Implementation Order

| Phase | What | Time Est |
|-------|------|----------|
| 1 | Project scaffolding (Next.js, FastAPI, configs, env) | 30 min |
| 2 | Python backend — login endpoint + session encryption | 1-2 hrs |
| 3 | Python backend — profile + posts endpoints | 1 hr |
| 4 | Frontend — login page + API helpers + types | 1 hr |
| 5 | Frontend — dashboard (profile header, post grid, modal, insights) | 2 hrs |
| 6 | 2FA / challenge handling | 1 hr |
| 7 | Polish, error handling, deploy to Vercel | 1 hr |

---

## Security Considerations

- Credentials used once then discarded — never stored
- Session encrypted with Fernet (key in env var `SESSION_SECRET`)
- httpOnly + secure + sameSite cookies only
- No plain-text logging of credentials or sessions
- `.env.local` in `.gitignore`
- HTTPS enforced (Vercel default)
- Rate limit errors from Instagram caught and surfaced to user

---

## Verification / Testing

1. **Local dev:** Run `npm run dev` + `uvicorn api.index:app` → test login flow in browser
2. **Login:** Enter credentials → verify session cookie is set, profile data returned
3. **Dashboard:** Verify profile pic, stats, and post grid render correctly
4. **Post modal:** Click a post → verify expanded view with engagement data
5. **2FA:** Test with a 2FA-enabled account → verify code input appears and works
6. **Logout:** Verify cookie is cleared and user is redirected to login
7. **Deploy:** Push to Vercel, set `SESSION_SECRET` env var, test full flow on production URL

---

## Key Files

- `api/utils/instagram.py` — core instagrapi wrapper (most critical file)
- `api/login.py` — login orchestration
- `app/dashboard/page.tsx` — main user-facing page
- `components/LoginForm.tsx` — login UX with 2FA support
- `next.config.ts` — proxy rewrites for dev
- `vercel.json` — production routing
