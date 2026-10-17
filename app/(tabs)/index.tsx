import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import LauncherApps, { type LauncherApp } from '@/modules/shabzos-launcher-apps';

const WALLPAPER = require('../../assets/images/shabzos-wallpaper.png');
const APP_ICON = require('../../assets/images/icon.png');
const FAVORITES_KEY = 'shabzos.home-favorites.v1';

type PreviewApp = LauncherApp & {
  glyph: ComponentProps<typeof Feather>['name'];
  tone: 'lavender' | 'coral' | 'mint' | 'gold' | 'sky';
};

const PREVIEW_APPS: PreviewApp[] = [
  { name: 'Phone', packageName: 'preview.phone', glyph: 'phone', tone: 'mint' },
  { name: 'Messages', packageName: 'preview.messages', glyph: 'message-circle', tone: 'coral' },
  { name: 'Camera', packageName: 'preview.camera', glyph: 'camera', tone: 'gold' },
  { name: 'Browser', packageName: 'preview.browser', glyph: 'globe', tone: 'sky' },
  { name: 'Photos', packageName: 'preview.photos', glyph: 'image', tone: 'lavender' },
  { name: 'Calendar', packageName: 'preview.calendar', glyph: 'calendar', tone: 'coral' },
  { name: 'Settings', packageName: 'preview.settings', glyph: 'settings', tone: 'sky' },
  { name: 'Music', packageName: 'preview.music', glyph: 'music', tone: 'lavender' },
  { name: 'Maps', packageName: 'preview.maps', glyph: 'map-pin', tone: 'mint' },
  { name: 'Notes', packageName: 'preview.notes', glyph: 'edit-3', tone: 'gold' },
  { name: 'Files', packageName: 'preview.files', glyph: 'folder', tone: 'coral' },
  { name: 'Clock', packageName: 'preview.clock', glyph: 'clock', tone: 'sky' },
];

function chooseDefaultFavorites(apps: LauncherApp[]) {
  const preferredNames = [/phone|dialer/i, /message|sms/i, /camera/i, /chrome|browser|internet/i];
  const preferred = preferredNames
    .map((pattern) => apps.find((app) => pattern.test(app.name))?.packageName)
    .filter((id): id is string => Boolean(id));
  const uniquePreferred = [...new Set(preferred)];
  if (uniquePreferred.length >= 4) return uniquePreferred.slice(0, 4);
  return [...uniquePreferred, ...apps.map((app) => app.packageName).filter((id) => !uniquePreferred.includes(id))]
    .slice(0, 4);
}

function AppIcon({
  app,
  size = 54,
  colors,
}: {
  app: LauncherApp;
  size?: number;
  colors: ReturnType<typeof useColors>;
}) {
  const background = colors[app.tone ?? 'lavender'];
  const glyph = (app.glyph ?? 'grid') as ComponentProps<typeof Feather>['name'];

  return (
    <View
      style={[
        styles.appIcon,
        {
          width: size,
          height: size,
          borderRadius: size * 0.34,
          backgroundColor: app.iconDataUri ? colors.glassLight : background,
        },
      ]}
    >
      {app.iconDataUri ? (
        <Image
          source={{ uri: app.iconDataUri }}
          resizeMode="contain"
          style={{ width: size * 0.82, height: size * 0.82 }}
        />
      ) : (
        <Feather name={glyph} size={size * 0.42} color={colors.ink} />
      )}
    </View>
  );
}

function AppTile({
  app,
  colors,
  onPress,
  onLongPress,
  selected = false,
  compact = false,
}: {
  app: LauncherApp;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  compact?: boolean;
}) {
  const longPressed = useRef(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${app.name}${selected ? ', pinned to dock' : ''}`}
      delayLongPress={420}
      onPress={() => {
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        onPress();
      }}
      onLongPress={() => {
        if (!onLongPress) return;
        longPressed.current = true;
        onLongPress();
      }}
      style={({ pressed }) => [
        styles.appTile,
        compact && styles.compactAppTile,
        { opacity: pressed ? 0.72 : 1 },
      ]}
      testID={`launcher-app-${app.packageName}`}
    >
      <View>
        <AppIcon app={app} colors={colors} size={compact ? 50 : 56} />
        {selected ? (
          <View style={[styles.pinnedMark, { backgroundColor: colors.primary }]}>
            <Feather name="check" size={10} color={colors.primaryForeground} />
          </View>
        ) : null}
      </View>
      {!compact ? (
        <Text numberOfLines={1} style={[styles.appLabel, { color: colors.foreground }]}>
          {app.name}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function LauncherHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => new Date());
  const [apps, setApps] = useState<LauncherApp[]>(PREVIEW_APPS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isDeviceLauncher, setIsDeviceLauncher] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeSwipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy < -14 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy < -64) setDrawerOpen(true);
        },
      }),
    [],
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadLauncher = async () => {
      let savedFavorites: string[] = [];
      try {
        const stored = await AsyncStorage.getItem(FAVORITES_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
            savedFavorites = parsed;
          }
        }
      } catch {
        savedFavorites = [];
      }

      if (Platform.OS === 'android' && LauncherApps) {
        try {
          const installedApps = await LauncherApps.getLaunchableApps();
          if (!mounted) return;
          if (installedApps.length === 0) {
            setLoadError('No launchable apps were found on this device.');
            setApps([]);
            setIsDeviceLauncher(true);
            return;
          }
          const validSavedFavorites = savedFavorites.filter((id) =>
            installedApps.some((app) => app.packageName === id),
          );
          setApps(installedApps);
          setFavorites(
            validSavedFavorites.length > 0
              ? validSavedFavorites.slice(0, 4)
              : chooseDefaultFavorites(installedApps),
          );
          setIsDeviceLauncher(true);
          setLoadError('');
          return;
        } catch {
          if (!mounted) return;
          setLoadError('ShabzOS could not read your installed apps. Try reopening the launcher.');
          setApps([]);
          setIsDeviceLauncher(true);
          return;
        }
      }

      if (!mounted) return;
      const previewIds = PREVIEW_APPS.map((app) => app.packageName);
      const validPreviewFavorites = savedFavorites.filter((id) => previewIds.includes(id));
      setApps(PREVIEW_APPS);
      setFavorites(
        validPreviewFavorites.length > 0 ? validPreviewFavorites.slice(0, 4) : chooseDefaultFavorites(PREVIEW_APPS),
      );
      setIsDeviceLauncher(false);
    };

    void loadLauncher();
    return () => {
      mounted = false;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const favoriteApps = useMemo(
    () => favorites.map((id) => apps.find((app) => app.packageName === id)).filter((app): app is LauncherApp => !!app),
    [apps, favorites],
  );
  const homeApps = useMemo(
    () => apps.filter((app) => !favorites.includes(app.packageName)).slice(0, 8),
    [apps, favorites],
  );
  const filteredApps = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query) return apps;
    return apps.filter((app) => app.name.toLocaleLowerCase().includes(query));
  }, [apps, searchText]);
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2200);
  }, []);

  const openApp = useCallback(
    async (app: LauncherApp) => {
      if (Platform.OS === 'android' && isDeviceLauncher && LauncherApps) {
        try {
          const opened = await LauncherApps.launchApp(app.packageName);
          if (!opened) Alert.alert('App unavailable', `${app.name} could not be opened.`);
        } catch {
          Alert.alert('Could not open app', `ShabzOS could not start ${app.name}.`);
        }
        return;
      }
      Alert.alert(
        'Launcher preview',
        'The preview shows how ShabzOS looks. Installed apps can be opened from a native Android build.',
      );
    },
    [isDeviceLauncher],
  );

  const toggleFavorite = useCallback(
    async (app: LauncherApp) => {
      const isPinned = favorites.includes(app.packageName);
      if (!isPinned && favorites.length >= 4) {
        showNotice('The dock is full. Unpin an app first.');
        return;
      }
      const next = isPinned
        ? favorites.filter((id) => id !== app.packageName)
        : [...favorites, app.packageName];
      setFavorites(next);
      try {
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        showNotice('Could not save dock changes.');
      }
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
      showNotice(isPinned ? `${app.name} removed from dock` : `${app.name} added to dock`);
    },
    [favorites, showNotice],
  );

  const openHomeSettings = () => {
    if (Platform.OS === 'android') {
      Alert.alert(
        'Make ShabzOS your home screen',
        'Open Android Settings → Apps → Default apps → Home app, then choose ShabzOS.',
      );
      return;
    }
    Alert.alert('Android launcher', 'Install ShabzOS on Android to set it as your home screen.');
  };

  const renderDrawerApp = ({ item }: { item: LauncherApp }) => (
    <AppTile
      app={item}
      colors={colors}
      selected={favorites.includes(item.packageName)}
      onPress={() => {
        setDrawerOpen(false);
        void openApp(item);
      }}
      onLongPress={() => void toggleFavorite(item)}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ImageBackground source={WALLPAPER} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(39,26,68,0.27)', 'rgba(48,32,76,0.06)', 'rgba(36,23,63,0.48)']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View
        style={[
          styles.homeContent,
          {
            paddingTop: insets.top + webTopInset + 8,
            paddingBottom: insets.bottom + webBottomInset + 10,
          },
        ]}
        {...homeSwipe.panHandlers}
      >
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <Image source={APP_ICON} style={styles.brandIcon} />
            <View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>ShabzOS</Text>
              <Text style={[styles.brandCaption, { color: colors.mutedForeground }]}>PERSONAL SPACE</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How to set ShabzOS as your home app"
            onPress={openHomeSettings}
            style={({ pressed }) => [styles.settingsButton, { opacity: pressed ? 0.7 : 1 }]}
            testID="launcher-settings"
          >
            <Feather name="sliders" size={19} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.clockBlock}>
          <Text style={[styles.greeting, { color: colors.foreground }]}>{greeting}, Shabz</Text>
          <Text style={[styles.clock, { color: colors.foreground }]}>{clock}</Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>{date}</Text>
        </View>

        <BlurView intensity={28} tint="light" style={[styles.glanceCard, { borderColor: colors.glassBorder }]}>
          <View style={[styles.glanceIcon, { backgroundColor: colors.glassLight }]}>
            <Feather name="grid" size={18} color={colors.foreground} />
          </View>
          <View style={styles.glanceCopy}>
            <Text style={[styles.glanceEyebrow, { color: colors.mutedForeground }]}>YOUR SPACE</Text>
            <Text style={[styles.glanceTitle, { color: colors.foreground }]}>
              {isDeviceLauncher ? `${apps.length} apps ready` : 'Everything in its place'}
            </Text>
          </View>
          <Feather name="arrow-up-right" size={16} color={colors.foreground} />
        </BlurView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search your apps"
          onPress={() => {
            setSearchText('');
            setDrawerOpen(true);
          }}
          style={({ pressed }) => [styles.searchButton, { opacity: pressed ? 0.75 : 1 }]}
          testID="open-app-search"
        >
          <Feather name="search" size={18} color={colors.foreground} />
          <Text style={[styles.searchPlaceholder, { color: colors.mutedForeground }]}>Search your apps</Text>
          <View style={[styles.searchShortcut, { borderColor: colors.glassBorder }]}>
            <Feather name="command" size={13} color={colors.foreground} />
          </View>
        </Pressable>

        {loadError ? (
          <View style={[styles.errorCard, { backgroundColor: colors.glass }]}>
            <Feather name="alert-circle" size={17} color={colors.foreground} />
            <Text style={[styles.errorText, { color: colors.foreground }]}>{loadError}</Text>
          </View>
        ) : (
          <View style={styles.appGrid}>
            {homeApps.map((app) => (
              <AppTile key={app.packageName} app={app} colors={colors} onPress={() => void openApp(app)} />
            ))}
            {homeApps.length === 0 ? (
              <Pressable style={styles.emptyGrid} onPress={() => setDrawerOpen(true)}>
                <Feather name="plus-circle" size={22} color={colors.foreground} />
                <Text style={[styles.emptyGridText, { color: colors.foreground }]}>Add apps</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.bottomArea}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSearchText('');
              setDrawerOpen(true);
            }}
            style={({ pressed }) => [styles.drawerHint, { opacity: pressed ? 0.72 : 1 }]}
          >
            <Feather name="chevron-up" size={15} color={colors.mutedForeground} />
            <Text style={[styles.drawerHintText, { color: colors.mutedForeground }]}>Swipe up or tap to see all apps</Text>
          </Pressable>
          <BlurView intensity={42} tint="light" style={[styles.dock, { borderColor: colors.glassBorder }]}>
            {favoriteApps.map((app) => (
              <AppTile
                key={app.packageName}
                app={app}
                colors={colors}
                compact
                onPress={() => void openApp(app)}
                onLongPress={() => void toggleFavorite(app)}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open all apps"
              onPress={() => setDrawerOpen(true)}
              style={({ pressed }) => [styles.dockDrawer, { opacity: pressed ? 0.7 : 1 }]}
              testID="open-app-drawer"
            >
              <Feather name="grid" size={21} color={colors.foreground} />
            </Pressable>
          </BlurView>
        </View>
      </View>

      {notice ? (
        <View style={[styles.notice, { backgroundColor: colors.ink, bottom: insets.bottom + 96 }]}>
          <Text style={[styles.noticeText, { color: colors.foreground }]}>{notice}</Text>
        </View>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setDrawerOpen(false)}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={drawerOpen}
      >
        <View
          style={[
            styles.drawer,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top + webTopInset + 14,
              paddingBottom: insets.bottom + webBottomInset + 10,
            },
          ]}
        >
          <ImageBackground source={WALLPAPER} resizeMode="cover" style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['rgba(43,30,69,0.86)', 'rgba(47,34,76,0.93)', 'rgba(34,26,55,0.98)']}
              style={StyleSheet.absoluteFill}
            />
          </ImageBackground>
          <View style={styles.drawerHeader}>
            <View>
              <Text style={[styles.drawerEyebrow, { color: colors.primary }]}>
                {isDeviceLauncher ? 'SHABZOS · ANDROID' : 'SHABZOS · PREVIEW'}
              </Text>
              <Text style={[styles.drawerTitle, { color: colors.foreground }]}>Your apps</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close app drawer"
              onPress={() => setDrawerOpen(false)}
              style={styles.closeButton}
            testID="close-app-drawer"
            >
              <Feather name="x" size={21} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={[styles.drawerSearch, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              accessibilityLabel="Search apps"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              onChangeText={setSearchText}
              placeholder="Find an app"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
              style={[styles.drawerInput, { color: colors.foreground }]}
              testID="app-search-input"
              value={searchText}
            />
            {searchText ? (
              <Pressable
                accessibilityLabel="Clear search"
                onPress={() => setSearchText('')}
                testID="clear-app-search"
              >
                <Feather name="x-circle" size={17} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.drawerCaptionRow}>
            <Text style={[styles.drawerCaption, { color: colors.mutedForeground }]}>
              {filteredApps.length} {filteredApps.length === 1 ? 'app' : 'apps'}
            </Text>
            <Text style={[styles.drawerCaption, { color: colors.mutedForeground }]}>Hold an app to pin it</Text>
          </View>
          <FlatList
            columnWrapperStyle={styles.drawerGridRow}
            data={filteredApps}
            keyExtractor={(item) => item.packageName}
            keyboardShouldPersistTaps="handled"
            numColumns={4}
            renderItem={renderDrawerApp}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.drawerGrid}
            ListEmptyComponent={
              <View style={styles.noResults}>
                <Feather name="search" size={26} color={colors.mutedForeground} />
                <Text style={[styles.noResultsTitle, { color: colors.foreground }]}>No apps found</Text>
                <Text style={[styles.noResultsCopy, { color: colors.mutedForeground }]}>Try a different name.</Text>
              </View>
            }
          />
          {!isDeviceLauncher ? (
            <Text style={[styles.previewFootnote, { color: colors.mutedForeground }]}>
              This preview uses sample icons. Installed apps are discovered by the native Android launcher.
            </Text>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  homeContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 36, height: 36, borderRadius: 12 },
  brandName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  brandCaption: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginTop: 2 },
  settingsButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  clockBlock: { alignItems: 'center', marginTop: 2 },
  greeting: { fontSize: 15, fontWeight: '500', letterSpacing: 0.1 },
  clock: { fontSize: 56, lineHeight: 64, fontWeight: '300', letterSpacing: -3.8, marginTop: 2 },
  date: { fontSize: 13, fontWeight: '500', letterSpacing: 0.4, marginTop: 1 },
  glanceCard: {
    minHeight: 62,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    overflow: 'hidden',
  },
  glanceIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  glanceCopy: { flex: 1 },
  glanceEyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 1.35, marginBottom: 3 },
  glanceTitle: { fontSize: 13, fontWeight: '600' },
  searchButton: {
    height: 50,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 10,
  },
  searchPlaceholder: { flex: 1, fontSize: 14 },
  searchShortcut: {
    width: 26,
    height: 24,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', rowGap: 15, minHeight: 140 },
  appTile: { width: '25%', alignItems: 'center', gap: 6, minHeight: 82 },
  compactAppTile: { width: 52, flexShrink: 0, minHeight: 50, gap: 0 },
  appIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    overflow: 'hidden',
    shadowColor: '#201333',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  appLabel: {
    maxWidth: 74,
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    textShadowColor: 'rgba(30,18,48,0.35)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  pinnedMark: {
    position: 'absolute',
    top: -3,
    right: -4,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
  },
  bottomArea: { gap: 6 },
  drawerHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  drawerHintText: { fontSize: 10, fontWeight: '500', letterSpacing: 0.1 },
  dock: {
    minHeight: 76,
    borderRadius: 25,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    paddingVertical: 9,
    overflow: 'hidden',
  },
  dockDrawer: {
    width: 48,
    height: 48,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGrid: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 110 },
  emptyGridText: { fontSize: 12, fontWeight: '600' },
  errorCard: { borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 18 },
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '85%',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  noticeText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  drawer: { flex: 1, paddingHorizontal: 22 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 21 },
  drawerEyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  drawerTitle: { fontSize: 30, fontWeight: '600', letterSpacing: -0.8 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerSearch: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  drawerInput: { flex: 1, fontSize: 14, paddingVertical: 11 },
  drawerCaptionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 19, marginBottom: 12 },
  drawerCaption: { fontSize: 10, fontWeight: '500' },
  drawerGrid: { paddingBottom: 20 },
  drawerGridRow: { justifyContent: 'flex-start', marginBottom: 17 },
  noResults: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 9 },
  noResultsTitle: { fontSize: 16, fontWeight: '600' },
  noResultsCopy: { fontSize: 12 },
  previewFootnote: { fontSize: 10, lineHeight: 15, textAlign: 'center', paddingTop: 8 },
});
