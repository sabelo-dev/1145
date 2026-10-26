import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import { driverRpc } from "@/services/nearbyDispatch";
import { getDeviceId, driverVerification } from "@/services/driverVerificationService";

const background = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
export function useDriverLocation(driverId?: string, status?: string) {
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const online = status === "available" || status === "busy";
  useEffect(() => {
    if (!driverId || !online) { setUpdated(null); return; }
    let stopped = false;
    let watcher: string | number | undefined;
    let publishing = false;
    let lastPublish = 0;
    let lastHeartbeat = 0;
    const publish = async (latitude: number, longitude: number, accuracy: number, time: number, simulated = false) => {
      if (stopped || publishing || Date.now() - lastPublish < 15_000) return;
      if (simulated || Date.now() - time > 30_000 || accuracy > 200) { setError("Waiting for an accurate GPS position. Nearby offers pause when your location is stale."); return; }
      publishing = true;
      try {
        await supabase.auth.getSession();
        if (Date.now() - lastHeartbeat > 60_000) {
          const beat = await driverVerification.heartbeat();
          if (!beat?.online) throw new Error("Go online on your verified device to receive nearby work.");
          lastHeartbeat = Date.now();
        }
        await driverRpc("driver_publish_position", { p_device_id: await getDeviceId(), p_lat: latitude, p_lng: longitude, p_accuracy: accuracy });
        lastPublish = Date.now();
        if (!stopped) { setUpdated(lastPublish); setError(null); }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "Location could not be shared. Check your connection."); }
      finally { publishing = false; }
    };
    const start = async () => {
      try {
        // Only the Driver app ships the background plugin; the main app tracks
        // through the web view while it is open.
        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BackgroundGeolocation")) {
          if (Capacitor.getPlatform() === "android") {
            const { PushNotifications } = await import("@capacitor/push-notifications");
            await PushNotifications.requestPermissions();
          }
          watcher = await background.addWatcher({ backgroundTitle: "1145 Driver is online", backgroundMessage: "Sharing your location for nearby trips and deliveries. Go offline to stop.", requestPermissions: true, stale: false, distanceFilter: 0 }, (location, err) => {
            if (stopped) return;
            if (err) { setError("Location permission is needed to receive nearby work. Enable location in your phone settings."); return; }
            if (location) void publish(location.latitude, location.longitude, location.accuracy, location.time, location.simulated);
          });
          if (stopped) await background.removeWatcher({ id: String(watcher) });
        } else {
          if (!navigator.geolocation) throw new Error("This device does not support location.");
          watcher = navigator.geolocation.watchPosition(p => { void publish(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp); }, () => setError("Allow location access to receive nearby trips and deliveries."), { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
        }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "Could not start location tracking."); }
    };
    void start();
    // A stationary driver still needs fresh GPS fixes to remain in nearby supply.
    const positionTimer = setInterval(async () => {
      if (stopped) return;
      try {
        if (Capacitor.isNativePlatform()) {
          const { Geolocation } = await import("@capacitor/geolocation");
          const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 });
          await publish(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp);
        } else navigator.geolocation?.getCurrentPosition(p => { void publish(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp); }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 });
      } catch { /* The watcher reports permission errors; stale fixes leave supply automatically. */ }
    }, 30_000);
    return () => {
      stopped = true;
      clearInterval(positionTimer);
      if (typeof watcher === "string") void background.removeWatcher({ id: watcher });
      else if (typeof watcher === "number") navigator.geolocation.clearWatch(watcher);
    };
  }, [driverId, online, retry]);
  return { error, updated, online, retry: () => setRetry(x => x + 1) };
}
