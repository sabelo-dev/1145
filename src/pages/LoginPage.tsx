import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";
import AuthShell from "@/components/auth/AuthShell";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  useFrameBreakout();
  const navigate = useNavigate();
  const { user, isLoading, isAdmin, isMerchant, isDriver, isInfluencer, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (isInfluencer) return <Navigate to="/influencer/dashboard" replace />;
    if (isDriver) return <Navigate to="/driver/dashboard" replace />;
    if (isMerchant) return <Navigate to="/merchant/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      const result = await login(values.email, values.password);
      navigate(result?.redirectPath || "/dashboard", { replace: true });
    } catch (err) {
      // handled in AuthContext toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your email or a social account"
      footer={
        <span className="text-muted-foreground">
          New to 1145?{" "}
          <Link to="/register" className="font-medium text-foreground hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="name@example.com" autoComplete="email" {...field} />
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
                <div className="flex justify-between items-center">
                  <FormLabel>Password</FormLabel>
                  <Link to="/forgot-password" className="text-sm text-muted-foreground hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full h-11" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </Form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <OAuthButtons mode="login" />

      <p className="mt-6 text-xs text-center text-muted-foreground">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </p>
    </AuthShell>
  );
};

export default LoginPage;
