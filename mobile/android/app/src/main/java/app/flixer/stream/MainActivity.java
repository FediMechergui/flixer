package app.flixer.stream;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private FullscreenChromeClient chromeClient;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        chromeClient = new FullscreenChromeClient(getBridge());
        android.webkit.WebView webView = getBridge().getWebView();
        webView.setWebChromeClient(chromeClient);
        getBridge().setWebViewClient(new PlayerWebViewClient(getBridge()));
        if (androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.DOCUMENT_START_SCRIPT)) {
            androidx.webkit.WebViewCompat.addDocumentStartJavaScript(webView,
                "(()=>{if(parent===window)return;let failed=false;const fail=()=>{if(!failed){failed=true;parent.postMessage({type:'flixer:provider-missing'},'https://localhost')}};"
                + "if(location.hostname==='embos.top'&&/^\\/404\\/?$/.test(location.pathname))fail();"
                + "document.addEventListener('error',e=>{if(e.target instanceof HTMLVideoElement)fail()},true);"
                + "const check=()=>{const text=(document.body?.innerText||'').trim();if(text.length<1800&&/we can't find the video|video (?:has been|was) (?:removed|deleted)|file (?:not found|was deleted)|403 Forbidden|404\\s*Page Not Found/i.test(text))fail()};"
                + "document.addEventListener('DOMContentLoaded',()=>{check();const observer=new MutationObserver(check);observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000)},{once:true});})()",
                new java.util.HashSet<>(java.util.Arrays.asList("https://embos.top","https://mxdrop.click","https://mixdrop.top","https://hgcloud.to","https://vkvideo.ru","https://www.ok.ru","https://ok.ru","https://s1.hdup400.com","https://player.mediadelivery.net","https://playmogo.com","https://watch.easyvidplayer.com")));
        }

        android.webkit.WebSettings settings = webView.getSettings();
        settings.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // Back button while a video is fullscreen: leave fullscreen instead of navigating back.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (chromeClient != null && chromeClient.isFullscreen()) {
                    chromeClient.onHideCustomView();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
