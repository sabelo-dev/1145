import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Car,
  FileCheck,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { verificationService, type VerificationStatus } from "@/services/driverService";

interface DriverVerificationProps {
  driver: {
    id: string;
    name: string;
    phone: string | null;
    license_number: string | null;
    vehicle_registration: string | null;
    status: string;
  } | null;
}

const DriverVerification: React.FC<DriverVerificationProps> = ({ driver }) => {
  if (!driver) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading verification status...</p>
        </CardContent>
      </Card>
    );
  }

  const verificationStatus = verificationService.getVerificationStatus(driver as any);
  const progress = verificationService.getVerificationProgress(verificationStatus);

  const getStatusIcon = (verified: boolean) => {
    return verified ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <Clock className="h-5 w-5 text-amber-500" />
    );
  };

  const getOverallStatusBadge = (status: VerificationStatus['overall_status']) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500">Verified</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-amber-600 border-amber-400">Expired</Badge>;
      default:
        return <Badge variant="secondary">Pending Verification</Badge>;
    }
  };

  const verificationItems = [
    {
      icon: User,
      label: "Identity Verification",
      description: "Phone number and profile verified",
      verified: verificationStatus.identity_verified,
    },
    {
      icon: FileCheck,
      label: "Driver's License",
      description: "Valid license number on file",
      verified: verificationStatus.license_verified,
    },
    {
      icon: Car,
      label: "Vehicle Registration",
      description: "Vehicle documents verified",
      verified: verificationStatus.vehicle_verified,
    },
    {
      icon: Shield,
      label: "Background Check",
      description: "Account approved by admin",
      verified: verificationStatus.background_check,
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Verification & KYC Status</h2>

      {/* Overall Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Verification Status
            </CardTitle>
            {getOverallStatusBadge(verificationStatus.overall_status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Verification Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {verificationStatus.overall_status !== 'verified' && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Complete Your Verification
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Verified drivers get priority access to high-value deliveries and can earn up to 25% more.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {verificationItems.map((item, index) => (
              <div
                key={index}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  item.verified
                    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                    : "bg-muted/50 border-border"
                }`}
              >
                <div
                  className={`p-2 rounded-full ${
                    item.verified
                      ? "bg-green-100 dark:bg-green-900"
                      : "bg-muted"
                  }`}
                >
                  <item.icon
                    className={`h-5 w-5 ${
                      item.verified ? "text-green-600" : "text-muted-foreground"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{item.label}</h4>
                    {getStatusIcon(item.verified)}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Required Documents */}
      {verificationStatus.overall_status !== 'verified' && (
        <Card>
          <CardHeader>
            <CardTitle>Required Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To complete verification, please ensure the following information is provided in your profile settings:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                {verificationStatus.identity_verified ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                Valid phone number
              </li>
              <li className="flex items-center gap-2">
                {verificationStatus.license_verified ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                Driver's license number
              </li>
              <li className="flex items-center gap-2">
                {verificationStatus.vehicle_verified ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                Vehicle registration number
              </li>
            </ul>
            <Button variant="outline" className="w-full mt-4">
              Update Profile Settings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DriverVerification;
