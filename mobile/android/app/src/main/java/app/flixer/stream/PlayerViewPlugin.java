package app.flixer.stream;

import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.JSObject;
import org.json.JSONObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** A separate web surface: remote pages never receive the app's Capacitor bridge. */
@CapacitorPlugin(name = "PlayerView")
public class PlayerViewPlugin extends Plugin {
    private NativePlayerSurface playerDialog;
    private WebView playerWebView;
    private static final Set<String> HOSTS = new HashSet<>(Arrays.asList(
        "vidsrc.sh", "vsembed.ru", "sv2.nontongo.stream", "www.animegg.org", "abysscdn.com", "rozgarlelo.modiplay.xyz", "streams.iqsmartgames.com", "embed.vidrift.net", "vidout.pages.dev", "embed.filmu.in", "vidbolt.xyz", "youtube.com", "www.youtube.com", "www.youtube-nocookie.com", "embos.top", "mxdrop.click", "mixdrop.top", "hgcloud.to", "vkvideo.ru", "www.ok.ru", "ok.ru", "s1.hdup400.com", "vidzy.cc", "vidzy.org", "rufiiguta.com", "engifuosi.com", "kitraskimisi.com", "tukipasti.com", "player.mediadelivery.net", "playmogo.com", "watch.easyvidplayer.com", "vidcore.io", "vidcore.net", "vidsrc.mov", "vidsrc.fyi", "embed.vidsrc.si", "vidfast.pro", "vidup.to", "vidrock.net", "vidnest.fun", "vidlink.pro", "111movies.net", "multiembed.mov", "mappletv.uk", "moviesapi.to", "vidapi.xyz", "player.vidlove.cc", "mixdrop.ps", "cybervynx.com", "1vid.xyz", "vidmoly.org", "vidspeed.org", "www.mp4upload.com", "bysesukior.com", "bysetayico.com", "doodstream.com", "cima.easyvidplayer.com", "zumivids.com", "cimatnwatchingg.blogspot.com", "embedmaster.link", "fsvid.lol", "kokoflix.lol", "trakx.lol", "uqload.vc", "voe.sx", "doodstream.com", "player.vimeo.com", "www.dailymotion.com", "geo.dailymotion.com", "audinifer.com", "morencius.com", "watch.strp2p.site", "app.videas.fr", "www.vidspeed.org", "uqload.net", "movearnpre.com", "dingtezuni.com", "q7v3k8m2p1.top"
    ));
    // Observed HTTPS destinations of existing provider player redirects.
    static { HOSTS.add("vidfast.vc"); HOSTS.add("sv4.nontongo.day"); HOSTS.add("hglamioz.com"); HOSTS.add("hgplaycdn.com"); HOSTS.add("derricknationtop.com"); }
    static Set<String> playerOrigins(){Set<String> origins=new HashSet<>();for(String host:HOSTS)origins.add("https://"+host);origins.add("https://*.medmedia03.wiki");return origins;}
    private boolean approved(String value) {
        if (value == null || value.length() > 3000) return false;
        try { Uri u = Uri.parse(value); String host = u.getHost();
            return "https".equals(u.getScheme()) && u.getUserInfo() == null && u.getPort() == -1 && host != null && (HOSTS.contains(host) || host.matches("(?:balance|[1-9])\\.medmedia03\\.wiki"));
        } catch (Exception e) { return false; }
    }
    private int dp(int value) { return Math.round(value * getContext().getResources().getDisplayMetrics().density); }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (!approved(url)) { call.reject("This player origin is not supported"); return; }
        getActivity().runOnUiThread(() -> {
            if (playerDialog != null) { call.reject("A player is already open"); return; }
            NativePlayerSurface dialog = new NativePlayerSurface((com.getcapacitor.BridgeActivity)getActivity(),getBridge().getWebView(),call.getObject("bounds"));
            playerDialog = dialog;
            String[] reason={"closed"};boolean[] played={false};boolean[] verifying={false};boolean[] challengeDocument={false};
            android.os.Handler watchdog=new android.os.Handler(android.os.Looper.getMainLooper());
            Runnable startupTimeout=()->{if(dialog.isShowing()&&!played[0]){reason[0]="failed";dialog.dismiss();}};JSObject media=new JSObject();boolean captureMedia=call.getBoolean("captureMedia",true);
            LinearLayout layout = new LinearLayout(getActivity()); layout.setOrientation(LinearLayout.VERTICAL); layout.setBackgroundColor(Color.rgb(12,18,16));
            LinearLayout toolbar = new LinearLayout(getActivity()); toolbar.setPadding(dp(8),dp(6),dp(8),dp(6)); toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);
            Button close = new Button(getActivity()); close.setText("Close player"); close.setAllCaps(false); close.setTextSize(14); close.setBackgroundColor(Color.TRANSPARENT); close.setContentDescription("Close in-app player"); close.setTextColor(Color.rgb(243,178,87)); close.setOnClickListener(v -> dialog.dismiss());
            close.setText("Close");toolbar.addView(close,new LinearLayout.LayoutParams(dp(80),dp(48)));
            TextView title = new TextView(getActivity()); title.setText(Uri.parse(url).getHost()); title.setTextColor(Color.rgb(234,240,235)); title.setTextSize(13); title.setMaxLines(1); title.setEllipsize(android.text.TextUtils.TruncateAt.END); toolbar.addView(title,new LinearLayout.LayoutParams(0,dp(44),1));
            Button next=new Button(getActivity());next.setText("Next");next.setContentDescription("Next source");next.setAllCaps(false);next.setOnClickListener(v->{reason[0]="next";dialog.dismiss();});toolbar.addView(next);
            Button restore=new Button(getActivity());restore.setText("Inline");restore.setContentDescription("Exit fullscreen");restore.setOnClickListener(v->dialog.setFullscreen(false));toolbar.addView(restore);
            layout.addView(toolbar);dialog.setToolbar(toolbar);
            FrameLayout stage = new FrameLayout(getActivity()); layout.addView(stage,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1));
            WebView web = new WebView(getActivity()); playerWebView = web; web.setBackgroundColor(Color.BLACK);
            web.setDownloadListener((target,userAgent,contentDisposition,mimeType,length)->{});
            WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); settings.setMediaPlaybackRequiresUserGesture(false); settings.setSupportMultipleWindows(true); settings.setJavaScriptCanOpenWindowsAutomatically(false);
            android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
            if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))WebViewCompat.addDocumentStartJavaScript(web,PlayerAdBlock.script(getContext()),playerOrigins());
            // Health messages only; remote pages never receive Capacitor's app bridge.
            if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)&&WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)){
                Set<String> origins=playerOrigins();
                WebViewCompat.addWebMessageListener(web,"FlixerPlayback",origins,(view,message,origin,main,reply)->{
                    if("playing".equals(message.getData())){played[0]=true;watchdog.removeCallbacks(startupTimeout);}
                    if("missing".equals(message.getData())&&!played[0]){reason[0]="failed";dialog.dismiss();}
                    if(captureMedia&&message.getData()!=null&&message.getData().length()<14000)try{
                        JSONObject data=new JSONObject(message.getData());String target=data.optString("url"),format=data.optString("format");Uri uri=Uri.parse(target);
                        if("public-media".equals(data.optString("type"))&&"https".equals(uri.getScheme())&&uri.getHost()!=null&&uri.getUserInfo()==null&&uri.getPort()==-1&&Arrays.asList("mp4","hls","dash").contains(format)){
                            media.put("url",target);media.put("format",format);media.put("position",Math.max(0,data.optDouble("position",0)));media.put("sourceOrigin",origin.toString());reason[0]="media";dialog.dismiss();
                        }
                    }catch(Exception ignored){}
                });
                WebViewCompat.addDocumentStartJavaScript(web,"(()=>{let sent=false;const send=x=>{try{FlixerPlayback.postMessage(x)}catch{}};document.addEventListener('timeupdate',e=>{const v=e.target;if(!sent&&v instanceof HTMLVideoElement&&v.currentTime>1&&!v.paused&&v.getBoundingClientRect().width>0){sent=true;send('playing')}},true);const check=()=>{const text=(document.body?.innerText||'').trim();if(text.length<1800&&/no video was found for this title|404\\)?\\s*AN UNEXPECTED ERROR OCCURRED|we can't find the video|we couldn't find this title on any server|video (?:has been|was) (?:removed|deleted)|file (?:not found|was deleted)|403 Forbidden|Sorry, you have been blocked|you are unable to access|we couldn.t find a video for this|this video (?:is not|is no longer) available|ad.?blocker detected|please disable ad.?block|404\\)?\\s*OOPS! SOMETHING WENT WRONG|this video not found|Enjoy Ad-Free Access[\\s\\S]*REDEEM YOUR CODE HERE/i.test(text))send('missing')};document.addEventListener('DOMContentLoaded',()=>{check();const o=new MutationObserver(check);if(document.body)o.observe(document.body,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),60000)},{once:true});})()",origins);
            }
            web.setWebViewClient(new WebViewClient() {
                @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return PlayerAdBlock.intercept(request);}
                @Override public boolean shouldOverrideUrlLoading(WebView view, String target) { return !approved(target); }
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return request.isForMainFrame() && !approved(request.getUrl().toString()); }
                @Override public void onPageStarted(WebView view,String target,android.graphics.Bitmap favicon){challengeDocument[0]=false;title.setText(Uri.parse(target).getHost());}
                @Override public void onPageFinished(WebView view,String target){
                    // A completed page may play through a cross-origin frame whose
                    // clock we cannot observe. Do not close it for missing telemetry.
                    if(!challengeDocument[0]){watchdog.removeCallbacks(startupTimeout);verifying[0]=false;}
                }
                @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,android.webkit.WebResourceResponse response){
                    if(!request.isForMainFrame()||response.getStatusCode()<400)return;
                    if(PlayerHttpPolicy.needsBrowserVerification(response.getStatusCode(),response.getResponseHeaders())){
                        challengeDocument[0]=true;
                        title.setText("Browser verification");
                        // Give normal JavaScript/cookie verification a bounded opportunity.
                        // Redirect loops cannot keep extending the deadline.
                        if(!verifying[0]&&!played[0]){verifying[0]=true;watchdog.removeCallbacks(startupTimeout);watchdog.postDelayed(startupTimeout,30000);}
                        return;
                    }
                    reason[0]="failed";dialog.dismiss();
                }
                @Override public void onReceivedError(WebView view,WebResourceRequest request,android.webkit.WebResourceError error){if(request.isForMainFrame()){reason[0]="failed";dialog.dismiss();}}
            });
            web.setWebChromeClient(new WebChromeClient() {
                private View video;
                private CustomViewCallback callback;
                @Override public void onShowCustomView(View view, CustomViewCallback cb) {
                    if (video != null) { cb.onCustomViewHidden(); return; }
                    video=view;callback=cb;web.setVisibility(View.GONE);stage.addView(view,new FrameLayout.LayoutParams(-1,-1));dialog.setFullscreen(true);
                }
                @Override public void onHideCustomView() { if(video!=null){stage.removeView(video);video=null;web.setVisibility(View.VISIBLE);CustomViewCallback cb=callback;callback=null;dialog.setFullscreen(false);if(cb!=null)cb.onCustomViewHidden();} }
                @Override public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) { return false; }
                @Override public boolean onJsAlert(WebView view,String target,String message,android.webkit.JsResult result){result.cancel();return true;}
                @Override public boolean onJsConfirm(WebView view,String target,String message,android.webkit.JsResult result){result.cancel();return true;}
                @Override public boolean onJsPrompt(WebView view,String target,String message,String initial,android.webkit.JsPromptResult result){result.cancel();return true;}
            });
            stage.addView(web,new FrameLayout.LayoutParams(-1,-1)); dialog.setContentView(layout);
            dialog.setOnDismissListener(d -> { watchdog.removeCallbacksAndMessages(null);web.stopLoading();web.loadUrl("about:blank");stage.removeAllViews();web.destroy();playerWebView=null;playerDialog=null;JSObject result=new JSObject();result.put("reason",reason[0]);result.put("played",played[0]);result.put("media",media);call.resolve(result); });
            dialog.show();watchdog.postDelayed(startupTimeout,60000);web.loadUrl(url);
        });
    }
    @PluginMethod public void close(PluginCall call) { getActivity().runOnUiThread(() -> { if(playerDialog!=null)playerDialog.dismiss();call.resolve(); }); }
    @PluginMethod public void updateBounds(PluginCall call){getActivity().runOnUiThread(()->{if(playerDialog!=null)playerDialog.updateBounds(call.getObject("bounds"));call.resolve();});}
    @PluginMethod public void setFullscreen(PluginCall call){getActivity().runOnUiThread(()->{if(playerDialog!=null)playerDialog.setFullscreen(call.getBoolean("fullscreen",true));call.resolve();});}
    @Override protected void handleOnPause() { if(playerWebView!=null)playerWebView.onPause(); }
    @Override protected void handleOnResume() { if(playerWebView!=null)playerWebView.onResume(); }
    @Override protected void handleOnDestroy() { if(playerDialog!=null)playerDialog.dismiss(); }
}
