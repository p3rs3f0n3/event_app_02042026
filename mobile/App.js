import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { getAppConfig } from './src/api/api';
import { FALLBACK_APP_CONFIG, getRolePresentation } from './src/config/roles';
import CoordinatorHomeScreen from './src/screens/CoordinatorHomeScreen';
import ClientHomeScreen from './src/screens/ClientHomeScreen';
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
        <ClientHomeScreen user={user} onLogout={handleLogout} appConfig={appConfig} roleConfig={roleConfig} />
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
