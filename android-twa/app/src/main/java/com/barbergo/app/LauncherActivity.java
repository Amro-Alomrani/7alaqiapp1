package com.barbergo.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import androidx.core.content.ContextCompat;

public class LauncherActivity extends Activity {

    private static final String TWA_URL = "https://halaqyapp.web.app/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Uri uri = Uri.parse(TWA_URL);

        new TrustedWebActivityIntentBuilder(uri)
            .setColorSchemeParams(
                CustomTabsIntent.COLOR_SCHEME_DARK,
                new CustomTabColorSchemeParams.Builder()
                    .setToolbarColor(ContextCompat.getColor(this, R.color.colorPrimary))
                    .build()
            )
            .build(null)
            .launchTrustedWebActivity(this);

        finish();
    }
}
