# BizzFlow Management (Android)

Flutter app for management officers: dashboards and approvals, with push alerts for new approval requests.
Talks to the main PHP API in `server/` (`/api/auth/*`, `/api/approval/*`, `/api/dashboard/*`, `/api/device/*`).

## First-time setup

The `android/` folder is generated, not hand-written. From this folder:

```sh
flutter create --org com.bizzflow --project-name mobile_mgmt --platforms android .
flutter pub get
```

`flutter create .` only adds missing files; it leaves `lib/` and `pubspec.yaml` alone.
Delete the generated `test/widget_test.dart` (it references a counter app that doesn't exist).

### Firebase (push)

1. In the Firebase console, add an Android app with package `com.bizzflow.mobile_mgmt`.
2. Download `google-services.json` to `android/app/` (gitignored).
3. `android/settings.gradle.kts`, inside `plugins { }`:
   ```kotlin
   id("com.google.gms.google-services") version "4.4.2" apply false
   ```
4. `android/app/build.gradle.kts`:
   ```kotlin
   plugins {
       // ...existing
       id("com.google.gms.google-services")
   }
   android {
       defaultConfig { minSdk = 23 }
       compileOptions {
           isCoreLibraryDesugaringEnabled = true   // needed by flutter_local_notifications
       }
   }
   dependencies {
       coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
   }
   ```
5. `android/app/src/main/AndroidManifest.xml`, inside `<manifest>`:
   ```xml
   <uses-permission android:name="android.permission.INTERNET"/>
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
   ```
   For a local `http://` dev API, also add `android:usesCleartextTraffic="true"` on `<application>`.

Without `google-services.json` the app still runs; push is just off.

### App lock (fingerprint / PIN)

`local_auth` needs two Android changes:

1. `android/app/src/main/kotlin/.../MainActivity.kt`:
   ```kotlin
   import io.flutter.embedding.android.FlutterFragmentActivity
   class MainActivity : FlutterFragmentActivity()
   ```
2. `AndroidManifest.xml`, inside `<manifest>`:
   ```xml
   <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
   ```

Users turn it on in Profile > App lock. It asks on cold start and after the chosen time away (default 1 min).

Server side: set `FCM_SERVICE_ACCOUNT` in `server/.env` (see `server/.env.example`).

## Run

```sh
flutter run
```

On first launch enter the API address (e.g. `https://api.yourcompany.com`; `/api` is added automatically)
and, for shared cloud workspaces, the workspace domain (sent as `X-Tenant-Host`).
For a local XAMPP API from a phone, use the PC's LAN IP: `http://192.168.x.x/rapair-management/server/public`.

## Structure

- `lib/services/api_client.dart`: every API call; adds Bearer token, `X-Location-Id`, `X-Tenant-Host`; 401 signs out.
- `lib/services/session.dart`: login, profile, permissions, location switch. Dashboards need `reports.read` (or admin).
- `lib/services/push_service.dart`: FCM, foreground notifications, device register/unregister, notification taps.
- `lib/services/dashboard_service.dart`: `/dashboard/sales` + `/dashboard/overview`, cached per location for offline.
- `lib/services/approval_service.dart`: inbox, my requests, detail, approve/reject/withdraw, inbox badge count.
- `lib/services/app_lock.dart`: optional fingerprint/PIN lock with background timeout.
- `lib/screens/`: setup, login, lock, home shell (bottom nav), `dashboard/`, `approvals/`, profile.
- `lib/widgets/`: KPI tiles, charts (fl_chart), number/date formatting.

## Release

### Signing (once)

```sh
keytool -genkey -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Keep `upload.jks` and its passwords somewhere safe outside the repo. Losing them means you can't update the app.

`android/key.properties` (gitignored):
```properties
storeFile=upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```
Copy `upload.jks` to `android/app/`.

`android/app/build.gradle.kts`:
```kotlin
import java.util.Properties
val keyProps = Properties().apply {
    val f = rootProject.file("key.properties")
    if (f.exists()) load(f.inputStream())
}
android {
    signingConfigs {
        create("release") {
            if (keyProps.isNotEmpty()) {
                storeFile = file(keyProps["storeFile"] as String)
                storePassword = keyProps["storePassword"] as String
                keyAlias = keyProps["keyAlias"] as String
                keyPassword = keyProps["keyPassword"] as String
            }
        }
    }
    buildTypes {
        release { signingConfig = signingConfigs.getByName(if (keyProps.isNotEmpty()) "release" else "debug") }
    }
}
```

### Build

Locally:
```sh
flutter build apk --release        # direct install
flutter build appbundle --release  # Play Store
```

CI: `.github/workflows/mobile-mgmt-build.yml` builds both on a `mgmt-v*` tag (e.g. `git tag mgmt-v1.0.0 && git push origin mgmt-v1.0.0`)
or by hand from the Actions tab, and attaches them to the run. Secrets it needs are listed at the top of the workflow.
Commit the generated `android/` folder first; `google-services.json`, `key.properties` and `*.jks` stay gitignored.

### Release checklist

- [ ] `flutter analyze` clean
- [ ] Login on single and shared (workspace domain) servers
- [ ] Dashboard: all locations and one location; pull-to-refresh; airplane mode shows saved figures
- [ ] Approvals: approve, reject (reason required), withdraw own request, 409 when someone acted first
- [ ] Push: new request alerts approvers (app closed, background, open); tap opens that request
- [ ] App lock: on/off, timeout, sign out from lock screen
- [ ] Sign out stops pushes to this phone
- [ ] `FCM_SERVICE_ACCOUNT` set on the production server
