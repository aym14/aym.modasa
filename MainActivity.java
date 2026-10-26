package com.ansaryuvamandal.ledger;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Locale;

/**
 * ANSAR YUVA MANDAL — Smart Ledger
 * મોબાઇલ એપ્લિકેશન (Android WebView).
 *
 * એપની આખી ફાઇલ index.html assets/ માં બંડલ થયેલી છે — એટલે
 * ઇન્ટરનેટ વગર પણ સંપૂર્ણ એપ ચાલે છે. ડેટા ફોનના WebView storage
 * (localStorage) માં જ રહે છે, એટલે એપ બંધ કરો તો પણ હિસાબ સચવાયેલો રહે.
 */
public class MainActivity extends Activity {

    private WebView web;
    private FrameLayout root;
    private long lastBackPress = 0L;
    private ValueCallback<Uri[]> fileCallback;
    private static final int REQ_FILE = 3411;

    /* એપ એસેટ અંદરની ફેક ડોમેન — https હોવાથી WebView નું localStorage કાયમી રહે છે
       (file:// પર કેટલાક ફોનમાં ડેટા ગુમાવાનું જોખમ હોય છે). */
    private static final String HOST = "aym.local";
    private static final String START_URL = "https://aym.local/index.html";

    /* એપની અંદર ઉમેરાતો નાનો "નેતિવ શિમ": પ્રિન્ટ → Android પ્રિન્ટ ડાયલોગ,
       બેકઅપ/CSV ડાઉનલોડ → Downloads ફોલ્ડર. index.html ને બદલ્યા વગર. */
    private static final String SHIM =
        "(function(){try{" +
        "if(!window.AndroidBridge||window.__aymShim)return;window.__aymShim=1;" +
        "var p=window.print;window.print=function(){try{window.AndroidBridge.printPage();}catch(e){try{p&&p();}catch(e2){}}};" +
        "function save(href,name){try{fetch(href).then(function(r){return r.blob();}).then(function(b){" +
        "var fr=new FileReader();fr.onload=function(){var d=String(fr.result||''),i=d.indexOf(',');" +
        "var b64=i>=0?d.slice(i+1):'';try{window.AndroidBridge.saveFile(name||'aym-file',b.type||'',b64);}catch(e){}};" +
        "fr.readAsDataURL(b);}).catch(function(){});}catch(e){}}" +
        "var oc=HTMLAnchorElement.prototype.click;" +
        "HTMLAnchorElement.prototype.click=function(){" +
        "try{var h=this.getAttribute('href')||'',n=this.getAttribute('download');" +
        "if(n&&h.indexOf('blob:')===0){save(h,n);return;}" +
        "if(n&&h.indexOf('data:')===0){try{var i=h.indexOf(',');" +
        "window.AndroidBridge.saveFile(n,(h.slice(5,i).split(';')[0]||''),h.slice(i+1));return;}catch(e){}}" +
        "}catch(e){}return oc.apply(this,arguments);};" +
        "}catch(e){}})();";

    private static final HashMap<String, String> MIME = new HashMap<String, String>();
    static {
        MIME.put("html", "text/html");
        MIME.put("htm", "text/html");
        MIME.put("js", "application/javascript");
        MIME.put("json", "application/json");
        MIME.put("css", "text/css");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("webp", "image/webp");
        MIME.put("ico", "image/x-icon");
        MIME.put("woff", "font/woff");
        MIME.put("woff2", "font/woff2");
        MIME.put("ttf", "font/ttf");
        MIME.put("txt", "text/plain");
        MIME.put("pdf", "application/pdf");
    }

    private String mimeOf(String path) {
        String p = path == null ? "" : path.toLowerCase(Locale.US);
        int i = p.lastIndexOf('.');
        String ext = i >= 0 ? p.substring(i + 1) : "";
        String m = MIME.get(ext);
        return m == null ? "application/octet-stream" : m;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(0xFF173A3A);
        web = new WebView(this);
        // સ્ટાર્ટઅપ: WebView સફેદ રંગે ઝબકે નહીં — પહેલા ફ્રેમથી જ બ્રાન્ડ રંગ દેખાય
        web.setBackgroundColor(0xFF173A3A);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);          // એપ પોતે જ મોબાઇલ માટે ગોઠવાયેલી છે
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);               // ફોનની સિસ્ટમ ફોન્ટ સાઇઝથી લેઆઉટ ન બગડે
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setLoadsImagesAutomatically(true);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        // થીમ/સ્ટેટસ બાર
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                getWindow().setStatusBarColor(0xFF173A3A);
                getWindow().setNavigationBarColor(0xFF173A3A);
            }
        } catch (Exception ignored) { }

        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        // http(s) ડાઉનલોડ લિંક દબાય તો બ્રાઉઝરમાં ખોલો (blob: ડાઉનલોડ JS શિમ સંભાળે છે)
        web.setDownloadListener(new android.webkit.DownloadListener() {
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) return;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) { }
            }
        });

        web.setWebViewClient(new WebViewClient() {
            /** એપની ફાઇલો સીધી assets/ માંથી આપો (ઑફલાઇન) */
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                try {
                    Uri u = req.getUrl();
                    if (u == null || !HOST.equals(u.getHost())) return null;
                    String path = u.getPath();
                    if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                    String asset = path.startsWith("/") ? path.substring(1) : path;
                    HashMap<String, String> h = new HashMap<String, String>();
                    h.put("Cache-Control", "no-store");
                    // એપમાં Service Worker ની જરૂર નથી (બધું already ઑફલાઇન બંડલમાં છે)
                    if ("sw.js".equals(asset)) {
                        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", h,
                                new ByteArrayInputStream(new byte[0]));
                    }
                    InputStream in = getAssets().open(asset);
                    return new WebResourceResponse(mimeOf(asset), "UTF-8", 200, "OK", h, in);
                } catch (IOException e) {
                    return null;
                } catch (Exception e) {
                    return null;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(SHIM, null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return handleUrl(req.getUrl() == null ? "" : req.getUrl().toString());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                return true; // લોગ શાંત
            }

            /** લોગો અપલોડ / બેકઅપ ઇમ્પોર્ટ માટે ફાઇલ પસંદગી */
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = cb;
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(Intent.createChooser(i, "ફાઇલ પસંદ કરો"), REQ_FILE);
                    return true;
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "ફાઇલ પસંદ કરવાનો વિકલ્પ મળ્યો નહીં", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        // JS ↔ Android પુલ: પ્રિન્ટ અને ફાઇલ સેવ
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.loadUrl(START_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.onPause();
            web.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        try {
            if (web != null) {
                web.removeJavascriptInterface("AndroidBridge");
                web.loadUrl("about:blank");
                web.destroy();
                web = null;
            }
        } catch (Exception ignored) { }
        super.onDestroy();
    }

    /** બહારની લિંક બ્રાઉઝરમાં ખોલો; એપની અંદરની લિંક એપમાં જ */
    private boolean handleUrl(String url) {
        if (url == null || url.isEmpty()) return false;
        if (url.startsWith("file://")) return false;
        if (url.contains(HOST)) return false;   /* એપની પોતાની ફાઇલો */
        if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:")
                || url.startsWith("upi:") || url.startsWith("sms:")) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ignored) { }
            return true;
        }
        if (url.startsWith("http://") || url.startsWith("https://")) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ignored) { }
            return true;
        }
        return false;
    }

    /* ---------------- JS પુલ ---------------- */
    private class Bridge {

        /** એપમાંથી "પ્રિન્ટ" દબાવો ત્યારે Android નો પ્રિન્ટ ડાયલોગ (PDF સેવ પણ થાય) */
        @JavascriptInterface
        public void printPage() {
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                        String job = getString(R.string.app_name) + " — પ્રિન્ટ";
                        PrintDocumentAdapter adapter;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            adapter = web.createPrintDocumentAdapter(job);
                        } else {
                            adapter = web.createPrintDocumentAdapter();
                        }
                        PrintAttributes attrs = new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                .build();
                        pm.print(job, adapter, attrs);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this,
                                "પ્રિન્ટ થઈ શક્યું નહીં — PDF તરીકે સેવ કરવાનો પ્રયત્ન કરો",
                                Toast.LENGTH_LONG).show();
                    }
                }
            });
        }

        /** એપમાંથી ડાઉનલોડ (બેકઅપ JSON, PDF વગેરે) → ફોનના Downloads ફોલ્ડરમાં */
        @JavascriptInterface
        public void saveFile(String fileName, String mime, String base64) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    cv.put(android.provider.MediaStore.MediaColumns.MIME_TYPE,
                            (mime == null || mime.isEmpty()) ? "application/octet-stream" : mime);
                    cv.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, "Download");
                    Uri uri = getContentResolver()
                            .insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) throw new Exception("no uri");
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    os.write(bytes);
                    os.close();
                } else {
                    File dir = android.os.Environment
                            .getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, fileName);
                    FileOutputStream fo = new FileOutputStream(f);
                    fo.write(bytes);
                    fo.close();
                }
                runOnUiThread(new Runnable() {
                    public void run() {
                        Toast.makeText(MainActivity.this,
                                "ફાઇલ Downloads ફોલ્ડરમાં સેવ થઈ", Toast.LENGTH_LONG).show();
                    }
                });
            } catch (Exception e) {
                runOnUiThread(new Runnable() {
                    public void run() {
                        Toast.makeText(MainActivity.this,
                                "ફાઇલ સેવ થઈ શકી નહીં", Toast.LENGTH_LONG).show();
                    }
                });
            }
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }

        /** એપનું વર્ઝન કોડ (અપડેટ તપાસ માટે) */
        @JavascriptInterface
        public int appVersionCode() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            } catch (Exception e) {
                return 0;
            }
        }

        /** એપનું વર્ઝન નામ, દા.ત. 1.0.2 */
        @JavascriptInterface
        public String appVersionName() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }

        /** નવું APK ડાઉનલોડ કરીને ઇન્સ્ટોલર ખોલો (ડેટા જળવાય રહે) */
        @JavascriptInterface
        public void installUpdate(final String url) {
            if (url == null || url.trim().isEmpty()) return;
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                            Toast.makeText(MainActivity.this,
                                    "એપ ઇન્સ્ટોલ કરવાની મંજૂરી આપો, પછી ફરી 'અપડેટ કરો' દબાવો",
                                    Toast.LENGTH_LONG).show();
                            try {
                                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                        Uri.parse("package:" + getPackageName())));
                            } catch (Exception ignored) { }
                            return;
                        }
                        Toast.makeText(MainActivity.this, "⬇️ નવું વર્ઝન ડાઉનલોડ થાય છે…", Toast.LENGTH_SHORT).show();
                        downloadAndInstall(url.trim());
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "અપડેટ શરૂ થઈ શક્યું નહીં", Toast.LENGTH_LONG).show();
                    }
                }
            });
        }
    }

    /* ---------------- અપડેટ: ડાઉનલોડ + ઇન્સ્ટોલ ---------------- */
    private void toastOnUi(final String msg) {
        runOnUiThread(new Runnable() {
            public void run() { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show(); }
        });
    }

    private void downloadAndInstall(final String url) {
        new Thread(new Runnable() {
            public void run() {
                File out = null;
                try {
                    File dir = new File(getExternalFilesDir(null), "updates");
                    if (!dir.exists()) dir.mkdirs();
                    out = new File(dir, "AYM-Ledger-update.apk");
                    if (out.exists() && !out.delete()) { /* જૂની ફાઇલ ગઈ નહીં તો પણ ઓવરરાઇટ */ }

                    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setConnectTimeout(20000);
                    conn.setReadTimeout(120000);
                    conn.setInstanceFollowRedirects(true);
                    conn.setRequestProperty("Accept", "application/octet-stream");
                    conn.connect();
                    int code = conn.getResponseCode();
                    if (code < 200 || code >= 300) throw new IOException("HTTP " + code);
                    int total = conn.getContentLength();

                    InputStream in = new BufferedInputStream(conn.getInputStream());
                    FileOutputStream fo = new FileOutputStream(out);
                    byte[] buf = new byte[16384];
                    long done = 0;
                    int n, lastShown = -10;
                    while ((n = in.read(buf)) > 0) {
                        fo.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct - lastShown >= 20) {
                                lastShown = pct;
                                toastOnUi("ડાઉનલોડ " + pct + "%");
                            }
                        }
                    }
                    fo.flush();
                    fo.close();
                    in.close();
                    conn.disconnect();

                    if (out.length() < 10000) throw new IOException("empty file");
                    final File apk = out;
                    runOnUiThread(new Runnable() {
                        public void run() { startInstaller(apk); }
                    });
                } catch (Exception e) {
                    toastOnUi("ડાઉનલોડ થઈ શક્યું નહીં — ઇન્ટરનેટ/લિંક તપાસો");
                }
            }
        }).start();
    }

    private void startInstaller(File apk) {
        try {
            Uri uri = ApkProvider.uriFor(apk.getName());
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            toastOnUi("✅ ઇન્સ્ટોલર ખૂલ્યો — 'Update' દબાવો (ડેટા જળવાય રહેશે)");
        } catch (Exception e) {
            toastOnUi("ઇન્સ્ટોલર ખૂલી શક્યો નહીં");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) {
                Uri[] out = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int n = data.getClipData().getItemCount();
                        out = new Uri[n];
                        for (int i = 0; i < n; i++) {
                            out[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (data.getData() != null) {
                        out = new Uri[]{data.getData()};
                    }
                }
                fileCallback.onReceiveValue(out);
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // પહેલાં ખુલેલા પોપઅપ બંધ કરો
            web.evaluateJavascript(
                    "(function(){try{"
                            + "var o=[].slice.call(document.querySelectorAll('.modal-overlay,.modal')).filter(function(e){return e.offsetParent!==null&&getComputedStyle(e).display!=='none';});"
                            + "if(o.length){var top=o[o.length-1];var b=top.querySelector('[onclick*=\"close\"],.close,.btn-close');if(b){b.click();return 'closed';}top.style.display='none';top.classList.remove('open');return 'hidden';}"
                            + "}catch(e){}return 'none';})()",
                    new ValueCallback<String>() {
                        @Override
                        public void onReceiveValue(String value) {
                            boolean handledByPage = value != null
                                    && (value.contains("closed") || value.contains("hidden") || value.contains("pc"));
                            if (handledByPage) return;
                            if (web.canGoBack()) {
                                web.goBack();
                            } else {
                                long now = System.currentTimeMillis();
                                if (now - lastBackPress < 2000) {
                                    finish();
                                } else {
                                    lastBackPress = now;
                                    Toast.makeText(MainActivity.this,
                                            "એપ બંધ કરવા ફરી એક વાર BACK દબાવો", Toast.LENGTH_SHORT).show();
                                }
                            }
                        }
                    });
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
