package app.flixer.stream;

import android.net.Uri;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;
import java.util.HashSet;

/** Observe the publisher's public configuration in its real browser context.
 * Remote documents never receive Capacitor, native HTTP, file or app access. */
@CapacitorPlugin(name="WcoSource")
public class WcoSourcePlugin extends Plugin {
    private WebView source;
    private FrameLayout surface;
    private PluginCall pending;
    private android.os.Handler watchdog=new android.os.Handler(android.os.Looper.getMainLooper());
    public static final String USER_AGENT="Flixer (Android)";

    @PluginMethod public void resolve(PluginCall call){
        String url=call.getString("url","");
        try{Uri u=Uri.parse(url);if(!"https".equals(u.getScheme())||!"www.wcostream.tv".equals(u.getHost())||u.getPort()!=-1||u.getUserInfo()!=null||u.getQuery()!=null||u.getFragment()!=null||!u.getPath().matches("/[a-z0-9][a-z0-9-]{0,159}"))throw new IllegalArgumentException();}
        catch(Exception e){call.reject("Invalid WCO episode URL");return;}
        start(call,url,false,null);
    }
    @PluginMethod public void page(PluginCall call){
        String slug=call.getString("slug","");
        if(!slug.matches("[a-z0-9][a-z0-9-]{0,159}")){call.reject("Invalid WCO series");return;}
        start(call,"https://www.wcostream.tv/anime/"+slug,true,null);
    }
    @PluginMethod public void search(PluginCall call){
        String query=call.getString("query","").trim();if(query.isEmpty()||query.length()>80){call.reject("Invalid WCO search");return;}
        try{start(call,"https://www.wcostream.tv/search",true,("catara="+java.net.URLEncoder.encode(query,"UTF-8")+"&konuara=series").getBytes("UTF-8"));}catch(java.io.UnsupportedEncodingException e){call.reject("Invalid WCO search");}
    }
    private void start(PluginCall call,String url,boolean page,byte[] post){getActivity().runOnUiThread(()->{
        if(pending!=null)finish(pending,null,"WCO request superseded");
        if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)||!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){call.reject("Update Android System WebView to resolve this source");return;}
        pending=call;WebView web=new WebView(getActivity());source=web;
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportMultipleWindows(true);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setUserAgentString(USER_AGENT);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
        surface=new FrameLayout(getActivity());surface.setAlpha(0);surface.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);surface.addView(web,new FrameLayout.LayoutParams(412,600));getActivity().addContentView(surface,new ViewGroup.LayoutParams(1,1));
        java.util.Set<String> origins=new HashSet<>(Arrays.asList("https://www.wcostream.tv","https://embed.wcostream.com"));
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.addWebMessageListener(web,"FlixerWcoResult",origins,(view,message,origin,main,reply)->{
            if(pending!=call||message.getData()==null||message.getData().length()>2000000)return;
            try{JSObject data=new JSObject(message.getData());
                if(page&&main&&"www.wcostream.tv".equals(origin.getHost())&&data.has("html")){finish(call,data,null);}
                else if(!page&&"embed.wcostream.com".equals(origin.getHost())&&data.has("configuration")){finish(call,data,null);}
            }catch(Exception ignored){}
        });
        String script;
        try(java.io.InputStream input=getContext().getAssets().open("wco-source.js")){
            java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int count;while((count=input.read(buffer))!=-1)out.write(buffer,0,count);
            script="window.__flixerWcoPage="+page+";window.__flixerWcoSearch="+(post!=null)+";\n"+out.toString("UTF-8");
        }catch(java.io.IOException e){finish(call,null,"WCO resolver unavailable");return;}
        if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))WebViewCompat.addDocumentStartJavaScript(web,script,origins);
        // These filters block advertising requests without changing a source's
        // authentication, media tokens, quality selection or playback timers.
        web.setWebViewClient(new WebViewClient(){
            @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){return PlayerAdBlock.intercept(request);}
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){return request.isForMainFrame()&&!request.getUrl().toString().equals(url);}
            @Override public void onReceivedError(WebView v,WebResourceRequest request,android.webkit.WebResourceError error){if(request.isForMainFrame())finish(call,null,"WCO page unavailable");}
            @Override public void onReceivedHttpError(WebView v,WebResourceRequest request,android.webkit.WebResourceResponse response){if(request.isForMainFrame()&&response.getStatusCode()>=400&&!PlayerHttpPolicy.needsBrowserVerification(response.getStatusCode(),response.getResponseHeaders()))finish(call,null,"WCO HTTP "+response.getStatusCode());}
        });
        web.setDownloadListener((target,agent,disposition,mime,length)->{});
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onCreateWindow(WebView v,boolean dialog,boolean gesture,android.os.Message result){return false;}
            @Override public boolean onJsAlert(WebView v,String target,String message,android.webkit.JsResult result){result.cancel();return true;}
            @Override public boolean onJsConfirm(WebView v,String target,String message,android.webkit.JsResult result){result.cancel();return true;}
            @Override public boolean onJsPrompt(WebView v,String target,String message,String value,android.webkit.JsPromptResult result){result.cancel();return true;}
            @Override public void onPermissionRequest(android.webkit.PermissionRequest request){request.deny();}
        });
        watchdog.postDelayed(()->finish(call,null,"WCO source timed out"),35000);if(post==null)web.loadUrl(url);else web.postUrl(url,post);
    });}
    private void finish(PluginCall call,JSObject result,String error){
        if(pending!=call)return;pending=null;watchdog.removeCallbacksAndMessages(null);
        if(source!=null){source.stopLoading();if(source.getParent() instanceof ViewGroup)((ViewGroup)source.getParent()).removeView(source);source.destroy();source=null;}
        if(surface!=null){if(surface.getParent() instanceof ViewGroup)((ViewGroup)surface.getParent()).removeView(surface);surface=null;}
        if(error!=null)call.reject(error);else call.resolve(result);
    }
    @PluginMethod public void cancel(PluginCall call){getActivity().runOnUiThread(()->{if(pending!=null)finish(pending,null,"WCO request cancelled");call.resolve();});}
    @Override protected void handleOnDestroy(){if(pending!=null)finish(pending,null,"WCO request cancelled");}
    @Override protected void handleOnPause(){if(pending!=null)finish(pending,null,"WCO request cancelled");}
}
