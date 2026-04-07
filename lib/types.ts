export interface Profile {
  pk: string;
  username: string;
  full_name: string;
  biography: string;
  profile_pic_url: string;
  follower_count: number;
  following_count: number;
  media_count: number;
  is_business: boolean;
  is_private: boolean;
  scraped_at: string | null;
}

export interface PostResource {
  thumbnail_url: string;
}

export interface Post {
  pk: string;
  code: string;
  taken_at: string | null;
  media_type: number; // 1=photo, 2=video, 8=carousel
  thumbnail_url: string | null;
  like_count: number;
  comment_count: number;
  caption_text: string;
  video_url?: string;
  resources?: PostResource[];
}

export interface ApiResponse {
  status: "success" | "error" | "not_found" | "private" | "rate_limited" | "blocked";
  message?: string;
  profile?: Profile;
  posts?: Post[];
  cached?: boolean;
  retry_after?: number;
}
