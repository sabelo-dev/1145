
import React from "react";
import { Link } from "react-router-dom";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

const Navigation: React.FC = () => {
  return (
    <NavigationMenu className="hidden md:flex">
      <NavigationMenuList className="space-x-6">
        <NavigationMenuItem>
          <Link
            to="/"
            className="text-gray-600 hover:text-wwe-navy transition-colors px-3 py-2"
          >
            Home
          </Link>
        </NavigationMenuItem>
        
        <NavigationMenuItem>
          <Link
            to="/shop"
            className="text-gray-600 hover:text-wwe-navy transition-colors px-3 py-2"
          >
            Shop
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger className="text-gray-600 hover:text-wwe-navy">
            Categories
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[400px] p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Clothing</h3>
                  <ul className="space-y-1">
                    <li><Link to="/category/clothing/men" className="text-sm hover:text-wwe-navy">Men's Clothing</Link></li>
                    <li><Link to="/category/clothing/women" className="text-sm hover:text-wwe-navy">Women's Clothing</Link></li>
                    <li><Link to="/category/clothing/kids" className="text-sm hover:text-wwe-navy">Kids' Clothing</Link></li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Home</h3>
                  <ul className="space-y-1">
                    <li><Link to="/category/home-kitchen/appliances" className="text-sm hover:text-wwe-navy">Appliances</Link></li>
                    <li><Link to="/category/home-kitchen/kitchen" className="text-sm hover:text-wwe-navy">Electronics</Link></li>
                    <li><Link to="/category/home-kitchen/furniture" className="text-sm hover:text-wwe-navy">Furniture</Link></li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <Link to="/categories" className="text-sm font-medium text-wwe-navy hover:underline">
                  View All Categories →
                </Link>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link
            to="/best-sellers"
            className="text-gray-600 hover:text-wwe-navy transition-colors px-3 py-2"
          >
            Best Sellers
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link
            to="/deals"
            className="text-gray-600 hover:text-wwe-navy transition-colors px-3 py-2"
          >
            Deals
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link
            to="/auctions"
            className="text-gray-600 hover:text-wwe-navy transition-colors px-3 py-2"
          >
            Auctions
          </Link>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
};

export default Navigation;
