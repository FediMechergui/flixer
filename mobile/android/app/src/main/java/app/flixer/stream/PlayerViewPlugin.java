package app.flixer.stream;

import android.app.Dialog;
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
    private Dialog playerDialog;
    private WebView playerWebView;
    private static final Set<String> HOSTS = new HashSet<>(Arrays.asList(
        "www.youtube.com", "www.youtube-nocookie.com", "embos.top", "mxdrop.click", "mixdrop.top", "hgcloud.to", "vkvideo.ru", "www.ok.ru", "ok.ru", "s1.hdup400.com", "vidzy.cc", "vidzy.org", "rufiiguta.com", "engifuosi.com", "kitraskimisi.com", "tukipasti.com", "player.mediadelivery.net", "playmogo.com", "watch.easyvidplayer.com", "vidcore.io", "vidcore.net", "vidsrc.mov", "vidsrc.fyi", "embed.vidsrc.si", "vidfast.pro", "vidup.to", "vidrock.net", "vidnest.fun", "vidlink.pro", "111movies.net", "multiembed.mov", "mappletv.uk", "moviesapi.to", "vidapi.xyz", "player.vidlove.cc", "zumivids.com", "cimatnwatchingg.blogspot.com", "embedmaster.link", "fsvid.lol", "kokoflix.lol", "trakx.lol", "uqload.vc", "voe.sx", "doodstream.com", "player.vimeo.com", "www.dailymotion.com", "geo.dailymotion.com", "audinifer.com", "morencius.com", "watch.strp2p.site", "app.videas.fr", "www.vidspeed.org", "uqload.net", "movearnpre.com", "dingtezuni.com", "q7v3k8m2p1.top"
    ));
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
            Dialog dialog = new Dialog(getActivity(), android.R.style.Theme_Material_NoActionBar_Fullscreen);
            playerDialog = dialog;
            LinearLayout layout = new LinearLayout(getActivity()); layout.setOrientation(LinearLayout.VERTICAL); layout.setBackgroundColor(Color.rgb(12,18,16));
            LinearLayout toolbar = new LinearLayout(getActivity()); toolbar.setPadding(dp(8),dp(6),dp(8),dp(6)); toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);
            Button close = new Button(getActivity()); close.setText("Close player"); close.setAllCaps(false); close.setTextSize(14); close.setBackgroundColor(Color.TRANSPARENT); close.setContentDescription("Close in-app player"); close.setTextColor(Color.rgb(243,178,87)); close.setOnClickListener(v -> dialog.dismiss());
            toolbar.addView(close,new LinearLayout.LayoutParams(dp(128),dp(48)));
            TextView title = new TextView(getActivity()); title.setText(Uri.parse(url).getHost()); title.setTextColor(Color.rgb(234,240,235)); title.setTextSize(13); title.setMaxLines(1); title.setEllipsize(android.text.TextUtils.TruncateAt.END); toolbar.addView(title,new LinearLayout.LayoutParams(0,dp(44),1));
            layout.addView(toolbar);
            FrameLayout stage = new FrameLayout(getActivity()); layout.addView(stage,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1));
            WebView web = new WebView(getActivity()); playerWebView = web; web.setBackgroundColor(Color.BLACK);
            WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); settings.setMediaPlaybackRequiresUserGesture(false); settings.setSupportMultipleWindows(true); settings.setJavaScriptCanOpenWindowsAutomatically(false);
            web.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, String target) { return !approved(target); }
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return request.isForMainFrame() && !approved(request.getUrl().toString()); }
            });
            web.setWebChromeClient(new WebChromeClient() {
                private View video;
                private CustomViewCallback callback;
                @Override public void onShowCustomView(View view, CustomViewCallback cb) {
                    if (video != null) { cb.onCustomViewHidden(); return; }
                    video=view;callback=cb;web.setVisibility(View.GONE);stage.addView(view,new FrameLayout.LayoutParams(-1,-1));
                }
                @Override public void onHideCustomView() { if(video!=null){stage.removeView(video);video=null;web.setVisibility(View.VISIBLE);CustomViewCallback cb=callback;callback=null;if(cb!=null)cb.onCustomViewHidden();} }
                @Override public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) { return false; }
            });
            stage.addView(web,new FrameLayout.LayoutParams(-1,-1)); dialog.setContentView(layout);
            dialog.setOnDismissListener(d -> { web.stopLoading();web.loadUrl("about:blank");stage.removeAllViews();web.destroy();playerWebView=null;playerDialog=null;call.resolve(); });
            dialog.show(); if(dialog.getWindow()!=null)dialog.getWindow().setLayout(-1,-1);web.loadUrl(url);
        });
    }
    @PluginMethod public void close(PluginCall call) { getActivity().runOnUiThread(() -> { if(playerDialog!=null)playerDialog.dismiss();call.resolve(); }); }
    @Override protected void handleOnPause() { if(playerWebView!=null)playerWebView.onPause(); }
    @Override protected void handleOnResume() { if(playerWebView!=null)playerWebView.onResume(); }
    @Override protected void handleOnDestroy() { if(playerDialog!=null)playerDialog.dismiss(); }
}
