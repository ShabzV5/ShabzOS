# ShabzOS Android Launcher source

This is the standalone Expo source for ShabzOS. It includes the custom wallpaper, app icon, Android Home-screen registration, and the native Android module that lists and opens installed apps. This ZIP contains source code, not a built APK.

## Build a debug APK

You need Node.js, Android Studio, and the Android SDK/Platform Tools installed. From this folder run:

```sh
pnpm install --frozen-lockfile
CI=1 pnpm exec expo prebuild --platform android --no-install
cd android
./gradlew assembleDebug
```

On Windows, run `gradlew.bat assembleDebug` instead. The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

To install over USB with Android Debug Bridge (ADB), run from this folder after enabling USB debugging:

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

You can also copy the APK to your phone and open it there; Android may ask you to allow installation from that source. After installing, choose ShabzOS under **Settings → Apps → Default apps → Home app** (wording varies by device).

The debug APK is intended for personal testing. The Android native launcher features do not run in Expo Go; they require the generated Android build.

## Build with Codemagic

The `codemagic.yml` workflow builds a release APK and uploads it as a Codemagic build artifact. Connect this GitHub repository in Codemagic and run the `shabzos_android_apk` workflow. The APK is collected from `android/app/build/outputs/`.
