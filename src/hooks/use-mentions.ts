import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RedditMention = {
  id: string;
  reddit_id: string;
  type: string;
  title: string | null;
  content: string;
  author: string;
  subreddit: string;
  permalink: string;
  score: number | null;
  created_utc: string;
  fetched_at: string;
  sentiment: string | null;
};

export function useMentions() {
  return useQuery({
    queryKey: ["reddit-mentions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reddit_mentions")
        .select("*")
        .order("created_utc", { ascending: false });
      if (error) throw error;
      return data as RedditMention[];
    },
  });
}

export function useSubreddits() {
  return useQuery({
    queryKey: ["monitored-subreddits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitored_subreddits")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}
