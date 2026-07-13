import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Truck, Clock, MapPin, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ShippingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/shop" className="inline-flex items-center text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Shipping Information</h1>
          <p className="text-gray-600 mt-2">Learn about our shipping policies and delivery options</p>
        </div>

        <div className="space-y-8">
          {/* Shipping Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="h-5 w-5 mr-2" />
                Shipping Options
              </CardTitle>
              <CardDescription>
                We offer various shipping methods to meet your needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-gray-900">Standard Shipping</h3>
                  <p className="text-sm text-gray-600 mt-1">5-7 business days</p>
                  <p className="text-primary font-medium mt-2">R99 - R199</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-gray-900">Express Shipping</h3>
                  <p className="text-sm text-gray-600 mt-1">2-3 business days</p>
                  <p className="text-primary font-medium mt-2">R199 - R299</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-gray-900">Overnight Shipping</h3>
                  <p className="text-sm text-gray-600 mt-1">Next business day</p>
                  <p className="text-primary font-medium mt-2">R399 - R499</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-gray-900">Free Shipping</h3>
                  <p className="text-sm text-gray-600 mt-1">Orders over R1000</p>
                  <p className="text-green-600 font-medium mt-2">FREE</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Processing Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Processing Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <strong>Order Processing:</strong> All orders are processed within 1-2 business days.
                </p>
                <p className="text-gray-700">
                  <strong>Cut-off Time:</strong> Orders placed before 2:00 PM (SAST) on business days will be processed the same day.
                </p>
                <p className="text-gray-700">
                  <strong>Weekends & Holidays:</strong> Orders placed on weekends or holidays will be processed on the next business day.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Areas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Delivery Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Major Cities</h3>
                  <p className="text-gray-700">Cape Town, Johannesburg, Durban, Pretoria, Port Elizabeth</p>
                  <p className="text-sm text-gray-600">Standard delivery times apply</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Other Areas</h3>
                  <p className="text-gray-700">All other areas within South Africa</p>
                  <p className="text-sm text-gray-600">May require additional 1-2 business days</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Remote Areas</h3>
                  <p className="text-gray-700">Rural and remote locations</p>
                  <p className="text-sm text-gray-600">Additional charges may apply</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Costs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Shipping Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-gray-700">
                  Shipping costs are calculated based on the size, weight, and destination of your order.
                </p>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900">Free Shipping Threshold</h4>
                  <p className="text-blue-800">
                    Enjoy free standard shipping on all orders over R1000 within major cities.
                  </p>
                </div>
                <p className="text-gray-700">
                  <strong>Note:</strong> Actual shipping costs will be calculated and displayed at checkout before you complete your purchase.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Order Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-gray-700">
                  Once your order ships, you'll receive a confirmation email with tracking information.
                </p>
                <p className="text-gray-700">
                  You can track your package using the tracking number provided or through your account dashboard.
                </p>
                <div className="mt-4">
                  <Button asChild>
                    <Link to="/account">Track Your Orders</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ShippingPage;