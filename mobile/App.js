import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { getAppConfig } from './src/api/api';
import { FALLBACK_APP_CONFIG, getRolePresentation } from './src/config/roles';
import LoginScreen from './src/screens/LoginScreen';
import ExecutiveHomeScreen from './src/screens/ExecutiveHomeScreen';
import RolePlaceholderScreen from './src/screens/RolePlaceholderScreen';

export default function App() {
  const [user, setUser] = useState(null);
  const [appConfig, setAppConfig] = useState(FALLBACK_APP_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);

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

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (loadingConfig) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
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

  return <RolePlaceholderScreen roleConfig={roleConfig} onLogout={handleLogout} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00574B',
  }
});
