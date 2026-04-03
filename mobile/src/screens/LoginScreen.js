import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LockKeyhole, ShieldCheck, UserRound, Wifi } from 'lucide-react-native';

import { getBaseUrl, login, setBaseUrl } from '../api/api';
import BrandMark from '../components/BrandMark';
import { AppButton, StatusBadge, SurfaceCard } from '../components/ui';
import { COLORS } from '../theme/colors';
import { getAppPalette, RADII, SPACING } from '../theme/tokens';
import { useResponsiveMetrics } from '../utils/responsive';

const DEMO_ACCOUNTS = [
  { key: 'ejecutivo', role: 'Ejecutivo', username: 'ejecutivo', password: 'ChangeMe.Ejecutivo.123' },
  { key: 'coord', role: 'Coordinador', username: 'coord', password: 'ChangeMe.Coordinador.123' },
  { key: 'cliente', role: 'Cliente', username: 'cliente', password: 'ChangeMe.Cliente.123' },
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
  const palette = getAppPalette();
  const styles = useMemo(() => createStyles(palette, metrics), [palette, metrics]);

  const activeAccounts = useMemo(
    () => (appConfig?.roles || []).filter((role) => role.enabled).map((role) => role.label),
    [appConfig],
  );

  const handlePickDemo = (account) => {
    setUsername(account.username);
    setPassword(account.password);
    setError('');
  };

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Datos requeridos');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const user = await login(username, password);
      onLogin(user);
    } catch (err) {
      setError('Falla de conexión: verificá IP del servidor o tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = () => {
    if (!newIp.startsWith('http')) {
      Alert.alert('Error', 'La URL debe empezar con http://');
      return;
    }
    setBaseUrl(newIp);
    setShowConfig(false);
    Alert.alert('Configuración guardada', 'La nueva URL del servidor fue aplicada.');
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
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.backgroundOrbTop} />
          <View style={styles.backgroundOrbBottom} />

          <Pressable style={styles.header} onPress={handleBrandPress} onLongPress={openHiddenConfig}>
            <BrandMark appName={appConfig?.appName || 'EventApp'} size={metrics.isCompact ? 'sm' : 'md'} subtitle="Operación de eventos con una experiencia clara, rápida y lista para campo." />
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

          <SurfaceCard style={styles.card}>
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>Bienvenido</Text>
              <Text style={styles.kickerMeta}>{activeAccounts.join(' · ')}</Text>
            </View>
            <Text style={styles.subtitle}>Ingresá a tu espacio de trabajo</Text>
            <Text style={styles.helperText}>Usá un acceso demo para revisar el flujo o iniciá sesión con tus credenciales reales.</Text>

            <View style={styles.demoSection}>
              {DEMO_ACCOUNTS.map((account) => {
                const isSelected = username === account.username;
                return (
                  <Pressable key={account.key} style={[styles.demoCard, isSelected && styles.demoCardSelected]} onPress={() => handlePickDemo(account)}>
                    <Text style={styles.demoRole}>{account.role}</Text>
                    <Text style={styles.demoUser}>{account.username}</Text>
                    {isSelected ? <StatusBadge label="Activo" tone="info" /> : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.formSection}>
              <Text style={styles.fieldLabel}>Usuario</Text>
              <View style={styles.inputShell}>
                <UserRound color={palette.textMuted} size={18} strokeWidth={2.2} />
                <TextInput style={styles.input} placeholder="usuario" placeholderTextColor={palette.inputPlaceholder} value={username} onChangeText={setUsername} autoCapitalize="none" />
              </View>

              <Text style={styles.fieldLabel}>Contraseña</Text>
              <View style={styles.inputShell}>
                <LockKeyhole color={palette.textMuted} size={18} strokeWidth={2.2} />
                <TextInput style={styles.input} placeholder="contraseña" placeholderTextColor={palette.inputPlaceholder} value={password} onChangeText={setPassword} secureTextEntry />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton title={loading ? 'INGRESANDO...' : 'INGRESAR'} onPress={handleLogin} disabled={loading} />
            {loading ? <ActivityIndicator color={palette.hero} style={styles.loader} /> : null}

            <Text style={styles.secondaryCopy}>Tu acceso mantiene la lógica actual de autenticación y navegación por roles.</Text>
          </SurfaceCard>

          <Pressable style={styles.footer} onLongPress={openHiddenConfig} delayLongPress={700}>
            <Text style={styles.footerText}>EventApp · acceso operativo multirol</Text>
            <Text style={styles.footerHint}>Soporte técnico y entorno operativo</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showConfig} transparent animationType="slide">
        <View style={styles.overlay}>
          <SurfaceCard style={styles.configCard}>
            <Text style={styles.configTitle}>Configurar servidor</Text>
            <Text style={styles.configLabel}>URL API (IP local o túnel)</Text>
            <TextInput
              style={styles.configInput}
              value={newIp}
              onChangeText={setNewIp}
              autoCapitalize="none"
              placeholder="http://192.168.20.xxx:3001/api"
              placeholderTextColor={palette.inputPlaceholder}
            />
            <Text style={styles.hint}>Actualizá esta URL cuando cambie tu red WiFi.</Text>
            <View style={styles.configFooter}>
              <AppButton title="CANCELAR" variant="secondary" style={styles.modalButton} onPress={() => setShowConfig(false)} />
              <AppButton title="APLICAR" style={styles.modalButton} onPress={handleUpdateConfig} />
            </View>
          </SurfaceCard>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (palette, metrics) => StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: palette.pageBg },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: metrics.screenPadding,
    paddingVertical: metrics.verticalPadding,
  },
  backgroundOrbTop: { position: 'absolute', top: 40, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: COLORS.brand.glowStrong },
  backgroundOrbBottom: { position: 'absolute', bottom: 60, left: -70, width: 230, height: 230, borderRadius: 115, backgroundColor: COLORS.brand.glowSoft },
  header: { alignItems: 'center', marginBottom: 28, gap: 18 },
  valueStrip: {
    width: '100%',
    maxWidth: 360,
    borderRadius: RADII.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  valueItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueText: { color: COLORS.brand.onDark, fontSize: 13, fontWeight: '500' },
  card: { backgroundColor: COLORS.brand.cardSoft, borderRadius: 28, padding: metrics.cardPadding },
  kickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  kicker: { color: palette.hero, fontSize: 12, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  kickerMeta: { flex: 1, color: palette.textMuted, fontSize: 12, textAlign: 'right' },
  subtitle: { fontSize: metrics.subtitleSize, fontWeight: '800', color: COLORS.brand.body, marginBottom: 10 },
  helperText: { color: palette.textMuted, marginBottom: 22, fontSize: 14, lineHeight: 21 },
  demoSection: { gap: 12, marginBottom: 24 },
  demoCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.border, borderRadius: RADII.md, paddingVertical: 14, paddingHorizontal: 14, gap: 6 },
  demoCardSelected: { backgroundColor: palette.pageBgSoft },
  demoRole: { color: COLORS.brand.body, fontWeight: '700', fontSize: 15 },
  demoUser: { color: palette.textMuted, fontSize: 12 },
  formSection: { marginBottom: 6 },
  fieldLabel: { color: COLORS.brand.body, fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  inputShell: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: palette.inputBorder, paddingHorizontal: 14, marginBottom: 15 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: COLORS.brand.body },
  errorText: { color: palette.errorText, marginBottom: 15, fontWeight: '700' },
  loader: { marginTop: SPACING.sm },
  secondaryCopy: { color: palette.textMuted, fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: 'center' },
  footer: { alignItems: 'center', marginTop: 24 },
  footerText: { color: COLORS.brand.onDark, fontSize: 12, opacity: 0.74 },
  footerHint: { color: COLORS.brand.muted, fontSize: 11, marginTop: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  configCard: { width: '100%', maxWidth: 380 },
  configTitle: { fontSize: 20, fontWeight: '800', color: COLORS.brand.body, marginBottom: 15 },
  configLabel: { fontSize: 14, color: palette.textMuted, marginBottom: 8 },
  configInput: { backgroundColor: '#F4F7FA', borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.brand.body, marginBottom: 10, borderWidth: 1, borderColor: palette.inputBorder },
  hint: { fontSize: 11, color: palette.textMuted, marginBottom: 20, lineHeight: 16 },
  configFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalButton: { flex: 1 },
});

export default LoginScreen;
