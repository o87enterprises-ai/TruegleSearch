package info.truegle.app;

import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Rational;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TruegleMeshPlugin.class); // Offline Mesh "Nearby" (BLE) — must precede super.onCreate
        registerPlugin(TruegleLinkPlugin.class); // share links that open the app
        registerPlugin(TrueglePipPlugin.class); // Picture-in-Picture (float the app)
        registerPlugin(TruegleSavePlugin.class); // save PDF / text files (WebView can't)
        super.onCreate(savedInstanceState);
        keepClearOfSystemBars();
        handleLink(getIntent());
    }

    /**
     * targetSdk 35 draws the app edge-to-edge, so page headers slid under the status bar and
     * footer buttons under the nav bar (taps hit the system buttons). Pad the whole window by the
     * system-bar insets instead; the strips take the app's dark background.
     */
    private void keepClearOfSystemBars() {
        final int bg = Color.parseColor("#0d0f12");
        getWindow().getDecorView().setBackgroundColor(bg);
        View root = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets b = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            v.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setAppearanceLightStatusBars(false);     // light icons on the dark strip
        c.setAppearanceLightNavigationBars(false);
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
