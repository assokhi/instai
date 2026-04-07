# Discussion #001: Instagram Web Scraping Architecture (Replacing Login-Based Approach)

**Date:** 2026-04-07  
**Status:** Research & Planning  
**Objective:** Replace the current Instagrapi login-based approach with a web scraping approach that fetches public Instagram profile data by username, stores it in the database, and serves it to the frontend.

---

## Background

The current Instai architecture uses `instagrapi` to log into Instagram with the user's credentials. This approach is **risky** because:
- Instagram aggressively flags third-party logins (suspicious login blocks)
- Account bans are common when using unofficial login APIs
- Users must trust us with their Instagram passwords
- 2FA/Challenge flows add friction and complexity
- Session management and encryption add significant overhead

**Proposed Alternative:** Scrape public Instagram profile data using the username only -- no login required.

---

## Part 1: Research Findings

### 1.1 What Public Data Is Available Without Login?

| Data Type | Available? | Notes |
|-----------|-----------|-------|
| Username, full name, bio | Yes | Via REST API or page scrape |
| Profile picture URL | Yes | |
| Follower/following counts | Yes | |
| Post count | Yes | |
| Verification status | Yes | |
| Business contact info | Yes | Business accounts only |
| Recent posts (~12) | Yes | First page of posts |
| Full post history | Partial | Pagination may require session |
| Post captions & hashtags | Yes | |
| Post image/video URLs | Yes | |
| Post timestamps | Yes | |
| Likes count | Yes | |
| Comments count | Yes | |
| Reels | Yes | Public accounts |
| **Stories** | **No** | Requires authentication |
| **Follower/following lists** | **No** | Requires authentication |
| **Saved posts / DMs** | **No** | Requires authentication |

**Verdict:** For an analytics dashboard showing profile overview + recent posts + engagement metrics, public scraping provides everything we need.

### 1.2 Current State of Instagram Scraping (2025-2026)

- **Simple HTTP scraping is dead.** BeautifulSoup/basic requests no longer work. Instagram enforces login walls and obfuscates endpoints.
- **The `?__a=1` JSON endpoint is dead.** Returns 302 redirects to login page since late 2023.
- **Instagram Basic Display API is deprecated** (as of December 4, 2024). No longer functional.
- **Instagram Graph API** still works but only for Business/Creator accounts and requires Facebook app review. Rate limit: 200 calls/hour.
- **Two working approaches remain:**
  1. REST API endpoints with proper headers + residential proxies
  2. GraphQL API with `doc_id` parameters (changes every 2-4 weeks)

### 1.3 Working API Endpoints

**REST API (more stable):**
```
GET https://i.instagram.com/api/v1/users/web_profile_info/?username={username}
Header: x-ig-app-id: 936619743392459
Header: User-Agent: <realistic browser UA>
```
Returns: Complete profile data including recent posts.

**GraphQL API (richer data, less stable):**
```
POST https://www.instagram.com/graphql/query
Body: doc_id=9310670392322965&variables={"username":"target"}
```
Returns: Detailed profile + posts with engagement metrics. But `doc_id` values change every 2-4 weeks.

### 1.4 Instagram's Anti-Scraping Defenses

| Layer | Defense | Impact |
|-------|---------|--------|
| 1 | IP Quality Detection | Datacenter IPs blocked instantly |
| 2 | TLS Fingerprinting | Python `requests` detected at TLS layer |
| 3 | Browser Fingerprinting | 50+ markers analyzed |
| 4 | Behavioral Analysis | AI detects unnatural patterns |

**Rate Limits:** ~200 requests/hour per residential IP. HTTP 429 triggers temporary blocks.

**Our existing advantage:** The codebase already uses `curl_cffi` for TLS impersonation -- this solves Layer 2 for us.

### 1.5 Legal Analysis

| Activity | Legal Status |
|----------|-------------|
| Scraping public data while logged out | **Generally legal** (hiQ v. LinkedIn, Meta v. Bright Data 2024) |
| Scraping data visible only when logged in | Risky / likely illegal |
| Creating fake accounts to scrape | Illegal |
| Bypassing authentication | Illegal |
| Scraping private accounts | Illegal |

**Key ruling:** In *Meta v. Bright Data (Jan 2024)*, a federal judge ruled that scraping public Instagram data while logged out does NOT violate Meta's Terms of Service. Meta dropped the lawsuit entirely in Feb 2024.

**Our approach (scraping public profiles without login) is on the strongest legal footing.**

### 1.6 Scraping Tools & Services Comparison

| Tool/Service | Type | Cost | Reliability | Best For |
|-------------|------|------|-------------|----------|
| **Apify** | Managed SaaS | $5/mo free, $49/mo starter | High | Full-featured, no maintenance |
| **RapidAPI endpoints** | Third-party API | Free tier + $10-50/mo | Varies | Quick prototyping |
| **Instaloader** | Python library | Free (OSS) | Medium | Self-hosted, public profiles |
| **Self-hosted (curl_cffi)** | Custom code | Proxy costs only | Medium | Full control |
| **Bright Data** | Enterprise proxy | $500+/mo | Very high | Enterprise scale |
| **ScraperAPI** | Proxy + API | $44/mo+ | High | Simple proxy rotation |

---

## Part 2: Proposed Architecture

### 2.1 High-Level Flow

```
User enters Instagram username
        |
        v
Next.js Frontend
        |
        v
FastAPI Backend (/api/py/scrape/{username})
        |
        v
Check Database Cache (is data fresh?)
        |
    [Fresh] --> Return cached data
    [Stale/Missing] --> Scrape Instagram
        |
        v
Instagram Public API (REST endpoint)
  (via curl_cffi + residential proxy)
        |
        v
Parse & Store in SQLite/PostgreSQL
        |
        v
Return structured data to frontend
```

### 2.2 Detailed Architecture

#### Layer 1: Frontend (Next.js)
```
/ (Home)          --> Search bar: "Enter Instagram username"
/profile/{username} --> Profile page showing:
                       - Profile header (avatar, bio, stats)
                       - Post grid (thumbnails)
                       - Engagement summary (avg likes, comments)
                       - Post modal (click to expand)
```

**Key change:** No login form. User simply enters any public Instagram username to view analytics.

#### Layer 2: API (FastAPI)

**New endpoints:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/py/scrape/{username}` | Fetch/refresh profile + posts |
| GET | `/api/py/profile/{username}` | Get cached profile data |
| GET | `/api/py/posts/{username}` | Get cached posts |
| GET | `/api/py/search` | Search previously scraped profiles |

**Removed endpoints:**
- `POST /api/py/login` (no longer needed)
- `POST /api/py/challenge` (no longer needed)
- `POST /api/py/logout` (no longer needed)

#### Layer 3: Scraping Engine

```python
class InstagramScraper:
    """Scrapes public Instagram data without authentication."""
    
    def __init__(self):
        self.session = CurlCffiSession()  # TLS impersonation (already in codebase)
        self.proxy = get_proxy()           # Residential proxy rotation
        self.headers = {
            'x-ig-app-id': '936619743392459',
            'User-Agent': get_realistic_ua(),
        }
    
    async def scrape_profile(self, username: str) -> dict:
        """Fetch profile data from Instagram's REST API."""
        url = f'https://i.instagram.com/api/v1/users/web_profile_info/?username={username}'
        response = self.session.get(url, headers=self.headers, proxy=self.proxy)
        return parse_profile(response.json())
    
    async def scrape_posts(self, username: str, count: int = 12) -> list:
        """Fetch recent posts with engagement metrics."""
        # Use profile data to get user_id, then fetch posts
        ...
```

#### Layer 4: Database

**Updated schema (keeping existing tables, modifying for scraping):**

```sql
-- Remove: users table (no more sessions/login)
-- Remove: login_attempts table (no more login)

-- Keep & enhance: profiles table
CREATE TABLE profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ig_username TEXT UNIQUE NOT NULL,
    ig_pk TEXT,
    full_name TEXT,
    biography TEXT,
    profile_pic_url TEXT,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_business BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    external_url TEXT,
    category TEXT,
    scraped_at TEXT NOT NULL,  -- When was this data last scraped
    updated_at TEXT NOT NULL
);

-- Keep & enhance: posts table
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ig_username TEXT NOT NULL,
    pk TEXT UNIQUE NOT NULL,
    code TEXT,
    taken_at TEXT,
    media_type INTEGER DEFAULT 1,
    thumbnail_url TEXT,
    video_url TEXT,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    caption_text TEXT,
    resources_json TEXT,
    scraped_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (ig_username) REFERENCES profiles(ig_username)
);

-- New: scrape_jobs table (track scraping operations)
CREATE TABLE scrape_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ig_username TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, running, success, failed
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    posts_scraped INTEGER DEFAULT 0
);
```

#### Layer 5: Caching Strategy

| Data Type | Cache TTL | Rationale |
|-----------|----------|-----------|
| Profile bio/avatar | 24 hours | Changes infrequently |
| Follower/following counts | 6 hours | Moderate change rate |
| Recent posts list | 2 hours | New posts appear periodically |
| Post engagement metrics | 1 hour | Changes rapidly for recent posts |

**Logic:**
```python
def get_profile(username: str):
    cached = db.get_profile(username)
    if cached and not is_stale(cached['scraped_at'], ttl=24*3600):
        return cached  # Serve from cache
    
    # Scrape fresh data
    fresh = scraper.scrape_profile(username)
    db.upsert_profile(fresh)
    return fresh
```

### 2.3 Proxy Strategy

**For MVP (low volume):**
- Use ScraperAPI ($44/mo) or a RapidAPI Instagram endpoint (free tier)
- Simplest integration, no proxy management needed

**For Growth:**
- Smartproxy residential proxies ($4/GB, no minimum)
- Rotate IP after every 100-200 requests
- Random delays of 3-10 seconds between requests

**For Scale:**
- Bright Data with Web Unlocker
- Distributed scraping workers

### 2.4 What We Keep From Current Codebase

| Component | Keep? | Reason |
|-----------|-------|--------|
| `curl_cffi` / TLS impersonation | **Yes** | Critical for anti-detection |
| FastAPI backend structure | **Yes** | Clean, works well |
| SQLite database | **Yes (for now)** | Fine for MVP, upgrade to PostgreSQL later |
| Database utility functions | **Modify** | Remove login-related, add scraping functions |
| Frontend components | **Modify** | Remove login form, add search bar |
| `ProfileHeader` component | **Keep** | Works as-is |
| `PostGrid` / `PostCard` / `PostModal` | **Keep** | Work as-is |
| `InsightsSummary` | **Keep** | Works as-is |
| `LoginForm` component | **Remove** | Replace with search/username input |
| `instagrapi` dependency | **Remove** | No longer needed |
| Session encryption (`crypto.py`) | **Remove** | No sessions to encrypt |
| Cookie auth middleware | **Remove** | No auth needed |

---

## Part 3: Implementation Approaches (Ranked)

### Approach A: Third-Party Scraping API (Recommended for MVP)

**Use a RapidAPI Instagram endpoint or Apify as the data source.**

**Pros:**
- Zero proxy management
- No maintenance when Instagram changes endpoints
- Free tiers available for development
- Fastest to implement (1-2 days)

**Cons:**
- Per-request costs at scale
- Dependency on third-party service
- Rate limits on free tiers

**Estimated cost:** Free for development, $10-50/mo for production

### Approach B: Self-Hosted with curl_cffi (Recommended for Production)

**Build our own scraper using the existing `curl_cffi` setup + residential proxies.**

**Pros:**
- Full control over scraping logic
- No per-request costs (only proxy costs)
- Already have TLS impersonation in codebase
- Can customize for exact data needs

**Cons:**
- Must maintain scraper when Instagram changes endpoints (every 2-4 weeks)
- Need residential proxy subscription ($4+/GB)
- More complex error handling

**Estimated cost:** $4-50/mo for residential proxies

### Approach C: Hybrid (Best Long-Term)

**Use a third-party API as primary, with self-hosted as fallback.**

**Pros:**
- Reliability of managed service
- Fallback when service is down
- Can gradually shift to self-hosted as you learn patterns

**Cons:**
- More complex codebase
- Two systems to maintain

---

## Part 4: Modifications Needed

### 4.1 Backend Changes

1. **New file: `api/utils/scraper.py`**
   - `InstagramScraper` class (replaces `InstagramClient`)
   - Uses `curl_cffi` for TLS impersonation (from existing `tls_session.py`)
   - Methods: `scrape_profile()`, `scrape_posts()`
   - Rate limiting and retry logic

2. **Modify: `api/utils/database.py`**
   - Remove: `save_user()`, `get_user()`, `log_login_attempt()`, `check_login_cooldown()`
   - Add: `upsert_profile()`, `upsert_posts()`, `get_cached_profile()`, `is_cache_stale()`
   - Add: `log_scrape_job()`, `get_scrape_history()`

3. **Modify: `api/index.py`**
   - Remove: login, challenge, logout endpoints
   - Add: scrape, profile/{username}, posts/{username} endpoints
   - Remove: cookie-based auth middleware

4. **Remove: `api/utils/crypto.py`** (no more session encryption)

### 4.2 Frontend Changes

1. **Modify: `app/page.tsx`**
   - Replace login form with search bar (enter Instagram username)
   - On submit, navigate to `/profile/{username}`

2. **New: `app/profile/[username]/page.tsx`**
   - Fetch profile + posts data from API
   - Display using existing components (ProfileHeader, PostGrid, InsightsSummary)

3. **Remove: `components/LoginForm.tsx`**
   - Replace with `components/SearchBar.tsx`

4. **Modify: `lib/api.ts`**
   - Remove: login, challenge, logout API calls
   - Add: scrapeProfile(username), getProfile(username), getPosts(username)

5. **Modify: `lib/types.ts`**
   - Add: `ScrapeStatus` type
   - Keep: `Profile`, `Post`, `PostResource` types (same data shape)

### 4.3 Configuration Changes

1. **Remove from `.env.local`:** `SESSION_SECRET`
2. **Add to `.env.local`:** `PROXY_URL` (residential proxy), `SCRAPER_API_KEY` (if using third-party)
3. **Remove from `requirements.txt`:** `instagrapi`, `cryptography`
4. **Keep in `requirements.txt`:** `fastapi`, `uvicorn`, `curl_cffi`, `python-dotenv`

---

## Part 5: Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Instagram blocks our scraping | High | Use residential proxies, rate limiting, multiple fallback endpoints |
| GraphQL doc_ids change | Medium | Monitor and update, or use REST API (more stable) |
| Legal issues | Low | We're scraping public data without login (strongest legal position per Meta v. Bright Data) |
| Proxy costs increase | Low | Start with third-party API, self-host later |
| Private profiles can't be scraped | Medium | Detect and show "Profile is private" message |
| Data staleness | Low | Implement TTL-based cache refresh |
| Rate limiting by Instagram | Medium | Queue requests, implement backoff, use proxy rotation |

---

## Part 6: Comparison -- Old vs New Architecture

| Aspect | Old (Login-Based) | New (Scraping-Based) |
|--------|-------------------|---------------------|
| User input | Username + password | Username only |
| Risk to user's account | High (bans, blocks) | None |
| Data access | Full (private + public) | Public only |
| Stories | Yes | No |
| Follower lists | Yes | No |
| Legal risk | Higher (login = auth bypass concern) | Lower (public data, no login) |
| Maintenance | Session management, 2FA handling | Endpoint monitoring, proxy management |
| User trust | Must share password | No sensitive info needed |
| Speed | Slow (login flow) | Fast (direct API call) |
| Cost | Free (but risky) | Proxy/API costs |

---

## Conclusion & Recommendation

**The web scraping approach is viable and recommended.** Here's why:

1. **Sufficient data:** Public profiles expose everything needed for analytics (profile info, recent posts, engagement metrics).
2. **Legal safety:** Meta v. Bright Data (2024) established strong precedent for scraping public data without login.
3. **Existing infrastructure:** The codebase already has `curl_cffi` for TLS impersonation -- the hardest part is already solved.
4. **Better UX:** Users just enter a username instead of sharing their password.
5. **Lower risk:** No risk of account bans or suspicious login blocks.

**Recommended path:**
1. Start with **Approach A** (third-party API) for MVP -- fastest to ship
2. Build **Approach B** (self-hosted scraper) in parallel
3. Deploy the hybrid (**Approach C**) for production reliability

**Next steps:**
- [ ] Choose a third-party API (Apify vs RapidAPI endpoint)
- [ ] Build the `InstagramScraper` class
- [ ] Update database schema (remove auth, add scraping metadata)
- [ ] Update API endpoints
- [ ] Build search UI (replace login form)
- [ ] Add profile page route (`/profile/[username]`)
- [ ] Test with various public profiles
- [ ] Set up proxy rotation for production
