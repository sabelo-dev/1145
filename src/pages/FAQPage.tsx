
import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const FAQPage: React.FC = () => {
  const faqCategories = [
    {
      title: "Orders & Shipping",
      faqs: [
        {
          question: "How long does shipping take?",
          answer: "Standard shipping typically takes 3-5 business days within South Africa. Express shipping is available for next-day delivery in major cities."
        },
        {
          question: "Do you offer international shipping?",
          answer: "Yes, we ship internationally to most countries. International shipping takes 7-14 business days depending on the destination."
        },
        {
          question: "How can I track my order?",
          answer: "Once your order ships, you'll receive a tracking number via email. You can track your package on our website or the courier's website."
        },
        {
          question: "What are your shipping costs?",
          answer: "Shipping costs vary by location and order size. Free shipping is available on orders over R500 within South Africa."
        }
      ]
    },
    {
      title: "Returns & Refunds",
      faqs: [
        {
          question: "What is your return policy?",
          answer: "We offer a 30-day return policy for most items. Products must be unused, in original packaging, and in resaleable condition."
        },
        {
          question: "How do I initiate a return?",
          answer: "Contact our customer service team or log into your account to start a return. We'll provide you with a return label and instructions."
        },
        {
          question: "When will I receive my refund?",
          answer: "Refunds are processed within 3-5 business days after we receive your returned item. It may take an additional 5-7 days to appear on your statement."
        },
        {
          question: "Are there any items that cannot be returned?",
          answer: "Yes, certain items like personalized products, perishable goods, and intimate items cannot be returned for hygiene reasons."
        }
      ]
    },
    {
      title: "Payments & Pricing",
      faqs: [
        {
          question: "What payment methods do you accept?",
          answer: "We accept all major credit cards (Visa, MasterCard, American Express), PayPal, EFT, and mobile payments like SnapScan."
        },
        {
          question: "Is it safe to shop on your website?",
          answer: "Yes, our website uses SSL encryption to protect your personal and payment information. We never store your credit card details."
        },
        {
          question: "Do you offer price matching?",
          answer: "Yes, we offer price matching on identical products from authorized retailers. Contact us with proof of the lower price."
        },
        {
          question: "Can I pay in installments?",
          answer: "Yes, we offer payment plans through PayJustNow and Mobicred for qualifying purchases over R500."
        }
      ]
    },
    {
      title: "Products & Inventory",
      faqs: [
        {
          question: "How do I know if an item is in stock?",
          answer: "Stock availability is shown on each product page. If an item is out of stock, you can sign up for notifications when it's back."
        },
        {
          question: "Do you offer product warranties?",
          answer: "Yes, most electronics and appliances come with manufacturer warranties. Extended warranty options are available for many products."
        },
        {
          question: "Can I cancel or modify my order?",
          answer: "Orders can be cancelled or modified within 1 hour of placement. After that, please contact customer service for assistance."
        },
        {
          question: "Do you offer bulk or wholesale pricing?",
          answer: "Yes, we offer special pricing for bulk orders. Contact our sales team at sales@wwecommerce.co.za for a custom quote."
        }
      ]
    },
    {
      title: "Account & Technical",
      faqs: [
        {
          question: "How do I create an account?",
          answer: "Click 'Sign Up' at the top of any page and fill in your details. You can also create an account during checkout."
        },
        {
          question: "I forgot my password. How do I reset it?",
          answer: "Click 'Forgot Password' on the login page and enter your email. We'll send you instructions to reset your password."
        },
        {
          question: "Why can't I add items to my cart?",
          answer: "This could be due to stock limitations or technical issues. Try refreshing the page or clearing your browser cache."
        },
        {
          question: "How do I update my account information?",
          answer: "Log into your account and go to 'My Account' to update your personal information, addresses, and preferences."
        }
      ]
    }
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="wwe-container py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <HelpCircle className="mx-auto h-16 w-16 text-wwe-navy mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold text-wwe-navy mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Find answers to the most common questions about shopping, shipping, returns, and more.
          </p>
        </div>

        {/* Search Bar */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search frequently asked questions..."
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* FAQ Categories */}
        <div className="space-y-8">
          {faqCategories.map((category, categoryIndex) => (
            <Card key={categoryIndex}>
              <CardHeader>
                <CardTitle>{category.title}</CardTitle>
                <CardDescription>
                  Common questions about {category.title.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {category.faqs.map((faq, faqIndex) => (
                    <AccordionItem key={faqIndex} value={`${categoryIndex}-${faqIndex}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Still Need Help Section */}
        <Card className="mt-12">
          <CardHeader className="text-center">
            <CardTitle>Still Need Help?</CardTitle>
            <CardDescription>
              Can't find what you're looking for? Our customer service team is here to help.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">WhatsApp Support</h3>
                <p className="text-sm text-gray-600 mb-2">Quick responses via WhatsApp</p>
                <p className="font-medium">0639776666</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Email Support</h3>
                <p className="text-sm text-gray-600 mb-2">For detailed inquiries</p>
                <p className="font-medium">support@1145lifestyle.com</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Sales Team</h3>
                <p className="text-sm text-gray-600 mb-2">For business inquiries</p>
                <p className="font-medium">sales@1145lifestyle.com</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FAQPage;
