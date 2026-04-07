"use client";

import Image from "next/image";
import type { Post } from "@/lib/types";
import { proxyImageUrl, downloadUrl } from "@/lib/image";

interface PostModalProps {
  post: Post;
  onClose: () => void;
}

export default function PostModal({ post, onClose }: PostModalProps) {
  const formattedDate = post.taken_at
    ? new Date(post.taken_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-lg overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media */}
        <div className="relative w-full md:w-1/2 aspect-square bg-black flex-shrink-0">
          {post.media_type === 2 && post.video_url ? (
            <video
              src={proxyImageUrl(post.video_url)}
              controls
              className="w-full h-full object-contain"
            />
          ) : post.thumbnail_url ? (
            <Image
              src={proxyImageUrl(post.thumbnail_url)}
              alt={post.caption_text?.slice(0, 50) || "Post"}
              fill
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">
              No media
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col w-full md:w-1/2 p-5 overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="self-end text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 mb-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Download button */}
          {(post.thumbnail_url || post.video_url) && (
            <a
              href={downloadUrl(
                post.video_url || post.thumbnail_url,
                `post_${post.code}`
              )}
              className="flex items-center gap-2 w-fit px-3 py-1.5 mb-3 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors text-zinc-700 dark:text-zinc-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
              </svg>
              Download {post.media_type === 2 ? "Video" : "Image"}
            </a>
          )}

          {/* Engagement stats */}
          <div className="flex gap-6 mb-4 text-sm">
            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span className="font-semibold">{post.like_count.toLocaleString()}</span> likes
            </div>
            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="font-semibold">{post.comment_count.toLocaleString()}</span> comments
            </div>
          </div>

          {/* Caption */}
          {post.caption_text && (
            <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-line mb-4 leading-relaxed">
              {post.caption_text}
            </p>
          )}

          {/* Date */}
          {formattedDate && (
            <p className="text-xs text-zinc-400 mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
              {formattedDate}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
