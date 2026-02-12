
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Store, 
  Upload, 
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Save
} from "lucide-react";

const VendorProfile = () => {
  const [isEditing, setIsEditing] = useState(false);

  // Mock data - in real app, this would come from API
  const profileData = {
    storeName: "Tech Store",
    description: "Your one-stop shop for the latest tech gadgets and accessories.",
    address: "123 Tech Street, Digital City, DC 12345",
    phone: "+1 (555) 123-4567",
    email: "contact@techstore.com",
    logoUrl: "",
    verificationStatus: "approved", // pending, approved, rejected
    profileCompletion: 85,
    bankInfo: {
      accountNumber: "****1234",
      routingNumber: "****5678",
      accountHolder: "Tech Store LLC"
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "default";
      case "pending": return "outline";
      case "rejected": return "destructive";
      default: return "outline";
    }
  };

  const requiredFields = [
    { name: "Store Name", completed: !!profileData.storeName },
    { name: "Description", completed: !!profileData.description },
    { name: "Address", completed: !!profileData.address },
    { name: "Phone", completed: !!profileData.phone },
    { name: "Bank Info", completed: !!profileData.bankInfo.accountNumber },
    { name: "Store Logo", completed: !!profileData.logoUrl }
  ];

  const completedFields = requiredFields.filter(field => field.completed).length;
  const completionPercentage = (completedFields / requiredFields.length) * 100;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vendor Profile</h2>
          <p className="text-muted-foreground">
            Manage your store information and verification status.
          </p>
        </div>
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant={isEditing ? "outline" : "default"}
        >
          {isEditing ? "Cancel" : "Edit Profile"}
        </Button>
      </div>

      {/* Verification Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(profileData.verificationStatus)}
              Verification Status
            </CardTitle>
            <Badge variant={getStatusColor(profileData.verificationStatus)}>
              {profileData.verificationStatus}
            </Badge>
          </div>
          {profileData.verificationStatus === "pending" && (
            <CardDescription>
              Your profile is under review. You'll be notified once approved.
            </CardDescription>
          )}
          {profileData.verificationStatus === "rejected" && (
            <CardDescription className="text-red-600">
              Your profile was rejected. Please review and update your information.
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* Profile Completion */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Completion</CardTitle>
          <CardDescription>
            Complete all required fields to start listing products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedFields}/{requiredFields.length} completed
              </span>
            </div>
            <Progress value={completionPercentage} className="w-full" />
            
            <div className="grid gap-2 md:grid-cols-2">
              {requiredFields.map((field, index) => (
                <div key={index} className="flex items-center gap-2">
                  {field.completed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">{field.name}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Store Information
          </CardTitle>
          <CardDescription>
            Update your store details and branding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Store Name</Label>
              <Input 
                id="store-name" 
                defaultValue={profileData.storeName}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Contact Email</Label>
              <Input 
                id="email" 
                type="email"
                defaultValue={profileData.email}
                disabled={!isEditing}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Store Description</Label>
            <Textarea 
              id="description" 
              defaultValue={profileData.description}
              rows={3}
              disabled={!isEditing}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address">Business Address</Label>
            <Textarea 
              id="address" 
              defaultValue={profileData.address}
              rows={2}
              disabled={!isEditing}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input 
              id="phone" 
              defaultValue={profileData.phone}
              disabled={!isEditing}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="logo">Store Logo</Label>
            <div className="flex items-center gap-4">
              <Input 
                id="logo" 
                type="file"
                accept="image/*"
                disabled={!isEditing}
              />
              <Button variant="outline" size="sm" disabled={!isEditing}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>

          {isEditing && (
            <Button className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Bank Information */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Information</CardTitle>
          <CardDescription>
            Bank details for receiving payouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account-holder">Account Holder</Label>
              <Input 
                id="account-holder" 
                defaultValue={profileData.bankInfo.accountHolder}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-number">Account Number</Label>
              <Input 
                id="account-number" 
                defaultValue={profileData.bankInfo.accountNumber}
                disabled={!isEditing}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="routing-number">Routing Number</Label>
            <Input 
              id="routing-number" 
              defaultValue={profileData.bankInfo.routingNumber}
              disabled={!isEditing}
            />
          </div>

          {isEditing && (
            <Button variant="outline" className="w-full">
              Update Payment Method
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorProfile;
