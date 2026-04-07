import type { Profile, Post } from "./types";

const API_BASE = "/api/py";

async function fetchApi<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || "Request failed") as Error & {
      status: string;
      retryAfter?: number;
    };
    err.status = data.status || "error";
    err.retryAfter = data.retry_after;
    throw err;
  }
  return data;
}

export async function scrapeProfile(username: string) {
  return fetchApi<{
    status: string;
    profile: Profile;
    posts: Post[];
    cached: boolean;
    message?: string;
  }>(`/scrape/${encodeURIComponent(username)}`);
}

export async function getProfile(username: string) {
  return fetchApi<{
    status: string;
    profile: Profile;
  }>(`/profile/${encodeURIComponent(username)}`);
}

export async function getPosts(username: string, count = 12) {
  return fetchApi<{
    status: string;
    posts: Post[];
  }>(`/posts/${encodeURIComponent(username)}?count=${count}`);
}
