import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mail, Phone, MapPin, Clock } from "lucide-react";

const ContactPage: React.FC = () => {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="wwe-container py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-wwe-navy mb-4">Contact Us</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            We're here to help! Get in touch with our team for any questions, support, or feedback. We'd love to hear
            from you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Get in Touch
                </CardTitle>
                <CardDescription>Choose your preferred way to contact us</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                  <Phone className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">WhatsApp</p>
                    <p className="text-green-700">0761597719</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">General Support</p>
                    <p className="text-blue-700">support@1145lifestyle.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                  <Mail className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-purple-900">Sales Inquiries</p>
                    <p className="text-purple-700">sales@1145lifestyle.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Address</p>
                    <p className="text-gray-700">E-Commerce Street, International</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-900">Business Hours</p>
                    <p className="text-orange-700">Mon - Fri: 8:00 AM - 6:00 PM</p>
                    <p className="text-orange-700">Sat: 9:00 AM - 4:00 PM</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle>Send us a Message</CardTitle>
              <CardDescription>Fill out the form below and we'll get back to you as soon as possible</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium mb-2">
                      First Name
                    </label>
                    <Input id="firstName" placeholder="Your first name" />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium mb-2">
                      Last Name
                    </label>
                    <Input id="lastName" placeholder="Your last name" />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email Address
                  </label>
                  <Input id="email" type="email" placeholder="your.email@example.com" />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-2">
                    Subject
                  </label>
                  <Input id="subject" placeholder="What is this about?" />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Message
                  </label>
                  <Textarea id="message" placeholder="Tell us more about your inquiry..." rows={6} />
                </div>

                <Button type="submit" className="w-full bg-wwe-navy hover:bg-wwe-navy/90">
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
