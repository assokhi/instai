"use client";

import Image from "next/image";
import type { Profile } from "@/lib/types";
import { proxyImageUrl, downloadUrl } from "@/lib/image";

interface ProfileHeaderProps {
  profile: Profile;
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  const formatCount = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toString();
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 p-6">
      <div className="relative group flex-shrink-0">
        <div className="w-20 h-20 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 border-zinc-200 dark:border-zinc-700">
          <Image
            src={proxyImageUrl(profile.profile_pic_url)}
            alt={profile.username}
            width={150}
            height={150}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>
        {profile.profile_pic_url && (
          <a
            href={downloadUrl(profile.profile_pic_url, `${profile.username}_profile`)}
            className="absolute bottom-0 right-0 w-7 h-7 sm:w-8 sm:h-8 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Download profile picture"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
            </svg>
          </a>
        )}
      </div>
      <div className="flex flex-col items-center sm:items-start gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-normal text-zinc-900 dark:text-zinc-100">
            {profile.username}
          </h2>
        </div>
        <div className="flex gap-8">
          <div className="text-center sm:text-left">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatCount(profile.media_count)}
            </span>{" "}
            <span className="text-zinc-500">posts</span>
          </div>
          <div className="text-center sm:text-left">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatCount(profile.follower_count)}
            </span>{" "}
            <span className="text-zinc-500">followers</span>
          </div>
          <div className="text-center sm:text-left">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatCount(profile.following_count)}
            </span>{" "}
            <span className="text-zinc-500">following</span>
          </div>
        </div>
        <div>
          <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            {profile.full_name}
          </p>
          {profile.biography && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line mt-1">
              {profile.biography}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
