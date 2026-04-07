"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { scrapeProfile } from "@/lib/api";
import type { Profile, Post } from "@/lib/types";
import ProfileHeader from "@/components/ProfileHeader";
import PostGrid from "@/components/PostGrid";
import PostModal from "@/components/PostModal";
import InsightsSummary from "@/components/InsightsSummary";

type PageStatus = "loading" | "success" | "private" | "not_found" | "rate_limited" | "error";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [cached, setCached] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setPageStatus("loading");
      setErrorMessage("");

      try {
        const res = await scrapeProfile(username);
        setProfile(res.profile);
        setPosts(res.posts || []);
        setCached(res.cached);

        if (res.status === "private") {
          setPageStatus("private");
        } else {
          setPageStatus("success");
        }
      } catch (err: unknown) {
        const error = err as Error & { status?: string };
        const status = error.status || "error";

        if (status === "not_found") {
          setPageStatus("not_found");
          setErrorMessage(`User @${username} not found`);
        } else if (status === "rate_limited") {
          setPageStatus("rate_limited");
          setErrorMessage("Instagram is temporarily limiting requests. Try again in a few minutes.");
        } else {
          setPageStatus("error");
          setErrorMessage(error.message || "Something went wrong");
        }
      }
    };

    loadData();
  }, [username]);

  // ── Loading state ──
  if (pageStatus === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-zinc-300 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-zinc-400">Searching the Instagram Universe</p>
          <p className="text-xs text-zinc-500">Looking up @{username}</p>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (pageStatus === "not_found") {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <p className="text-lg text-zinc-700 dark:text-zinc-300 mb-4">{errorMessage}</p>
          <Link
            href="/"
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            Search another profile
          </Link>
        </div>
      </div>
    );
  }

  // ── Error / rate limited (no cached data) ──
  if ((pageStatus === "error" || pageStatus === "rate_limited") && !profile) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <p className="text-lg text-zinc-700 dark:text-zinc-300 mb-4">{errorMessage}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium"
            >
              Try again
            </button>
            <Link
              href="/"
              className="text-zinc-500 hover:text-zinc-600 text-sm font-medium"
            >
              Search another profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Profile loaded (success, private, or cached fallback) ──
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <div className="max-w-4xl w-full mx-auto">
        {/* Back to search */}
        <div className="px-4 pt-4">
          <Link
            href="/"
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            &larr; Search another profile
          </Link>
          {cached && (
            <span className="ml-3 text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              cached
            </span>
          )}
        </div>

        {profile && <ProfileHeader profile={profile} />}

        {/* Private profile message */}
        {pageStatus === "private" && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 py-12 text-center">
            <svg className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-zinc-500 text-sm">This account is private</p>
          </div>
        )}

        {/* Insights + Posts (only for public profiles) */}
        {pageStatus !== "private" && (
          <>
            <div className="border-t border-zinc-200 dark:border-zinc-800">
              <InsightsSummary posts={posts} />
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 mt-2">
              <div className="px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider text-center">
                  Posts
                </h3>
              </div>
              <PostGrid posts={posts} onPostClick={setSelectedPost} />
            </div>
          </>
        )}
      </div>

      {selectedPost && (
        <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
