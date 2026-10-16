package app.flixer.stream;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/** Keep nested player navigation in its frame and prevent ads taking over playback. */
public class PlayerWebViewClient extends BridgeWebViewClient {
    public PlayerWebViewClient(Bridge bridge) { super(bridge); }

    private void reportPlayerFailure(WebView view, WebResourceRequest request, int status, boolean document) {
        reportPlayerFailure(view,request.getUrl().toString(),status,document);
    }

    private void reportPlayerFailure(WebView view, String resourceUrl, int status, boolean document) {
        String url=org.json.JSONObject.quote(resourceUrl);
        view.post(() -> view.evaluateJavascript("window.dispatchEvent(new CustomEvent('flixer:player-error',{detail:{url:"+url+",status:"+status+",document:"+document+"}}))",null));
    }

    @Override
    public void onLoadResource(WebView view, String url) {
        super.onLoadResource(view,url);
        Uri resource=Uri.parse(url);
        if("embos.top".equals(resource.getHost()) && ("/404".equals(resource.getPath()) || "/404/".equals(resource.getPath())))
            reportPlayerFailure(view,url,404,true);
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
        super.onReceivedError(view,request,error);
        reportPlayerFailure(view,request,error.getErrorCode(),false);
    }

    @Override
    public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse response) {
        super.onReceivedHttpError(view,request,response);
        if(response.getStatusCode()>=400)reportPlayerFailure(view,request,response.getStatusCode(),"text/html".equals(response.getMimeType()));
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri target = request.getUrl();
        String scheme = target.getScheme();
        // This provider redirects missing titles to an HTML error page with HTTP 200.
        // Restrict recognition to its documented error path, never ad resources.
        if (!request.isForMainFrame() && "embos.top".equals(target.getHost())
                && ("/404".equals(target.getPath()) || "/404/".equals(target.getPath()))) {
            reportPlayerFailure(view, request, 404, true);
            return true;
        }
        if (!request.isForMainFrame()) return !("https".equals(scheme) || "http".equals(scheme) || "about".equals(scheme) || "blob".equals(scheme));
        String current = view.getUrl();
        if (current != null && current.contains("/watch/")) {
            Uri origin = Uri.parse(current);
            // A player/ad can target the app's origin and strip its route. That
            // reloads the entire catalogue, even though no external host opens.
            if (!request.hasGesture() && java.util.Objects.equals(origin.getHost(),target.getHost())
                    && (target.getFragment()==null || target.getFragment().isEmpty())) return true;
            if (!java.util.Objects.equals(origin.getHost(), target.getHost())) {
                // The app's explicit Source link remains usable; player ad destinations do not.
                String host = target.getHost();
                boolean source = "myflixerz.day".equals(host) || "hdtoday.sx".equals(host) || "www.f-movies.org".equals(host)
                    || "www.animegg.org".equals(host) || "www.megacartoons.net".equals(host)
                    || "www.toontales.net".equals(host) || "myasiantv.com.bz".equals(host)
                    || "multimovies.garden".equals(host) || "m1.multimovies.courses".equals(host) || "www1.yoturkish.com".equals(host)
                    || "streamtunisie.net".equals(host) || "kirmalk.com".equals(host)
                    || "yam.ahwaktv.net".equals(host) || "tv10.egydead.live".equals(host)
                    || "tuniflix.site".equals(host) || "www.cimatn.com".equals(host)
                    || "cinetimes.org".equals(host);
                if (!(request.hasGesture() && "https".equals(scheme) && source)) return true;
            }
        }
        return super.shouldOverrideUrlLoading(view, request);
    }
}
