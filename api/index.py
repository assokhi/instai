import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load .env.local for local dev — must happen before any imports that use env vars
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env.local"
    load_dotenv(_env_path)
except ImportError:
    pass

from api.utils.database import (
    init_db,
    save_profile,
    load_profile,
    save_posts,
    load_posts,
    is_cache_fresh,
    record_scrape,
)
from api.utils.scraper import (
    InstagramScraper,
    UserNotFoundError,
    RateLimitedError,
    ScrapingBlockedError,
    _CacheFallback,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9._]{1,30}$")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    docs_url="/api/py/docs",
    openapi_url="/api/py/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Single scraper instance — reuses curl_cffi session across requests
scraper = InstagramScraper()


@app.get("/api/py/scrape/{username}")
async def scrape(username: str):
    """Scrape a public Instagram profile. Returns cached data if fresh."""
    username = username.lower().strip()

    if not _USERNAME_RE.match(username):
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "Invalid username format"},
        )

    # Return cached data if fresh (< 1 hour old)
    if is_cache_fresh(username):
        profile = load_profile(username)
        posts = load_posts(username) or []
        if profile:
            return {
                "status": "private" if profile.get("is_private") else "success",
                "profile": profile,
                "posts": posts,
                "cached": True,
            }

    # Scrape fresh data
    try:
        result = await scraper.scrape_profile(username)
    except _CacheFallback:
        # Another request is already scraping this user — return cache
        profile = load_profile(username)
        posts = load_posts(username) or []
        if profile:
            return {
                "status": "private" if profile.get("is_private") else "success",
                "profile": profile,
                "posts": posts,
                "cached": True,
            }
        return JSONResponse(
            status_code=503,
            content={"status": "error", "message": "Please try again in a moment"},
        )
    except UserNotFoundError:
        record_scrape(username, "not_found")
        return JSONResponse(
            status_code=404,
            content={"status": "not_found", "message": f"User '{username}' not found"},
        )
    except RateLimitedError as e:
        record_scrape(username, "rate_limited", error_message=str(e))
        # Try to return cached data as fallback
        profile = load_profile(username)
        posts = load_posts(username) or []
        if profile:
            return {
                "status": "private" if profile.get("is_private") else "success",
                "profile": profile,
                "posts": posts,
                "cached": True,
            }
        return JSONResponse(
            status_code=429,
            content={
                "status": "rate_limited",
                "message": str(e),
                "retry_after": e.retry_after,
            },
        )
    except ScrapingBlockedError as e:
        record_scrape(username, "error", error_message=str(e))
        # Try cache fallback
        profile = load_profile(username)
        posts = load_posts(username) or []
        if profile:
            return {
                "status": "private" if profile.get("is_private") else "success",
                "profile": profile,
                "posts": posts,
                "cached": True,
            }
        return JSONResponse(
            status_code=503,
            content={"status": "blocked", "message": "Instagram is temporarily blocking requests. Try again later."},
        )
    except Exception as e:
        logger.exception("Unexpected error scraping %s", username)
        record_scrape(username, "error", error_message=str(e))
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "An unexpected error occurred"},
        )

    # Save to database
    profile = result["profile"]
    posts = result["posts"]

    save_profile(username, profile)
    if posts:
        save_posts(username, posts)
    record_scrape(username, "success", post_count=len(posts))

    # Reload from DB to get consistent format (with scraped_at)
    profile = load_profile(username) or profile

    status = "private" if profile.get("is_private") else "success"
    return {"status": status, "profile": profile, "posts": posts, "cached": False}


@app.get("/api/py/profile/{username}")
async def profile(username: str):
    """Get cached profile data (no scraping)."""
    username = username.lower().strip()
    cached = load_profile(username)
    if not cached:
        return JSONResponse(
            status_code=404,
            content={"status": "not_found", "message": "Profile not cached. Use /scrape/{username} first."},
        )
    return {"status": "success", "profile": cached}


@app.get("/api/py/posts/{username}")
async def posts(username: str, count: int = 12):
    """Get cached posts (no scraping)."""
    username = username.lower().strip()
    cached = load_posts(username, count)
    if not cached:
        return JSONResponse(
            status_code=404,
            content={"status": "not_found", "message": "Posts not cached. Use /scrape/{username} first."},
        )
    return {"status": "success", "posts": cached}
