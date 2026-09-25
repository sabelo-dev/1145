import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { PWA_UPDATE_EVENT, getPendingUpdate } from "@/lib/registerSW";

/** Offers a one-tap update when a new release has been downloaded. */
const UpdatePrompt = () => {
  const { toast } = useToast();

  useEffect(() => {
    const show = () => {
      const update = getPendingUpdate();
      if (!update) return;
      toast({
        title: "A new version of 1145 is ready",
        description: "Update now to get the latest features and fixes.",
        duration: Infinity,
        action: (
          <ToastAction altText="Update the app" onClick={() => update()}>
            Update
          </ToastAction>
        ),
      });
    };
    show(); // in case the update was found before this mounted
    window.addEventListener(PWA_UPDATE_EVENT, show);
    return () => window.removeEventListener(PWA_UPDATE_EVENT, show);
  }, [toast]);

  return null;
};

export default UpdatePrompt;
