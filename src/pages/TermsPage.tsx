import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Scale, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-gray-600 mt-2">Last updated: January 2025</p>
        </div>

        <div className="space-y-8">
          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Agreement Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">
                  Welcome to 1145 Lifestyle. These Terms of Service ("Terms") govern your use of our website and
                  services. By using our platform, you agree to be bound by these terms.
                </p>
                <p className="text-gray-700">
                  If you do not agree with any of these terms, you may not use our services.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Account Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Account Registration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Account Requirements</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• You must be at least 18 years old to create an account</li>
                  <li>• You must provide accurate and complete information</li>
                  <li>• You are responsible for maintaining account security</li>
                  <li>• One account per person or business entity</li>
                </ul>

                <h4 className="font-semibold mt-6">Account Responsibilities</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Keep your login credentials secure</li>
                  <li>• Notify us immediately of unauthorized access</li>
                  <li>• Update account information when necessary</li>
                  <li>• Use the account only for lawful purposes</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Platform Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Acceptable Use</h4>
                <p className="text-gray-700">You may use our platform to:</p>
                <ul className="space-y-2 text-gray-700">
                  <li>• Browse and purchase products</li>
                  <li>• Create and manage your account</li>
                  <li>• Contact customer support</li>
                  <li>• Leave reviews and feedback</li>
                </ul>

                <h4 className="font-semibold mt-6">Prohibited Activities</h4>
                <p className="text-gray-700">You may not:</p>
                <ul className="space-y-2 text-gray-700">
                  <li>• Use the platform for illegal activities</li>
                  <li>• Attempt to breach security measures</li>
                  <li>• Upload malicious content or code</li>
                  <li>• Impersonate others or provide false information</li>
                  <li>• Interfere with platform functionality</li>
                  <li>• Violate intellectual property rights</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Orders and Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Scale className="h-5 w-5 mr-2" />
                Orders and Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Order Processing</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• All orders are subject to acceptance and availability</li>
                  <li>• We reserve the right to refuse or cancel orders</li>
                  <li>• Prices are subject to change without notice</li>
                  <li>• Product availability is not guaranteed</li>
                </ul>

                <h4 className="font-semibold mt-6">Payment Terms</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Payment is required at time of order</li>
                  <li>• We accept major credit cards and bank transfers</li>
                  <li>• All prices include applicable taxes</li>
                  <li>• Currency is South African Rand (ZAR)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Vendor Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor Agreements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Vendor Responsibilities</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Provide accurate product information</li>
                  <li>• Maintain adequate inventory levels</li>
                  <li>• Process orders in a timely manner</li>
                  <li>• Comply with applicable laws and regulations</li>
                  <li>• Respond to customer inquiries promptly</li>
                </ul>

                <h4 className="font-semibold mt-6">Platform Commission</h4>
                <p className="text-gray-700">
                  Vendor commission rates and payment terms are outlined in separate vendor agreements.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Intellectual Property */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Intellectual Property
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Our Rights</h4>
                <p className="text-gray-700">
                  All content on our platform, including text, graphics, logos, and software, is owned by SIM Online or
                  our licensors and is protected by copyright and trademark laws.
                </p>

                <h4 className="font-semibold mt-6">User Content</h4>
                <p className="text-gray-700">
                  By submitting content (reviews, comments, etc.), you grant us a non-exclusive, royalty-free license to
                  use, modify, and display that content.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Disclaimers */}
          <Card>
            <CardHeader>
              <CardTitle>Disclaimers and Limitations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Service Availability</h4>
                <p className="text-gray-700">
                  We strive to maintain platform availability but cannot guarantee uninterrupted service. We reserve the
                  right to modify or discontinue services at any time.
                </p>

                <h4 className="font-semibold mt-6">Limitation of Liability</h4>
                <p className="text-gray-700">
                  Our liability is limited to the amount you paid for the specific product or service. We are not liable
                  for indirect, incidental, or consequential damages.
                </p>

                <h4 className="font-semibold mt-6">Product Accuracy</h4>
                <p className="text-gray-700">
                  While we strive for accuracy, product descriptions, images, and pricing may contain errors. We reserve
                  the right to correct any errors.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card>
            <CardHeader>
              <CardTitle>Account Termination</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">
                  We may terminate or suspend your account at any time for violations of these terms or for any other
                  reason at our discretion.
                </p>
                <p className="text-gray-700">You may close your account at any time by contacting customer support.</p>
                <p className="text-gray-700">Upon termination, your right to use the platform ceases immediately.</p>
              </div>
            </CardContent>
          </Card>

          {/* Governing Law */}
          <Card>
            <CardHeader>
              <CardTitle>Governing Law</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">
                  These terms are governed by the laws of South Africa. Any disputes will be resolved in the courts of
                  South Africa.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">If you have questions about these Terms of Service, please contact us:</p>
                <div className="text-gray-700">
                  <p>Email: legal@1145lifestyle.com</p>
                  <p>Phone: +27-76-159-7719</p>
                  <p>Address: eCommerce Street, International</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
