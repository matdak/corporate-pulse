import { cn } from "@/lib/utils";

type Sentiment = "positive" | "negative" | "neutral" | null;

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  if (!sentiment) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted text-muted-foreground">
        PENDING
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase",
        sentiment === "positive" && "bg-sentiment-positive/15 text-sentiment-positive",
        sentiment === "negative" && "bg-sentiment-negative/15 text-sentiment-negative",
        sentiment === "neutral" && "bg-sentiment-neutral/15 text-sentiment-neutral"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          sentiment === "positive" && "bg-sentiment-positive",
          sentiment === "negative" && "bg-sentiment-negative",
          sentiment === "neutral" && "bg-sentiment-neutral"
        )}
      />
      {sentiment}
    </span>
  );
}
