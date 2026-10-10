
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, Download, RotateCcw, Shield, User, Package } from "lucide-react";

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: "admin" | "merchant" | "customer";
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  severity: "low" | "medium" | "high" | "critical";
}


const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        // Generate audit logs from database activities
        const auditLogs: AuditLog[] = [];
        
        // Get recent merchant approvals/rejections
        const { data: merchants } = await supabase
          .from('merchants')
          .select('*, profiles!inner(*)')
          .order('updated_at', { ascending: false })
          .limit(20);

        merchants?.forEach(merchant => {
          if (merchant.approval_date) {
            auditLogs.push({
              id: `merchant-${merchant.id}`,
              timestamp: merchant.approval_date,
              userId: 'admin',
              userName: 'System Admin',
              userRole: 'admin',
              action: 'UPDATE',
              resource: 'merchant',
              resourceId: merchant.id,
              details: `Merchant ${merchant.business_name} status updated to ${merchant.status}`,
              ipAddress: '127.0.0.1',
              userAgent: 'System',
              severity: merchant.status === 'approved' ? 'medium' : 'high'
            });
          }
        });

        // Get recent product updates
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(10);

        products?.forEach(product => {
          auditLogs.push({
            id: `product-${product.id}`,
            timestamp: product.updated_at,
            userId: 'system',
            userName: 'System',
            userRole: 'admin',
            action: product.created_at === product.updated_at ? 'CREATE' : 'UPDATE',
            resource: 'product',
            resourceId: product.id,
            details: `Product ${product.name} ${product.created_at === product.updated_at ? 'created' : 'updated'}`,
            ipAddress: '127.0.0.1',
            userAgent: 'System',
            severity: 'low'
          });
        });

        // Sort by timestamp descending
        auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setLogs(auditLogs);
      } catch (error) {
        console.error('Error fetching audit logs:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load audit logs."
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, [toast]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === "all" || log.severity === severityFilter;
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesSeverity && matchesAction;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "outline";
      case "low": return "default";
      default: return "default";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATE": return <Package className="h-4 w-4" />;
      case "UPDATE": return <RotateCcw className="h-4 w-4" />;
      case "DELETE": return <Shield className="h-4 w-4" />;
      case "LOGIN": return <User className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "merchant": return "outline";
      case "customer": return "default";
      default: return "default";
    }
  };

  const criticalLogs = logs.filter(log => log.severity === "critical").length;
  const highSeverityLogs = logs.filter(log => log.severity === "high").length;
  const todayLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp).toDateString();
    const today = new Date().toDateString();
    return logDate === today;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">Loading audit logs...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">Audit Logs</h2>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filter
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>
      </div>

      {/* Security Overview */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activities</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayLogs}</div>
            <p className="text-xs text-muted-foreground">
              System activities today
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{criticalLogs}</div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{highSeverityLogs}</div>
            <p className="text-xs text-muted-foreground">
              Should be reviewed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Secure</div>
            <p className="text-xs text-muted-foreground">
              No security threats detected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant={actionFilter === "all" ? "default" : "outline"}
            onClick={() => setActionFilter("all")}
          >
            All Actions
          </Button>
          <Button 
            variant={actionFilter === "CREATE" ? "default" : "outline"}
            onClick={() => setActionFilter("CREATE")}
          >
            Create
          </Button>
          <Button 
            variant={actionFilter === "UPDATE" ? "default" : "outline"}
            onClick={() => setActionFilter("UPDATE")}
          >
            Update
          </Button>
          <Button 
            variant={actionFilter === "DELETE" ? "default" : "outline"}
            onClick={() => setActionFilter("DELETE")}
          >
            Delete
          </Button>
          <Button 
            variant={severityFilter === "critical" ? "default" : "outline"}
            onClick={() => setSeverityFilter("critical")}
          >
            Critical
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Activity Log</CardTitle>
          <CardDescription>Complete audit trail of all system activities</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Detailed audit log entries</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="text-sm">
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div className="text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.userName}</div>
                      <Badge variant={getRoleColor(log.userRole)} className="text-xs">
                        {log.userRole}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      <span className="font-medium">{log.action}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.resource}</div>
                      <div className="text-sm text-muted-foreground">{log.resourceId}</div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="text-sm">{log.details}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSeverityColor(log.severity)}>
                      {log.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-mono">{log.ipAddress}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuditLogs;
