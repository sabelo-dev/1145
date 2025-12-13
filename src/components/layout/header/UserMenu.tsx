
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Store, Shield, ChevronDown } from "lucide-react";
import { User as UserType } from "@/types";

interface UserMenuProps {
  user: UserType | null;
  isAdmin: boolean;
  isVendor: boolean;
  logout: () => Promise<void>;
}

const UserMenu: React.FC<UserMenuProps> = ({ user, isAdmin, isVendor, logout }) => {
  console.log('UserMenu props:', { user: !!user, isAdmin, isVendor, userRole: user?.role });
  
  if (!user) {
    return (
      <Link to="/login">
        <Button variant="outline">Sign in</Button>
      </Link>
    );
  }

  const getInitials = (name: string | undefined, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return email[0].toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback className="text-sm">
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden md:flex items-center">
            {user.name || user.email}
            {isAdmin && <Shield className="h-4 w-4 ml-2 text-destructive" />}
            <ChevronDown className="h-4 w-4 ml-1" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuItem asChild>
          <Link to="/account" className="flex items-center">
            <User className="h-4 w-4 mr-2" />
            Account Settings
          </Link>
        </DropdownMenuItem>
        
        {!isVendor && user?.role === 'consumer' && (
          <DropdownMenuItem asChild>
            <Link to="/vendor/register" className="flex items-center">
              <Store className="h-4 w-4 mr-2" />
              Become a Vendor
            </Link>
          </DropdownMenuItem>
        )}
        
        {isVendor && (
          <DropdownMenuItem asChild>
            <Link to="/vendor/dashboard" className="flex items-center">
              <Store className="h-4 w-4 mr-2" />
              Vendor Dashboard
            </Link>
          </DropdownMenuItem>
        )}
        
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/admin/dashboard" className="flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Admin Dashboard
            </Link>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => logout()}
          className="text-destructive focus:text-destructive"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
