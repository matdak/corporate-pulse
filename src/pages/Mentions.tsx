import { useState, useMemo } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { SentimentBadge } from "@/components/SentimentBadge";
import { useMentions, useSubreddits } from "@/hooks/use-mentions";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { useDateFilter, DateRangeFilter } from "@/components/DateRangeFilter";

export default function Mentions() {
  const { data: mentions = [], isLoading } = useMentions();
  const { data: subreddits = [] } = useSubreddits();
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [subredditFilter, setSubredditFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { startDate, setStartDate, endDate, setEndDate, filterByDate } = useDateFilter();

  const filtered = useMemo(() => {
    const dateFiltered = filterByDate(mentions);
    return dateFiltered.filter((m) => {
      if (sentimentFilter !== "all" && m.sentiment !== sentimentFilter) return false;
      if (subredditFilter !== "all" && m.subreddit !== subredditFilter) return false;
      if (search && !m.content.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [mentions, sentimentFilter, subredditFilter, search, filterByDate]);

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-lg font-mono font-bold tracking-tight">Mentions</h1>
          <p className="text-xs font-mono text-muted-foreground">{filtered.length} results</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 h-8 text-xs font-mono"
          />
          <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
            <SelectTrigger className="w-32 h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-mono">All Sentiment</SelectItem>
              <SelectItem value="positive" className="text-xs font-mono">Positive</SelectItem>
              <SelectItem value="negative" className="text-xs font-mono">Negative</SelectItem>
              <SelectItem value="neutral" className="text-xs font-mono">Neutral</SelectItem>
            </SelectContent>
          </Select>
          <Select value={subredditFilter} onValueChange={setSubredditFilter}>
            <SelectTrigger className="w-40 h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-mono">All Subreddits</SelectItem>
              {subreddits.map((s) => (
                <SelectItem key={s.id} value={s.name} className="text-xs font-mono">r/{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        </div>

        {/* Mentions List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-xs font-mono text-muted-foreground p-6 text-center animate-pulse">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground p-6 text-center">No mentions found.</p>
            ) : (
              <div className="divide-y">
                {filtered.map((m) => (
                  <div key={m.id}>
                    <button
                      onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                      className="w-full text-left p-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
                    >
                      {expandedId === m.id ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono line-clamp-1">{m.content}</p>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">r/{m.subreddit}</span>
                      <SentimentBadge sentiment={m.sentiment as any} />
                      <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0 tabular-nums">
                        {format(new Date(m.created_utc), "MMM dd")}
                      </span>
                      <a
                        href={`https://reddit.com${m.permalink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </button>
                    {expandedId === m.id && (
                      <div className="px-10 pb-3 space-y-1">
                        <p className="text-xs font-mono leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        <div className="flex gap-3 text-[10px] font-mono text-muted-foreground pt-1">
                          <span>u/{m.author}</span>
                          <span>Score: {m.score ?? "—"}</span>
                          <span>{format(new Date(m.created_utc), "MMM dd, yyyy HH:mm")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
