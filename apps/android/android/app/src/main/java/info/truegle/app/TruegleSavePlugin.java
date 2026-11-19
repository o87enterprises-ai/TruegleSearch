package info.truegle.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saving files from inside the app. Android's WebView cannot do either of these on its own:
 * window.print() is a no-op and a blob "download" link does nothing. No permissions needed —
 * the system picker / print dialog hands us a destination the user chose.
 *
 *  printHtml → system print dialog; the user picks "Save as PDF" and where it goes.
 *  saveText  → system "Save to…" picker (Downloads, Drive, SD card…), writes the text there.
 */
@CapacitorPlugin(name = "TruegleSave")
public class TruegleSavePlugin extends Plugin {
    private WebView printView; // kept referenced until the print job has been handed to the system

    @PluginMethod
    public void printHtml(final PluginCall call) {
        final String html = call.getString("html");
        final String name = call.getString("name", "document");
        if (html == null) { call.reject("html required"); return; }
        getActivity().runOnUiThread(() -> {
            try {
                final WebView wv = new WebView(getActivity());
                wv.getSettings().setJavaScriptEnabled(false);
                printView = wv;
                wv.setWebViewClient(new WebViewClient() {
                    private boolean done;
                    @Override public void onPageFinished(WebView view, String url) {
                        if (done) return;
                        done = true;
                        try {
                            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                            pm.print(name, view.createPrintDocumentAdapter(name), null);
                            call.resolve();
                        } catch (Exception e) {
                            call.reject("print failed: " + e.getMessage());
                        }
                    }
                });
                wv.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                call.reject("print failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void saveText(PluginCall call) {
        if (call.getString("text") == null) { call.reject("text required"); return; }
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(call.getString("mime", "text/plain"));
        i.putExtra(Intent.EXTRA_TITLE, call.getString("name", "document.txt"));
        startActivityForResult(call, i, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject out = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            out.put("saved", false); // user backed out of the picker
            call.resolve(out);
            return;
        }
        Uri uri = data.getData();
        try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
            if (os == null) throw new java.io.IOException("no stream");
            os.write(call.getString("text").getBytes(StandardCharsets.UTF_8));
            out.put("saved", true);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("save failed: " + e.getMessage());
        }
    }
}
