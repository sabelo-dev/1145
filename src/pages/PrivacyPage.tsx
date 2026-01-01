import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Eye, Lock, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-gray-600 mt-2">Last updated: January 2025</p>
        </div>

        <div className="space-y-8">
          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Our Commitment to Privacy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">
                  At 1145 Lifestyle, we are committed to protecting your privacy and ensuring the security of your
                  personal information. This Privacy Policy explains how we collect, use, and safeguard your data.
                </p>
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    We comply with the Protection of Personal Information Act (POPIA) and international privacy
                    standards.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Information Collection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Information We Collect
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Personal Information</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Name and contact information (email, phone, address)</li>
                  <li>• Account credentials and preferences</li>
                  <li>• Payment information (processed securely by third parties)</li>
                  <li>• Order history and purchase behavior</li>
                  <li>• Communication with customer support</li>
                </ul>

                <h4 className="font-semibold mt-6">Automatic Information</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Device information (browser, operating system)</li>
                  <li>• IP address and location data</li>
                  <li>• Website usage patterns and analytics</li>
                  <li>• Cookies and similar tracking technologies</li>
                </ul>

                <h4 className="font-semibold mt-6">Vendor Information</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Business registration details</li>
                  <li>• Tax and banking information</li>
                  <li>• Product catalogs and inventory data</li>
                  <li>• Sales performance metrics</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="h-5 w-5 mr-2" />
                How We Use Your Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Service Provision</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Process orders and payments</li>
                  <li>• Manage your account and preferences</li>
                  <li>• Provide customer support</li>
                  <li>• Send order confirmations and updates</li>
                </ul>

                <h4 className="font-semibold mt-6">Platform Improvement</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Analyze usage patterns and trends</li>
                  <li>• Improve website functionality</li>
                  <li>• Develop new features and services</li>
                  <li>• Conduct market research</li>
                </ul>

                <h4 className="font-semibold mt-6">Marketing and Communication</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Send promotional emails (with your consent)</li>
                  <li>• Personalize product recommendations</li>
                  <li>• Conduct surveys and feedback collection</li>
                  <li>• Inform you about new products and services</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Information Sharing */}
          <Card>
            <CardHeader>
              <CardTitle>Information Sharing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">We Share Information With:</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>
                    • <strong>Vendors:</strong> Order details for fulfillment
                  </li>
                  <li>
                    • <strong>Payment Processors:</strong> Secure payment processing
                  </li>
                  <li>
                    • <strong>Shipping Partners:</strong> Delivery information
                  </li>
                  <li>
                    • <strong>Service Providers:</strong> Analytics, marketing, and support
                  </li>
                </ul>

                <h4 className="font-semibold mt-6">We Do Not:</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• Sell your personal information to third parties</li>
                  <li>• Share sensitive data without your consent</li>
                  <li>• Use your information for purposes not disclosed</li>
                </ul>

                <Alert className="mt-4">
                  <AlertDescription>
                    We may disclose information when required by law or to protect our rights and the safety of our
                    users.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Data Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Security Measures</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• SSL/TLS encryption for data transmission</li>
                  <li>• Secure database storage with encryption</li>
                  <li>• Regular security audits and monitoring</li>
                  <li>• Access controls and authentication</li>
                  <li>• Employee training on data protection</li>
                </ul>

                <h4 className="font-semibold mt-6">Payment Security</h4>
                <p className="text-gray-700">
                  We use industry-standard payment processors that comply with PCI DSS standards. We do not store credit
                  card information on our servers.
                </p>

                <h4 className="font-semibold mt-6">Data Breach Response</h4>
                <p className="text-gray-700">
                  In the unlikely event of a data breach, we will notify affected users and relevant authorities within
                  72 hours as required by law.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card>
            <CardHeader>
              <CardTitle>Your Privacy Rights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Under POPIA, You Have the Right To:</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>
                    • <strong>Access:</strong> Request copies of your personal data
                  </li>
                  <li>
                    • <strong>Correction:</strong> Update or correct inaccurate information
                  </li>
                  <li>
                    • <strong>Deletion:</strong> Request deletion of your data (subject to legal requirements)
                  </li>
                  <li>
                    • <strong>Portability:</strong> Receive your data in a portable format
                  </li>
                  <li>
                    • <strong>Objection:</strong> Object to processing for marketing purposes
                  </li>
                  <li>
                    • <strong>Restriction:</strong> Request limitation of data processing
                  </li>
                </ul>

                <h4 className="font-semibold mt-6">How to Exercise Your Rights</h4>
                <p className="text-gray-700">
                  To exercise any of these rights, please contact us at privacy@lsiapp.com. We will respond to your
                  request within 30 days.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cookies */}
          <Card>
            <CardHeader>
              <CardTitle>Cookies and Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-semibold">Types of Cookies We Use:</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>
                    • <strong>Essential:</strong> Required for basic website functionality
                  </li>
                  <li>
                    • <strong>Performance:</strong> Help us understand how you use our site
                  </li>
                  <li>
                    • <strong>Functional:</strong> Remember your preferences and settings
                  </li>
                  <li>
                    • <strong>Marketing:</strong> Deliver relevant advertisements (with consent)
                  </li>
                </ul>

                <h4 className="font-semibold mt-6">Managing Cookies</h4>
                <p className="text-gray-700">
                  You can control cookies through your browser settings. Note that disabling certain cookies may affect
                  website functionality.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Third-Party Services */}
          <Card>
            <CardHeader>
              <CardTitle>Third-Party Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">We use third-party services including:</p>
                <ul className="space-y-2 text-gray-700">
                  <li>• Google Analytics for website analytics</li>
                  <li>• Payment gateways for secure transactions</li>
                  <li>• Email service providers for communications</li>
                  <li>• Cloud hosting services for data storage</li>
                </ul>

                <p className="text-gray-700 mt-4">
                  These services have their own privacy policies, and we encourage you to review them.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Retention */}
          <Card>
            <CardHeader>
              <CardTitle>Data Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">We retain your information for as long as:</p>
                <ul className="space-y-2 text-gray-700">
                  <li>• Your account remains active</li>
                  <li>• Required to provide services</li>
                  <li>• Necessary for legal compliance</li>
                  <li>• Needed to resolve disputes</li>
                </ul>

                <p className="text-gray-700 mt-4">When data is no longer needed, we securely delete or anonymize it.</p>
              </div>
            </CardContent>
          </Card>

          {/* Children's Privacy */}
          <Card>
            <CardHeader>
              <CardTitle>Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">
                  Our services are not directed to children under 18. We do not knowingly collect personal information
                  from children. If you believe we have collected information from a child, please contact us
                  immediately.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Policy Updates */}
          <Card>
            <CardHeader>
              <CardTitle>Policy Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">
                  We may update this Privacy Policy to reflect changes in our practices or legal requirements. We will
                  notify you of significant changes via email or website notice.
                </p>
                <p className="text-gray-700">
                  Continued use of our services after policy updates constitutes acceptance of the changes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">
                  If you have questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="text-gray-700">
                  <p>
                    <strong>Privacy Officer:</strong> privacy@1145lifestyle.com
                  </p>
                  <p>
                    <strong>General Inquiries:</strong> support@1145lifestyle.com
                  </p>
                  <p>
                    <strong>Phone:</strong> +27-76-159-7719
                  </p>
                  <p>
                    <strong>Address:</strong>eCommerce Street, International
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
