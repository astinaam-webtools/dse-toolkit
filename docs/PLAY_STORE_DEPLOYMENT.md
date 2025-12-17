# Google Play Store Deployment Guide for DSE Toolkit

This guide covers the end-to-end process of building your Android App Bundle (.aab) and publishing it to the Google Play Store.

## 1. Prerequisites & Preparation

### Permissions Check
Your app currently uses:
- `android.permission.INTERNET`: Required to fetch market data.
- **No other dangerous permissions** are requested in your `AndroidManifest.xml`.

### Privacy Policy & Terms
**Yes, a Privacy Policy is required.**
Even if you don't collect data, Google Play requires a valid Privacy Policy URL for all apps, especially those in the "Finance" category.
- **Action**: Create a simple `privacy.html` in your repository (served via GitHub Pages) stating that the app does not collect personal user data and is a read-only tool.
- **Disclaimer**: Since this is a stock market tool, add a "Disclaimer" in your app (e.g., in the About section) and in the Store Description stating: *"This app is for informational purposes only and does not constitute financial advice."*

## 2. Building the Signed App Bundle (AAB)

Google Play requires an `.aab` (Android App Bundle) file, not an `.apk`.

### Step 2.1: Update Version
Before every release, increment the `versionCode` and `versionName`.
1. Open `android/app/build.gradle`.
2. Find `defaultConfig`:
   ```gradle
   defaultConfig {
       applicationId "com.astinaam.stockglossary"
       versionCode 1  // Increment this (integer) for every update (1 -> 2)
       versionName "1.0" // Visible to users (1.0 -> 1.1)
       // ...
   }
   ```

### Step 2.2: Build Web Assets & Sync
Run these commands in your VS Code terminal to ensure the latest code is copied to the Android project:
```bash
npm run build
npx cap sync android
```

### Step 2.3: Generate Keystore (First Time Only)
You need a digital signature to prove ownership.
1. Open Android Studio: `npx cap open android`.
2. Go to **Build > Generate Signed Bundle / APK**.
3. Select **Android App Bundle** > Next.
4. Under **Key store path**, click **Create new...**.
   - **Path**: Save it somewhere safe (e.g., `~/keystores/dse-toolkit.jks`). **Do not commit this to Git.**
   - **Password**: Create a strong password.
   - **Alias**: `key0` (default) or `dse_toolkit`.
   - **Key Password**: Same as store password.
   - **Validity**: 25 years.
   - **Certificate**: Fill in First/Last Name, Org Unit (Engineering), Org (Astinaam), City, etc.
5. Click **OK**.

### Step 2.4: Generate the Bundle
1. Back in the "Generate Signed Bundle or APK" window, select your newly created Key store.
2. Enter the passwords.
3. Check "Remember passwords" (optional).
4. Click **Next**.
5. Select **release**.
6. Click **Create**.
7. Once done, a popup will appear. Click **locate** to find the `.aab` file (usually in `android/app/release/app-release.aab`).

---

## 3. Google Play Console Setup

Go to [Google Play Console](https://play.google.com/console) and log in.

### Step 3.1: Create App
- **App Name**: DSE Toolkit
- **Default Language**: English (en-US) or Bengali (bn-BD) depending on preference.
- **App or Game**: App.
- **Free or Paid**: Free.
- **Declarations**: Accept the "Developer Program Policies" and "US Export Laws".

### Step 3.2: Dashboard "Set up your app"
You must complete these tasks in order.

1.  **Privacy Policy**: Paste the URL to your GitHub Pages privacy policy (e.g., `https://<user>.github.io/stock-market/privacy.html`).
2.  **App Access**: Select "All functionality is available without special access" (unless you add login later).
3.  **Ads**: Select "No, my app does not contain ads".
4.  **Content Rating**:
    -   Start questionnaire.
    -   Category: "Reference, News, or Educational".
    -   Answer "No" to violence, sexuality, offensive language, etc.
    -   Save & Submit.
5.  **Target Audience**:
    -   Select "18 and over". (Selecting younger ages triggers strict family policies).
    -   "Appeal to children?": No.
6.  **News Apps**: "No, my app is not a news app".
7.  **COVID-19**: "My app is not a publicly available COVID-19 contact tracing or status app".
8.  **Data Safety**:
    -   Does your app collect or share any of the required user data types? **No**. (Since you use standard Capacitor with no analytics plugins).
    -   Submit the form.
9.  **Government Apps**: "No, my app is not a government app".
10. **Financial Features**:
    -   Scroll down to "Financial features".
    -   You might need to declare this. Since you provide market data, select "My app provides financial information".
    -   You may need to provide documentation if asked, but usually, for a glossary/dashboard, it's fine. Ensure your "Disclaimer" is visible in the app.
11. **Select an App Category and provide contact details**:
    -   Category: **Finance**.
    -   Tags: Stock Market, Education, Finance.
    -   Email: Your developer email.

### Step 3.3: Store Listing (Main Store Listing)
-   **App Name**: DSE Toolkit
-   **Short Description**: (Max 80 chars) *Real-time DSE market dashboard, stock analyzer, and investor glossary.*
-   **Full Description**: (Max 4000 chars)
    -   Describe features: Market Lens, Screener, Sector Heatmap, Behavior Analyzer.
    -   Mention it's for Dhaka Stock Exchange.
    -   Include the disclaimer: *"Not financial advice."*
-   **Graphics**:
    -   **App Icon**: 512x512 PNG (Use `assets/finalized/Option1/pwa_icon_512.png` but ensure it has no transparency if Play Console complains, though usually, it accepts it. Ideally, use a filled background version).
    -   **Feature Graphic**: 1024x500 PNG (Use `assets/finalized/Common/feature_graphic.png`).
    -   **Phone Screenshots**: Upload 2-8 screenshots (Take these from your emulator or device).
    -   **Tablet Screenshots**: Upload 7-inch and 10-inch screenshots (Optional but recommended).

---

## 4. Releasing to Production

1.  On the left menu, go to **Production**.
2.  Click **Create new release**.
3.  **App Bundles**: Upload the `.aab` file you generated in Step 2.4.
4.  **Release Name**: e.g., "1.0 - Initial Release".
5.  **Release Notes**:
    ```text
    Initial release of DSE Toolkit.
    - Comprehensive Stock Glossary
    - Market Dashboard with Screener & Heatmap
    - Stock Behavior Analyzer
    ```
6.  Click **Next**.
7.  **Errors/Warnings**:
    -   You might see warnings about "App Bundle contains native code..." (Ignore, Capacitor handles this).
    -   If you see errors, fix them (usually missing declarations).
8.  Click **Save** -> **Review release**.
9.  Click **Start rollout to Production**.

## 5. What to Expect
-   **Review Time**: Google takes 1-7 days to review new apps.
-   **Rejection**: Common reasons include:
    -   Broken functionality (ensure your API works).
    -   Misleading description.
    -   Missing Privacy Policy.
    -   Improper "Financial Features" declaration.
-   **Updates**: For future updates, just repeat Step 2.1 (bump version), Step 2.2 (build), Step 2.4 (generate AAB), and Step 4 (upload new release).
