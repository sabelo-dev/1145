import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, CheckCircle, Building2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const SA_BANKS = [
  { name: 'ABSA', code: '632005' },
  { name: 'Standard Bank', code: '051001' },
  { name: 'FNB', code: '250655' },
  { name: 'Nedbank', code: '198765' },
  { name: 'Capitec', code: '470010' },
  { name: 'Discovery Bank', code: '679000' },
  { name: 'TymeBank', code: '678910' },
  { name: 'African Bank', code: '430000' },
  { name: 'Investec', code: '580105' },
  { name: 'Bidvest Bank', code: '462005' },
];

export interface LinkedBankAccount {
  id: string;
  bank_name: string;
  account_holder_name: string;
  account_number_masked: string;
  account_type: string;
  branch_code: string | null;
  is_verified: boolean;
  is_default: boolean;
}

interface BankAccountManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountSelected?: (account: LinkedBankAccount) => void;
  selectionMode?: boolean;
}

export function BankAccountManager({ open, onOpenChange, onAccountSelected, selectionMode = false }: BankAccountManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<LinkedBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    account_type: 'savings',
    branch_code: '',
  });

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
    if (open && user) fetchAccounts();
  }, [open, user, fetchAccounts]);

  const handleAdd = async () => {
    if (!user || !form.bank_name || !form.account_holder_name || !form.account_number) {
      toast({ variant: 'destructive', title: 'Please fill all required fields' });
      return;
    }

    setSaving(true);
    const masked = '****' + form.account_number.slice(-4);
    const hash = btoa(form.account_number); // Simple hash for demo; production would use server-side hashing

    const bank = SA_BANKS.find(b => b.name === form.bank_name);
    const isFirst = accounts.length === 0;

    const { error } = await supabase.from('user_linked_bank_accounts').insert({
      user_id: user.id,
      bank_name: form.bank_name,
      account_holder_name: form.account_holder_name,
      account_number_masked: masked,
      account_number_hash: hash,
      account_type: form.account_type,
      branch_code: form.branch_code || bank?.code || null,
      is_default: isFirst,
      is_verified: true, // Auto-verify for demo
      verified_at: new Date().toISOString(),
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add bank account' });
    } else {
      toast({ title: 'Bank account linked', description: `${form.bank_name} ${masked} added successfully` });
      setForm({ bank_name: '', account_holder_name: '', account_number: '', account_type: 'savings', branch_code: '' });
      setShowAddForm(false);
      fetchAccounts();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('user_linked_bank_accounts').delete().eq('id', id);
    toast({ title: 'Account removed' });
    fetchAccounts();
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    await supabase.from('user_linked_bank_accounts').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('user_linked_bank_accounts').update({ is_default: true }).eq('id', id);
    fetchAccounts();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {selectionMode ? 'Select Bank Account' : 'Linked Bank Accounts'}
          </DialogTitle>
          <DialogDescription>
            {selectionMode ? 'Choose a verified bank account for this transaction' : 'Manage your South African bank accounts for deposits and withdrawals'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading accounts...</div>
          ) : accounts.length === 0 && !showAddForm ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground mb-3">No linked bank accounts</p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Bank Account
              </Button>
            </div>
          ) : (
            <>
              {accounts.map(acc => (
                <Card
                  key={acc.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${selectionMode ? 'hover:shadow-md' : ''}`}
                  onClick={() => selectionMode && onAccountSelected?.(acc)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{acc.bank_name}</p>
                          <p className="text-xs text-muted-foreground">{acc.account_holder_name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{acc.account_number_masked} · {acc.account_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {acc.is_verified && (
                          <Badge variant="outline" className="text-xs gap-1 border-green-500/30 text-green-600">
                            <Shield className="h-3 w-3" /> Verified
                          </Badge>
                        )}
                        {acc.is_default && (
                          <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/20">Default</Badge>
                        )}
                        {!selectionMode && (
                          <div className="flex gap-1">
                            {!acc.is_default && (
                              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); handleSetDefault(acc.id); }}>
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(acc.id); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {!showAddForm && (
                <Button variant="outline" className="w-full" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add Another Account
                </Button>
              )}
            </>
          )}

          {showAddForm && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Link New Bank Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bank *</Label>
                  <Select value={form.bank_name} onValueChange={v => setForm({ ...form, bank_name: v, branch_code: SA_BANKS.find(b => b.name === v)?.code || '' })}>
                    <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                    <SelectContent>
                      {SA_BANKS.map(b => (
                        <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account Holder Name *</Label>
                  <Input value={form.account_holder_name} onChange={e => setForm({ ...form, account_holder_name: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account Number *</Label>
                  <Input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} placeholder="1234567890" type="password" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Account Type</Label>
                    <Select value={form.account_type} onValueChange={v => setForm({ ...form, account_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="checking">Cheque</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Branch Code</Label>
                    <Input value={form.branch_code} onChange={e => setForm({ ...form, branch_code: e.target.value })} placeholder="Auto-filled" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddForm(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleAdd} disabled={saving}>{saving ? 'Linking...' : 'Link Account'}</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
