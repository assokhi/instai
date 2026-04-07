/**
 * Proxy an Instagram CDN image URL through our API route
 * to bypass referrer-based blocking.
 */
export function proxyImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  return `/api/image?url=${encodeURIComponent(url)}`;
}

/**
 * Get a download URL for an Instagram media item.
 */
export function downloadUrl(url: string | null | undefined, filename: string): string {
  if (!url) return "";
  return `/api/image?url=${encodeURIComponent(url)}&download=1&filename=${encodeURIComponent(filename)}`;
}
