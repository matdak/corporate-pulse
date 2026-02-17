import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function searchPullpush(endpoint: string, query: string, subreddit: string, size = 100): Promise<any[]> {
  const url = `https://api.pullpush.io/reddit/search/${endpoint}/?q=${encodeURIComponent(query)}&subreddit=${encodeURIComponent(subreddit)}&sort=desc&size=${size}`;
  console.log(`PullPush ${endpoint}: ${url}`);
  const res = await fetch(url, {
    headers: { "User-Agent": "SocialListener/1.0" },
  });
  if (!res.ok) {
    throw new Error(`PullPush ${endpoint} failed (${res.status}): ${await res.text().then(t => t.substring(0, 200))}`);
  }
  const data = await res.json();
  return data?.data || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let searchQuery = "Corporate";
    try {
      const body = await req.json();
      if (body?.searchQuery) searchQuery = body.searchQuery;
    } catch {}

    const { data: subs } = await supabase.from("monitored_subreddits").select("name");
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ message: "No subreddits configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalNew = 0;
    const newMentionIds: string[] = [];

    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i];
      if (i > 0) await new Promise(r => setTimeout(r, 1500));

      try {
        // Fetch both submissions and comments in parallel
        const [submissions, comments] = await Promise.all([
          searchPullpush("submission", searchQuery, sub.name, 100),
          searchPullpush("comment", searchQuery, sub.name, 100),
        ]);

        console.log(`r/${sub.name}: ${submissions.length} submissions, ${comments.length} comments`);

        const mentions = [
          ...submissions.map((d: any) => ({
            reddit_id: d.name || `t3_${d.id}`,
            type: "post" as const,
            title: d.title || null,
            content: d.selftext || d.title || "",
            author: d.author || "[deleted]",
            subreddit: d.subreddit || sub.name,
            permalink: d.permalink || `/r/${sub.name}/comments/${d.id}/`,
            score: d.score || 0,
            created_utc: new Date((d.created_utc || 0) * 1000).toISOString(),
          })),
          ...comments.map((d: any) => ({
            reddit_id: d.name || `t1_${d.id}`,
            type: "comment" as const,
            title: null,
            content: d.body || "",
            author: d.author || "[deleted]",
            subreddit: d.subreddit || sub.name,
            permalink: d.permalink || "",
            score: d.score || 0,
            created_utc: new Date((d.created_utc || 0) * 1000).toISOString(),
          })),
        ];

        // Filter to only keep mentions that specifically mention the search query
        const queryLower = searchQuery.toLowerCase();
        const filtered = mentions.filter(m => {
          const text = `${m.title || ""} ${m.content}`.toLowerCase();
          if (!text.includes(queryLower)) return false;
          if (m.author === "[deleted]" || m.author === "[removed]") return false;
          if (m.content === "[deleted]" || m.content === "[removed]") return false;
          return true;
        });
        console.log(`r/${sub.name}: ${mentions.length} total -> ${filtered.length} matching "${searchQuery}"`);

        // Batch upsert filtered mentions
        const { data: inserted } = await supabase
          .from("reddit_mentions")
          .upsert(filtered, { onConflict: "reddit_id", ignoreDuplicates: true })
          .select("id");

        if (inserted) {
          totalNew += inserted.length;
          newMentionIds.push(...inserted.map((r: any) => r.id));
        }
      } catch (err) {
        console.error(`Failed for r/${sub.name}:`, err);
      }
    }

    // Trigger sentiment analysis for new mentions
    if (newMentionIds.length > 0) {
      await fetch(`${supabaseUrl}/functions/v1/analyze-sentiment`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mentionIds: newMentionIds }),
      });
    }

    return new Response(JSON.stringify({ message: `Fetched ${totalNew} new mentions`, newMentionIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-reddit-mentions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
