import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mail, Phone, MapPin, Clock, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ContactPage: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.firstName || !form.email || !form.subject || !form.message) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: form,
      });

      if (error) throw error;

      setSubmitted(true);
      toast({ title: "Message sent!", description: "We'll get back to you as soon as possible." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="wwe-container py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Contact Us</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
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
                <a href="https://wa.me/27761597719" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg hover:ring-1 hover:ring-green-300 transition-all">
                  <Phone className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-300">WhatsApp</p>
                    <p className="text-green-700 dark:text-green-400">0761597719</p>
                  </div>
                </a>

                <a href="mailto:support@1145lifestyle.com" className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg hover:ring-1 hover:ring-blue-300 transition-all">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-300">General Support</p>
                    <p className="text-blue-700 dark:text-blue-400">support@1145lifestyle.com</p>
                  </div>
                </a>

                <a href="mailto:sales@1145lifestyle.com" className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg hover:ring-1 hover:ring-purple-300 transition-all">
                  <Mail className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-purple-900 dark:text-purple-300">Sales Inquiries</p>
                    <p className="text-purple-700 dark:text-purple-400">sales@1145lifestyle.com</p>
                  </div>
                </a>

                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Address</p>
                    <p className="text-muted-foreground">E-Commerce Street, International</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-300">Business Hours</p>
                    <p className="text-orange-700 dark:text-orange-400">Mon - Fri: 8:00 AM - 6:00 PM</p>
                    <p className="text-orange-700 dark:text-orange-400">Sat: 9:00 AM - 4:00 PM</p>
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
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">Message Sent!</h3>
                  <p className="text-muted-foreground mb-6">
                    Thank you for reaching out. Our team will review your message and get back to you within 24 hours.
                  </p>
                  <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ firstName: "", lastName: "", email: "", subject: "", message: "" }); }}>
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium mb-2">
                        First Name <span className="text-destructive">*</span>
                      </label>
                      <Input id="firstName" placeholder="Your first name" value={form.firstName} onChange={handleChange} required />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium mb-2">
                        Last Name
                      </label>
                      <Input id="lastName" placeholder="Your last name" value={form.lastName} onChange={handleChange} />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email Address <span className="text-destructive">*</span>
                    </label>
                    <Input id="email" type="email" placeholder="your.email@example.com" value={form.email} onChange={handleChange} required />
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium mb-2">
                      Subject <span className="text-destructive">*</span>
                    </label>
                    <Input id="subject" placeholder="What is this about?" value={form.subject} onChange={handleChange} required />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium mb-2">
                      Message <span className="text-destructive">*</span>
                    </label>
                    <Textarea id="message" placeholder="Tell us more about your inquiry..." rows={6} value={form.message} onChange={handleChange} required />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                        Sending...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        Send Message
                      </div>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
