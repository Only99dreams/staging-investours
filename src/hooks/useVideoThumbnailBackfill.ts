/**
 * Silently backfills missing video thumbnails for the signed-in user's posts.
 *
 * Runs once per mount. For each of the author's video posts that has no stored
 * frame yet, it captures one in-browser and writes it to Supabase Storage beside
 * the video. The share endpoint can then find it on the next crawl.
 *
 * Fire-and-forget: errors are swallowed so a thumbnail failure never surfaces
 * as a visible error on the dashboard.
 */

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { backfillVideoThumbnail } from "@/lib/videoThumbnail";

export function useVideoThumbnailBackfill() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    void (async () => {
      try {
        const { data: posts } = await supabase
          .from("posts")
          .select("id, attachment_url, attachment_type")
          .eq("author_id", user.id)
          .eq("attachment_type", "video")
          .eq("is_approved", true)
          .eq("is_hidden", false)
          .limit(20);

        if (!posts?.length) return;

        // Process sequentially to avoid hammering storage with parallel uploads.
        for (const post of posts) {
          if (!post.attachment_url) continue;
          // backfillVideoThumbnail checks for an existing frame first (HEAD),
          // so posts that already have one are skipped cheaply.
          await backfillVideoThumbnail(post.attachment_url).catch(() => {});
        }
      } catch {
        // Never surface a thumbnail error on the dashboard.
      }
    })();
    // Run once per user session, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
