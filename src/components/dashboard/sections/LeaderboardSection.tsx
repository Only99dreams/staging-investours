import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Crown, Sparkles, Loader2, User, Users, Target, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface TutorLeaderboardEntry {
  user_id: string;
  xp_total: number;
  level: string;
  streak_days: number;
  badges: any;
  full_name: string | null;
  email: string | null;
  funding_readiness_score: number;
  plans_count: number;
}

interface ReferralLeaderboardEntry {
  user_id: string;
  full_name: string | null;
  referral_count: number;
  total_earnings: number;
  rank: number;
}

interface Edition {
  id: string;
  name: string;
  status: string;
  started_at: string;
}

const levelColors: Record<string, string> = {
  beginner: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  intermediate: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  advanced: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

function getFundingColor(score: number) {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-orange-500";
  return "text-muted-foreground";
}

function FundingScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : score >= 40 ? "bg-orange-500" : "bg-muted";
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
      <motion.div
        className={cn("h-full rounded-full", color)}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="w-5 h-5 text-amber-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-300" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
}

function getDisplayName(entry: TutorLeaderboardEntry) {
  if (entry.full_name?.trim()) return entry.full_name.trim();
  if (entry.email) return entry.email.split("@")[0];
  return "Anonymous";
}

function initials(entry: TutorLeaderboardEntry) {
  return getDisplayName(entry).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function TutorLeaderboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TutorLeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeEdition, setActiveEdition] = useState<Edition | null>(null);

  const fetchLeaderboard = async () => {
    try {
      const [{ data: lb }, { data: edition }] = await Promise.all([
        supabase.rpc("get_tutor_leaderboard"),
        supabase
          .from("ai_challenge_editions")
          .select("id,name,status,started_at")
          .eq("status", "active")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const typed = (lb || []) as TutorLeaderboardEntry[];
      setEntries(typed);
      setActiveEdition(edition ?? null);
      const idx = typed.findIndex(e => e.user_id === user?.id);
      setMyRank(idx >= 0 ? idx + 1 : null);
    } catch (err) {
      console.error("Leaderboard fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const channel = supabase
      .channel("tutor-leaderboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tutor_user_levels" }, fetchLeaderboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_plans" }, fetchLeaderboard)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              AI Challenge Leaderboard
            </CardTitle>
            <CardDescription className="mt-1">
              Ranked by Business Plan Funding Readiness Score · XP as tiebreaker
            </CardDescription>
          </div>
          {activeEdition && (
            <Badge variant="outline" className="text-xs border-primary/30 text-primary shrink-0">
              {activeEdition.name}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Target className="w-3 h-3 text-green-500" /> Funding Score (primary)</span>
          <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber-400" /> XP Points (tiebreaker)</span>
          <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Plans submitted</span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No participants yet. Generate a business plan to enter!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = user?.id === entry.user_id;
              const name = getDisplayName(entry);
              const isTop3 = rank <= 3;
              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                    isCurrentUser
                      ? "bg-primary/5 border-primary/30"
                      : isTop3
                      ? "bg-amber-500/5 border-amber-500/20"
                      : "bg-card border-border hover:border-muted-foreground/20"
                  )}
                >
                  <div className="w-8 flex items-center justify-center flex-shrink-0">
                    {getRankIcon(rank)}
                  </div>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                    isTop3 ? "bg-amber-500/20 text-amber-600" : "bg-muted text-muted-foreground"
                  )}>
                    {entry.full_name ? initials(entry) : <User className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium truncate text-sm", isCurrentUser && "text-primary")}>
                      {name}{isCurrentUser && " (You)"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className={cn("text-xs border-0 px-1.5 py-0", levelColors[entry.level] || "bg-muted text-muted-foreground")}>
                        {entry.level}
                      </Badge>
                      {entry.streak_days > 0 && (
                        <span className="text-xs text-muted-foreground">🔥 {entry.streak_days}d</span>
                      )}
                      {entry.plans_count > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <FileText className="w-3 h-3" />{entry.plans_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 min-w-[90px]">
                    <div className="flex items-center justify-end gap-1">
                      <Target className={cn("w-3.5 h-3.5", getFundingColor(entry.funding_readiness_score))} />
                      <span className={cn("text-lg font-bold leading-none", getFundingColor(entry.funding_readiness_score))}>
                        {entry.funding_readiness_score}
                        <span className="text-xs font-normal text-muted-foreground">/100</span>
                      </span>
                    </div>
                    <FundingScoreBar score={entry.funding_readiness_score} />
                    <p className="text-xs text-muted-foreground mt-1">
                      <Sparkles className="w-2.5 h-2.5 inline mr-0.5 text-amber-400" />
                      {entry.xp_total.toLocaleString()} XP
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        {myRank && (
          <p className="text-xs text-center text-muted-foreground mt-4">
            Your rank: <span className="font-semibold text-primary">#{myRank}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReferralLeaderboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ReferralLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase.rpc("get_referral_leaderboard");
      if (error) {
        console.error("Error fetching referral leaderboard:", error);
        return;
      }
      setEntries((data || []) as ReferralLeaderboardEntry[]);
    } catch (err) {
      console.error("Referral leaderboard fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const channel = supabase
      .channel("referral-leaderboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "referral_stats" }, () => fetchLeaderboard())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Top Followers
        </CardTitle>
        <CardDescription>Ranked by number of followers</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No followers yet. Share your link to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = user?.id === entry.user_id;
              const displayName = entry.full_name?.trim() || "Anonymous User";
              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-xl border transition-colors",
                    isCurrentUser ? "bg-primary/5 border-primary/30" : "bg-card border-border hover:border-muted-foreground/20"
                  )}
                >
                  <div className="w-8 text-center font-bold text-sm text-muted-foreground">
                    {rank <= 3 ? (
                      rank === 1 ? <Crown className="w-5 h-5 text-amber-400 mx-auto" /> :
                      rank === 2 ? <Medal className="w-5 h-5 text-slate-300 mx-auto" /> :
                      <Medal className="w-5 h-5 text-amber-600 mx-auto" />
                    ) : <span>#{rank}</span>}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    {displayName !== "Anonymous User" ? (
                      <span className="text-xs font-bold text-muted-foreground">
                        {displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium truncate", isCurrentUser && "text-primary")}>
                      {displayName}{isCurrentUser && " (You)"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-foreground">{entry.referral_count} follower{entry.referral_count !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">₦{entry.total_earnings.toLocaleString()} earned</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LeaderboardSection() {
  const { profile } = useAuth();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Investours AI Challenge</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Compete on Funding Readiness Score · XP Points · Referrals
          </p>
        </div>
        {profile && (
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 shrink-0">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Your XP</p>
                <p className="text-base font-bold">{profile.ai_tutor_used || 0} XP</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="challenge">
        <TabsList className="w-full">
          <TabsTrigger value="challenge" className="flex-1">
            <Trophy className="w-4 h-4 mr-2" />
            AI Challenge
          </TabsTrigger>
          <TabsTrigger value="referral" className="flex-1">
            <Users className="w-4 h-4 mr-2" />
            Referral
          </TabsTrigger>
        </TabsList>
        <TabsContent value="challenge" className="mt-4">
          <TutorLeaderboard />
        </TabsContent>
        <TabsContent value="referral" className="mt-4">
          <ReferralLeaderboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}