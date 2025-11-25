package com.navigator.school;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    hideSystemUI();
    WebView.setWebContentsDebuggingEnabled(true);
    WebView web = new WebView(this);
    web.clearCache(true);

    WebView webView = getBridge().getWebView();


    if (webView != null) {
      WebSettings webSettings = webView.getSettings();
      webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW); // Allow mixed content (HTTP and HTTPS)
    }
  }

  private void hideSystemUI() {
    getWindow().getDecorView().setSystemUiVisibility(
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_FULLSCREEN
    );
  }
}
