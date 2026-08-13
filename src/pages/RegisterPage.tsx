import React, { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Car, Check, Eye, EyeOff, Loader2, ShoppingBag, Sparkles, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";
import AuthSplitShell from "@/components/auth/AuthSplitShell";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirmPassword: z.string(),
    role: z.enum(["consumer", "vendor", "driver", "influencer"]),
    terms: z.boolean().refine((v) => v, { message: "Please accept the terms to continue" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

const scorePassword = (pw: string) => {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

const strengthMeta = [
  { label: "Too weak", color: "bg-destructive" },
  { label: "Weak", color: "bg-destructive" },
  { label: "Fair", color: "bg-gold/100" },
  { label: "Good", color: "bg-emerald-500" },
  { label: "Strong", color: "bg-emerald-600" },
];

const RoleCard: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}> = ({ active, onClick, icon, title, desc }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
      "hover:border-foreground/40 hover:bg-accent/40",
      active
        ? "border-foreground bg-accent shadow-sm"
        : "border-border bg-background"
    )}
  >
    <span
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg transition-colors",
        active ? "bg-foreground text-background" : "bg-muted text-foreground"
      )}
    >
      {icon}
    </span>
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
    </div>
    {active && (
      <span className="absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background">
        <Check className="h-3 w-3" />
      </span>
    )}
  </button>
);

const RegisterPage: React.FC = () => {
  useFrameBreakout();
  const navigate = useNavigate();
  const { user, register } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "consumer",
      terms: false,
    },
  });

  const password = form.watch("password");
  const role = form.watch("role");
  const score = useMemo(() => scorePassword(password || ""), [password]);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (values: RegisterFormValues) => {
    setSubmitting(true);
    try {
      const result = await register(values.email, values.password, values.name, values.role);
      navigate(
        result?.redirectPath || `/verify-email?email=${encodeURIComponent(values.email)}`,
        { replace: true }
      );
    } catch {
      /* toast handled in AuthContext */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitShell
      eyebrow="Get started"
      title="Create your account"
      subtitle="Join thousands shopping, riding and earning on 1145 Lifestyle."
      footer={
        <span className="text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-foreground hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <div className="space-y-6">
        <OAuthButtons mode="register" />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-background px-3 text-muted-foreground">or sign up with email</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>I'm joining as</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <RoleCard
                      active={role === "consumer"}
                      onClick={() => field.onChange("consumer")}
                      icon={<ShoppingBag className="h-4 w-4" />}
                      title="Shopper"
                      desc="Buy, ride and earn rewards"
                    />
                    <RoleCard
                      active={role === "vendor"}
                      onClick={() => field.onChange("vendor")}
                      icon={<Store className="h-4 w-4" />}
                      title="Merchant"
                      desc="Sell products and services"
                    />
                    <RoleCard
                      active={role === "driver"}
                      onClick={() => field.onChange("driver")}
                      icon={<Car className="h-4 w-4" />}
                      title="Driver"
                      desc="Drive rides and deliveries"
                    />
                    <RoleCard
                      active={role === "influencer"}
                      onClick={() => field.onChange("influencer")}
                      icon={<Sparkles className="h-4 w-4" />}
                      title="Influencer"
                      desc="Promote and earn commissions"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" autoComplete="name" className="h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="h-11"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPw ? "text" : "password"}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        className="h-11 pr-11"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  {password && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-colors",
                              i < score ? strengthMeta[score].color : "bg-muted"
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Strength: <span className="font-medium text-foreground">{strengthMeta[score].label}</span>
                        {" · "}Use 12+ chars with a number & symbol for best security.
                      </p>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        className="h-11 pr-11"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 space-y-0 rounded-lg border p-3 bg-muted/30">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-tight">
                    <FormLabel className="text-sm font-normal cursor-pointer">
                      I agree to the{" "}
                      <Link to="/terms" className="font-medium text-foreground hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link to="/privacy" className="font-medium text-foreground hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating your account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </AuthSplitShell>
  );
};

export default RegisterPage;
