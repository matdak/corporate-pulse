
# Dayforce Reddit Social Listening Tool

## Overview
A data-dense analytics dashboard that monitors Reddit for mentions of "Dayforce" across configurable subreddits, with AI-powered sentiment analysis, stored history, and detailed stats.

## Backend (Lovable Cloud + Supabase)

### Database
- **reddit_mentions** table — stores each Reddit comment/post with: content, author, subreddit, permalink, created date, fetched date, and AI sentiment label (positive/negative/neutral)
- **monitored_subreddits** table — configurable list of subreddits to watch (seeded with r/jobs, r/hcm, r/humanresources)

### Edge Functions
1. **fetch-reddit-mentions** — Calls the Reddit API to search for "dayforce" mentions in monitored subreddits, deduplicates against already-stored mentions, and saves new ones to the database
2. **analyze-sentiment** — Uses Lovable AI (Gemini) to classify each new mention's sentiment as positive, negative, or neutral and updates the record
3. A **weekly cron job** (pg_cron) triggers the fetch + analysis pipeline automatically

## Frontend Pages

### 1. Dashboard (Home)
- **Summary cards**: Total mentions, sentiment breakdown (positive/negative/neutral counts & percentages), mentions this week
- **Mentions over time chart** (line/area chart) — daily mention count over the last 30/90 days
- **Mentions per day bar chart** — for the current week
- **Sentiment distribution** — donut or stacked bar chart
- **Recent mentions feed** — latest mentions with sentiment badge, subreddit tag, date, and snippet; clicking opens the Reddit permalink in a new tab

### 2. Mentions List
- Filterable table of all stored mentions
- Filters: sentiment, subreddit, date range
- Each row shows: snippet, subreddit, sentiment badge, date, and a link icon to open on Reddit
- Clicking a row expands to show full comment text

### 3. Settings
- Manage monitored subreddits (add/remove)
- Trigger a manual fetch (on-demand "Fetch Now" button)

## Key Details
- Reddit API credentials will be stored as Supabase secrets
- Data is persisted — only new mentions are fetched each cycle (deduplication by Reddit post/comment ID)
- All charts built with Recharts for the data-dense dashboard feel
- Sentiment analysis via Lovable AI using structured output (tool calling) for reliable classification
