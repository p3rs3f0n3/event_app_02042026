import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { getAppConfig } from './src/api/api';
import { saveExpoPushToken } from './src/api/api';
import { FALLBACK_APP_CONFIG, getRolePresentation } from './src/config/roles';
import CoordinatorHomeScreen from './src/screens/CoordinatorHomeScreen';
import ClientHomeScreen from './src/screens/ClientHomeScreen';
import AdminHomeScreen from './src/screens/AdminHomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import ExecutiveHomeScreen from './src/screens/ExecutiveHomeScreen';
import RolePlaceholderScreen from './src/screens/RolePlaceholderScreen';
import EntrySplash from './src/components/EntrySplash';
import { getAppPalette } from './src/theme/tokens';

export default function App() {
  const [user, setUser] = useState(null);
  const [appConfig, setAppConfig] = useState(FALLBACK_APP_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [showEntrySplash, setShowEntrySplash] = useState(true);
  const [pushNotificationData, setPushNotificationData] = useState(null);
  const handledNotificationIdsRef = useRef(new Set());

  const queueNotificationResponse = (response) => {
    const notificationId = response?.notification?.request?.identifier || response?.actionIdentifier || null;
    const data = response?.notification?.request?.content?.data || null;

    if (!notificationId || handledNotificationIdsRef.current.has(notificationId)) {
      return;
    }

    handledNotificationIdsRef.current.add(notificationId);
    setPushNotificationData({ notificationId, data });
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const remoteConfig = await getAppConfig();
        if (remoteConfig?.roles?.length) {
          setAppConfig(remoteConfig);
        }
      } catch (error) {
        setAppConfig(FALLBACK_APP_CONFIG);
      } finally {
        setLoadingConfig(false);
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowEntrySplash(false);
    }, 1500);

    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (isMounted && response) {
          queueNotificationResponse(response);
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
        }
      })
      .catch(() => {});

    const registerToken = async () => {
      if (!user?.id) {
        return;
      }

      const permission = await Notifications.getPermissionsAsync();
      let finalStatus = permission.status;
      if (finalStatus !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }

      if (finalStatus !== 'granted') {
        return;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;
      const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      if (token?.data) {
        await saveExpoPushToken({ userId: user.id, expoPushToken: token.data });
      }
    };

    registerToken().catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      queueNotificationResponse(response);
    });

    return () => subscription.remove();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (loadingConfig || showEntrySplash) {
    return <EntrySplash appName={appConfig?.appName || FALLBACK_APP_CONFIG.appName} loadingConfig={loadingConfig} />;
  }

  if (!user) {
    return <LoginScreen onLogin={handleLoginSuccess} appConfig={appConfig} />;
  }

  const role = user.role?.toUpperCase();
  const roleConfig = user.roleConfig || getRolePresentation(appConfig, role);

  if (role === 'EJECUTIVO') {
    return (
      <View style={styles.container}>
        <ExecutiveHomeScreen user={user} onLogout={handleLogout} appConfig={appConfig} roleConfig={roleConfig} />
      </View>
    );
  }

  if (role === 'ADMIN') {
    return (
      <View style={styles.container}>
        <AdminHomeScreen user={user} onLogout={handleLogout} appConfig={appConfig} roleConfig={roleConfig} />
      </View>
    );
  }

  if (role === 'COORDINADOR') {
    return (
      <View style={styles.container}>
        <CoordinatorHomeScreen user={user} onLogout={handleLogout} appConfig={appConfig} roleConfig={roleConfig} />
      </View>
    );
  }

  if (role === 'CLIENTE') {
    return (
      <View style={styles.container}>
        <ClientHomeScreen
          user={user}
          onLogout={handleLogout}
          appConfig={appConfig}
          roleConfig={roleConfig}
          notificationData={pushNotificationData}
          onNotificationHandled={(notificationId) => {
            setPushNotificationData((current) => (current?.notificationId === notificationId ? null : current));
          }}
        />
      </View>
    );
  }

  return <RolePlaceholderScreen roleConfig={roleConfig} onLogout={handleLogout} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: getAppPalette().pageBg,
  },
});
