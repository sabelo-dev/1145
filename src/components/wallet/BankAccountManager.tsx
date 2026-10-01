import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, CheckCircle, Building2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { VerifiedBankForm } from '@/components/banking/VerifiedBankForm';

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
              <CardContent>
                <VerifiedBankForm
                  endpoint="fintech-link-bank"
                  extraBody={{ destination: "transfers" }}
                  returnPath="/ucoin-wallet"
                  submitLabel="Link Account"
                  onCancel={() => setShowAddForm(false)}
                  onSaved={(result) => {
                    toast({ title: 'Bank account linked', description: `${result.bank_name} ****${result.last4} added successfully` });
                    setShowAddForm(false);
                    fetchAccounts();
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
