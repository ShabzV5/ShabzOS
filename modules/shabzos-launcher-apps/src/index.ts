import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type LauncherApp = {
  name: string;
  packageName: string;
  iconDataUri?: string;
  glyph?: string;
  tone?: 'lavender' | 'coral' | 'mint' | 'gold' | 'sky';
};

type ShabzLauncherAppsNativeModule = {
  getLaunchableApps(): Promise<LauncherApp[]>;
  launchApp(packageName: string): Promise<boolean>;
};

const LauncherApps =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<ShabzLauncherAppsNativeModule>('ShabzLauncherApps')
    : null;

export default LauncherApps;
