import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function searchPullpush(
  endpoint: string, query: string, subreddit: string,
  size = 100, before?: number, after?: number
): Promise<any[]> {
  let url = `https://api.pullpush.io/reddit/search/${endpoint}/?q=${encodeURIComponent(query)}&subreddit=${encodeURIComponent(subreddit)}&sort=desc&size=${size}`;
  if (before) url += `&before=${before}`;
  if (after) url += `&after=${after}`;
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

// Paginate through all results between after and now
async function fetchAllPaginated(
  endpoint: string, query: string, subreddit: string, afterEpoch: number
): Promise<any[]> {
  const allResults: any[] = [];
  let before: number | undefined = undefined;
  const maxPages = 20; // Safety limit

  for (let page = 0; page < maxPages; page++) {
    const batch = await searchPullpush(endpoint, query, subreddit, 100, before, afterEpoch);
    if (batch.length === 0) break;

    allResults.push(...batch);

    // Get the oldest item's timestamp for next page
    const oldestTs = Math.min(...batch.map((d: any) => d.created_utc || 0));
    if (oldestTs <= afterEpoch) break; // We've gone past our time range
    before = oldestTs;

    // Small delay between pages
    await new Promise(r => setTimeout(r, 500));
  }

  return allResults;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let searchQuery = "Corporate";
    let fullHistory = false;
    let subredditNames: string[] | null = null;
    try {
      const body = await req.json();
      if (body?.searchQuery) searchQuery = body.searchQuery;
      if (body?.fullHistory) fullHistory = body.fullHistory;
      if (body?.subreddits) subredditNames = body.subreddits;
    } catch {}

    let subs: { name: string }[];
    if (subredditNames && subredditNames.length > 0) {
      subs = subredditNames.map(n => ({ name: n }));
    } else {
      const { data } = await supabase.from("monitored_subreddits").select("name");
      if (!data || data.length === 0) {
        return new Response(JSON.stringify({ message: "No subreddits configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      subs = data;
    }

    // 2 years ago as epoch seconds
    const twoYearsAgo = Math.floor(Date.now() / 1000) - (2 * 365 * 24 * 60 * 60);

    let totalNew = 0;
    const newMentionIds: string[] = [];

    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i];
      if (i > 0) await new Promise(r => setTimeout(r, 3000));

      try {
        let submissions: any[];
        let comments: any[];

        if (fullHistory) {
          submissions = await fetchAllPaginated("submission", searchQuery, sub.name, twoYearsAgo);
          await new Promise(r => setTimeout(r, 1500));
          comments = await fetchAllPaginated("comment", searchQuery, sub.name, twoYearsAgo);
        } else {
          submissions = await searchPullpush("submission", searchQuery, sub.name, 100);
          await new Promise(r => setTimeout(r, 1500));
          comments = await searchPullpush("comment", searchQuery, sub.name, 100);
        }

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

        // Batch upsert in chunks of 200 to avoid payload limits
        for (let j = 0; j < filtered.length; j += 200) {
          const chunk = filtered.slice(j, j + 200);
          const { data: inserted } = await supabase
            .from("reddit_mentions")
            .upsert(chunk, { onConflict: "reddit_id", ignoreDuplicates: true })
            .select("id");

          if (inserted) {
            totalNew += inserted.length;
            newMentionIds.push(...inserted.map((r: any) => r.id));
          }
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
