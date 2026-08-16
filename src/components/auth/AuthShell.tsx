import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const AuthShell: React.FC<Props> = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
      <Button asChild variant="ghost" size="sm" className="mb-6 gap-2">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </Button>
      <div className="text-center">
        <h2 className="text-3xl font-extrabold text-foreground">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>

    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div className="bg-card border rounded-xl shadow-sm px-6 py-8 sm:px-10">
        {children}
      </div>
      {footer && <div className="mt-4 text-center text-sm">{footer}</div>}
      <div className="mt-6 text-center">
        <Button asChild variant="link" size="sm" className="gap-1 text-muted-foreground">
          <Link to="/">
            <Home className="h-3.5 w-3.5" />
            Return to homepage
          </Link>
        </Button>
      </div>
    </div>
  </div>
);

export default AuthShell;
