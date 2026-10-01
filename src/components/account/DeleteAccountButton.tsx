import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { callRewardRpc } from "@/lib/ucRewards";

/**
 * Account deletion (App Store / Google Play requirement): records the request
 * (request_account_deletion), stops pushes, and signs the user out. An admin
 * completes the deletion within 30 days.
 */
export function DeleteAccountButton({ label = "Delete account" }: { label?: string }) {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await callRewardRpc("request_account_deletion", { p_reason: null });
      toast({
        title: "Deletion requested",
        description: "Your account and personal data will be deleted within 30 days. You've been signed out.",
      });
      await logout();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not request deletion", description: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your 1145 account?</AlertDialogTitle>
          <AlertDialogDescription>
            We will delete your account and personal data within 30 days. Your UCoin balance, rewards and saved
            details will be lost. Records we must keep by law (such as completed orders and payments) are kept
            only as long as required.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirm(); }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete my account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
