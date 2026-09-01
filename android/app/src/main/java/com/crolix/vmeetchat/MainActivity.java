package com.crolix.vmeetchat;

import android.Manifest;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Capacitor's WebView only auto-grants a JS getUserMedia prompt when the
        // OS-level runtime permission is already held, so request it up front.
        ActivityCompat.requestPermissions(
            this,
            new String[] { Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO },
            1
        );
    }
}
