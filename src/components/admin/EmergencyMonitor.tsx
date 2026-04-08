import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, MapPin, Clock, CheckCircle, Shield, Send,
  Phone, User, Car, XCircle,
} from "lucide-react";
import { emergencyService, type EmergencyEvent } from "@/services/emergencyService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const EmergencyMonitor: React.FC = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<EmergencyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const data = await emergencyService.getActiveEmergencies();
    setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEvents();
    const channel = emergencyService.subscribeToEmergencies((updatedEvent) => {
      setEvents((prev) => {
        const idx = prev.findIndex((e) => e.id === updatedEvent.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updatedEvent;
          // Remove if resolved/cancelled
          if (['resolved', 'cancelled'].includes(updatedEvent.status)) {
            return copy.filter((e) => e.id !== updatedEvent.id);
          }
          return copy;
        }
        if (['active', 'dispatched'].includes(updatedEvent.status)) {
          return [updatedEvent, ...prev];
        }
        return prev;
      });

      if (updatedEvent.status === 'active') {
        toast({
          title: "🆘 NEW EMERGENCY",
          description: `${updatedEvent.role} triggered panic alert`,
          variant: "destructive",
        });
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDispatch = async (eventId: string) => {
    setProcessingId(eventId);
    const ok = await emergencyService.dispatchToEvent(eventId);
    setProcessingId(null);
    if (ok) {
      toast({ title: "Dispatched", description: "Responder notified." });
      loadEvents();
    }
  };

  const handleResolve = async (eventId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setProcessingId(eventId);
    const notes = resolveNotes[eventId] || "Resolved by admin";
    const ok = await emergencyService.resolveEmergencyEvent(eventId, user.id, notes);
    setProcessingId(null);
    if (ok) {
      toast({ title: "Resolved", description: "Emergency event closed." });
      setResolveNotes((p) => { const c = { ...p }; delete c[eventId]; return c; });
      loadEvents();
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'destructive';
      case 'dispatched': return 'default';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Emergency Monitor</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm">Loading...</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Emergency Monitor
            {events.length > 0 && (
              <Badge variant="destructive" className="ml-2 animate-pulse">{events.length} Active</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No active emergencies</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <Card key={event.id} className="border-destructive/40 bg-destructive/5">
                  <CardContent className="pt-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={statusColor(event.status) as any}>
                          {event.status.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          {event.role === 'driver' ? <Car className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {event.role}
                        </Badge>
                        {event.silent_mode && (
                          <Badge variant="secondary">Silent</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Location */}
                    {event.lat && event.lng && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-destructive" />
                        <a
                          href={`https://www.google.com/maps?q=${event.lat},${event.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          {Number(event.lat).toFixed(5)}, {Number(event.lng).toFixed(5)}
                        </a>
                      </div>
                    )}

                    {/* User & Trip IDs */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>User: {event.user_id.slice(0, 8)}...</p>
                      {event.trip_id && <p>Trip: {event.trip_id.slice(0, 8)}...</p>}
                      <p>Event: {event.id.slice(0, 8)}...</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {event.status === 'active' && (
                        <Button
                          size="sm"
                          onClick={() => handleDispatch(event.id)}
                          disabled={processingId === event.id}
                        >
                          <Send className="h-3 w-3 mr-1" /> Dispatch
                        </Button>
                      )}
                      <a href="tel:10111">
                        <Button size="sm" variant="outline">
                          <Phone className="h-3 w-3 mr-1" /> Call SAPS
                        </Button>
                      </a>
                    </div>

                    {/* Resolve */}
                    <div className="flex gap-2 pt-1">
                      <Textarea
                        placeholder="Resolution notes..."
                        value={resolveNotes[event.id] || ""}
                        onChange={(e) => setResolveNotes((p) => ({ ...p, [event.id]: e.target.value }))}
                        className="min-h-[60px] text-sm"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleResolve(event.id)}
                        disabled={processingId === event.id}
                        className="shrink-0 self-end"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmergencyMonitor;
