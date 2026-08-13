import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Landmark, ShieldCheck, ArrowDownToLine, ArrowUpFromLine, Trash2, Loader2, Plus, ShieldAlert, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFintech } from "@/hooks/useFintech";
import { fintech, type LinkedBankAccount } from "@/services/fintech";
import { motion } from "framer-motion";

const fmtR = (n: number) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const brandLabel = (b?: string | null) => (b ? b.replace(/_/g, " ").toUpperCase() : "CARD");

const statusBadge = (s: string) => {
  const map: Record<string, { icon: any; className: string; label: string }> = {
    verified: { icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Verified" },
    approved: { icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Approved" },
    completed: { icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Completed" },
    pending: { icon: Clock, className: "bg-gold/10 text-gold dark:text-gold", label: "Pending" },
    failed: { icon: XCircle, className: "bg-destructive/10 text-destructive", label: "Failed" },
    rejected: { icon: XCircle, className: "bg-destructive/10 text-destructive", label: "Rejected" },
    active: { icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Active" },
  };
  const cfg = map[s] || { icon: Clock, className: "bg-muted text-muted-foreground", label: s };
  const Icon = cfg.icon;
  return (
    <Badge variant="secondary" className={`gap-1 ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
};

const FintechPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, loading, reload } = useFintech();

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBank, setWithdrawBank] = useState<string>("");
  const [withdrawing, setWithdrawing] = useState(false);

  const [addBankOpen, setAddBankOpen] = useState(false);
  const [linkingCard, setLinkingCard] = useState(false);

  const [kycOpen, setKycOpen] = useState(false);

  const w = data?.summary?.wallet;
  const kyc = data?.summary?.kyc;
  const limits = data?.summary?.limits;
  const kycOk = kyc?.status === "approved" && kyc?.level !== "none";
  const verifiedBanks = (data?.banks || []).filter((b) => b.verification_status === "verified");

  const handleDeposit = async () => {
    const amt = Number(depositAmount);
    if (!Number.isFinite(amt) || amt < 10) { toast({ variant: "destructive", title: "Enter at least R10" }); return; }
    try {
      setDepositing(true);
      await fintech.deposit(amt);
    } catch (e) {
      setDepositing(false);
      toast({ variant: "destructive", title: "Deposit failed", description: (e as Error).message });
    }
  };

  const handleWithdraw = async () => {
    const amt = Number(withdrawAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast({ variant: "destructive", title: "Enter an amount" }); return; }
    if (!withdrawBank) { toast({ variant: "destructive", title: "Select a bank account" }); return; }
    try {
      setWithdrawing(true);
      await fintech.withdraw(amt, withdrawBank);
      toast({ title: "Withdrawal requested", description: "Pending review. You'll be notified once processed." });
      setWithdrawOpen(false); setWithdrawAmount(""); setWithdrawBank("");
      reload();
    } catch (e) {
      toast({ variant: "destructive", title: "Withdrawal failed", description: (e as Error).message });
    } finally {
      setWithdrawing(false);
    }
  };

  const handleLinkCard = async () => {
    try {
      setLinkingCard(true);
      await fintech.startLinkCard();
    } catch (e) {
      setLinkingCard(false);
      toast({ variant: "destructive", title: "Could not start card linking", description: (e as Error).message });
    }
  };

  const removeCard = async (id: string) => {
    try { await fintech.removeCard(id); toast({ title: "Card removed" }); reload(); }
    catch (e) { toast({ variant: "destructive", title: "Failed", description: (e as Error).message }); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate("/wallet")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight">1145 Fintech</h1>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            PCI-secured
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-5 max-w-3xl space-y-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription>1145 Wallet balance</CardDescription>
              <CardTitle className="text-3xl">{fmtR(w?.available_balance || 0)}</CardTitle>
              <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                <span>Pending: {fmtR(w?.pending_balance || 0)}</span>
                <span>Withdrawal hold: {fmtR(w?.withdrawal_balance || 0)}</span>
                {w?.status && w.status !== "active" && (
                  <Badge variant="destructive" className="ml-auto">Wallet {w.status}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-3">
              <Button onClick={() => setDepositOpen(true)}>
                <ArrowDownToLine className="h-4 w-4 mr-2" /> Deposit
              </Button>
              <Button variant="secondary" onClick={() => setWithdrawOpen(true)}>
                <ArrowUpFromLine className="h-4 w-4 mr-2" /> Withdraw
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {!kycOk && (
          <Card className="border-gold/40 bg-gold/5">
            <CardContent className="flex items-start gap-3 py-4">
              <ShieldAlert className="h-5 w-5 text-gold mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Verify your identity (KYC) to withdraw</p>
                <p className="text-sm text-muted-foreground">
                  Required by South African banking regulations before withdrawing to a bank account.
                </p>
              </div>
              <Button size="sm" onClick={() => setKycOpen(true)}>Verify</Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="cards" className="w-full">
          <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-4 h-10">
            <TabsTrigger value="cards" className="text-xs"><CreditCard className="h-4 w-4 mr-1" />Cards</TabsTrigger>
            <TabsTrigger value="banks" className="text-xs"><Landmark className="h-4 w-4 mr-1" />Banks</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            <TabsTrigger value="withdrawals" className="text-xs">Withdrawals</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Linked cards</p>
                <p className="text-xs text-muted-foreground">Cards are tokenised by PayFast. 1145 never stores your full card number.</p>
              </div>
              <Button size="sm" onClick={handleLinkCard} disabled={linkingCard}>
                {linkingCard ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Add card
              </Button>
            </div>
            {(data?.cards || []).length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                No cards linked yet. Add one to fund deposits and pay faster.
              </CardContent></Card>
            ) : (
              <div className="grid gap-2">
                {data!.cards.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="flex items-center gap-3 py-3">
                      <CreditCard className="h-6 w-6 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">{brandLabel(c.brand)} •••• {c.last4 || "----"}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.exp_month && c.exp_year ? `Exp ${String(c.exp_month).padStart(2, "0")}/${c.exp_year}` : "Verified"}
                        </p>
                      </div>
                      {statusBadge(c.status)}
                      <Button variant="ghost" size="icon" onClick={() => removeCard(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="banks" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Bank accounts</p>
                <p className="text-xs text-muted-foreground">Only verified accounts can receive withdrawals. Full account numbers are never stored.</p>
              </div>
              <Button size="sm" onClick={() => setAddBankOpen(true)}><Plus className="h-4 w-4 mr-2" />Add bank</Button>
            </div>
            {(data?.banks || []).length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                No bank accounts linked yet.
              </CardContent></Card>
            ) : (
              <div className="grid gap-2">
                {data!.banks.map((b) => (
                  <Card key={b.id}>
                    <CardContent className="flex items-center gap-3 py-3">
                      <Landmark className="h-6 w-6 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">{b.bank_name} •••• {b.account_last4}</p>
                        <p className="text-xs text-muted-foreground">{b.account_holder_name} · {b.account_type}</p>
                      </div>
                      {statusBadge(b.verification_status)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4 space-y-2">
            {(data?.ledger || []).length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                No wallet activity yet.
              </CardContent></Card>
            ) : (
              (data!.ledger).map((row) => (
                <Card key={row.id}>
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className={`h-8 w-8 rounded-full grid place-items-center ${row.direction === "credit" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
                      {row.direction === "credit" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate capitalize">{row.type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()} · {row.bucket}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${row.direction === "credit" ? "text-emerald-600" : "text-destructive"}`}>
                        {row.direction === "credit" ? "+" : "−"}{fmtR(row.amount)}
                      </p>
                      {row.balance_after != null && <p className="text-[10px] text-muted-foreground">Balance: {fmtR(row.balance_after)}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-4 space-y-2">
            {(data?.withdrawals || []).length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                No withdrawal requests yet.
              </CardContent></Card>
            ) : (
              data!.withdrawals.map((w) => (
                <Card key={w.id}>
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex-1">
                      <p className="font-medium">{fmtR(w.amount)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</p>
                      {w.rejection_reason && <p className="text-xs text-destructive mt-1">{w.rejection_reason}</p>}
                    </div>
                    {statusBadge(w.status)}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed pt-2">
          1145 uses PayFast and licensed banking partners for all card and account verification. Sensitive banking credentials
          are never stored in our systems. Card verification, 3-D Secure authentication and payment authorisation happen
          directly with your bank.
        </p>
      </div>

      {/* Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deposit to 1145 Wallet</DialogTitle>
            <DialogDescription>You'll be redirected to your bank via PayFast to authorise the payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Amount (ZAR)</Label>
            <Input type="number" min={10} step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="100.00" />
            <p className="text-xs text-muted-foreground">Daily deposit limit: {fmtR(limits?.daily_deposit || 0)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button onClick={handleDeposit} disabled={depositing}>
              {depositing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Continue to PayFast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw from 1145 Wallet</DialogTitle>
            <DialogDescription>
              Withdrawals are reviewed and paid out to a verified bank account. Per-withdrawal max: {fmtR(limits?.single_withdrawal_max || 0)}.
            </DialogDescription>
          </DialogHeader>
          {!kycOk ? (
            <div className="text-sm text-muted-foreground">
              You need to complete identity verification before you can withdraw.
              <Button size="sm" variant="link" className="px-1" onClick={() => { setWithdrawOpen(false); setKycOpen(true); }}>Verify now</Button>
            </div>
          ) : verifiedBanks.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Add and verify a bank account first.
              <Button size="sm" variant="link" className="px-1" onClick={() => { setWithdrawOpen(false); setAddBankOpen(true); }}>Add bank</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" min={1} step="0.01" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0.00" />
                <p className="text-xs text-muted-foreground">Available: {fmtR(w?.available_balance || 0)}</p>
              </div>
              <div className="space-y-2">
                <Label>Bank account</Label>
                <Select value={withdrawBank} onValueChange={setWithdrawBank}>
                  <SelectTrigger><SelectValue placeholder="Select a verified bank" /></SelectTrigger>
                  <SelectContent>
                    {verifiedBanks.map((b: LinkedBankAccount) => (
                      <SelectItem key={b.id} value={b.id}>{b.bank_name} •••• {b.account_last4}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={handleWithdraw} disabled={withdrawing || !kycOk || verifiedBanks.length === 0}>
              {withdrawing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddBankDialog open={addBankOpen} onOpenChange={setAddBankOpen} onAdded={reload} />
      <KycDialog open={kycOpen} onOpenChange={setKycOpen} onSubmitted={reload} />
    </div>
  );
};

// ==================== Add Bank Dialog ====================
const AddBankDialog: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }> = ({ open, onOpenChange, onAdded }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ bank_name: "", account_holder_name: "", account_number: "", account_type: "checking", branch_code: "" });

  const submit = async () => {
    if (!form.bank_name || !form.account_holder_name || form.account_number.length < 6) {
      toast({ variant: "destructive", title: "Please complete all required fields" }); return;
    }
    try {
      setLoading(true);
      await fintech.addBankAccount(form);
      toast({ title: "Bank added", description: "Pending verification by 1145." });
      onOpenChange(false); onAdded();
      setForm({ bank_name: "", account_holder_name: "", account_number: "", account_type: "checking", branch_code: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed", description: (e as Error).message });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link bank account</DialogTitle>
          <DialogDescription>Only the last 4 digits of your account number are stored. 1145 never stores your full account number or online banking password.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Bank</Label>
            <Select value={form.bank_name} onValueChange={(v) => setForm({ ...form, bank_name: v })}>
              <SelectTrigger><SelectValue placeholder="Select your bank" /></SelectTrigger>
              <SelectContent>
                {["ABSA", "Standard Bank", "FNB", "Nedbank", "Capitec", "Discovery Bank", "TymeBank", "African Bank", "Investec"].map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Account holder name</Label>
            <Input value={form.account_holder_name} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} placeholder="As shown on your ID" />
          </div>
          <div className="space-y-2">
            <Label>Account number</Label>
            <Input inputMode="numeric" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="Only last 4 will be stored" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Account type</Label>
              <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Cheque / Current</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch code (optional)</Label>
              <Input value={form.branch_code} onChange={(e) => setForm({ ...form, branch_code: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit for verification</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==================== KYC Dialog ====================
const KycDialog: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void; onSubmitted: () => void }> = ({ open, onOpenChange, onSubmitted }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    legal_name: "", dob: "", id_number: "",
    address_line1: "", city: "", province: "", postal_code: "",
  });
  const submit = async () => {
    if (!form.legal_name || !form.dob || !form.id_number || !form.address_line1 || !form.city || !form.province || !form.postal_code) {
      toast({ variant: "destructive", title: "Complete all fields" }); return;
    }
    try {
      setLoading(true);
      await fintech.submitKyc(form);
      toast({ title: "KYC submitted", description: "We'll notify you once your identity is verified." });
      onOpenChange(false); onSubmitted();
    } catch (e) {
      toast({ variant: "destructive", title: "Submission failed", description: (e as Error).message });
    } finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify your identity</DialogTitle>
          <DialogDescription>Required by South African financial regulations (FIC Act). Your ID number is hashed and never stored in the clear.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2"><Label>Full legal name</Label>
            <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Date of birth</Label>
            <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
          <div className="space-y-2"><Label>ID number</Label>
            <Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} placeholder="13-digit SA ID" /></div>
          <div className="col-span-2 space-y-2"><Label>Address</Label>
            <Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} placeholder="Street address" /></div>
          <div className="space-y-2"><Label>City</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="space-y-2"><Label>Province</Label>
            <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></div>
          <div className="space-y-2"><Label>Postal code</Label>
            <Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FintechPage;
