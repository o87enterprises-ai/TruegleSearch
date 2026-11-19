package info.truegle.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TruegleMeshPlugin.class); // Offline Mesh "Nearby" (BLE) — must precede super.onCreate
        registerPlugin(TruegleLinkPlugin.class); // share links that open the app
        super.onCreate(savedInstanceState);
        handleLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleLink(intent);
    }

    private void handleLink(Intent intent) {
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            TruegleLinkPlugin.deliver(intent.getDataString());
        }
    }
}
