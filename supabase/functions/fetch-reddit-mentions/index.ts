import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const redditClientId = Deno.env.get("REDDIT_CLIENT_ID");
    const redditClientSecret = Deno.env.get("REDDIT_CLIENT_SECRET");

    if (!redditClientId || !redditClientSecret) {
      return new Response(JSON.stringify({ error: "Reddit API credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get search query from request body or default to "Corporate"
    let searchQuery = "Corporate";
    try {
      const body = await req.json();
      if (body?.searchQuery) searchQuery = body.searchQuery;
    } catch {}

    // Get Reddit access token
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${redditClientId}:${redditClientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "DayforceListener/1.0",
      },
      body: "grant_type=client_credentials",
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("Failed to get Reddit access token");

    // Get monitored subreddits
    const { data: subs } = await supabase.from("monitored_subreddits").select("name");
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ message: "No subreddits configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalNew = 0;
    const newMentionIds: string[] = [];

    for (const sub of subs) {
      // Search for company name in each subreddit
      const searchUrl = `https://oauth.reddit.com/r/${sub.name}/search?q=${encodeURIComponent(searchQuery)}&restrict_sr=on&sort=new&limit=100&type=comment,link`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": "DayforceListener/1.0",
        },
      });
      const searchData = await searchRes.json();

      const children = searchData?.data?.children || [];

      for (const child of children) {
        const d = child.data;
        const redditId = d.name || d.id;
        const isComment = child.kind === "t1";

        const mention = {
          reddit_id: redditId,
          type: isComment ? "comment" : "post",
          title: isComment ? null : (d.title || null),
          content: isComment ? (d.body || "") : (d.selftext || d.title || ""),
          author: d.author || "[deleted]",
          subreddit: d.subreddit || sub.name,
          permalink: d.permalink || "",
          score: d.score || 0,
          created_utc: new Date((d.created_utc || 0) * 1000).toISOString(),
        };

        const { data: inserted, error } = await supabase
          .from("reddit_mentions")
          .upsert(mention, { onConflict: "reddit_id", ignoreDuplicates: true })
          .select("id")
          .single();

        if (inserted) {
          totalNew++;
          newMentionIds.push(inserted.id);
        }
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
