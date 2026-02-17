

# Switch Reddit Data Fetching to Steel Scraping

## Why
Reddit's public API access takes 7+ days to approve and may be denied. Steel (your buddies' headless browser API) provides a `/v1/scrape` REST endpoint that can extract page content from any URL -- including Reddit search pages -- without needing API credentials from Reddit.

## Approach
Replace the Reddit API calls in the `fetch-reddit-mentions` edge function with Steel's simple REST scrape API. Steel will render Reddit search pages and return the HTML, which we then parse to extract posts and comments.

### How Steel Works
Steel exposes a straightforward REST endpoint:
```
POST https://api.steel.dev/v1/scrape
Headers: { "steel-api-key": "YOUR_KEY", "Content-Type": "application/json" }
Body: { "url": "https://www.reddit.com/r/jobs/search/?q=Corporate&sort=new", "delay": 2000 }
```
It returns rendered HTML content which we parse server-side.

## What Changes

### 1. Add Steel API Key as a secret
- You'll need to provide your `STEEL_API_KEY` (from steel.dev dashboard)

### 2. Rewrite `fetch-reddit-mentions` edge function
- Remove all Reddit OAuth token logic (client ID/secret no longer needed)
- For each monitored subreddit, use Steel to scrape `reddit.com/r/{sub}/search?q={companyName}&sort=new`
- Parse the returned HTML to extract post/comment data (title, author, subreddit, permalink, score, content, timestamp)
- Reddit's search results page renders posts with predictable HTML structure that we can parse with regex or DOM parsing
- Keep the existing deduplication and sentiment trigger logic unchanged

### 3. Fallback strategy
- Use Reddit's old.reddit.com interface for scraping (simpler, more consistent HTML structure)
- Also scrape Reddit's JSON endpoints as a first attempt: `old.reddit.com/r/{sub}/search.json?q={query}&sort=new` -- Reddit exposes public JSON without authentication on old.reddit.com
- If JSON works, skip HTML parsing entirely; if blocked, fall back to Steel HTML scraping

### 4. No frontend changes needed
- The data schema stays the same
- Dashboard, mentions list, and settings all work as-is

## Technical Details

### Edge function changes (`supabase/functions/fetch-reddit-mentions/index.ts`)

**Remove:**
- `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` env vars
- Reddit OAuth token flow
- Reddit API calls

**Add:**
- `STEEL_API_KEY` env var
- Primary path: try Reddit's public JSON endpoint (`old.reddit.com/r/{sub}/search.json?q={query}&sort=new&limit=100`) with a standard User-Agent via Steel scrape
- Fallback path: if JSON is blocked, scrape the HTML page via Steel and parse results
- Parse each result into the same `reddit_mentions` shape (reddit_id, type, title, content, author, subreddit, permalink, score, created_utc)

### Scraping flow per subreddit:
1. Call Steel `/v1/scrape` with URL `https://old.reddit.com/r/{sub}/search.json?q={query}&sort=new&limit=100`
2. Steel returns the page content -- since it's a `.json` URL, the content will be the raw JSON
3. Parse the JSON the same way we currently parse Reddit API responses (same `data.children` structure)
4. If this fails or gets rate-limited, fall back to scraping the HTML search page
5. Upsert results and trigger sentiment analysis (unchanged)

### Rate limiting
- Add a 2-3 second delay between subreddit scrapes to be respectful
- Steel handles anti-bot/rendering challenges automatically

