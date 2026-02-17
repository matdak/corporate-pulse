
-- Create monitored_subreddits table
CREATE TABLE public.monitored_subreddits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.monitored_subreddits ENABLE ROW LEVEL SECURITY;

-- Public read/write since this is an internal tool, no auth required
CREATE POLICY "Allow all access to monitored_subreddits"
  ON public.monitored_subreddits FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed default subreddits
INSERT INTO public.monitored_subreddits (name) VALUES ('jobs'), ('hcm'), ('humanresources');

-- Create reddit_mentions table
CREATE TABLE public.reddit_mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reddit_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'comment', -- 'comment' or 'post'
  title TEXT,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  subreddit TEXT NOT NULL,
  permalink TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  created_utc TIMESTAMP WITH TIME ZONE NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral'))
);

ALTER TABLE public.reddit_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to reddit_mentions"
  ON public.reddit_mentions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for deduplication and queries
CREATE INDEX idx_reddit_mentions_reddit_id ON public.reddit_mentions (reddit_id);
CREATE INDEX idx_reddit_mentions_subreddit ON public.reddit_mentions (subreddit);
CREATE INDEX idx_reddit_mentions_sentiment ON public.reddit_mentions (sentiment);
CREATE INDEX idx_reddit_mentions_created_utc ON public.reddit_mentions (created_utc);
