import type { VercelRequest, VercelResponse } from "@vercel/node";
import { siblingThumbnailUrl, parseVideoLink } from "../../src/lib/video";

/**
 * Image proxy for post share previews: /post-image/:id
 *
 * WhatsApp, LinkedIn and Facebook crawlers fetch og:image directly. If that
 * URL is a raw Supabase storage link they may hit CORS errors, get a 404 for a
 * missing thumbnail, or refuse to render a cross-origin image. Pointing
 * og:image here instead means the crawler always hits OUR server, which fetches
 * the real image from Supabase and pipes the bytes back — no CORS, no missing
 * frames, no broken previews.
 *
 * Falls back to the site logo so the social card is never blank.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";
const SITE_URL = (process.env.SITE_URL || "https://investours.app").replace(/\/$/, "");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchPostAttachment(
  id: string,
): Promise<{ attachment_url: string | null; attachment_type: string | null } | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(id)}` +
        `&select=attachment_url,attachment_type&is_approved=eq.true&is_hidden=eq.false&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0];
  } catch {
    return null;
  }
}

/** Fetch a remote image and pipe the bytes back. Returns false if unavailable. */
async function proxyImage(url: string, res: VercelResponse): Promise<boolean> {
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!upstream.ok || !upstream.body) return false;
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return false;
    const buffer = await upstream.arrayBuffer();
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.status(200).send(Buffer.from(buffer));
    return true;
  } catch {
    return false;
  }
}

function logoFallback(res: VercelResponse) {
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.redirect(302, `${SITE_URL}/logo.png`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "").trim();

  if (!id || !UUID.test(id) || !SUPABASE_URL || !SUPABASE_KEY) {
    return logoFallback(res);
  }

  const post = await fetchPostAttachment(id);
  if (!post) return logoFallback(res);

  const { attachment_url, attachment_type } = post;

  // Image post — pipe the image directly
  if (attachment_type === "image" && attachment_url) {
    const ok = await proxyImage(attachment_url, res);
    if (ok) return;
    return logoFallback(res);
  }

  // Video post — try YouTube/Vimeo poster first, then stored sibling frame
  if (attachment_type === "video" && attachment_url) {
    const linked = parseVideoLink(attachment_url);
    if (linked?.thumbnailUrl) {
      const ok = await proxyImage(linked.thumbnailUrl, res);
      if (ok) return;
    }
    const thumbUrl = siblingThumbnailUrl(attachment_url);
    if (thumbUrl) {
      const ok = await proxyImage(thumbUrl, res);
      if (ok) return;
    }
  }

  return logoFallback(res);
}
