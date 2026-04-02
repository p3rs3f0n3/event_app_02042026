import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Modal, Alert, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { LockKeyhole, ShieldCheck, UserRound, Wifi } from 'lucide-react-native';
import { login, setBaseUrl, getBaseUrl } from '../api/api';
import { COLORS } from '../theme/colors';
import { useResponsiveMetrics } from '../utils/responsive';
import BrandMark from '../components/BrandMark';

const DEMO_ACCOUNTS = [
  {
    key: 'ejecutivo',
    role: 'Ejecutivo',
    username: 'ejecutivo',
    password: 'ChangeMe.Ejecutivo.123',
    accent: '#81C784',
  },
  {
    key: 'coord',
    role: 'Coordinador',
    username: 'coord',
    password: 'ChangeMe.Coordinador.123',
    accent: '#BCAAA4',
  },
];

const LoginScreen = ({ onLogin, appConfig }) => {
  const [username, setUsername] = useState('ejecutivo');
  const [password, setPassword] = useState('ChangeMe.Ejecutivo.123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [newIp, setNewIp] = useState(getBaseUrl());
  const [brandTapCount, setBrandTapCount] = useState(0);
  const metrics = useResponsiveMetrics();
  const activeAccounts = useMemo(() => (appConfig?.roles || [])
    .filter((role) => role.enabled)
    .map((role) => role.label), [appConfig]);

  const handlePickDemo = (account) => {
    setUsername(account.username);
    setPassword(account.password);
    setError('');
  };

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

  const openHiddenConfig = () => {
    setBrandTapCount(0);
    setShowConfig(true);
  };

  const handleBrandPress = () => {
    const nextCount = brandTapCount + 1;
    if (nextCount >= 5) {
      openHiddenConfig();
      return;
    }
    setBrandTapCount(nextCount);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: metrics.screenPadding, paddingVertical: metrics.verticalPadding }]} keyboardShouldPersistTaps="handled">
          <View style={styles.backgroundOrbTop} />
          <View style={styles.backgroundOrbBottom} />

          <Pressable style={styles.header} onPress={handleBrandPress} onLongPress={openHiddenConfig}>
            <BrandMark
              appName={appConfig?.appName || 'EventApp'}
              size={metrics.isCompact ? 'sm' : 'md'}
              subtitle="Operación de eventos con una experiencia clara, rápida y lista para campo."
            />

            <View style={styles.valueStrip}>
              <View style={styles.valueItem}>
                <ShieldCheck color={COLORS.brand.highlight} size={16} strokeWidth={2.4} />
                <Text style={styles.valueText}>Acceso seguro por rol</Text>
              </View>
              <View style={styles.valueItem}>
                <Wifi color={COLORS.brand.highlight} size={16} strokeWidth={2.4} />
                <Text style={styles.valueText}>Sincronización con backend actual</Text>
              </View>
            </View>
          </Pressable>

          <View style={[styles.card, { padding: metrics.cardPadding }]}> 
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>Bienvenido</Text>
              <Text style={styles.kickerMeta}>{activeAccounts.join(' · ')}</Text>
            </View>

            <Text style={[styles.subtitle, { fontSize: metrics.subtitleSize }]}>Ingresá a tu espacio de trabajo</Text>
            <Text style={styles.helperText}>Usá un acceso demo para revisar el flujo o iniciá sesión con tus credenciales reales.</Text>

            <View style={styles.demoSection}>
              {DEMO_ACCOUNTS.map((account) => {
                const isSelected = username === account.username;

                return (
                  <TouchableOpacity
                    key={account.key}
                    style={[
                      styles.demoCard,
                      isSelected && styles.demoCardSelected,
                      { borderColor: isSelected ? account.accent : COLORS.brand.outline },
                    ]}
                    onPress={() => handlePickDemo(account)}
                  >
                    <Text style={[styles.demoRole, isSelected && { color: COLORS.brand.body }]}>{account.role}</Text>
                    <Text style={[styles.demoUser, isSelected && { color: COLORS.brand.bodyMuted }]}>{account.username}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.formSection}>
              <Text style={styles.fieldLabel}>Usuario</Text>
              <View style={styles.inputShell}>
                <UserRound color={COLORS.brand.bodyMuted} size={18} strokeWidth={2.2} />
                <TextInput style={styles.input} placeholder="usuario" placeholderTextColor={COLORS.brand.bodyMuted} value={username} onChangeText={setUsername} autoCapitalize="none" />
              </View>
              <Text style={styles.fieldLabel}>Contraseña</Text>
              <View style={styles.inputShell}>
                <LockKeyhole color={COLORS.brand.bodyMuted} size={18} strokeWidth={2.2} />
                <TextInput style={styles.input} placeholder="contraseña" placeholderTextColor={COLORS.brand.bodyMuted} value={password} onChangeText={setPassword} secureTextEntry />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.brand.onPrimary} /> : <Text style={[styles.buttonText, { fontSize: metrics.buttonTextSize }]}>Ingresar</Text>}
            </TouchableOpacity>

            <Text style={styles.secondaryCopy}>Tu acceso mantiene la lógica actual de autenticación y navegación por roles.</Text>
          </View>

          <Pressable style={styles.footer} onLongPress={openHiddenConfig} delayLongPress={700}>
            <Text style={styles.footerText}>EventApp · acceso operativo multirol</Text>
            <Text style={styles.footerHint}>Soporte técnico y entorno operativo</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

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
              autoCapitalize="none"
              placeholder="http://192.168.20.xxx:3001/api"
              placeholderTextColor={COLORS.brand.bodyMuted}
            />
            <Text style={styles.hint}>Actualice esta URL cuando cambie su red WiFi.</Text>
            <View style={styles.configFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfig(false)}><Text style={styles.cancelBtnText}>CANCELAR</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateConfig}><Text style={styles.saveBtnText}>APLICAR</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.brand.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  backgroundOrbTop: {
    position: 'absolute',
    top: 40,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: COLORS.brand.glowStrong,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: 60,
    left: -70,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: COLORS.brand.glowSoft,
  },
  header: { alignItems: 'center', marginBottom: 28, gap: 18 },
  valueStrip: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  valueItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueText: { color: COLORS.brand.onDark, fontSize: 13, fontWeight: '500' },
  card: {
    backgroundColor: COLORS.brand.cardSoft,
    borderRadius: 28,
    shadowColor: COLORS.brand.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 12,
  },
  kickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  kicker: {
    color: COLORS.brand.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  kickerMeta: {
    flex: 1,
    color: COLORS.brand.bodyMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  subtitle: { fontSize: 24, fontWeight: '800', color: COLORS.brand.body, marginBottom: 10 },
  helperText: { color: COLORS.brand.bodyMuted, marginBottom: 22, fontSize: 14, lineHeight: 21 },
  demoSection: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  demoCard: {
    flex: 1,
    backgroundColor: COLORS.brand.surfaceStrong,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  demoCardSelected: { backgroundColor: '#F2F8FF' },
  demoRole: { color: COLORS.brand.body, fontWeight: '700', fontSize: 15 },
  demoUser: { color: COLORS.brand.bodyMuted, marginTop: 4, fontSize: 12 },
  formSection: { marginBottom: 6 },
  fieldLabel: { color: COLORS.brand.body, fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.brand.surfaceStrong,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.brand.inputBorder,
    paddingHorizontal: 14,
    marginBottom: 15,
  },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: COLORS.brand.body },
  button: {
    backgroundColor: COLORS.brand.primary,
    borderRadius: 18,
    padding: 17,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: COLORS.brand.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 5,
  },
  buttonText: { fontWeight: '800', color: COLORS.brand.onPrimary },
  errorText: { color: COLORS.brand.error, marginBottom: 15, fontWeight: '700' },
  secondaryCopy: {
    color: COLORS.brand.bodyMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  footer: { alignItems: 'center', marginTop: 24 },
  footerText: { color: COLORS.brand.onDark, fontSize: 12, opacity: 0.74 },
  footerHint: { color: COLORS.brand.muted, fontSize: 11, marginTop: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  configCard: { backgroundColor: COLORS.brand.surfaceStrong, width: '85%', borderRadius: 24, padding: 25 },
  configTitle: { fontSize: 20, fontWeight: '800', color: COLORS.brand.body, marginBottom: 15 },
  configLabel: { fontSize: 14, color: COLORS.brand.bodyMuted, marginBottom: 8 },
  configInput: { backgroundColor: '#F4F7FA', borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.brand.body, marginBottom: 10, borderWidth: 1, borderColor: COLORS.brand.inputBorder },
  hint: { fontSize: 11, color: COLORS.brand.bodyMuted, marginBottom: 20, lineHeight: 16 },
  configFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 15 },
  saveBtn: { backgroundColor: COLORS.brand.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  saveBtnText: { color: COLORS.brand.onPrimary, fontWeight: '800' },
  cancelBtnText: { color: COLORS.brand.bodyMuted, fontWeight: '600' }
});

export default LoginScreen;
