import { useState, useEffect, useCallback } from 'react';
import { ArrowDownLeft, ArrowUpRight, Building2, Shield, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { LinkedBankAccount } from './BankAccountManager';
import { BankAccountManager } from './BankAccountManager';
import { motion, AnimatePresence } from 'framer-motion';

type TransferType = 'deposit' | 'withdrawal';
type Step = 'select_bank' | 'enter_amount' | 'verify_otp' | 'processing' | 'complete';

interface BankTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: TransferType;
  zarBalance: number;
  onComplete: () => void;
}

export function BankTransferDialog({ open, onOpenChange, type, zarBalance, onComplete }: BankTransferDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('select_bank');
  const [accounts, setAccounts] = useState<LinkedBankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<LinkedBankAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [transferRef, setTransferRef] = useState('');

  const isDeposit = type === 'deposit';
  const amountNum = parseFloat(amount) || 0;

  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_linked_bank_accounts')
      .select('id, bank_name, account_holder_name, account_number_masked, account_type, branch_code, is_verified, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });
    setAccounts((data as LinkedBankAccount[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open) {
      setStep('select_bank');
      setSelectedAccount(null);
      setAmount('');
      setOtp('');
      setGeneratedOtp('');
      setTransferRef('');
      fetchAccounts();
    }
  }, [open, fetchAccounts]);

  const handleSelectAccount = (acc: LinkedBankAccount) => {
    setSelectedAccount(acc);
    setStep('enter_amount');
  };

  const handleRequestOtp = () => {
    if (amountNum <= 0) {
      toast({ variant: 'destructive', title: 'Invalid amount' });
      return;
    }
    if (!isDeposit && amountNum > zarBalance) {
      toast({ variant: 'destructive', title: 'Insufficient balance', description: `Available: R${zarBalance.toFixed(2)}` });
      return;
    }
    // Generate a 6-digit OTP (in production this would be sent via SMS/email)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    toast({ title: 'OTP Sent', description: `Verification code sent to your registered contact. (Demo: ${code})` });
    setStep('verify_otp');
  };

  const handleVerifyAndProcess = async () => {
    if (otp !== generatedOtp) {
      toast({ variant: 'destructive', title: 'Invalid OTP', description: 'The verification code is incorrect' });
      return;
    }

    setStep('processing');
    setProcessing(true);

    try {
      const ref = `BT-${Date.now().toString(36).toUpperCase()}`;
      setTransferRef(ref);

      // Create transfer request
      const { error: reqError } = await supabase.from('bank_transfer_requests').insert({
        user_id: user!.id,
        bank_account_id: selectedAccount!.id,
        transfer_type: type,
        amount: amountNum,
        currency: 'ZAR',
        status: 'completed',
        otp_verified: true,
        reference: ref,
        completed_at: new Date().toISOString(),
      });

      if (reqError) throw reqError;

      // Get current wallet
      const { data: wallet } = await supabase
        .from('platform_wallets')
        .select('id, balance_zar, lifetime_earned, lifetime_spent')
        .eq('user_id', user!.id)
        .single();

      if (!wallet) throw new Error('Wallet not found');

      const newBalance = isDeposit
        ? (wallet.balance_zar || 0) + amountNum
        : (wallet.balance_zar || 0) - amountNum;

      // Update wallet balance
      const updates: any = { balance_zar: newBalance };
      if (isDeposit) {
        updates.lifetime_earned = (wallet.lifetime_earned || 0) + amountNum;
      } else {
        updates.lifetime_spent = (wallet.lifetime_spent || 0) + amountNum;
      }
      await supabase.from('platform_wallets').update(updates).eq('id', wallet.id);

      // Record transaction
      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        user_id: user!.id,
        type: isDeposit ? 'deposit' : 'withdrawal',
        amount: isDeposit ? amountNum : -amountNum,
        net_amount: isDeposit ? amountNum : -amountNum,
        status: 'completed',
        description: `${isDeposit ? 'Deposit from' : 'Withdrawal to'} ${selectedAccount!.bank_name} ${selectedAccount!.account_number_masked}`,
        completed_at: new Date().toISOString(),
      });

      setStep('complete');
      onComplete();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Transfer Failed', description: err.message });
      setStep('enter_amount');
    } finally {
      setProcessing(false);
    }
  };

  const Icon = isDeposit ? ArrowDownLeft : ArrowUpRight;
  const color = isDeposit ? 'text-green-600' : 'text-orange-600';
  const bgColor = isDeposit ? 'bg-green-500/10' : 'bg-orange-500/10';

  return (
    <>
      <Dialog open={open && !showAddBank} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full ${bgColor} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              {isDeposit ? 'Deposit Funds' : 'Withdraw Funds'}
            </DialogTitle>
            <DialogDescription>
              {isDeposit ? 'Transfer money from your bank account to your wallet' : 'Transfer money from your wallet to your bank account'}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {/* Step 1: Select Bank */}
            {step === 'select_bank' && (
              <motion.div key="select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading accounts...</div>
                ) : accounts.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground mb-3">No linked bank accounts. Link one to continue.</p>
                    <Button onClick={() => setShowAddBank(true)}>Link Bank Account</Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-muted-foreground">Select a verified bank account:</p>
                    {accounts.map(acc => (
                      <Card
                        key={acc.id}
                        className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm"
                        onClick={() => handleSelectAccount(acc)}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{acc.bank_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{acc.account_holder_name} · {acc.account_number_masked}</p>
                          </div>
                          {acc.is_verified && <Shield className="h-4 w-4 text-green-500 shrink-0" />}
                          {acc.is_default && <Badge className="text-[10px] bg-primary/10 text-primary shrink-0">Default</Badge>}
                        </CardContent>
                      </Card>
                    ))}
                    <Button variant="outline" className="w-full text-sm" onClick={() => setShowAddBank(true)}>
                      + Add New Account
                    </Button>
                  </>
                )}
              </motion.div>
            )}

            {/* Step 2: Enter Amount */}
            {step === 'enter_amount' && selectedAccount && (
              <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <Card className="bg-muted/50">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{selectedAccount.bank_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedAccount.account_number_masked}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setStep('select_bank')}>Change</Button>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label>Amount (ZAR)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">R</span>
                    <Input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-8 text-lg font-semibold h-12"
                      min="10"
                      step="10"
                    />
                  </div>
                  {!isDeposit && (
                    <p className="text-xs text-muted-foreground">Available balance: <span className="font-medium text-foreground">R{zarBalance.toFixed(2)}</span></p>
                  )}
                </div>

                {amountNum > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{isDeposit ? 'Deposit' : 'Withdrawal'} amount</span>
                      <span className="font-medium">R{amountNum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Processing fee</span>
                      <span className="font-medium text-green-600">FREE</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span>R{amountNum.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep('select_bank')}>Back</Button>
                  <Button className="flex-1" onClick={handleRequestOtp} disabled={amountNum <= 0}>
                    <Lock className="h-4 w-4 mr-2" /> Verify & Continue
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: OTP Verification */}
            {step === 'verify_otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Authentication Required</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter the 6-digit verification code sent to your registered contact
                  </p>
                </div>

                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-left space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Bank</span>
                    <span>{selectedAccount?.bank_name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Account</span>
                    <span>{selectedAccount?.account_number_masked}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Amount</span>
                    <span>R{amountNum.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setOtp(''); setStep('enter_amount'); }}>Back</Button>
                  <Button className="flex-1" onClick={handleVerifyAndProcess} disabled={otp.length !== 6}>
                    Confirm {isDeposit ? 'Deposit' : 'Withdrawal'}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Processing */}
            {step === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <p className="font-medium">Processing your {type}...</p>
                <p className="text-sm text-muted-foreground">Please wait while we verify and complete the transaction</p>
              </motion.div>
            )}

            {/* Step 5: Complete */}
            {step === 'complete' && (
              <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{isDeposit ? 'Deposit' : 'Withdrawal'} Successful!</h3>
                  <p className="text-2xl font-bold mt-1">R{amountNum.toFixed(2)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm text-left">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono text-xs">{transferRef}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span>{selectedAccount?.bank_name} {selectedAccount?.account_number_masked}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className="bg-green-500/10 text-green-600 text-xs">Completed</Badge>
                  </div>
                </div>
                <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <BankAccountManager
        open={showAddBank}
        onOpenChange={(v) => { setShowAddBank(v); if (!v) fetchAccounts(); }}
      />
    </>
  );
}
