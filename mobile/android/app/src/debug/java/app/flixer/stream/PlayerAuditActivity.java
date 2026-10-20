package app.flixer.stream;

import android.os.Bundle;

/** Debug-only harness: exercise real native players without catalogue work. */
public class PlayerAuditActivity extends MainActivity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getBridge().getWebView().loadUrl("https://localhost/playback-audit.html");
    }
}
