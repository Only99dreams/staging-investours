import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Wallet, Gem, Users, ArrowUpRight, ArrowDownRight, Clock, Building2,
  Info, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface WalletData {
  id: string;
  user_wallet_balance: number;
  gem_points: number;
  gfe_wallet_balance: number;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_details_locked: boolean;
}

interface WithdrawalPreview {
  gross: number;
  fee: number;
  net: number;
  fee_rate_pct: number;
}

export function WalletsSection() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [transactions, setTransactions] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: "", bank_account_number: "", bank_account_name: "" });

  const [isWithdrawalDialogOpen, setIsWithdrawalDialogOpen] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({ amount: "", wallet_type: "user_wallet" });
  const [preview, setPreview] = useState<WithdrawalPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { if (user) fetchAll(); }, [user]);

  // Live fee preview as user types
  useEffect(() => {
    const amount = parseFloat(withdrawalForm.amount);
    if (!isNaN(amount) && amount >= 5000) {
      const feeRate = profile?.user_tier === "premium" ? 0.10 : 0.15;
      const fee = Math.round(amount * feeRate * 100) / 100;
      setPreview({ gross: amount, fee, net: amount - fee, fee_rate_pct: feeRate * 100 });
    } else {
      setPreview(null);
    }
  }, [withdrawalForm.amount, profile?.user_tier]);

  const fetchAll = async () => {
    if (!user) return;
    setIsLoading(true);

    const { data: walletData } = await supabase
      .from("wallets").select("*").eq("user_id", user.id).maybeSingle();

    if (walletData) {
      setWallet(walletData);
      setBankForm({
        bank_name: walletData.bank_name || "",
        bank_account_number: walletData.bank_account_number || "",
        bank_account_name: walletData.bank_account_name || "",
      });

      const { data: txns } = await supabase
        .from("wallet_transactions").select("*")
        .eq("wallet_id", walletData.id)
        .order("created_at", { ascending: false }).limit(20);
      setTransactions(txns || []);
    }

    const { data: withdrawals } = await supabase
      .from("withdrawal_requests").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(10);
    setWithdrawalHistory(withdrawals || []);

    setIsLoading(false);
  };

  const handleUpdateBankDetails = async () => {
    if (!wallet) return;
    const { error } = await supabase.from("wallets").update({
      bank_name: bankForm.bank_name,
      bank_account_number: bankForm.bank_account_number,
      bank_account_name: bankForm.bank_account_name,
    }).eq("id", wallet.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update bank details", variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Bank details updated successfully" });
    setIsBankDialogOpen(false);
    fetchAll();
  };

  const handleRequestWithdrawal = async () => {
    if (!user || !wallet) return;
    const amount = parseFloat(withdrawalForm.amount);
    if (isNaN(amount) || amount < 5000) {
      toast({ title: "Invalid Amount", description: "Minimum withdrawal is ₦5,000", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await supabase.rpc("submit_withdrawal_request", {
      p_user_id: user.id,
      p_amount: amount,
      p_wallet_type: withdrawalForm.wallet_type,
    });
    setIsSubmitting(false);

    if (error || !data?.success) {
      toast({ title: "Error", description: data?.error || error?.message || "Failed to submit request", variant: "destructive" });
      return;
    }

    toast({
      title: "✅ Withdrawal Submitted!",
      description: `₦${data.net.toLocaleString()} will be sent to your bank (₦${data.fee.toLocaleString()} fee deducted). Processing within 72 hours.`,
    });
    setIsWithdrawalDialogOpen(false);
    setWithdrawalForm({ amount: "", wallet_type: "user_wallet" });
    setPreview(null);
    fetchAll();
  };

  const selectedBalance = wallet
    ? withdrawalForm.wallet_type === "gfe_wallet"
      ? wallet.gfe_wallet_balance
      : wallet.user_wallet_balance
    : 0;

  const walletCards = [
    {
      title: "Main Wallet",
      balance: wallet?.user_wallet_balance || 0,
      icon: Wallet,
      gradient: "from-emerald-500 to-emerald-600",
      description: "All user income",
    },
    {
      title: "Gem Points",
      balance: wallet?.gem_points || 0,
      icon: Gem,
      gradient: "from-amber-400 to-amber-500",
      description: "Learning & engagement rewards",
      isPoints: true,
    },
    {
      title: "GFE Wallet",
      balance: wallet?.gfe_wallet_balance || 0,
      icon: Users,
      gradient: "from-primary to-primary/80",
      description: "Referral commissions",
      locked: !profile?.is_gfe,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Commission Rate Banner */}
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Your Commission Rates:</strong> 30% on first-time referral subscriptions · 15% on renewals · 2% indirect bonus.
          Commissions are credited to your GFE Wallet instantly when your referral pays.
        </AlertDescription>
      </Alert>

      {/* Wallet Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {walletCards.map((card, index) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
            <Card className="overflow-hidden">
              <div className={cn("h-1.5 bg-gradient-to-r", card.gradient)} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold mt-1">
                      {card.isPoints ? card.balance.toLocaleString() : `₦${card.balance.toLocaleString()}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                  </div>
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br text-white", card.gradient)}>
                    <card.icon className="w-5 h-5" />
                  </div>
                </div>
                {card.locked && (
                  <Badge variant="outline" className="mt-3 text-xs">Become a GFE to unlock</Badge>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Bank Details + Withdrawal */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Bank Details */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Bank Account</CardTitle>
              <CardDescription>Your withdrawal destination</CardDescription>
            </div>
            {!wallet?.bank_details_locked && (
              <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">{wallet?.bank_account_number ? "Edit" : "Add"}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bank Account Details</DialogTitle>
                    <DialogDescription>Used for all withdrawal payments.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Input placeholder="e.g. First Bank" value={bankForm.bank_name}
                        onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Number</Label>
                      <Input placeholder="0123456789" maxLength={10} value={bankForm.bank_account_number}
                        onChange={(e) => setBankForm({ ...bankForm, bank_account_number: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Name</Label>
                      <Input placeholder="As it appears on your bank account" value={bankForm.bank_account_name}
                        onChange={(e) => setBankForm({ ...bankForm, bank_account_name: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBankDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdateBankDetails}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {wallet?.bank_account_number ? (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">{wallet.bank_name}</p>
                  <p className="text-sm text-muted-foreground">{wallet.bank_account_number}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{wallet.bank_account_name}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground text-sm mb-3">No bank details added yet</p>
                <Button variant="secondary" size="sm" onClick={() => setIsBankDialogOpen(true)}>Add Bank Details</Button>
              </div>
            )}

            {wallet?.bank_details_locked && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md mt-3">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>Details locked pending verification</span>
              </div>
            )}

            <Separator className="my-4" />

            {/* Withdrawal button */}
            <Dialog open={isWithdrawalDialogOpen} onOpenChange={setIsWithdrawalDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" disabled={!wallet?.bank_account_number}>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Request Withdrawal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Withdrawal</DialogTitle>
                  <DialogDescription>Funds are deducted immediately and sent within 72 hours.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Withdraw From</Label>
                    <Select value={withdrawalForm.wallet_type}
                      onValueChange={(v) => setWithdrawalForm({ ...withdrawalForm, wallet_type: v, amount: "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user_wallet">
                          Main Wallet — ₦{(wallet?.user_wallet_balance || 0).toLocaleString()}
                        </SelectItem>
                        <SelectItem value="gfe_wallet">
                          GFE Wallet (Commissions) — ₦{(wallet?.gfe_wallet_balance || 0).toLocaleString()}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount (₦)</Label>
                    <Input type="number" placeholder="5000" min="5000" max={selectedBalance}
                      value={withdrawalForm.amount}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })} />
                    <p className="text-xs text-muted-foreground">
                      Available: ₦{selectedBalance.toLocaleString()} · Minimum: ₦5,000
                    </p>
                  </div>

                  {/* Live fee preview */}
                  {preview && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm border">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gross amount</span>
                        <span>₦{preview.gross.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-destructive">
                        <span>Processing fee ({preview.fee_rate_pct}%)</span>
                        <span>−₦{preview.fee.toLocaleString()}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-base">
                        <span>You receive</span>
                        <span className="text-green-600">₦{preview.net.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        To: {wallet?.bank_name} · {wallet?.bank_account_number}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 text-xs text-center">
                    <div className="bg-muted/50 rounded p-2">
                      <p className="font-semibold">10% / 15%</p>
                      <p className="text-muted-foreground">Paying / Free</p>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <p className="font-semibold">₦5,000</p>
                      <p className="text-muted-foreground">Minimum</p>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <p className="font-semibold">72 hrs</p>
                      <p className="text-muted-foreground">Processing</p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsWithdrawalDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleRequestWithdrawal} disabled={isSubmitting || !preview}>
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : "Confirm Withdrawal"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Transaction History</CardTitle>
            <CardDescription>Recent wallet activity</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        tx.amount > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
                      )}>
                        {tx.amount > 0 ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[160px]">{tx.narration || tx.transaction_type}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn("font-semibold text-sm", tx.amount > 0 ? "text-green-600" : "text-red-500")}>
                        {tx.amount > 0 ? "+" : ""}₦{Math.abs(tx.amount).toLocaleString()}
                      </p>
                      <Badge variant="outline" className="text-xs">{tx.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No transactions yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal History */}
      {withdrawalHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Withdrawal Requests</CardTitle>
            <CardDescription>Track your payout status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {withdrawalHistory.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      req.status === "approved" ? "bg-green-100 text-green-600" :
                      req.status === "rejected" ? "bg-red-100 text-red-500" :
                      "bg-amber-100 text-amber-600"
                    )}>
                      {req.status === "approved" ? <CheckCircle2 className="w-4 h-4" /> :
                       req.status === "rejected" ? <XCircle className="w-4 h-4" /> :
                       <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        ₦{(req.net_amount || req.amount).toLocaleString()} → {req.bank_name || "Bank"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString()} · {req.wallet_type?.replace(/_/g, " ")}
                        {req.gross_amount && req.fee_amount ? ` · Fee: ₦${req.fee_amount.toLocaleString()}` : ""}
                      </p>
                      {req.rejection_reason && (
                        <p className="text-xs text-destructive mt-0.5">{req.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={
                    req.status === "approved" ? "default" :
                    req.status === "rejected" ? "destructive" : "secondary"
                  }>
                    {req.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
