package info.truegle.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Picture-in-Picture: the whole app shrinks into a floating window over other apps when the user
 * leaves it (Home / app switch), so they keep their place. No permission needed (API 26+).
 */
@CapacitorPlugin(name = "TrueglePip")
public class TrueglePipPlugin extends Plugin {
    private static TrueglePipPlugin instance;
    static boolean autoEnter = true;

    @Override
    public void load() { instance = this; }

    /** Called by MainActivity when PiP starts/stops. */
    static void notifyMode(boolean inPip) {
        if (instance != null) {
            JSObject o = new JSObject();
            o.put("active", inPip);
            instance.notifyListeners("pip", o, true);
        }
    }

    /** Turn the automatic "float when I leave" behaviour on/off. */
    @PluginMethod
    public void setAuto(PluginCall call) {
        autoEnter = call.getBoolean("enabled", true);
        call.resolve();
    }

    /** Float now (e.g. from a button). */
    @PluginMethod
    public void enter(PluginCall call) {
        boolean ok = getActivity() instanceof MainActivity && ((MainActivity) getActivity()).enterPip();
        JSObject o = new JSObject();
        o.put("entered", ok);
        call.resolve(o);
    }
}
