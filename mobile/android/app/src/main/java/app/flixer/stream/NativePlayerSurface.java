package app.flixer.stream;

import android.graphics.Color;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

/** Native playback occupies the HTML stage; only an explicit control expands it. */
final class NativePlayerSurface {
    interface DismissListener { void dismissed(NativePlayerSurface surface); }
    private final BridgeActivity activity;
    private final WebView appWeb;
    private final FrameLayout host, viewport;
    private View content, toolbar;
    private JSObject bounds;
    private DismissListener listener;
    private java.util.function.Consumer<Boolean> fullscreenListener;
    private boolean showing, fullscreen, keptScreenOn;
    private final OnBackPressedCallback back = new OnBackPressedCallback(true) {
        @Override public void handleOnBackPressed() {
            if (fullscreen) setFullscreen(false); else dismiss();
        }
    };
    NativePlayerSurface(BridgeActivity activity, WebView appWeb, JSObject bounds) {
        this.activity=activity; this.appWeb=appWeb; this.bounds=bounds;
        host=new FrameLayout(activity); viewport=new FrameLayout(activity);
        viewport.setBackgroundColor(Color.BLACK);viewport.setContentDescription("Flixer playback surface");
        host.addView(viewport);
    }
    void setContentView(View content) { this.content=content; viewport.addView(content,new FrameLayout.LayoutParams(-1,-1)); }
    void setToolbar(View toolbar) { this.toolbar=toolbar; toolbar.setVisibility(View.GONE); }
    void setOnDismissListener(DismissListener listener) { this.listener=listener; }
    void setFullscreenListener(java.util.function.Consumer<Boolean> listener) { fullscreenListener=listener; }
    boolean isShowing() { return showing; }
    boolean isFullscreen() { return fullscreen; }
    void show() {
        showing=true;
        ((ViewGroup)activity.findViewById(android.R.id.content)).addView(host,new ViewGroup.LayoutParams(-1,-1));
        activity.getOnBackPressedDispatcher().addCallback(activity,back);
        keptScreenOn=(activity.getWindow().getAttributes().flags&WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)!=0;
        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        host.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->layout());
        layout(); host.post(this::layout);
    }
    void updateBounds(JSObject bounds) { this.bounds=bounds; layout(); }
    void setFullscreen(boolean expanded) {
        fullscreen=expanded;
        if(fullscreenListener!=null)fullscreenListener.accept(expanded);
        if(toolbar!=null)toolbar.setVisibility(expanded?View.VISIBLE:View.GONE);
        layout();
    }
    private void layout() {
        if(!showing)return;
        androidx.core.view.WindowInsetsCompat insets=androidx.core.view.ViewCompat.getRootWindowInsets(host);
        if(fullscreen&&insets!=null){
            androidx.core.graphics.Insets safe=insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars()|androidx.core.view.WindowInsetsCompat.Type.displayCutout());
            viewport.setPadding(safe.left,safe.top,safe.right,safe.bottom);
        }else viewport.setPadding(0,0,0,0);
        FrameLayout.LayoutParams params;
        if(fullscreen)params=new FrameLayout.LayoutParams(-1,-1);
        else {
            double viewportWidth=bounds==null?0:bounds.optDouble("viewportWidth",0);
            double scale=viewportWidth>0?appWeb.getWidth()/viewportWidth:activity.getResources().getDisplayMetrics().density;
            double x=bounds==null?0:bounds.optDouble("x",0), y=bounds==null?0:bounds.optDouble("y",0);
            double w=bounds==null?appWeb.getWidth()/scale:bounds.optDouble("width",0);
            double h=bounds==null?w*9/16:bounds.optDouble("height",0);
            if(!Double.isFinite(scale)||scale<=0||!Double.isFinite(x)||!Double.isFinite(y)||!Double.isFinite(w)||!Double.isFinite(h)){viewport.setVisibility(View.GONE);return;}
            int[] webPos=new int[2],hostPos=new int[2];appWeb.getLocationInWindow(webPos);host.getLocationInWindow(hostPos);
            int width=(int)Math.round(Math.min(w*scale,appWeb.getWidth())),height=(int)Math.round(Math.min(h*scale,appWeb.getHeight()));
            params=new FrameLayout.LayoutParams(Math.max(1,width),Math.max(1,height));
            params.leftMargin=webPos[0]-hostPos[0]+(int)Math.round(x*scale);
            params.topMargin=webPos[1]-hostPos[1]+(int)Math.round(y*scale);
            viewport.setVisibility(width>0&&height>0&&params.topMargin+height>0&&params.topMargin<host.getHeight()?View.VISIBLE:View.GONE);
        }
        if(fullscreen)viewport.setVisibility(View.VISIBLE);
        viewport.setLayoutParams(params);
    }
    void dismiss() {
        if(!showing)return;
        showing=false; back.remove();
        ((ViewGroup)host.getParent()).removeView(host);
        if(!keptScreenOn)activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if(listener!=null)listener.dismissed(this);
        viewport.removeAllViews();content=null;
    }
}
