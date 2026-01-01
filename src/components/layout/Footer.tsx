import React from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin } from "lucide-react";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-wwe-navy text-white pt-12 pb-6">
      <div className="wwe-container">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About Column */}
          <div>
            <h3 className="text-lg font-semibold mb-4">About 1145 Lifestyle</h3>
            <p className="text-sm text-gray-300 mb-4">
              1145 Lifestyle connecting buyers and sellers since 2025. Our mission is to provide the best shopping
              experience with quality products and exceptional service.
            </p>
            <div className="flex space-x-4 mt-4">
              <a href="https://facebook.com/lsionlinemall/" className="text-gray-300 hover:text-white">
                <Facebook size={20} />
              </a>
              <a href="https://x.com/lsionlinemall/" className="text-gray-300 hover:text-white">
                <Twitter size={20} />
              </a>
              <a href="https://www.instagram.com/lsionlinemall/" className="text-gray-300 hover:text-white">
                <Instagram size={20} />
              </a>
              <a href="https://youtube.com//@lsionlinemall" className="text-gray-300 hover:text-white">
                <Youtube size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <Link to="/shop" className="hover:text-white">
                  Shop
                </Link>
              </li>
              <li>
                <Link to="/categories" className="hover:text-white">
                  Categories
                </Link>
              </li>
              <li>
                <Link to="/deals" className="hover:text-white">
                  Deals & Promotions
                </Link>
              </li>
              <li>
                <Link to="/new-arrivals" className="hover:text-white">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link to="/best-sellers" className="hover:text-white">
                  Best Sellers
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Customer Service</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <Link to="/contact" className="hover:text-white">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-white">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/shipping" className="hover:text-white">
                  Shipping & Delivery
                </Link>
              </li>
              <li>
                <Link to="/returns" className="hover:text-white">
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start">
                <MapPin size={18} className="mr-2 mt-1 flex-shrink-0" />
                <span>RSA</span>
              </li>
              <li className="flex items-center">
                <Phone size={18} className="mr-2 flex-shrink-0" />
                <span>+27 (63) 977-6666</span>
              </li>
              <li className="flex items-center">
                <Mail size={18} className="mr-2 flex-shrink-0" />
                <span>support@1145lifestyle.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="border-t border-gray-700 mt-10 pt-8 pb-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h4 className="text-lg font-semibold mb-2">Subscribe to our Newsletter</h4>
              <p className="text-sm text-gray-300">
                Get the latest news, updates and special offers delivered directly to your inbox.
              </p>
            </div>
            <div className="flex w-full md:w-auto">
              <input
                type="email"
                placeholder="Your Email Address"
                className="px-4 py-2 rounded-l-md w-full md:w-auto bg-gray-800 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-wwe-gold text-white"
              />
              <button className="px-4 py-2 bg-wwe-gold text-wwe-navy font-medium rounded-r-md hover:bg-opacity-90">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center text-sm text-gray-400 mt-8">
          <p>&copy; {currentYear} 1145 Lifestyle. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
