import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Check, Users, MousePointer, Crown, TrendingUp,
  Eye, EyeOff, Link2, UserPlus, ArrowRight, RefreshCw, Network,
} from "lucide-react";

function fmt(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReferralsSection() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [followers, setFollowers] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [showReferralCode, setShowReferralCode] = useState(false);
  const [directFirstEarned, setDirectFirstEarned] = useState(0);
  const [renewalEarned, setRenewalEarned] = useState(0);
  const [indirectEarned, setIndirectEarned] = useState(0);

  const referralLink = `${window.location.origin}/signup?ref=${profile?.referral_code}`;

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  async function fetchData() {
    const [{ data: statsData }, { data: followersData }, { data: walletData }] = await Promise.all([
      supabase.from("referral_stats").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("profiles").select("id, full_name, user_tier, created_at").eq("referred_by", user!.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("wallets").select("id").eq("user_id", user!.id).single(),
    ]);

    setStats(statsData);
    setFollowers(followersData || []);

    if (walletData?.id) {
      const { data: txns } = await supabase
        .from("wallet_transactions")
        .select("amount, narration")
        .eq("wallet_id", walletData.id)
        .eq("transaction_type", "credit")
        .ilike("narration", "%commission%");

      let first = 0, renewal = 0, indirect = 0;
      (txns || []).forEach((tx) => {
        const n = (tx.narration ?? "").toLowerCase();
        const amt = tx.amount ?? 0;
        if (n.includes("indirect") || n.includes("2%")) indirect += amt;
        else if (n.includes("renewal") || n.includes("15%")) renewal += amt;
        else first += amt;
      });
      setDirectFirstEarned(first);
      setRenewalEarned(renewal);
      setIndirectEarned(indirect);
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(profile?.referral_code || "");
    setCopied(true);
    toast({ title: "Copied!", description: "Referral code copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const totalEarned = directFirstEarned + renewalEarned + indirectEarned;

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Referral Link */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-1">Share Your Referral Link</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Earn commissions every time someone signs up and pays through your link.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-background/80 rounded-lg px-4 py-2 text-sm font-mono truncate">
                  {showReferralCode ? referralLink : "••••••••"}
                </div>
                <Button onClick={() => setShowReferralCode(!showReferralCode)} variant="outline" size="icon">
                  {showReferralCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {showReferralCode && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={copyLink} variant="default" size="sm" className="gap-2">
                    {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                    {copied ? "Copied" : "Copy Link"}
                  </Button>
                  <Button onClick={copyCode} variant="outline" size="sm" className="gap-2">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied" : "Copy Code"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "People Referred", value: followers.length, icon: UserPlus },
          { label: "Total Clicks", value: stats?.total_clicks || 0, icon: MousePointer },
          { label: "Converted", value: stats?.total_subscribed || 0, icon: Crown },
          { label: "Total Earned", value: fmt(totalEarned || stats?.total_earnings || 0), icon: TrendingUp },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-4 text-center">
                <s.icon className="w-5 h-5 mx-auto mb-2 text-primary" />
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Earning Structure ── */}
      <div>
        <h3 className="text-base font-semibold mb-3">How You Earn</h3>
        <div className="space-y-4">

          {/* Direct Income header */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Direct Income</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* 30% First-time */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserPlus className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">30% First-time Commission</span>
                        <Badge className="bg-primary/10 text-primary border-0 text-xs">Direct</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Earned when your referral pays for an Audit Credit Pack or Subscription for the <strong>first time</strong>. Calculated on actual pricing, VAT excluded.
                      </p>
                      {/* Illustration */}
                      <div className="bg-muted/50 rounded-lg p-3 text-xs">
                        <p className="font-medium mb-2 text-muted-foreground uppercase tracking-wide">Illustration</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-primary/10 text-primary px-2 py-1 rounded font-medium">You</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="bg-background border px-2 py-1 rounded">Refer Emma (new)</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded font-medium">You earn 30%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-primary">30%</p>
                    <p className="text-xs text-muted-foreground">rate</p>
                    {directFirstEarned > 0 && (
                      <p className="text-xs font-medium text-green-600 mt-1">{fmt(directFirstEarned)} earned</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 15% Renewal */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <RefreshCw className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">15% Recurrent Commission on Renewal</span>
                        <Badge className="bg-blue-500/10 text-blue-500 border-0 text-xs">Recurring</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Earned every time your referral <strong>repurchases</strong> an Audit Credit Pack or Subscription. Calculated on actual pricing, VAT excluded.
                      </p>
                      <div className="bg-muted/50 rounded-lg p-3 text-xs">
                        <p className="font-medium mb-2 text-muted-foreground uppercase tracking-wide">Illustration</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-background border px-2 py-1 rounded">Emma repurchases</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded font-medium">You earn 15%</span>
                        </div>
                        <p className="text-muted-foreground mt-1">This repeats every time Emma renews.</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-blue-500">15%</p>
                    <p className="text-xs text-muted-foreground">rate</p>
                    {renewalEarned > 0 && (
                      <p className="text-xs font-medium text-green-600 mt-1">{fmt(renewalEarned)} earned</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Indirect Income header */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Indirect Income</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* 2% Indirect */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Network className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">2% Bonus on Indirect Referrals & Repurchases</span>
                        <Badge className="bg-amber-500/10 text-amber-600 border-0 text-xs">Indirect</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Paid whenever people <strong>you referred</strong> onboard new users, and whenever those new users renew or repurchase. Your network keeps earning for you.
                      </p>
                      <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-2">
                        <p className="font-medium text-muted-foreground uppercase tracking-wide">Illustration</p>
                        {/* Step 1 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-primary/10 text-primary px-2 py-1 rounded font-medium">You</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="bg-background border px-2 py-1 rounded">Emma (new)</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded">You earn 30%</span>
                        </div>
                        {/* Step 2 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-background border px-2 py-1 rounded">Emma</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="bg-background border px-2 py-1 rounded">Daniel (new)</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="bg-background border px-2 py-1 rounded text-muted-foreground">Emma earns 30%</span>
                          <span className="text-muted-foreground">+</span>
                          <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded font-medium">You earn 2%</span>
                        </div>
                        {/* Step 3 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-background border px-2 py-1 rounded">Daniel renews</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="bg-background border px-2 py-1 rounded text-muted-foreground">Emma earns 15%</span>
                          <span className="text-muted-foreground">+</span>
                          <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded font-medium">You still earn 2%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-amber-500">2%</p>
                    <p className="text-xs text-muted-foreground">rate</p>
                    {indirectEarned > 0 && (
                      <p className="text-xs font-medium text-green-600 mt-1">{fmt(indirectEarned)} earned</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Earnings Summary + Followers */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader>
              <CardTitle>Earnings Breakdown</CardTitle>
              <CardDescription>Lifetime commissions from your GFE Wallet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  <span className="text-sm">First-time (30%)</span>
                </div>
                <span className="font-semibold text-primary">{fmt(directFirstEarned)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Renewals (15%)</span>
                </div>
                <span className="font-semibold text-blue-500">{fmt(renewalEarned)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-amber-500" />
                  <span className="text-sm">Indirect Bonus (2%)</span>
                </div>
                <span className="font-semibold text-amber-500">{fmt(indirectEarned)}</span>
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="font-semibold">Total Earned</span>
                <span className="text-xl font-bold text-green-600">{fmt(totalEarned)}</span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                All commissions are credited instantly to your GFE Wallet when your referral pays.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle>Recent Followers</CardTitle>
              <CardDescription>Users who signed up through your link</CardDescription>
            </CardHeader>
            <CardContent>
              {followers.length > 0 ? (
                <div className="space-y-3">
                  {followers.map((follower) => (
                    <div key={follower.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {follower.full_name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{follower.full_name || "User"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(follower.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        follower.user_tier === "exclusive" ? "default" :
                        follower.user_tier === "premium" ? "secondary" : "outline"
                      }>
                        {follower.user_tier || "free"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No followers yet</p>
                  <p className="text-sm">Share your referral link to grow your network!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
