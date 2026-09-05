package com.kxlynn.clock;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.format.DateFormat;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Color;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView timeView;
    private TextView dateView;
    private final Locale locale = new Locale("pt", "BR");

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            updateClock();
            handler.postDelayed(this, 250);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(11, 11, 15));
        window.setNavigationBarColor(Color.rgb(11, 11, 15));
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(24), dp(24), dp(24), dp(24));
        root.setBackgroundColor(Color.rgb(11, 11, 15));

        timeView = new TextView(this);
        timeView.setTextColor(Color.WHITE);
        timeView.setTextSize(64);
        timeView.setGravity(Gravity.CENTER);
        timeView.setIncludeFontPadding(false);
        timeView.setLetterSpacing(0.02f);
        timeView.setTypeface(android.graphics.Typeface.create("sans-serif-light", android.graphics.Typeface.NORMAL));

        dateView = new TextView(this);
        dateView.setTextColor(Color.rgb(185, 185, 195));
        dateView.setTextSize(18);
        dateView.setGravity(Gravity.CENTER);
        dateView.setPadding(0, dp(14), 0, 0);
        dateView.setTypeface(android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL));

        root.addView(timeView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(dateView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        setContentView(root);
        updateClock();
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.removeCallbacks(ticker);
        handler.post(ticker);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(ticker);
        super.onPause();
    }

    private void updateClock() {
        Date now = new Date();
        boolean is24Hour = DateFormat.is24HourFormat(this);
        String timePattern = is24Hour ? "HH:mm:ss" : "hh:mm:ss a";

        SimpleDateFormat timeFormat = new SimpleDateFormat(timePattern, locale);
        SimpleDateFormat dateFormat = new SimpleDateFormat("EEEE, d 'de' MMMM 'de' yyyy", locale);

        String time = timeFormat.format(now);
        String date = dateFormat.format(now);
        if (!date.isEmpty()) {
            date = Character.toUpperCase(date.charAt(0)) + date.substring(1);
        }

        timeView.setText(time);
        dateView.setText(date);
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }
}
