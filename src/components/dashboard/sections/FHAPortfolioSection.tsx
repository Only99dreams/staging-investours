import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, TrendingUp, Briefcase, User } from "lucide-react";

// Audit credit pack durations map to subscription_type values
const AUDIT_DURATIONS = [
  { label: "30 Days", key: "audit_30" },
  { label: "90 Days", key: "audit_90" },
  { label: "360 Days", key: "audit_360" },
];

const SUB_PLANS = [
  { label: "Monthly", key: "monthly" },
  { label: "Quarterly", key: "quarterly" },
  { label: "Bi-annual", key: "biannual" },
  { label: "Annual", key: "annual" },
];

interface BreakdownRow {
  label: string;
  key: string;
  users: number;
  earned: number;
}

interface CardData {
  rows: BreakdownRow[];
  total: number;
}

interface PortfolioData {
  auditIndividual: CardData;
  auditBusiness: CardData;
  subIndividual: CardData;
  subBusiness: CardData;
}

function fmt(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DualBox({ label, users, earned }: { label: string; users: number; earned: number }) {
  return (
    <div className="flex gap-2">
      <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-bold text-primary">{users}</p>
        <p className="text-xs text-muted-foreground">Active Users</p>
      </div>
      <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">Amount Earned</p>
        <p className="text-sm font-bold text-green-600">{fmt(earned)}</p>
        <p className="text-xs text-muted-foreground">Commission</p>
      </div>
    </div>
  );
}

function PortfolioCard({
  title,
  icon: Icon,
  rows,
  total,
}: {
  title: string;
  icon: React.ElementType;
  rows: BreakdownRow[];
  total: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <DualBox key={row.key} label={row.label} users={row.users} earned={row.earned} />
        ))}
        <div className="border-t pt-3 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Total Amount Earned</span>
          <span className="text-base font-bold text-green-600">{fmt(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function FHAPortfolioSection() {
  const { user } = useAuth();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchPortfolio();
  }, [user]);

  async function fetchPortfolio() {
    setLoading(true);
    try {
      // Fetch all commission transactions for this user from wallet_transactions
      // joined via wallets table, with narration containing referral info
      const { data: wallet } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!wallet) {
        setData(buildEmpty());
        return;
      }

      // Get all credit transactions (commissions) for this wallet
      const { data: txns } = await supabase
        .from("wallet_transactions")
        .select("amount, narration, source, created_at")
        .eq("wallet_id", wallet.id)
        .eq("transaction_type", "credit")
        .ilike("narration", "%commission%");

      // Get referred users' profiles to determine user_type and subscription_type
      const { data: referredProfiles } = await supabase
        .from("profiles")
        .select("id, user_type, subscription_type")
        .eq("referred_by", user!.id);

      const profileMap: Record<string, { user_type: string | null; subscription_type: string | null }> = {};
      (referredProfiles || []).forEach((p) => {
        profileMap[p.id] = { user_type: p.user_type, subscription_type: p.subscription_type };
      });

      // Parse transactions — narration format: "X% referral commission from <user_id> subscription"
      // We'll aggregate by matching actor_id in transactions against profileMap
      const { data: txnsWithActor } = await supabase
        .from("wallet_transactions")
        .select("amount, narration, source, actor_id, created_at")
        .eq("wallet_id", wallet.id)
        .eq("transaction_type", "credit")
        .ilike("narration", "%commission%");

      const result = buildEmpty();

      (txnsWithActor || []).forEach((tx) => {
        const actorId = tx.actor_id;
        const profile = actorId ? profileMap[actorId] : null;
        const userType = profile?.user_type ?? "individual";
        const subType = profile?.subscription_type ?? "";
        const amount = tx.amount ?? 0;

        const isIndividual = userType === "individual";
        const isBusiness = userType === "group" || userType === "firm";

        // Determine if audit pack or subscription
        const narration = (tx.narration ?? "").toLowerCase();
        const isAudit = narration.includes("audit") || subType.startsWith("audit_");
        const auditKey = subType.startsWith("audit_") ? subType : null;
        const subKey = !isAudit ? subType : null;

        if (isAudit && auditKey) {
          const target = isIndividual ? result.auditIndividual : result.auditBusiness;
          const row = target.rows.find((r) => r.key === auditKey);
          if (row) { row.earned += amount; row.users += 1; }
          target.total += amount;
        } else if (!isAudit && subKey) {
          const target = isIndividual ? result.subIndividual : result.subBusiness;
          const row = target.rows.find((r) => r.key === subKey);
          if (row) { row.earned += amount; row.users += 1; }
          target.total += amount;
        } else {
          // Fallback: treat as subscription individual
          const target = isIndividual ? result.subIndividual : result.subBusiness;
          target.total += amount;
        }
      });

      setData(result);
    } catch (e) {
      console.error(e);
      setData(buildEmpty());
    } finally {
      setLoading(false);
    }
  }

  function buildEmpty(): PortfolioData {
    return {
      auditIndividual: {
        rows: AUDIT_DURATIONS.map((d) => ({ ...d, users: 0, earned: 0 })),
        total: 0,
      },
      auditBusiness: {
        rows: AUDIT_DURATIONS.map((d) => ({ ...d, users: 0, earned: 0 })),
        total: 0,
      },
      subIndividual: {
        rows: SUB_PLANS.map((p) => ({ ...p, users: 0, earned: 0 })),
        total: 0,
      },
      subBusiness: {
        rows: SUB_PLANS.map((p) => ({ ...p, users: 0, earned: 0 })),
        total: 0,
      },
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalIndividuals = (data?.auditIndividual.total ?? 0) + (data?.subIndividual.total ?? 0);
  const totalBusinesses = (data?.auditBusiness.total ?? 0) + (data?.subBusiness.total ?? 0);
  const portfolioValue = totalIndividuals + totalBusinesses;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">FHA Portfolio</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Track your referred users' active plans and commissions earned across all categories.
        </p>
      </div>

      {/* 4 Portfolio Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PortfolioCard
          title="Audit Credit Pack Users — Individuals"
          icon={User}
          rows={data!.auditIndividual.rows}
          total={data!.auditIndividual.total}
        />
        <PortfolioCard
          title="Audit Credit Pack Users — Businesses"
          icon={Briefcase}
          rows={data!.auditBusiness.rows}
          total={data!.auditBusiness.total}
        />
        <PortfolioCard
          title="Active Subscribers — Individuals"
          icon={Users}
          rows={data!.subIndividual.rows}
          total={data!.subIndividual.total}
        />
        <PortfolioCard
          title="Active Subscribers — Businesses"
          icon={Briefcase}
          rows={data!.subBusiness.rows}
          total={data!.subBusiness.total}
        />
      </div>

      {/* Summary Totals */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" />
            Portfolio Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-background rounded-lg p-4 text-center border">
              <p className="text-xs text-muted-foreground mb-1">Total Earned from Individuals</p>
              <p className="text-xl font-bold text-primary">{fmt(totalIndividuals)}</p>
            </div>
            <div className="bg-background rounded-lg p-4 text-center border">
              <p className="text-xs text-muted-foreground mb-1">Total Earned from Businesses</p>
              <p className="text-xl font-bold text-primary">{fmt(totalBusinesses)}</p>
            </div>
            <div className="bg-background rounded-lg p-4 text-center border border-primary/40 bg-primary/10">
              <p className="text-xs text-muted-foreground mb-1">Current Portfolio Value</p>
              <p className="text-xl font-bold text-green-600">{fmt(portfolioValue)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Portfolio value determines eligibility for the Quarterly Reward programme.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
