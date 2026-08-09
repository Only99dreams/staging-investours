import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle, ArrowDownRight, ArrowUpRight, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DepositRequestsManager } from "@/components/admin/DepositRequestsManager";

const PayoutsTab = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchWithdrawalRequests(); }, []);

  const fetchWithdrawalRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*, user:profiles(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setWithdrawalRequests(data || []);
    } catch (error) {
      console.error("Error fetching payout requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc("approve_withdrawal_request", {
        p_request_id: id,
        p_admin_id: user!.id,
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message);
      toast({ title: "Approved", description: "Withdrawal approved and user notified." });
      fetchWithdrawalRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialogId) return;
    setProcessing(rejectDialogId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc("reject_withdrawal_request", {
        p_request_id: rejectDialogId,
        p_admin_id: user!.id,
        p_rejection_reason: rejectReason || "Rejected by admin",
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message);
      toast({ title: "Rejected", description: "Amount refunded to user wallet." });
      setRejectDialogId(null);
      setRejectReason("");
      fetchWithdrawalRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="withdrawals" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="withdrawals" className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" /> Withdrawal Requests
          </TabsTrigger>
          <TabsTrigger value="deposits" className="flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4" /> Deposit Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="withdrawals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5" /> Withdrawal Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>Fee</TableHead>
                        <TableHead>Net (Pay Out)</TableHead>
                        <TableHead>Bank Details</TableHead>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawalRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center h-24">
                            No withdrawal requests found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        withdrawalRequests.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="font-medium">
                              {req.user?.full_name || "N/A"}
                              <br />
                              <span className="text-xs text-muted-foreground">{req.user?.email}</span>
                            </TableCell>
                            <TableCell>₦{(req.gross_amount || req.amount || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-destructive">₦{(req.fee_amount || 0).toLocaleString()}</TableCell>
                            <TableCell className="font-bold text-green-600">
                              ₦{(req.net_amount || req.amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <p className="font-medium">{req.bank_name || "—"}</p>
                                <p className="text-muted-foreground">{req.bank_account_number || "—"}</p>
                                <p className="text-muted-foreground">{req.bank_account_name || "—"}</p>
                              </div>
                            </TableCell>
                            <TableCell className="capitalize text-xs">
                              {req.wallet_type?.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                req.status === "approved" ? "default" :
                                req.status === "pending" ? "secondary" : "destructive"
                              }>
                                {req.status || "Pending"}
                              </Badge>
                              {req.rejection_reason && (
                                <p className="text-xs text-destructive mt-1">{req.rejection_reason}</p>
                              )}
                            </TableCell>
                            <TableCell>{new Date(req.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              {req.status === "pending" && (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline"
                                    className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                                    onClick={() => handleApprove(req.id)}
                                    disabled={processing === req.id}
                                    title="Approve — confirm payment sent">
                                    {processing === req.id
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <CheckCircle className="h-4 w-4" />}
                                  </Button>
                                  <Button size="sm" variant="outline"
                                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                    onClick={() => { setRejectDialogId(req.id); setRejectReason(""); }}
                                    disabled={processing === req.id}
                                    title="Reject — refunds user">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposits">
          <DepositRequestsManager />
        </TabsContent>
      </Tabs>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectDialogId} onOpenChange={(o) => { if (!o) { setRejectDialogId(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" /> Reject Withdrawal
            </DialogTitle>
            <DialogDescription>
              The full gross amount will be refunded to the user's wallet automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason for rejection</Label>
            <Input
              placeholder="e.g. Invalid bank details, duplicate request..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogId(null); setRejectReason(""); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject & Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayoutsTab;
