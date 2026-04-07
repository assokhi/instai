"use client";

import type { Post } from "@/lib/types";
import PostCard from "./PostCard";

interface PostGridProps {
  posts: Post[];
  onPostClick: (post: Post) => void;
}

export default function PostGrid({ posts, onPostClick }: PostGridProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500">
        No posts yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {posts.map((post) => (
        <PostCard key={post.pk} post={post} onClick={() => onPostClick(post)} />
      ))}
    </div>
  );
}
