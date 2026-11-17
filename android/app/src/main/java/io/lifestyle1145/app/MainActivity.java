package io.lifestyle1145.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Lets the web load animation continue from the native launch animation.
        registerPlugin(LaunchClockPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
