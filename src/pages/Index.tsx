import { useMemo } from "react";
import { format, subDays, startOfDay, isAfter } from "date-fns";
import { useCompanyName } from "@/hooks/use-company-name";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMentions } from "@/hooks/use-mentions";
import { SentimentBadge } from "@/components/SentimentBadge";
import { AppLayout } from "@/components/AppLayout";
import { ExternalLink, TrendingUp, MessageSquare, BarChart3, PieChart } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RPieChart, Pie, Cell,
} from "recharts";

const SENTIMENT_COLORS = {
  positive: "hsl(142, 71%, 45%)",
  negative: "hsl(0, 72%, 51%)",
  neutral: "hsl(220, 10%, 54%)",
};

export default function Dashboard() {
  const { data: mentions = [], isLoading } = useMentions();
  const { companyName } = useCompanyName();

  const stats = useMemo(() => {
    const total = mentions.length;
    const positive = mentions.filter((m) => m.sentiment === "positive").length;
    const negative = mentions.filter((m) => m.sentiment === "negative").length;
    const neutral = mentions.filter((m) => m.sentiment === "neutral").length;
    const weekAgo = subDays(new Date(), 7);
    const thisWeek = mentions.filter((m) => isAfter(new Date(m.created_utc), weekAgo)).length;
    return { total, positive, negative, neutral, thisWeek };
  }, [mentions]);

  const timelineData = useMemo(() => {
    const days = 30;
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM dd");
      buckets[d] = 0;
    }
    mentions.forEach((m) => {
      const key = format(new Date(m.created_utc), "MMM dd");
      if (key in buckets) buckets[key]++;
    });
    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
  }, [mentions]);

  const sentimentPie = useMemo(() => [
    { name: "Positive", value: stats.positive, color: SENTIMENT_COLORS.positive },
    { name: "Negative", value: stats.negative, color: SENTIMENT_COLORS.negative },
    { name: "Neutral", value: stats.neutral, color: SENTIMENT_COLORS.neutral },
  ], [stats]);

  const weeklyBarData = useMemo(() => {
    const days = 7;
    const buckets: Record<string, { positive: number; negative: number; neutral: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "EEE");
      buckets[d] = { positive: 0, negative: 0, neutral: 0 };
    }
    const weekAgo = startOfDay(subDays(new Date(), 7));
    mentions
      .filter((m) => isAfter(new Date(m.created_utc), weekAgo))
      .forEach((m) => {
        const key = format(new Date(m.created_utc), "EEE");
        if (key in buckets && m.sentiment) {
          buckets[key][m.sentiment as keyof typeof buckets[string]]++;
        }
      });
    return Object.entries(buckets).map(([day, counts]) => ({ day, ...counts }));
  }, [mentions]);

  const recentMentions = mentions.slice(0, 8);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="font-mono text-sm text-muted-foreground animate-pulse">Loading data...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-lg font-mono font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs font-mono text-muted-foreground">{companyName} Reddit mention analytics</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Total Mentions" value={stats.total} icon={MessageSquare} />
          <StatCard label="This Week" value={stats.thisWeek} icon={TrendingUp} />
          <StatCard label="Positive" value={stats.positive} className="text-sentiment-positive" />
          <StatCard label="Negative" value={stats.negative} className="text-sentiment-negative" />
          <StatCard label="Neutral" value={stats.neutral} className="text-sentiment-neutral" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Mentions over time */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-xs font-mono flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                Mentions Over Time (30d)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 87%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: "monospace" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fontFamily: "monospace" }} width={30} />
                  <Tooltip contentStyle={{ fontSize: 11, fontFamily: "monospace" }} />
                  <Area type="monotone" dataKey="count" stroke="hsl(220, 70%, 50%)" fill="hsl(220, 70%, 50%)" fillOpacity={0.15} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sentiment Distribution */}
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-xs font-mono flex items-center gap-2">
                <PieChart className="h-3.5 w-3.5 text-muted-foreground" />
                Sentiment Split
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pb-3">
              <ResponsiveContainer width="100%" height={140}>
                <RPieChart>
                  <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={2}>
                    {sentimentPie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, fontFamily: "monospace" }} />
                </RPieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-[10px] font-mono mt-1">
                {sentimentPie.map((s) => (
                  <div key={s.name} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name} ({s.value})
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Stacked Bar */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-xs font-mono">This Week by Sentiment</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 87%)" />
                <XAxis dataKey="day" tick={{ fontSize: 9, fontFamily: "monospace" }} />
                <YAxis tick={{ fontSize: 9, fontFamily: "monospace" }} width={24} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "monospace" }} />
                <Bar dataKey="positive" stackId="a" fill={SENTIMENT_COLORS.positive} />
                <Bar dataKey="negative" stackId="a" fill={SENTIMENT_COLORS.negative} />
                <Bar dataKey="neutral" stackId="a" fill={SENTIMENT_COLORS.neutral} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Mentions Feed */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-xs font-mono">Recent Mentions</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {recentMentions.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground py-4 text-center">No mentions yet. Trigger a fetch from Settings.</p>
            ) : (
              <div className="space-y-2">
                {recentMentions.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 p-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground">r/{m.subreddit}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">·</span>
                        <span className="text-[10px] font-mono text-muted-foreground">u/{m.author}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">·</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{format(new Date(m.created_utc), "MMM dd, yyyy")}</span>
                        <SentimentBadge sentiment={m.sentiment as any} />
                      </div>
                      <p className="text-xs font-mono leading-relaxed line-clamp-2">{m.content}</p>
                    </div>
                    <a
                      href={`https://reddit.com${m.permalink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
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

function StatCard({ label, value, icon: Icon, className }: { label: string; value: number; icon?: any; className?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <p className={`text-2xl font-mono font-bold tabular-nums ${className || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
