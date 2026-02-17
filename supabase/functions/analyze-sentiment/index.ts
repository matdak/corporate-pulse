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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { mentionIds, companyName = "Corporate" } = await req.json();

    if (!mentionIds || mentionIds.length === 0) {
      // If no specific IDs, analyze all unanalyzed mentions
      const { data: unanalyzed } = await supabase
        .from("reddit_mentions")
        .select("id, content")
        .is("sentiment", null)
        .limit(50);

      if (!unanalyzed || unanalyzed.length === 0) {
        return new Response(JSON.stringify({ message: "No mentions to analyze" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await analyzeBatch(supabase, unanalyzed, lovableApiKey, companyName);
      return new Response(JSON.stringify({ message: `Analyzed ${unanalyzed.length} mentions` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch specified mentions
    const { data: mentions } = await supabase
      .from("reddit_mentions")
      .select("id, content")
      .in("id", mentionIds);

    if (mentions && mentions.length > 0) {
      await analyzeBatch(supabase, mentions, lovableApiKey, companyName);
    }

    return new Response(JSON.stringify({ message: `Analyzed ${mentions?.length || 0} mentions` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-sentiment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function analyzeBatch(
  supabase: any,
  mentions: { id: string; content: string }[],
  apiKey: string,
  companyName: string
) {
  // Process in batches of 10 to avoid rate limits
  for (let i = 0; i < mentions.length; i += 10) {
    const batch = mentions.slice(i, i + 10);

    const promises = batch.map(async (mention) => {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are a sentiment analysis tool. Classify the sentiment of Reddit comments about the company/product '${companyName}'.`
              },
              {
                role: "user",
                content: `Classify the sentiment of this Reddit comment about ${companyName}:\n\n"${mention.content.slice(0, 1000)}"`
              }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "classify_sentiment",
                  description: `Classify the sentiment of a Reddit comment about ${companyName}`,
                  parameters: {
                    type: "object",
                    properties: {
                      sentiment: {
                        type: "string",
                        enum: ["positive", "negative", "neutral"],
                        description: `The sentiment of the comment toward ${companyName}`
                      }
                    },
                    required: ["sentiment"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "classify_sentiment" } }
          }),
        });

        if (response.status === 429) {
          console.warn("Rate limited, waiting 5s...");
          await new Promise(r => setTimeout(r, 5000));
          return;
        }

        if (!response.ok) {
          console.error(`AI error for ${mention.id}: ${response.status}`);
          return;
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const args = JSON.parse(toolCall.function.arguments);
          await supabase
            .from("reddit_mentions")
            .update({ sentiment: args.sentiment })
            .eq("id", mention.id);
        }
      } catch (e) {
        console.error(`Error analyzing mention ${mention.id}:`, e);
      }
    });

    await Promise.all(promises);

    // Small delay between batches
    if (i + 10 < mentions.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
