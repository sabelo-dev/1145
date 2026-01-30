import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import {
  User,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  Star,
  MapPin,
  Ban,
  Shield,
  Clock,
  TrendingUp,
} from "lucide-react";

export interface UserDetails {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  role: string;
  is_banned?: boolean;
  created_at: string;
  updated_at: string;
  influencer_username?: string | null;
  // Extended data
  totalOrders?: number;
  totalSpent?: number;
  totalReviews?: number;
  averageRating?: number;
  lastOrderDate?: string | null;
  addresses?: {
    street_address?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    country?: string;
  }[];
}

interface UserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserDetails | null;
  isLoading?: boolean;
}

const UserDetailsDialog: React.FC<UserDetailsDialogProps> = ({
  open,
  onOpenChange,
  user,
  isLoading = false,
}) => {
  if (!user) return null;

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.charAt(0).toUpperCase() || "U";
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "vendor":
        return "outline";
      case "driver":
        return "secondary";
      case "influencer":
        return "default";
      default:
        return "secondary";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const daysSinceJoined = Math.floor(
    (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Header */}
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="text-xl">
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-semibold">
                    {user.name || "No name provided"}
                  </h3>
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role}
                  </Badge>
                  {user.is_banned && (
                    <Badge variant="destructive" className="gap-1">
                      <Ban className="h-3 w-3" />
                      Banned
                    </Badge>
                  )}
                </div>
                {user.influencer_username && (
                  <p className="text-sm text-primary">@{user.influencer_username}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Member for {daysSinceJoined} days
                </p>
              </div>
            </div>

            <Separator />

            {/* Contact Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">
                      {user.phone || "Not provided"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p className="text-sm font-medium">{formatDate(user.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-sm font-medium">{formatDateTime(user.updated_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Activity Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <ShoppingBag className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{user.totalOrders ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">
                      {formatCurrency(user.totalSpent ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <Star className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{user.totalReviews ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Reviews Written</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                    <p className="text-2xl font-bold">
                      {user.averageRating ? user.averageRating.toFixed(1) : "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Review Rating</p>
                  </div>
                </div>
                {user.lastOrderDate && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Last order: {formatDate(user.lastOrderDate)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Addresses */}
            {user.addresses && user.addresses.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Saved Addresses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {user.addresses.map((address, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">
                        {[
                          address.street_address,
                          address.city,
                          address.province,
                          address.postal_code,
                          address.country,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Incomplete address"}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Account Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Account Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {user.is_banned ? (
                      <Badge variant="destructive">Banned</Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                      >
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Role:</span>
                    <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">User ID:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {user.id.slice(0, 8)}...
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailsDialog;
