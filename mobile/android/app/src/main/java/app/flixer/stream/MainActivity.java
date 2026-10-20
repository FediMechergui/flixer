package app.flixer.stream;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private FullscreenChromeClient chromeClient;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayerViewPlugin.class);
        registerPlugin(DirectVideoPlugin.class);
        registerPlugin(WcoSourcePlugin.class);
        super.onCreate(savedInstanceState);
        PlayerAdBlock.installServiceWorkerFilter();
        chromeClient = new FullscreenChromeClient(getBridge());
        android.webkit.WebView webView = getBridge().getWebView();
        webView.setWebChromeClient(chromeClient);
        getBridge().setWebViewClient(new PlayerWebViewClient(getBridge()));
        if (androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.DOCUMENT_START_SCRIPT)) {
            androidx.webkit.WebViewCompat.addDocumentStartJavaScript(webView,PlayerAdBlock.script(this),PlayerViewPlugin.playerOrigins());
            androidx.webkit.WebViewCompat.addDocumentStartJavaScript(webView,
                "(()=>{if(parent===window)return;let failed=false,playing=false;const fail=()=>{if(!failed){failed=true;parent.postMessage({type:'flixer:provider-missing'},'https://localhost')}};"
                + "if(location.hostname==='embos.top'&&/^\\/404\\/?$/.test(location.pathname))fail();"
                + "const visible=v=>{const r=v.getBoundingClientRect();if(!r.width||!r.height||r.bottom<=0||r.right<=0||r.top>=innerHeight||r.left>=innerWidth)return false;for(let e=v;e;e=e.parentElement){const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false}return true};"
                + "document.addEventListener('timeupdate',e=>{const v=e.target;if(!playing&&v instanceof HTMLVideoElement&&v.currentTime>1&&!v.paused&&visible(v)){playing=true;parent.postMessage({type:'flixer:provider-playing'},'https://localhost')}},true);"
                + "document.addEventListener('error',e=>{if(e.target instanceof HTMLVideoElement)fail()},true);"
                + "const check=()=>{const text=(document.body?.innerText||'').trim();if(text.length<1800&&/no video was found for this title|404\\)?\\s*AN UNEXPECTED ERROR OCCURRED|we can't find the video|we couldn't find this title on any server|video (?:has been|was) (?:removed|deleted)|file (?:not found|was deleted)|403 Forbidden|404\\s*Page Not Found|404\\)?\\s*OOPS! SOMETHING WENT WRONG|404[\\s\\S]*the page you were looking for is not here/i.test(text))fail()};"
                + "document.addEventListener('DOMContentLoaded',()=>{check();const observer=new MutationObserver(check);observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000)},{once:true});})()",
                new java.util.HashSet<>(java.util.Arrays.asList("https://mixdrop.ps","https://cybervynx.com","https://1vid.xyz","https://vidmoly.org","https://vidspeed.org","https://www.mp4upload.com","https://bysesukior.com","https://bysetayico.com","https://doodstream.com","https://embos.top","https://mxdrop.click","https://mixdrop.top","https://hgcloud.to","https://vkvideo.ru","https://www.ok.ru","https://ok.ru","https://s1.hdup400.com","https://vidzy.cc","https://vidzy.org","https://rufiiguta.com","https://engifuosi.com","https://kitraskimisi.com","https://tukipasti.com","https://player.mediadelivery.net","https://playmogo.com","https://watch.easyvidplayer.com","https://vidcore.io","https://vidcore.net","https://vidsrc.mov","https://vidsrc.fyi","https://embed.vidsrc.si","https://vidfast.pro","https://vidup.to","https://vidrock.net","https://vidnest.fun","https://vidlink.pro","https://111movies.net","https://multiembed.mov","https://mappletv.uk","https://moviesapi.to","https://vidapi.xyz","https://player.vidlove.cc")));
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
