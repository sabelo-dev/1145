import { format } from 'date-fns';
import { CheckCircle2, Clock, XCircle, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MiningCompletion } from '@/hooks/useSocialMining';

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-500', label: 'Pending' },
  verified: { icon: CheckCircle2, color: 'text-blue-500', label: 'Verified' },
  paid: { icon: Coins, color: 'text-green-500', label: 'Paid' },
  rejected: { icon: XCircle, color: 'text-red-500', label: 'Rejected' }
};

interface MiningHistoryProps {
  completions: MiningCompletion[];
}

export function MiningHistory({ completions }: MiningHistoryProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Mining History</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {completions.length > 0 ? (
            <div className="space-y-3">
              {completions.map((completion) => {
                const status = statusConfig[completion.status];
                const StatusIcon = status.icon;

                return (
                  <div
                    key={completion.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-5 w-5 ${status.color}`} />
                      <div>
                        <p className="font-medium text-sm">
                          {completion.task?.title || 'Mining Task'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(completion.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className={`font-bold ${completion.status === 'rejected' ? 'text-red-500 line-through' : 'text-green-600'}`}>
                        +{completion.final_reward} UCoin
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No mining activity yet</p>
              <p className="text-sm">Complete tasks to start earning UCoin!</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
