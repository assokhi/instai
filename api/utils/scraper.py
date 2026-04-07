"""
Instagram public profile scraper.

Scrapes public Instagram profile data using Instagram's REST API
without authentication. Uses curl_cffi for TLS fingerprint impersonation
to avoid bot detection.

Only scrapes publicly available data — no login, no session, no credentials.
This approach is on strong legal footing per Meta v. Bright Data (2024).
"""

import asyncio
import logging
import random
import time
from datetime import datetime, timezone

from curl_cffi.requests import Session as CurlSession

logger = logging.getLogger(__name__)

# ── Exceptions ──────────────────────────────────────────────────────────────

class UserNotFoundError(Exception):
    """Raised when the Instagram username does not exist."""
    pass


class RateLimitedError(Exception):
    """Raised when Instagram returns HTTP 429."""
    def __init__(self, retry_after: int = 300):
        self.retry_after = retry_after
        super().__init__(f"Rate limited. Try again in {retry_after} seconds.")


class PrivateProfileError(Exception):
    """Raised when the profile is private (informational, not always thrown)."""
    pass


class ScrapingBlockedError(Exception):
    """Raised when Instagram blocks the request (401/403)."""
    pass


# ── Scraper ─────────────────────────────────────────────────────────────────

_PROFILE_API = "https://i.instagram.com/api/v1/users/web_profile_info/"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "X-IG-App-ID": "936619743392459",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.instagram.com/",
    "Origin": "https://www.instagram.com",
}

_TYPENAME_TO_MEDIA_TYPE = {
    "GraphImage": 1,
    "GraphVideo": 2,
    "GraphSidecar": 8,
}


def _human_delay(min_sec: float = 0.5, max_sec: float = 2.0) -> None:
    time.sleep(random.uniform(min_sec, max_sec))


class InstagramScraper:
    """Scrapes public Instagram profiles without authentication."""

    def __init__(self):
        self._session = CurlSession(impersonate="chrome120")
        self._session.headers.update(_HEADERS)
        # In-flight dedup: prevents concurrent duplicate scrapes for the same username
        self._active_scrapes: dict[str, asyncio.Event] = {}

    async def scrape_profile(self, username: str) -> dict:
        """
        Scrape a public Instagram profile by username.

        Returns:
            {
                "profile": { ... profile fields ... },
                "posts": [ ... post dicts ... ],
            }

        Raises:
            UserNotFoundError: username does not exist
            RateLimitedError: Instagram returned 429
            ScrapingBlockedError: Instagram returned 401/403
        """
        username = username.lower().strip()

        # ── Dedup concurrent requests for the same username ──
        if username in self._active_scrapes:
            event = self._active_scrapes[username]
            await asyncio.to_thread(event.wait, timeout=30)
            # After waiting, caller should read from cache
            raise _CacheFallback()

        event = asyncio.Event()
        self._active_scrapes[username] = event
        try:
            result = await asyncio.to_thread(self._fetch, username)
            return result
        finally:
            event.set()
            self._active_scrapes.pop(username, None)

    def _fetch(self, username: str) -> dict:
        """Synchronous fetch executed in a thread."""
        _human_delay(0.3, 1.5)

        resp = self._session.get(
            _PROFILE_API,
            params={"username": username},
            timeout=30,
        )

        # ── Status code handling ──
        if resp.status_code == 404:
            raise UserNotFoundError(f"User '{username}' not found")

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 300))
            raise RateLimitedError(retry_after=retry_after)

        if resp.status_code in (401, 403):
            raise ScrapingBlockedError(
                f"Instagram blocked the request (HTTP {resp.status_code})"
            )

        if resp.status_code != 200:
            raise ScrapingBlockedError(
                f"Unexpected HTTP {resp.status_code}: {resp.text[:200]}"
            )

        # ── Parse JSON ──
        try:
            data = resp.json()
        except Exception as e:
            logger.error("Failed to parse JSON response: %s", e)
            raise ScrapingBlockedError("Invalid JSON response from Instagram")

        user_data = data.get("data", {}).get("user")
        if user_data is None:
            raise UserNotFoundError(f"User '{username}' not found")

        profile = self._parse_profile(user_data)
        posts: list[dict] = []

        if not profile["is_private"]:
            timeline = user_data.get("edge_owner_to_timeline_media", {})
            edges = timeline.get("edges", [])
            posts = self._parse_posts(edges)

        return {"profile": profile, "posts": posts}

    # ── Parsers ─────────────────────────────────────────────────────────

    def _parse_profile(self, user: dict) -> dict:
        return {
            "pk": str(user.get("id", "")),
            "username": user.get("username", ""),
            "full_name": user.get("full_name", ""),
            "biography": user.get("biography", ""),
            "profile_pic_url": user.get("profile_pic_url_hd")
                or user.get("profile_pic_url", ""),
            "follower_count": user.get("edge_followed_by", {}).get("count", 0),
            "following_count": user.get("edge_follow", {}).get("count", 0),
            "media_count": user.get("edge_owner_to_timeline_media", {}).get("count", 0),
            "is_business": bool(user.get("is_business_account", False)),
            "is_private": bool(user.get("is_private", False)),
        }

    def _parse_posts(self, edges: list) -> list[dict]:
        posts = []
        for edge in edges:
            node = edge.get("node", {})
            try:
                post = self._parse_single_post(node)
                posts.append(post)
            except Exception as e:
                logger.warning("Skipping unparseable post: %s", e)
        return posts

    def _parse_single_post(self, node: dict) -> dict:
        typename = node.get("__typename", "GraphImage")
        media_type = _TYPENAME_TO_MEDIA_TYPE.get(typename, 1)

        # Caption
        caption_edges = node.get("edge_media_to_caption", {}).get("edges", [])
        caption_text = ""
        if caption_edges:
            caption_text = caption_edges[0].get("node", {}).get("text", "")

        # Timestamp
        taken_at_ts = node.get("taken_at_timestamp")
        taken_at = None
        if taken_at_ts:
            taken_at = datetime.fromtimestamp(
                taken_at_ts, tz=timezone.utc
            ).isoformat()

        post: dict = {
            "pk": str(node.get("id", "")),
            "code": node.get("shortcode", ""),
            "taken_at": taken_at,
            "media_type": media_type,
            "thumbnail_url": node.get("display_url"),
            "like_count": node.get("edge_liked_by", {}).get("count", 0),
            "comment_count": node.get("edge_media_to_comment", {}).get("count", 0),
            "caption_text": caption_text,
        }

        # Video URL (only for GraphVideo)
        if media_type == 2:
            video_url = node.get("video_url")
            if video_url:
                post["video_url"] = video_url

        # Carousel resources (only for GraphSidecar)
        if media_type == 8:
            sidecar_edges = node.get("edge_sidecar_to_children", {}).get("edges", [])
            if sidecar_edges:
                post["resources"] = [
                    {"thumbnail_url": child.get("node", {}).get("display_url", "")}
                    for child in sidecar_edges
                ]

        return post


class _CacheFallback(Exception):
    """Internal: signals the caller to read from cache instead of scraping."""
    pass
