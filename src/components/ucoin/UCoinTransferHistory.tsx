import { ArrowUpRight, ArrowDownLeft, Receipt, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { UCoinTransfer } from '@/types/ucoin';
import { format } from 'date-fns';

interface UCoinTransferHistoryProps {
  transfers: UCoinTransfer[];
  isLoading?: boolean;
}

export function UCoinTransferHistory({ transfers, isLoading }: UCoinTransferHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Transfer History
        </CardTitle>
        <CardDescription>Your P2P UCoin transfers</CardDescription>
      </CardHeader>
      <CardContent>
        {transfers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No transfers yet</p>
            <p className="text-sm">Your transfer history will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      transfer.direction === 'sent'
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400'
                        : 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400'
                    }`}>
                      {transfer.direction === 'sent' ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {transfer.direction === 'sent' ? 'Sent' : 'Received'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(transfer.created_at), 'MMM d, yyyy h:mm a')}</span>
                        {transfer.transfer_reference && (
                          <Badge variant="outline" className="text-xs">
                            {transfer.transfer_reference}
                          </Badge>
                        )}
                      </div>
                      {transfer.note && (
                        <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                          "{transfer.note}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      transfer.direction === 'sent' ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {transfer.direction === 'sent' ? '-' : '+'}{transfer.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {transfer.amount} mg Au
                    </p>
                    {transfer.fee_mg > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Fee: {transfer.fee_mg} UCoin
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
