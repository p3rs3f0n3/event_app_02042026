import React, { useState } from 'react';
import { View, StyleSheet, StatusBar, Text, TouchableOpacity } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import ExecutiveHomeScreen from './src/screens/ExecutiveHomeScreen';

export default function App() {
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <LoginScreen onLogin={handleLoginSuccess} />;
  }

  const role = user.role?.toUpperCase();

  if (role === 'EJECUTIVO') {
    return (
      <View style={styles.container}>
        <ExecutiveHomeScreen user={user} onLogout={handleLogout} />
      </View>
    );
  }

  // Placeholder for other roles (Coordinator, Client)
  return (
    <View style={styles.centered}>
      <Text style={styles.text}>Sesión: {user.role}</Text>
      <Text style={styles.text}>Módulo en desarrollo...</Text>
      <TouchableOpacity style={styles.btn} onPress={handleLogout}>
        <Text style={styles.btnText}>SALIR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00574B', // Match emerald green
  },
  text: {
    color: '#FFF',
    fontSize: 18,
    marginBottom: 10,
  },
  btn: {
    marginTop: 20,
    backgroundColor: '#FFB300',
    padding: 15,
    borderRadius: 30,
    width: 200,
    alignItems: 'center',
  },
  btnText: {
    fontWeight: 'bold',
    color: '#333',
  }
});
