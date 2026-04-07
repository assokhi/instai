import json
import os
from datetime import datetime, timezone
from pathlib import Path

import libsql_experimental as libsql

# Turso remote database (preferred) or local SQLite fallback
_TURSO_URL = os.environ.get("TURSO_DATABASE_URL", "")
_TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

# Local fallback path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_LOCAL_DB = os.environ.get("DB_PATH", str(_PROJECT_ROOT / "instai.db"))


def _get_connection():
    if _TURSO_URL and _TURSO_TOKEN:
        conn = libsql.connect("instai.db", sync_url=_TURSO_URL, auth_token=_TURSO_TOKEN)
        conn.sync()
    else:
        conn = libsql.connect(_LOCAL_DB)
    return conn


def _fetchone_dict(conn, query: str, params: tuple = ()) -> dict | None:
    """Execute a query and return the first row as a dict, or None."""
    cursor = conn.execute(query, params)
    row = cursor.fetchone()
    if not row:
        return None
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row))


def _fetchall_dicts(conn, query: str, params: tuple = ()) -> list[dict]:
    """Execute a query and return all rows as dicts."""
    cursor = conn.execute(query, params)
    rows = cursor.fetchall()
    if not rows:
        return []
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, row)) for row in rows]


def init_db() -> None:
    """Create tables if they don't exist. Drops legacy tables from login-based approach."""
    conn = _get_connection()
    conn.executescript("""
        -- Drop legacy tables from login-based approach
        DROP TABLE IF EXISTS login_attempts;
        DROP TABLE IF EXISTS users;

        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ig_username TEXT UNIQUE NOT NULL,
            ig_pk TEXT,
            full_name TEXT,
            biography TEXT,
            profile_pic_url TEXT,
            follower_count INTEGER DEFAULT 0,
            following_count INTEGER DEFAULT 0,
            media_count INTEGER DEFAULT 0,
            is_business INTEGER DEFAULT 0,
            is_private INTEGER DEFAULT 0,
            scraped_at TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ig_username TEXT NOT NULL,
            pk TEXT UNIQUE NOT NULL,
            code TEXT,
            taken_at TEXT,
            media_type INTEGER,
            thumbnail_url TEXT,
            video_url TEXT,
            like_count INTEGER DEFAULT 0,
            comment_count INTEGER DEFAULT 0,
            caption_text TEXT,
            resources_json TEXT,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_posts_username ON posts(ig_username);

        CREATE TABLE IF NOT EXISTS scrape_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ig_username TEXT NOT NULL,
            status TEXT NOT NULL,
            post_count INTEGER DEFAULT 0,
            error_message TEXT,
            scraped_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_scrape_log_username ON scrape_log(ig_username);
    """)
    conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Profile cache ---

def save_profile(ig_username: str, profile: dict) -> None:
    """Cache profile data locally."""
    conn = _get_connection()
    now = _now()
    conn.execute("""
        INSERT INTO profiles (ig_username, ig_pk, full_name, biography, profile_pic_url,
                              follower_count, following_count, media_count,
                              is_business, is_private, scraped_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ig_username) DO UPDATE SET
            ig_pk = excluded.ig_pk,
            full_name = excluded.full_name,
            biography = excluded.biography,
            profile_pic_url = excluded.profile_pic_url,
            follower_count = excluded.follower_count,
            following_count = excluded.following_count,
            media_count = excluded.media_count,
            is_business = excluded.is_business,
            is_private = excluded.is_private,
            scraped_at = excluded.scraped_at,
            updated_at = excluded.updated_at
    """, (
        ig_username, profile.get("pk"), profile.get("full_name"),
        profile.get("biography"), profile.get("profile_pic_url"),
        profile.get("follower_count", 0), profile.get("following_count", 0),
        profile.get("media_count", 0), int(profile.get("is_business", False)),
        int(profile.get("is_private", False)), now, now
    ))
    conn.commit()
    conn.close()


def load_profile(ig_username: str) -> dict | None:
    """Load cached profile data."""
    conn = _get_connection()
    row = _fetchone_dict(conn, "SELECT * FROM profiles WHERE ig_username = ?", (ig_username,))
    conn.close()
    if not row:
        return None
    return {
        "pk": row["ig_pk"],
        "username": row["ig_username"],
        "full_name": row["full_name"],
        "biography": row["biography"],
        "profile_pic_url": row["profile_pic_url"],
        "follower_count": row["follower_count"],
        "following_count": row["following_count"],
        "media_count": row["media_count"],
        "is_business": bool(row["is_business"]),
        "is_private": bool(row["is_private"]),
        "scraped_at": row["scraped_at"],
    }


def is_cache_fresh(ig_username: str, max_age_seconds: int = 3600) -> bool:
    """Check if cached profile data is younger than max_age_seconds (default 1 hour)."""
    conn = _get_connection()
    row = _fetchone_dict(conn, "SELECT scraped_at FROM profiles WHERE ig_username = ?", (ig_username,))
    conn.close()
    if not row or not row["scraped_at"]:
        return False
    try:
        scraped_dt = datetime.fromisoformat(row["scraped_at"])
        elapsed = (datetime.now(timezone.utc) - scraped_dt).total_seconds()
        return elapsed < max_age_seconds
    except (ValueError, TypeError):
        return False


# --- Posts cache ---

def save_posts(ig_username: str, posts: list[dict]) -> None:
    """Cache posts data locally."""
    conn = _get_connection()
    now = _now()
    for post in posts:
        resources_json = json.dumps(post.get("resources")) if post.get("resources") else None
        conn.execute("""
            INSERT INTO posts (ig_username, pk, code, taken_at, media_type, thumbnail_url,
                               video_url, like_count, comment_count, caption_text, resources_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(pk) DO UPDATE SET
                like_count = excluded.like_count,
                comment_count = excluded.comment_count,
                caption_text = excluded.caption_text,
                thumbnail_url = excluded.thumbnail_url,
                video_url = excluded.video_url,
                resources_json = excluded.resources_json,
                updated_at = excluded.updated_at
        """, (
            ig_username, post["pk"], post.get("code"), post.get("taken_at"),
            post.get("media_type"), post.get("thumbnail_url"), post.get("video_url"),
            post.get("like_count", 0), post.get("comment_count", 0),
            post.get("caption_text", ""), resources_json, now
        ))
    conn.commit()
    conn.close()


def load_posts(ig_username: str, count: int = 12) -> list[dict] | None:
    """Load cached posts. Returns None if no cached data."""
    conn = _get_connection()
    rows = _fetchall_dicts(conn,
        "SELECT * FROM posts WHERE ig_username = ? ORDER BY taken_at DESC LIMIT ?",
        (ig_username, count)
    )
    conn.close()
    if not rows:
        return None
    posts = []
    for row in rows:
        post = {
            "pk": row["pk"],
            "code": row["code"],
            "taken_at": row["taken_at"],
            "media_type": row["media_type"],
            "thumbnail_url": row["thumbnail_url"],
            "like_count": row["like_count"],
            "comment_count": row["comment_count"],
            "caption_text": row["caption_text"],
        }
        if row.get("video_url"):
            post["video_url"] = row["video_url"]
        if row.get("resources_json"):
            post["resources"] = json.loads(row["resources_json"])
        posts.append(post)
    return posts


# --- Scrape logging ---

def record_scrape(ig_username: str, status: str, post_count: int = 0, error_message: str | None = None) -> None:
    """Log a scrape operation for diagnostics."""
    conn = _get_connection()
    conn.execute(
        "INSERT INTO scrape_log (ig_username, status, post_count, error_message, scraped_at) VALUES (?, ?, ?, ?, ?)",
        (ig_username, status, post_count, error_message, _now())
    )
    conn.commit()
    conn.close()


def get_recent_scrape_count(minutes: int = 60) -> int:
    """Count total scrapes in the last N minutes (for self-imposed rate limiting)."""
    conn = _get_connection()
    row = _fetchone_dict(conn,
        "SELECT COUNT(*) as cnt FROM scrape_log WHERE scraped_at > datetime('now', ?)",
        (f"-{minutes} minutes",)
    )
    conn.close()
    return row["cnt"] if row else 0
