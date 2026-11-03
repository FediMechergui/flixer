package app.flixer.stream;

import java.net.URI;

/** Genuine iframe context for a publisher whose public embed requires a parent frame. */
final class SourcePlayerFrame {
    // A virtual app-owned document in the isolated player WebView. This is not
    // a publisher origin and the document receives no Capacitor bridge.
    static final String ORIGIN = "https://player.flixer.invalid/";
    private SourcePlayerFrame() {}

    static String html(String value) {
        try {
            URI url = new URI(value);
            if (!"netu.frembed.bond".equals(url.getHost()) || !SourcePlayerPolicy.approved(value)) return null;
            String escaped = value.replace("&", "&amp;").replace("\"", "&quot;").replace("'", "&#39;").replace("<", "&lt;").replace(">", "&gt;");
            return "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                    + "<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}iframe{display:block;width:100%;height:100%;border:0}</style>"
                    + "</head><body><iframe src=\"" + escaped + "\" title=\"Source video player\""
                    + " allow=\"autoplay; fullscreen; picture-in-picture\" allowfullscreen referrerpolicy=\"strict-origin-when-cross-origin\"></iframe></body></html>";
        } catch (Exception ignored) { return null; }
    }
}
