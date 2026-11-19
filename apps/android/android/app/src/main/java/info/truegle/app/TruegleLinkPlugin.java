package info.truegle.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hands links that open the app (https://truegle.info/… or truegle://…) to the web layer, so a
 * Truegle share link imports straight into the app instead of opening in a browser.
 */
@CapacitorPlugin(name = "TruegleLink")
public class TruegleLinkPlugin extends Plugin {
    private static String pending;
    private static TruegleLinkPlugin instance;

    @Override
    public void load() { instance = this; }

    /** Called by MainActivity for every VIEW intent. */
    static void deliver(String url) {
        pending = url;
        if (instance != null) {
            JSObject o = new JSObject();
            o.put("url", url);
            instance.notifyListeners("link", o, true);
        }
    }

    /** The link the app was launched with, if any (read once). */
    @PluginMethod
    public void getLaunchUrl(PluginCall call) {
        JSObject o = new JSObject();
        if (pending != null) o.put("url", pending);
        pending = null;
        call.resolve(o);
    }
}
