import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw, CheckCircle, AlertCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ReturnsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/shop" className="inline-flex items-center text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Returns & Refunds</h1>
          <p className="text-gray-600 mt-2">Information about our return policy and refund process</p>
        </div>

        <div className="space-y-8">
          {/* Return Policy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <RotateCcw className="h-5 w-5 mr-2" />
                Return Policy
              </CardTitle>
              <CardDescription>
                We want you to be completely satisfied with your purchase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>30-Day Return Window:</strong> You have 30 days from delivery to return most items for a full refund.
                  </AlertDescription>
                </Alert>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold text-green-700 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Returnable Items
                    </h3>
                    <ul className="text-sm text-gray-600 mt-2 space-y-1">
                      <li>• Unopened electronics</li>
                      <li>• Clothing with tags attached</li>
                      <li>• Books in original condition</li>
                      <li>• Home & kitchen items (unused)</li>
                      <li>• Furniture (unassembled)</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold text-red-700 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Non-Returnable Items
                    </h3>
                    <ul className="text-sm text-gray-600 mt-2 space-y-1">
                      <li>• Personal care items</li>
                      <li>• Intimate apparel</li>
                      <li>• Perishable goods</li>
                      <li>• Custom/personalized items</li>
                      <li>• Digital downloads</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Return Process */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="h-5 w-5 mr-2" />
                How to Return an Item
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <h4 className="font-semibold">Initiate Return</h4>
                    <p className="text-gray-600 text-sm">Log into your account and select the order you want to return. Click "Return Items" and select the items you wish to return.</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <h4 className="font-semibold">Print Return Label</h4>
                    <p className="text-gray-600 text-sm">We'll email you a prepaid return shipping label. Print it and attach it to your package.</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <h4 className="font-semibold">Pack & Ship</h4>
                    <p className="text-gray-600 text-sm">Pack the item(s) securely in the original packaging if possible, and drop off at any courier location.</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <h4 className="font-semibold">Get Refunded</h4>
                    <p className="text-gray-600 text-sm">Once we receive and inspect your return, we'll process your refund within 3-5 business days.</p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Button asChild>
                    <Link to="/account">Start a Return</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Refund Information */}
          <Card>
            <CardHeader>
              <CardTitle>Refund Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900">Processing Time</h4>
                  <p className="text-gray-700">Refunds are processed within 3-5 business days after we receive your returned item.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">Refund Method</h4>
                  <p className="text-gray-700">Refunds will be issued to your original payment method. Bank transfers may take 5-10 business days to appear in your account.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">Partial Refunds</h4>
                  <p className="text-gray-700">Items returned in used or damaged condition may receive a partial refund based on the item's condition.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">Return Shipping</h4>
                  <p className="text-gray-700">We provide free return shipping labels for eligible returns. Original shipping costs are non-refundable unless the return is due to our error.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exchange Policy */}
          <Card>
            <CardHeader>
              <CardTitle>Exchanges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-gray-700">
                  We currently don't offer direct exchanges. To exchange an item, please return the original item for a refund and place a new order for the desired item.
                </p>
                <p className="text-gray-700">
                  This ensures you get the item you want as quickly as possible and guarantees current pricing and availability.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-gray-700">
                  If you have any questions about returns or need assistance with the return process, please don't hesitate to contact us.
                </p>
                <div className="flex space-x-4">
                  <Button asChild variant="outline">
                    <Link to="/contact">Contact Support</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/faq">View FAQ</Link>
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

export default ReturnsPage;