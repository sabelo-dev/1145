import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Loader2, Wifi } from 'lucide-react';
import type { SyncStatus } from '@/hooks/useInfluencerDashboard';
import { formatDistanceToNow } from 'date-fns';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

interface SyncStatusPanelProps {
  syncStatuses: SyncStatus[];
  onSync?: (platform: string) => void;
}

export const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({ syncStatuses, onSync }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'syncing': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wifi className="h-4 w-4" />
          Platform Sync
        </CardTitle>
      </CardHeader>
      <CardContent>
        {syncStatuses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            No platforms connected yet
          </p>
        ) : (
          <div className="space-y-3">
            {syncStatuses.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(s.sync_status)}
                  <div>
                    <p className="text-sm font-medium">{PLATFORM_LABELS[s.platform] || s.platform}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.last_sync_at
                        ? `Synced ${formatDistanceToNow(new Date(s.last_sync_at), { addSuffix: true })}`
                        : 'Never synced'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {s.posts_synced} posts
                  </Badge>
                  {onSync && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onSync(s.platform)}
                      disabled={s.sync_status === 'syncing'}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${s.sync_status === 'syncing' ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
