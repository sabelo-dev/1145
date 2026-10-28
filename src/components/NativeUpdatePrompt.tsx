import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  NATIVE_UPDATE_EVENT, downloadNativeUpdate, getNativeUpdate, startNativeUpdateChecks, type NativeUpdate,
} from "@/lib/nativeUpdate";

const KEEPS_DATA = "It installs over this app; you stay signed in and keep your data.";

/**
 * Offers a newer APK in the Android apps (src/lib/nativeUpdate.ts). An update
 * the release marks as required blocks the app until it is installed.
 * Separate from UpdatePrompt so the Orders app, which has no service worker,
 * can use it on its own.
 */
const NativeUpdatePrompt = () => {
  const { toast } = useToast();
  const [required, setRequired] = useState<NativeUpdate | null>(null);

  useEffect(() => {
    const show = () => {
      const update = getNativeUpdate();
      if (!update) return;
      if (update.required) { setRequired(update); return; }
      toast({
        title: `${update.appName} ${update.latest.versionName} is available`,
        description: `${update.latest.notes ? `${update.latest.notes} ` : ""}${KEEPS_DATA}`,
        duration: Infinity,
        action: (
          <ToastAction altText={`Update ${update.appName}`} onClick={() => void downloadNativeUpdate(update)}>
            Update
          </ToastAction>
        ),
      });
    };
    show();
    window.addEventListener(NATIVE_UPDATE_EVENT, show);
    void startNativeUpdateChecks();
    return () => window.removeEventListener(NATIVE_UPDATE_EVENT, show);
  }, [toast]);

  return (
    <AlertDialog open={!!required}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update {required?.appName} to continue</AlertDialogTitle>
          <AlertDialogDescription>
            Version {required?.installedVersion} is no longer supported. {required?.latest.notes} {KEEPS_DATA}{" "}
            When the download finishes, open it and tap Install.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* preventDefault keeps the dialog open: the app stays blocked until the new version is installed. */}
          <AlertDialogAction onClick={(e) => { e.preventDefault(); if (required) void downloadNativeUpdate(required); }}>
            Download update
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default NativeUpdatePrompt;
