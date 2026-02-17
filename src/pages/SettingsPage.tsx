import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSubreddits } from "@/hooks/use-mentions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Loader2, Zap } from "lucide-react";

export default function SettingsPage() {
  const { data: subreddits = [], isLoading } = useSubreddits();
  const [newSub, setNewSub] = useState("");
  const [fetching, setFetching] = useState(false);
  const queryClient = useQueryClient();

  const addSubreddit = async () => {
    const name = newSub.trim().replace(/^r\//, "");
    if (!name) return;
    const { error } = await supabase.from("monitored_subreddits").insert({ name });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewSub("");
      queryClient.invalidateQueries({ queryKey: ["monitored-subreddits"] });
    }
  };

  const removeSubreddit = async (id: string) => {
    const { error } = await supabase.from("monitored_subreddits").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["monitored-subreddits"] });
    }
  };

  const triggerFetch = async () => {
    setFetching(true);
    try {
      const { error } = await supabase.functions.invoke("fetch-reddit-mentions");
      if (error) throw error;
      toast({ title: "Fetch complete", description: "New mentions fetched and sentiment analyzed." });
      queryClient.invalidateQueries({ queryKey: ["reddit-mentions"] });
    } catch (e: any) {
      toast({ title: "Fetch failed", description: e.message, variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-lg font-mono font-bold tracking-tight">Settings</h1>
          <p className="text-xs font-mono text-muted-foreground">Manage subreddits and fetch data</p>
        </div>

        {/* Manual Fetch */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-xs font-mono">Manual Fetch</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xs font-mono text-muted-foreground mb-3">
              Trigger an on-demand fetch of new Dayforce mentions from all monitored subreddits.
            </p>
            <Button onClick={triggerFetch} disabled={fetching} size="sm" className="font-mono text-xs">
              {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
              {fetching ? "Fetching..." : "Fetch Now"}
            </Button>
          </CardContent>
        </Card>

        {/* Monitored Subreddits */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-xs font-mono">Monitored Subreddits</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="subreddit name (e.g. payroll)"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubreddit()}
                className="h-8 text-xs font-mono flex-1"
              />
              <Button onClick={addSubreddit} size="sm" variant="outline" className="font-mono text-xs h-8">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
            {isLoading ? (
              <p className="text-xs font-mono text-muted-foreground animate-pulse">Loading...</p>
            ) : (
              <div className="space-y-1">
                {subreddits.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                    <span className="text-xs font-mono">r/{s.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeSubreddit(s.id)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
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
