package info.truegle.app;

import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TruegleMeshPlugin.class); // Offline Mesh "Nearby" (BLE) — must precede super.onCreate
        registerPlugin(TruegleLinkPlugin.class); // share links that open the app
        registerPlugin(TrueglePipPlugin.class); // Picture-in-Picture (float the app)
        super.onCreate(savedInstanceState);
        handleLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleLink(intent);
    }

    /** Shrink the whole app into a floating Picture-in-Picture window (Android 8+). */
    boolean enterPip() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        try {
            return enterPictureInPictureMode(
                new PictureInPictureParams.Builder().setAspectRatio(new Rational(3, 4)).build());
        } catch (Exception e) {
            return false; // PiP disabled in system settings
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (TrueglePipPlugin.autoEnter) enterPip();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, Configuration cfg) {
        super.onPictureInPictureModeChanged(inPip, cfg);
        TrueglePipPlugin.notifyMode(inPip);
    }

    private void handleLink(Intent intent) {
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            TruegleLinkPlugin.deliver(intent.getDataString());
        }
    }
}
