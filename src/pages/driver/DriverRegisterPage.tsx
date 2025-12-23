import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, Car, Bike, Clock, DollarSign, MapPin, Loader2, CheckCircle } from "lucide-react";

const DriverRegisterPage: React.FC = () => {
  const { user, isDriver, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    vehicleType: "car",
    licenseNumber: "",
    vehicleRegistration: "",
  });
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Not Logged In",
        description: "Please log in to register as a driver.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    if (!formData.name || !formData.phone || !formData.licenseNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (!agreed) {
      toast({
        title: "Terms Required",
        description: "Please agree to the terms and conditions.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create driver record
      const { error: driverError } = await supabase
        .from('drivers')
        .insert({
          user_id: user.id,
          name: formData.name,
          phone: formData.phone,
          vehicle_type: formData.vehicleType,
          license_number: formData.licenseNumber,
          vehicle_registration: formData.vehicleRegistration,
          status: 'pending',
        });

      if (driverError) throw driverError;

      // Add driver role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'driver',
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError;
      }

      toast({
        title: "Registration Submitted!",
        description: "Your driver application has been submitted. You'll be notified once approved.",
      });

      await refreshUserProfile();
      navigate("/consumer/dashboard");
    } catch (error: any) {
      console.error('Driver registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register as driver. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDriver) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <SEO title="Driver Registration" description="Register as a delivery driver" />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Already Registered</h2>
              <p className="text-muted-foreground mb-4">
                You're already registered as a driver. Access your dashboard to start delivering.
              </p>
              <Button onClick={() => navigate("/driver/dashboard")}>
                Go to Driver Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SEO 
        title="Become a Driver" 
        description="Join our delivery team and earn money on your schedule. Register as a driver today." 
      />
      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
              <Truck className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Become a Delivery Driver</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Join our growing network of drivers. Earn money on your own schedule while helping customers receive their orders.
            </p>
          </div>

          {/* Benefits Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6 text-center">
                <Clock className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold mb-1">Flexible Hours</h3>
                <p className="text-sm text-muted-foreground">Work when you want, as much as you want</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <DollarSign className="h-8 w-8 mx-auto mb-3 text-green-500" />
                <h3 className="font-semibold mb-1">Competitive Pay</h3>
                <p className="text-sm text-muted-foreground">Earn per delivery plus tips</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <MapPin className="h-8 w-8 mx-auto mb-3 text-blue-500" />
                <h3 className="font-semibold mb-1">Local Deliveries</h3>
                <p className="text-sm text-muted-foreground">Deliver in your area, know your routes</p>
              </CardContent>
            </Card>
          </div>

          {/* Registration Form */}
          <Card>
            <CardHeader>
              <CardTitle>Driver Application</CardTitle>
              <CardDescription>
                Fill in your details to apply as a delivery driver. Your application will be reviewed within 24-48 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Please log in to register as a driver.</p>
                  <Button onClick={() => navigate("/login")}>Log In</Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+27 123 456 789"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vehicleType">Vehicle Type *</Label>
                      <Select 
                        value={formData.vehicleType} 
                        onValueChange={(value) => setFormData({ ...formData, vehicleType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="car">
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4" />
                              Car
                            </div>
                          </SelectItem>
                          <SelectItem value="motorcycle">
                            <div className="flex items-center gap-2">
                              <Bike className="h-4 w-4" />
                              Motorcycle
                            </div>
                          </SelectItem>
                          <SelectItem value="bicycle">
                            <div className="flex items-center gap-2">
                              <Bike className="h-4 w-4" />
                              Bicycle
                            </div>
                          </SelectItem>
                          <SelectItem value="van">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              Van
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="licenseNumber">Driver's License Number *</Label>
                      <Input
                        id="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                        placeholder="Enter your license number"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicleRegistration">Vehicle Registration (Optional)</Label>
                    <Input
                      id="vehicleRegistration"
                      value={formData.vehicleRegistration}
                      onChange={(e) => setFormData({ ...formData, vehicleRegistration: e.target.value })}
                      placeholder="Enter vehicle registration number"
                    />
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox 
                      id="terms" 
                      checked={agreed}
                      onCheckedChange={(checked) => setAgreed(checked === true)}
                    />
                    <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                      I agree to the terms and conditions, including background check requirements and driver guidelines. I confirm that all information provided is accurate.
                    </Label>
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting Application...
                      </>
                    ) : (
                      <>
                        <Truck className="mr-2 h-4 w-4" />
                        Submit Driver Application
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DriverRegisterPage;
