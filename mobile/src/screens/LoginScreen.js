import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Image, Modal, Alert } from 'react-native';
import { login, setBaseUrl, getBaseUrl } from '../api/api';
import { COLORS } from '../theme/colors';

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('ejecutivo');
  const [password, setPassword] = useState('ChangeMe.Ejecutivo.123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [newIp, setNewIp] = useState(getBaseUrl());

  const handleLogin = async () => {
    if (!username || !password) { setError('Datos requeridos'); return; }
    setLoading(true); setError('');
    try {
      const user = await login(username, password);
      onLogin(user);
    } catch (err) {
      setError('Falla de conexión: Verifique IP del servidor o sus credenciales.');
      console.log('Login Error:', err);
    } finally { setLoading(false); }
  };

  const handleUpdateConfig = () => {
    if (!newIp.startsWith('http')) { Alert.alert('Error', 'La URL debe empezar con http://'); return; }
    setBaseUrl(newIp);
    setShowConfig(false);
    Alert.alert('Configuración Guardada', 'La nueva URL del servidor ha sido aplicada.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EVENTAPP</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>BIENVENIDO</Text>
        <Text style={styles.helperText}>Demo local ejecutivo: ejecutivo / ChangeMe.Ejecutivo.123</Text>
        <TextInput style={styles.input} placeholder="USUARIO" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="CONTRASEÑA" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#333" /> : <Text style={styles.buttonText}>INGRESAR</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.configBtn} onPress={() => setShowConfig(true)}>
          <Text style={styles.configText}>⚙️ CONFIGURACIÓN DEL SERVIDOR</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Configuración de Servidor */}
      <Modal visible={showConfig} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.configCard}>
            <Text style={styles.configTitle}>Configurar Servidor</Text>
            <Text style={styles.configLabel}>URL API (IP Local o Túnel):</Text>
            <TextInput 
              style={styles.configInput} 
              value={newIp} 
              onChangeText={setNewIp} 
              placeholder="http://192.168.20.xxx:3001/api"
            />
            <Text style={styles.hint}>Actualice esta URL cuando cambie su red WiFi.</Text>
            <View style={styles.configFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfig(false)}><Text style={styles.cancelBtnText}>CANCELAR</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateConfig}><Text style={styles.saveBtnText}>APLICAR</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}><Text style={styles.footerText}>EventApp SaaS Executive View</Text></View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.green.primary, padding: 30, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 50 },
  title: { fontSize: 45, fontWeight: 'bold', color: '#FFF', letterSpacing: 5 },
  card: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 30, borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  subtitle: { fontSize: 24, fontWeight: 'bold', color: '#FFB300', marginBottom: 30, textAlign: 'center' },
  helperText: { color: '#E5E7EB', textAlign: 'center', marginBottom: 16, fontSize: 12 },
  input: { backgroundColor: '#FFF', borderRadius: 10, padding: 15, marginBottom: 15, fontSize: 16 },
  button: { backgroundColor: '#D1D5DB', borderRadius: 30, padding: 18, alignItems: 'center', marginTop: 10 },
  buttonText: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  errorText: { color: '#FFEB3B', textAlign: 'center', marginBottom: 15, fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  footerText: { color: '#FFF', fontSize: 12, opacity: 0.7 },
  configBtn: { marginTop: 25, alignSelf: 'center' },
  configText: { color: '#FFF', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  configCard: { backgroundColor: '#FFF', width: '85%', borderRadius: 20, padding: 25 },
  configTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  configLabel: { fontSize: 14, color: '#666', marginBottom: 8 },
  configInput: { backgroundColor: '#F0F0F0', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', marginBottom: 10 },
  hint: { fontSize: 11, color: '#999', marginBottom: 20 },
  configFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 15 },
  saveBtn: { backgroundColor: '#4CAF50', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
  cancelBtnText: { color: '#666' }
});

export default LoginScreen;
