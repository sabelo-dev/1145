import { format } from 'date-fns';
import {
  ArrowUpRight, ArrowDownLeft, Scale, Send, ShoppingBag,
  Coins, Truck, Star, Gift, CreditCard
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  net_amount?: number;
  category?: string;
  description?: string;
  asset_type?: string;
  status?: string;
  created_at: string;
  source: 'wallet' | 'ucoin';
}

interface UnifiedTransactionListProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

const getIcon = (tx: Transaction) => {
  const t = tx.type + (tx.category || '');
  if (t.includes('gold_buy') || t.includes('gold_sell')) return Scale;
  if (t.includes('transfer')) return Send;
  if (t.includes('order') || t.includes('purchase')) return ShoppingBag;
  if (t.includes('delivery')) return Truck;
  if (t.includes('review')) return Star;
  if (t.includes('referral') || t.includes('badge') || t.includes('mining')) return Gift;
  if (t.includes('deposit') || t.includes('earning')) return ArrowDownLeft;
  if (t.includes('spend') || t.includes('payment')) return ArrowUpRight;
  return CreditCard;
};

const getColor = (tx: Transaction) => {
  const amt = tx.net_amount ?? tx.amount;
  const t = tx.type;
  if (t.includes('gold_buy')) return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' };
  if (t.includes('gold_sell')) return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' };
  if (t === 'earn' || amt > 0) return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' };
  return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' };
};

const getLabel = (tx: Transaction) => {
  if (tx.description) return tx.description;
  const cat = tx.category?.replace(/_/g, ' ') || tx.type.replace(/_/g, ' ');
  return cat.charAt(0).toUpperCase() + cat.slice(1);
};

export function UnifiedTransactionList({ transactions, isLoading }: UnifiedTransactionListProps) {
  const walletTxs = transactions.filter(t => t.source === 'wallet');
  const ucoinTxs = transactions.filter(t => t.source === 'ucoin');

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all">
          <TabsList className="w-full grid grid-cols-3 h-9 mb-3">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="wallet" className="text-xs">Cash & Gold</TabsTrigger>
            <TabsTrigger value="ucoin" className="text-xs">UCoin</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <TxList transactions={transactions} />
          </TabsContent>
          <TabsContent value="wallet">
            <TxList transactions={walletTxs} />
          </TabsContent>
          <TabsContent value="ucoin">
            <TxList transactions={ucoinTxs} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TxList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        <Coins className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>No activity yet</p>
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, Transaction[]> = {};
  transactions.forEach(tx => {
    const key = format(new Date(tx.created_at), 'yyyy-MM-dd');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  });

  return (
    <ScrollArea className="h-[380px] pr-2">
      <div className="space-y-4">
        {Object.entries(grouped).map(([date, txs]) => (
          <div key={date}>
            <p className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-card py-1">
              {format(new Date(date), 'EEEE, MMM d')}
            </p>
            <div className="space-y-1">
              <AnimatePresence>
                {txs.map((tx, i) => {
                  const Icon = getIcon(tx);
                  const colors = getColor(tx);
                  const amt = tx.net_amount ?? tx.amount;
                  const isPositive = tx.type === 'earn' || amt > 0;

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-colors cursor-default"
                    >
                      <div className={`p-2 rounded-full ${colors.bg} flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${colors.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getLabel(tx)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(tx.created_at), 'h:mm a')}
                          {tx.asset_type && tx.asset_type !== 'ZAR' && (
                            <Badge variant="outline" className="ml-1.5 text-[9px] py-0 h-4">
                              {tx.asset_type === 'GOLD' ? 'Gold' : tx.asset_type}
                            </Badge>
                          )}
                          {tx.source === 'ucoin' && (
                            <Badge variant="outline" className="ml-1.5 text-[9px] py-0 h-4 border-amber-300 text-amber-600">
                              UCoin
                            </Badge>
                          )}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums ${colors.text}`}>
                        {isPositive ? '+' : ''}{tx.source === 'ucoin' ? `${Math.abs(tx.amount).toLocaleString()} UC` : `R${Math.abs(amt).toFixed(2)}`}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
