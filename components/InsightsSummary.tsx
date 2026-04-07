"use client";

import type { Post } from "@/lib/types";

interface InsightsSummaryProps {
  posts: Post[];
}

export default function InsightsSummary({ posts }: InsightsSummaryProps) {
  if (posts.length === 0) return null;

  const totalLikes = posts.reduce((sum, p) => sum + p.like_count, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.comment_count, 0);
  const avgLikes = Math.round(totalLikes / posts.length);
  const avgComments = Math.round(totalComments / posts.length);
  const bestPost = posts.reduce((best, p) =>
    p.like_count + p.comment_count > best.like_count + best.comment_count ? p : best
  );

  const stats = [
    { label: "Total Likes", value: totalLikes.toLocaleString() },
    { label: "Total Comments", value: totalComments.toLocaleString() },
    { label: "Avg Likes/Post", value: avgLikes.toLocaleString() },
    { label: "Avg Comments/Post", value: avgComments.toLocaleString() },
    {
      label: "Best Post Engagement",
      value: (bestPost.like_count + bestPost.comment_count).toLocaleString(),
    },
  ];

  return (
    <div className="px-4 py-6">
      <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
        Insights
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 text-center"
          >
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {stat.value}
            </p>
            <p className="text-xs text-zinc-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
