import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Plus, Crown, Trash2, Loader2, AlertTriangle, Target, Sparkles } from "lucide-react";

interface Edition {
  id: string;
  name: string;
  description: string | null;
  status: string;
  champion_user_id: string | null;
  champion_declared_at: string | null;
  started_at: string;
  ended_at: string | null;
  champion?: { full_name: string | null; email: string | null } | null;
}

interface Participant {
  user_id: string;
  full_name: string | null;
  email: string | null;
  funding_readiness_score: number;
  xp_total: number;
}

const AIChallengTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [editions, setEditions] = useState<Edition[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [participantsLoading, setParticipantsLoading] = useState(true);

  // New edition dialog
  const [newEditionOpen, setNewEditionOpen] = useState(false);
  const [newEdition, setNewEdition] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);

  // End edition / declare champion dialog
  const [endEditionOpen, setEndEditionOpen] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<Edition | null>(null);
  const [championId, setChampionId] = useState<string>("");
  const [ending, setEnding] = useState(false);

  const fetchEditions = async () => {
    const { data, error } = await supabase
      .from("ai_challenge_editions")
      .select("*, champion:champion_user_id(full_name, email)")
      .order("created_at", { ascending: false });
    if (!error) setEditions((data || []) as Edition[]);
    setLoading(false);
  };

  const fetchParticipants = async () => {
    setParticipantsLoading(true);
    const { data } = await supabase.rpc("get_tutor_leaderboard");
    setParticipants((data || []) as Participant[]);
    setParticipantsLoading(false);
  };

  useEffect(() => {
    fetchEditions();
    fetchParticipants();
  }, []);

  const handleCreateEdition = async () => {
    if (!newEdition.name.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("ai_challenge_editions").insert({
      name: newEdition.name.trim(),
      description: newEdition.description.trim() || null,
      status: "active",
      created_by: user?.id,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Edition Created", description: `"${newEdition.name}" is now active.` });
      setNewEdition({ name: "", description: "" });
      setNewEditionOpen(false);
      fetchEditions();
    }
  };

  const handleEndEdition = async () => {
    if (!selectedEdition) return;
    setEnding(true);
    const { error } = await supabase.rpc("clear_challenge_edition", {
      p_edition_id: selectedEdition.id,
      p_champion_user_id: championId || null,
    });
    setEnding(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "🏆 Edition Ended!",
        description: "Champion declared, leaderboard data cleared for new edition.",
      });
      setEndEditionOpen(false);
      setSelectedEdition(null);
      setChampionId("");
      fetchEditions();
      fetchParticipants();
    }
  };

  const activeEditions = editions.filter(e => e.status === "active");
  const endedEditions = editions.filter(e => e.status === "ended");

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                AI Challenge Management
              </CardTitle>
              <CardDescription>
                Manage challenge editions, declare champions, and reset leaderboard data
              </CardDescription>
            </div>
            <Button onClick={() => setNewEditionOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Edition
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Active Editions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Active Editions ({activeEditions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : activeEditions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No active editions. Create one to start a new challenge.</p>
          ) : (
            <div className="space-y-3">
              {activeEditions.map(edition => (
                <div key={edition.id} className="flex items-center justify-between p-4 rounded-lg border border-green-500/20 bg-green-500/5">
                  <div>
                    <p className="font-semibold">{edition.name}</p>
                    {edition.description && <p className="text-sm text-muted-foreground">{edition.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Started {new Date(edition.started_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setSelectedEdition(edition); setEndEditionOpen(true); }}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    End & Declare Champion
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Leaderboard snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Current Leaderboard
          </CardTitle>
          <CardDescription>
            Ranked by Funding Readiness Score · XP as tiebreaker
          </CardDescription>
        </CardHeader>
        <CardContent>
          {participantsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : participants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No participants yet.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Funding Score</span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> XP</span>
                    </TableHead>
                    <TableHead>Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.slice(0, 20).map((p, i) => (
                    <TableRow key={p.user_id} className={i === 0 ? "bg-amber-500/5" : ""}>
                      <TableCell className="font-bold">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{p.full_name || "Anonymous"}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold text-lg ${p.funding_readiness_score >= 80 ? "text-green-500" : p.funding_readiness_score >= 60 ? "text-amber-500" : "text-muted-foreground"}`}>
                          {p.funding_readiness_score}
                          <span className="text-xs font-normal text-muted-foreground">/100</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{p.xp_total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">{(p as any).level || "—"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Editions */}
      {endedEditions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Past Editions ({endedEditions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Edition</TableHead>
                    <TableHead>Champion 🏆</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ended</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endedEditions.map(edition => (
                    <TableRow key={edition.id}>
                      <TableCell className="font-medium">{edition.name}</TableCell>
                      <TableCell>
                        {edition.champion ? (
                          <span className="flex items-center gap-1">
                            <Crown className="w-4 h-4 text-amber-400" />
                            {edition.champion.full_name || edition.champion.email || "Unknown"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">No champion declared</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{new Date(edition.started_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm">{edition.ended_at ? new Date(edition.ended_at).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Edition Dialog */}
      <Dialog open={newEditionOpen} onOpenChange={setNewEditionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Edition</DialogTitle>
            <DialogDescription>Start a new AI Challenge edition. This will be visible on the leaderboard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Edition Name *</Label>
              <Input
                placeholder="e.g. AI Challenge — Season 1"
                value={newEdition.name}
                onChange={e => setNewEdition({ ...newEdition, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Brief description of this edition..."
                value={newEdition.description}
                onChange={e => setNewEdition({ ...newEdition, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewEditionOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateEdition} disabled={creating || !newEdition.name.trim()}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Edition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Edition / Declare Champion Dialog */}
      <Dialog open={endEditionOpen} onOpenChange={setEndEditionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              End Edition & Declare Champion
            </DialogTitle>
            <DialogDescription>
              Select the champion for <strong>{selectedEdition?.name}</strong>. This will end the edition and <strong className="text-destructive">reset all XP, streaks, and funding scores</strong> for the next challenge.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                This action is irreversible. All participant XP, streaks, badges, and funding readiness scores will be cleared.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Champion 🏆 (optional)</Label>
              <Select value={championId} onValueChange={setChampionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select champion from leaderboard..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No champion (skip)</SelectItem>
                  {participants.slice(0, 20).map((p, i) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : `#${i + 1} `}
                      {p.full_name || p.email || "Anonymous"} — Score: {p.funding_readiness_score}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEndEditionOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleEndEdition} disabled={ending}>
              {ending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              End Edition & Clear Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIChallengTab;
