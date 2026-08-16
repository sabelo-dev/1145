import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const highlights = [
  { icon: Sparkles, title: "Everyday rewards", desc: "Earn UCoin on every order, ride and referral." },
  { icon: Truck, title: "Fast local delivery", desc: "Trusted merchants and drivers across South Africa." },
  { icon: ShieldCheck, title: "Secure by design", desc: "Bank-grade encryption and verified checkout." },
];

const AuthSplitShell: React.FC<Props> = ({ eyebrow, title, subtitle, children, footer }) => (
  <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-2">
    {/* Brand panel */}
    <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-foreground text-background p-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, hsl(30 30% 92% / 0.25), transparent 50%), radial-gradient(circle at 80% 70%, hsl(30 30% 92% / 0.18), transparent 55%)",
        }}
      />
      <Link to="/" className="relative z-10 inline-flex items-center gap-2 font-semibold tracking-tight">
        <span className="h-8 w-8 rounded-full bg-background text-foreground grid place-items-center font-bold">
          11
        </span>
        <span className="text-lg">1145 Lifestyle</span>
      </Link>

      <div className="relative z-10 space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-background/60">Join the lifestyle</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight">
            One account.<br />Shop, ride, earn and pay.
          </h1>
        </div>
        <ul className="space-y-5">
          {highlights.map(({ icon: Icon, title: t, desc }) => (
            <li key={t} className="flex gap-4">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background/10 ring-1 ring-background/20">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium">{t}</p>
                <p className="text-sm text-background/70">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 text-xs text-background/60">© {new Date().getFullYear()} 1145 Lifestyle. All rights reserved.</p>
    </aside>

    {/* Form panel */}
    <main className="flex flex-col px-4 sm:px-8 lg:px-16 py-8 lg:py-12">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-2 -ml-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </Button>
        <Link to="/" className="lg:hidden inline-flex items-center gap-2 font-semibold">
          <span className="h-7 w-7 rounded-full bg-foreground text-background grid place-items-center text-xs font-bold">
            11
          </span>
          <span>1145</span>
        </Link>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 flex flex-col justify-center py-10">
        <div className="mb-8">
          {eyebrow && (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
          )}
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="mt-8 text-center text-sm">{footer}</div>}
      </div>
    </main>
  </div>
);

export default AuthSplitShell;
