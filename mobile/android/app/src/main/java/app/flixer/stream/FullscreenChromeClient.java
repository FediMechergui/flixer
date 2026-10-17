package app.flixer.stream;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.FrameLayout;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * Capacitor's stock chrome client cancels every HTML5 fullscreen request, so <video>, the
 * YouTube player and embedded players could never go fullscreen inside the app. This client
 * shows the WebView's fullscreen view over the activity (landscape, immersive) and restores
 * the page when the site or the back button exits fullscreen.
 */
public class FullscreenChromeClient extends BridgeWebChromeClient {
    private final Bridge bridge;
    private View customView;
    private FrameLayout fullscreenContainer;
    private CustomViewCallback customViewCallback;
    private int originalOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;

    public FullscreenChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    public boolean isFullscreen() {
        return customView != null;
    }

    @Override
    public boolean onCreateWindow(android.webkit.WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
        return false;
    }

    @Override
    public void onShowCustomView(View view, CustomViewCallback callback) {
        if (customView != null) {
            callback.onCustomViewHidden();
            return;
        }
        Activity activity = bridge.getActivity();
        customView = view;
        customViewCallback = callback;
        originalOrientation = activity.getRequestedOrientation();
        view.setBackgroundColor(0xFF000000);
        ViewGroup decor = (ViewGroup) activity.getWindow().getDecorView();
        fullscreenContainer = new FrameLayout(activity);
        fullscreenContainer.setBackgroundColor(0xFF000000);
        fullscreenContainer.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        android.widget.Button exit = new android.widget.Button(activity);
        exit.setText("Exit player");
        exit.setContentDescription("Exit fullscreen player");
        exit.setTextColor(0xFFFFFFFF);
        exit.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xDD242424));
        int margin = (int)(24 * activity.getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams exitParams = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, android.view.Gravity.TOP | android.view.Gravity.END);
        exitParams.setMargins(margin, margin, margin, margin);
        fullscreenContainer.addView(exit, exitParams);
        exit.setOnClickListener(button -> onHideCustomView());
        decor.addView(fullscreenContainer, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // Keep WebView visible beneath decor to prevent Chromium GPU buffer / Skia mailbox destruction on orientation shift
        activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        setSystemBarsHidden(true);
    }

    @Override
    public void onHideCustomView() {
        if (customView == null) return;
        Activity activity = bridge.getActivity();
        ViewGroup decor = (ViewGroup) activity.getWindow().getDecorView();
        if (fullscreenContainer != null) {
            decor.removeView(fullscreenContainer);
            fullscreenContainer.removeAllViews();
            fullscreenContainer = null;
        }
        customView = null;
        if (customViewCallback != null) {
            try {
                customViewCallback.onCustomViewHidden();
            } catch (Exception ignored) {}
            customViewCallback = null;
        }
        activity.setRequestedOrientation(originalOrientation != ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED ? originalOrientation : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        setSystemBarsHidden(false);
    }

    private void setSystemBarsHidden(boolean hidden) {
        Window window = bridge.getActivity().getWindow();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (hidden) {
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars());
        }
    }
}
