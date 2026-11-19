package info.truegle.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TruegleMeshPlugin.class); // Offline Mesh "Nearby" (BLE) — must precede super.onCreate
        super.onCreate(savedInstanceState);
    }
}
