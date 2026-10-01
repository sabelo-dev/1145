import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isNative, navigateInApp, platform } from "@/lib/native";

let listenersAdded = false;

/**
 * Native apps only: once someone is signed in, ask for notification
 * permission, register this device with send-push (push_tokens), and open
 * the notification's page when it is tapped.
 */
export function usePushNotifications(userId: string | null | undefined) {
  useEffect(() => {
    if (!isNative() || !userId) return;
    let cancelled = false;

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        if (!listenersAdded) {
          listenersAdded = true;
          await PushNotifications.addListener("registration", async ({ value }) => {
            const { error } = await (supabase.rpc as unknown as (
              fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
              "register_push_token", { p_token: value, p_platform: platform() });
            if (error) console.warn("[push] could not save token", error.message);
          });
          await PushNotifications.addListener("registrationError", (e) => {
            console.warn("[push] registration failed", e.error);
          });
          await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
            const url = (notification.data as Record<string, string> | undefined)?.url;
            if (url && url.startsWith("/") && !url.startsWith("//")) navigateInApp(url);
          });
        }

        let status = await PushNotifications.checkPermissions();
        if (status.receive === "prompt" || status.receive === "prompt-with-rationale") {
          status = await PushNotifications.requestPermissions();
        }
        if (cancelled || status.receive !== "granted") return;
        await PushNotifications.register();
      } catch (e) {
        // Android without google-services.json throws here; the app keeps working.
        console.warn("[push] not available", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
