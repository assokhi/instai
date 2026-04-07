"use client";

import Image from "next/image";
import type { Post } from "@/lib/types";
import { proxyImageUrl, downloadUrl } from "@/lib/image";

interface PostCardProps {
  post: Post;
  onClick: () => void;
}

export default function PostCard({ post, onClick }: PostCardProps) {
  return (
    <button
      onClick={onClick}
      className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 group"
    >
      {post.thumbnail_url ? (
        <Image
          src={proxyImageUrl(post.thumbnail_url)}
          alt={post.caption_text?.slice(0, 50) || "Post"}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 33vw, 300px"
          unoptimized
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-400">
          No image
        </div>
      )}

      {/* Media type indicator */}
      {post.media_type === 2 && (
        <div className="absolute top-2 right-2 text-white drop-shadow-md">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      {post.media_type === 8 && (
        <div className="absolute top-2 right-2 text-white drop-shadow-md">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
          </svg>
        </div>
      )}

      {/* Download button */}
      {(post.thumbnail_url || post.video_url) && (
        <a
          href={downloadUrl(
            post.video_url || post.thumbnail_url,
            `post_${post.code}`
          )}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 left-2 w-7 h-7 bg-black/60 hover:bg-black/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Download"
        >
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
          </svg>
        </a>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-semibold text-sm pointer-events-none">
        <span className="flex items-center gap-1">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          {post.like_count}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {post.comment_count}
        </span>
      </div>
    </button>
  );
}
