package io.lifestyle1145.app;

import android.os.Build;
import android.os.Process;
import android.util.Log;
import android.os.SystemClock;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * How long the native launch animation has been running, so the web load
 * animation (src/brand/loader.html) continues from the same frame instead of
 * starting over. The launch screen appears when Android is asked to start the app
 * (on Android 13+ the process itself may have been created in advance).
 */
@CapacitorPlugin(name = "LaunchClock")
public class LaunchClockPlugin extends Plugin {
    @PluginMethod
    public void elapsed(PluginCall call) {
        JSObject result = new JSObject();
        long launchedAt = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? Process.getStartRequestedUptimeMillis()
                : Process.getStartUptimeMillis();
        long ms = SystemClock.uptimeMillis() - launchedAt;
        Log.d("LaunchClock", "elapsed " + ms + " ms (process created " + (SystemClock.uptimeMillis() - Process.getStartUptimeMillis()) + " ms ago)");
        result.put("ms", ms);
        call.resolve(result);
    }
}
