import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const AuthConfirmPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleConfirmation = async () => {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") as "signup" | "recovery" | "email_change" | "magiclink" | "invite";
      const redirectTo = searchParams.get("redirect_to") || "/home";

      if (!tokenHash || !type) {
        setStatus("error");
        setMessage("Invalid confirmation link. Missing required parameters.");
        return;
      }

      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type === "signup" ? "email" : type,
        });

        if (error) {
          console.error("Verification error:", error);
          setStatus("error");
          setMessage(error.message || "Failed to verify. The link may have expired.");
        } else {
          setStatus("success");
          setMessage(getSuccessMessage(type));
          
          // For signup (email verification), redirect to login page
          // For other types, use the provided redirect or default
          const finalRedirect = type === "signup" ? "/login" : redirectTo;
          
          // Redirect after a short delay
          setTimeout(() => {
            navigate(finalRedirect, { replace: true });
          }, 2000);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setStatus("error");
        setMessage("An unexpected error occurred. Please try again.");
      }
    };

    handleConfirmation();
  }, [searchParams, navigate]);

  const getSuccessMessage = (type: string) => {
    switch (type) {
      case "signup":
        return "Email verified successfully! Redirecting...";
      case "recovery":
        return "Password reset verified! Redirecting...";
      case "email_change":
        return "Email change confirmed! Redirecting...";
      case "magiclink":
        return "Login successful! Redirecting...";
      case "invite":
        return "Invitation accepted! Redirecting...";
      default:
        return "Verification successful! Redirecting...";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying your email...</p>
            </>
          )}
          
          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-center text-foreground">{message}</p>
            </>
          )}
          
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-destructive">{message}</p>
              <Button onClick={() => navigate("/login")} className="mt-4">
                Go to Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthConfirmPage;
