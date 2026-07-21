package com.soportecni.gpsrastreo;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Avoid restoring a stale WebView page from a previous run.
        super.onCreate(null);

        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().clearHistory();
            bridge.getWebView().clearCache(true);
        }
    }
}
