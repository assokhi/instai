import { NextRequest, NextResponse } from "next/server";

/**
 * Image proxy route.
 * Instagram's CDN blocks direct image loading from third-party domains
 * via referrer checks. This route fetches the image server-side
 * (no referrer) and forwards it to the browser.
 *
 * Usage: /api/image?url=<encoded-instagram-cdn-url>
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Only allow Instagram CDN domains
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const allowed =
    parsed.hostname.endsWith(".cdninstagram.com") ||
    parsed.hostname.endsWith(".fbcdn.net");

  if (!allowed) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    const download = request.nextUrl.searchParams.get("download");
    const filename = request.nextUrl.searchParams.get("filename") || "instagram-media";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    };

    if (download) {
      const ext = contentType.includes("video") ? "mp4" : contentType.includes("png") ? "png" : "jpg";
      headers["Content-Disposition"] = `attachment; filename="${filename}.${ext}"`;
    }

    return new NextResponse(buffer, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
