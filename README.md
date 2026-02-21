# Corporate Pulse

A Reddit social listening dashboard that tracks and analyzes how your company is being discussed online.

## What it does

Corporate Pulse monitors Reddit for mentions of your company and surfaces them in a clean analytics interface. It classifies each mention by sentiment (positive, negative, neutral) and lets you explore trends over time, drill into specific subreddits, and export data for further analysis.

**Dashboard** — at a glance view of mention volume and sentiment distribution across any date range, with charts for trends over time, weekly sentiment breakdowns, and a live feed of recent mentions.

**Mentions** — full list of every Reddit post or comment, searchable and filterable by sentiment or subreddit. Expandable rows show author, score, and timestamp. Exportable to CSV.

**Company name** — configurable in-app, stored locally. No account needed.

## Stack

- React + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Recharts
- Supabase (Postgres)
- TanStack Query

## Getting started

```sh
git clone <repo-url>
cd corporate-pulse
npm install
npm run dev
```

The app expects a Supabase project with two tables: `reddit_mentions` and `monitored_subreddits`. Supabase connection details go in your `.env` file:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Running tests

```sh
npm test
```
