import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield, AlertTriangle, MapPin, Eye, CheckCircle, XCircle,
  Clock, Search, Bell, Activity, TrendingDown, Users, FileText,
} from "lucide-react";
import { passengerSecurityService, type SafetyAlert } from "@/services/passengerSecurityService";
import { zoneComplianceService } from "@/services/zoneComplianceService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SafetyComplianceDashboard: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("alerts");
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
    const channel = passengerSecurityService.subscribeToAlerts((alert) => {
      setAlerts((prev) => [alert, ...prev]);
      if (alert.severity === 'CRITICAL') {
        toast({
          title: "🆘 CRITICAL ALERT",
          description: `${alert.alert_type} triggered for ride ${alert.ride_id?.slice(0, 8)}`,
          variant: "destructive",
        });
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [alertsData, zonesData, auditData] = await Promise.all([
      passengerSecurityService.getActiveAlerts(100),
      zoneComplianceService.getActiveZones(),
      zoneComplianceService.getAuditLog({ limit: 100 }),
    ]);

    // Get all violations
    const { data: violationsData } = await supabase
      .from('zone_violations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    setAlerts(alertsData);
    setZones(zonesData);
    setAuditLog(auditData);
    setViolations(violationsData || []);
    setLoading(false);
  };

  const handleAcknowledge = async (alertId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const success = await passengerSecurityService.acknowledgeAlert(alertId, user.id);
    if (success) {
      setAlerts((prev) => prev.map((a) =>
        a.id === alertId ? { ...a, status: 'acknowledged' } : a
      ));
      toast({ title: "Alert acknowledged" });
    }
  };

  const handleResolve = async (alertId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const notes = resolveNotes[alertId] || "Resolved by admin";
    const success = await passengerSecurityService.resolveAlert(alertId, user.id, notes);
    if (success) {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      toast({ title: "Alert resolved" });
    }
  };

  const handleEscalate = async (alertId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const success = await passengerSecurityService.escalateAlert(alertId, user.id);
    if (success) {
      setAlerts((prev) => prev.map((a) =>
        a.id === alertId ? { ...a, status: 'escalated', severity: 'CRITICAL' as const } : a
      ));
      toast({ title: "Alert escalated to CRITICAL", variant: "destructive" });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500 text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-amber-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="destructive">Active</Badge>;
      case 'acknowledged': return <Badge className="bg-amber-500">Acknowledged</Badge>;
      case 'investigating': return <Badge className="bg-blue-500 text-white">Investigating</Badge>;
      case 'escalated': return <Badge variant="destructive">Escalated</Badge>;
      case 'resolved': return <Badge className="bg-green-500 text-white">Resolved</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && a.status === 'active').length;
  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const pendingViolations = violations.filter((v) => v.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Safety & Compliance Center
          </h2>
          <p className="text-muted-foreground">Real-time monitoring, incident management & zone enforcement</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">Refresh</Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={criticalCount > 0 ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${criticalCount > 0 ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-2xl font-bold">{criticalCount}</p>
                <p className="text-xs text-muted-foreground">Critical Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{pendingViolations}</p>
                <p className="text-xs text-muted-foreground">Pending Violations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{zones.length}</p>
                <p className="text-xs text-muted-foreground">Active Zones</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="alerts" className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> Alerts
            {activeCount > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{activeCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="violations" className="flex items-center gap-1">
            <MapPin className="h-4 w-4" /> Violations
          </TabsTrigger>
          <TabsTrigger value="zones" className="flex items-center gap-1">
            <Eye className="h-4 w-4" /> Zones
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1">
            <FileText className="h-4 w-4" /> Audit Log
          </TabsTrigger>
        </TabsList>

        {/* ALERTS TAB */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search alerts by type, ride ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {loading ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Loading alerts...</CardContent></Card>
          ) : alerts.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="font-medium">All Clear</p>
              <p className="text-sm">No active safety alerts</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {alerts
                .filter((a) => !searchTerm || 
                  a.alert_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  a.ride_id?.includes(searchTerm)
                )
                .map((alert) => (
                <Card key={alert.id} className={alert.severity === 'CRITICAL' ? 'border-red-500 shadow-red-100' : ''}>
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                          <Badge variant="outline">{alert.alert_type.replace('_', ' ')}</Badge>
                          {getStatusBadge(alert.status)}
                          <span className="text-xs text-muted-foreground">
                            via {alert.trigger_source}
                          </span>
                        </div>
                        <div className="text-sm space-y-1">
                          {alert.ride_id && <p><span className="text-muted-foreground">Ride:</span> {alert.ride_id.slice(0, 8)}...</p>}
                          {alert.driver_id && <p><span className="text-muted-foreground">Driver:</span> {alert.driver_id.slice(0, 8)}...</p>}
                          {alert.location_lat && (
                            <p className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {alert.location_lat.toFixed(4)}, {alert.location_lng?.toFixed(4)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(alert.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 min-w-[200px]">
                        {alert.status === 'active' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleAcknowledge(alert.id)}>
                              Acknowledge
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleEscalate(alert.id)}>
                              Escalate
                            </Button>
                          </>
                        )}
                        {(alert.status === 'active' || alert.status === 'acknowledged') && (
                          <>
                            <Textarea
                              placeholder="Resolution notes..."
                              value={resolveNotes[alert.id] || ""}
                              onChange={(e) => setResolveNotes((prev) => ({ ...prev, [alert.id]: e.target.value }))}
                              className="text-xs h-16"
                            />
                            <Button size="sm" onClick={() => handleResolve(alert.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* VIOLATIONS TAB */}
        <TabsContent value="violations" className="space-y-4">
          {violations.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No violations recorded</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {violations.map((v: any) => (
                <Card key={v.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={v.status === 'fined' ? 'destructive' : v.status === 'warned' ? 'secondary' : 'outline'}>
                            {v.status}
                          </Badge>
                          <span className="text-sm font-medium">{v.violation_type.replace('_', ' ')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Driver: {v.driver_id.slice(0, 8)}... | Zone: {v.detected_zone || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">Severity: {v.severity}x</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ZONES TAB */}
        <TabsContent value="zones" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {zones.map((zone: any) => (
              <Card key={zone.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{zone.name}</span>
                    <Badge variant="outline">{zone.code}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Radius</p>
                      <p className="font-medium">{zone.radius_km} km</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Severity</p>
                      <p className="font-medium">{zone.severity}x</p>
                    </div>
                    {zone.province && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Province</p>
                        <p className="font-medium">{zone.province}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {zone.center_lat.toFixed(4)}, {zone.center_lng.toFixed(4)}
                  </div>
                </CardContent>
              </Card>
            ))}
            {zones.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No zones configured. Add zones via the SQL editor.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* AUDIT LOG TAB */}
        <TabsContent value="audit" className="space-y-4">
          <div className="space-y-2">
            {auditLog.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-3 p-3 border rounded-lg text-sm">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{entry.event_type}</Badge>
                    <span className="text-xs text-muted-foreground">{entry.entity_type}: {entry.entity_id.slice(0, 8)}...</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {auditLog.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No audit events yet</CardContent></Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SafetyComplianceDashboard;
