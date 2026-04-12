import React, { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, LockKeyhole, FileText, ShieldCheck, UserRound, Wifi } from 'lucide-react-native';

import { acceptTerms, getBaseUrl, login, setBaseUrl } from '../api/api';
import BrandMark from '../components/BrandMark';
import { AppButton, SurfaceCard } from '../components/ui';
import { APP_DISPLAY_NAME, APP_LEGAL_TAGLINE, LOGIN_BRAND_SUBTITLE, TERMS_AND_CONDITIONS_TEXT } from '../config/appMetadata';
import { COLORS } from '../theme/colors';
import { getAppPalette, RADII, SPACING } from '../theme/tokens';
import { useResponsiveMetrics } from '../utils/responsive';

const LoginScreen = ({ onLogin, appConfig }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingTermsUser, setPendingTermsUser] = useState(null);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [newIp, setNewIp] = useState(getBaseUrl());
  const [brandTapCount, setBrandTapCount] = useState(0);
  const [healthStatus, setHealthStatus] = useState('pendiente');
  const diagnosticMode = process.env.EXPO_PUBLIC_DIAGNOSTIC === 'true';
  const metrics = useResponsiveMetrics();
  const palette = getAppPalette();
  const styles = useMemo(() => createStyles(palette, metrics), [palette, metrics]);

  const activeAccounts = useMemo(
    () => (appConfig?.roles || []).filter((role) => role.enabled).map((role) => role.label),
    [appConfig],
  );

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Datos requeridos');
      return;
    }

    setLoading(true);
    setError('');
    setTermsError('');
    setPendingTermsUser(null);
    setShowTermsModal(false);

    try {
      const user = await login(username, password);

      if (user?.termsAccepted) {
        onLogin(user);
        return;
      }

      setPendingTermsUser(user);
      setError('Debes aceptar los términos y condiciones para continuar.');
      setShowTermsModal(true);
    } catch (err) {
      const message = typeof err === 'string' ? err : 'No pudimos iniciar sesión. Revisa tus credenciales e inténtalo de nuevo.';
      const diagnosticSuffix = diagnosticMode ? ` [baseURL=${getBaseUrl()}]` : '';
      setError(`${message}${diagnosticSuffix}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!pendingTermsUser?.id) {
      setTermsError('No pudimos identificar el usuario autenticado para registrar la aceptación. Iniciá sesión nuevamente.');
      return;
    }

    setAcceptingTerms(true);
    setTermsError('');

    try {
      const updatedUser = await acceptTerms(pendingTermsUser.id);
      setPendingTermsUser(null);
      setShowTermsModal(false);
      setError('');
      onLogin({
        ...pendingTermsUser,
        ...updatedUser,
      });
    } catch (err) {
      const message = typeof err === 'string' ? err : 'No pudimos registrar la aceptación de términos. Intentá nuevamente.';
      setTermsError(message);
      setError('No pudimos registrar la aceptación de términos. Tu acceso sigue bloqueado hasta que se confirme en backend.');
    } finally {
      setAcceptingTerms(false);
    }
  };

  const handleUsernameChange = (value) => {
    setUsername(value);
    setError('');
    setPendingTermsUser(null);
    setTermsError('');
    setShowTermsModal(false);
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    setError('');
    setPendingTermsUser(null);
    setTermsError('');
    setShowTermsModal(false);
  };

  const handleUpdateConfig = () => {
    if (!newIp.startsWith('http')) {
      Alert.alert('Error', 'La URL debe empezar con http://');
      return;
    }
    setBaseUrl(newIp);
    setShowConfig(false);
    Alert.alert('Configuración guardada', 'La conexión quedó actualizada.');
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

  useEffect(() => {
    if (!diagnosticMode) {
      return;
    }

    let active = true;

    const runHealthCheck = async () => {
      try {
        const response = await fetch(`${getBaseUrl()}/health`);
        const text = await response.text();

        if (!active) return;
        setHealthStatus(`GET /health -> ${response.status} ${text}`);
      } catch (error) {
        if (!active) return;
        setHealthStatus(`GET /health error -> ${error?.message || 'desconocido'}`);
      }
    };

    runHealthCheck();

    return () => {
      active = false;
    };
  }, [diagnosticMode]);

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.backgroundOrbTop} />
          <View style={styles.backgroundOrbBottom} />

          <Pressable style={styles.header} onPress={handleBrandPress} onLongPress={openHiddenConfig}>
            <BrandMark appName={appConfig?.appName || APP_DISPLAY_NAME} size={metrics.isCompact ? 'sm' : 'md'} subtitle={LOGIN_BRAND_SUBTITLE} legalLine={APP_LEGAL_TAGLINE} />
            <View style={styles.valueStrip}>
              <View style={styles.valueItem}>
                <ShieldCheck color={COLORS.brand.highlight} size={16} strokeWidth={2.4} />
                <Text style={styles.valueText}>Acceso seguro por rol</Text>
              </View>
              <View style={styles.valueItem}>
                <Wifi color={COLORS.brand.highlight} size={16} strokeWidth={2.4} />
                <Text style={styles.valueText}>Operación conectada</Text>
              </View>
            </View>
          </Pressable>

          <SurfaceCard style={styles.card}>
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>Bienvenido</Text>
              <Text style={styles.kickerMeta}>{activeAccounts.join(' · ')}</Text>
            </View>
            <Text style={styles.subtitle}>Ingresa a tu espacio de trabajo</Text>

            <View style={styles.formSection}>
              <Text style={styles.fieldLabel}>Usuario</Text>
              <View style={styles.inputShell}>
                <UserRound color={palette.textMuted} size={18} strokeWidth={2.2} />
                <TextInput style={styles.input} placeholder="usuario" placeholderTextColor={palette.inputPlaceholder} value={username} onChangeText={handleUsernameChange} autoCapitalize="none" />
              </View>

              <Text style={styles.fieldLabel}>Contraseña</Text>
              <View style={styles.inputShell}>
                <LockKeyhole color={palette.textMuted} size={18} strokeWidth={2.2} />
                <TextInput style={styles.input} placeholder="contraseña" placeholderTextColor={palette.inputPlaceholder} value={password} onChangeText={handlePasswordChange} secureTextEntry />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {diagnosticMode ? (
              <View style={styles.diagnosticBox}>
                <Text style={styles.diagnosticTitle}>Modo diagnóstico</Text>
                <Text style={styles.diagnosticText}>Base URL: {getBaseUrl()}</Text>
                <Text style={styles.diagnosticText}>{healthStatus}</Text>
              </View>
            ) : null}

            <Text style={styles.termsBlockingHint}>Si tu cuenta no aceptó términos todavía, el acceso queda frenado después del login hasta registrarlo en backend.</Text>

            <AppButton title={loading ? 'INGRESANDO...' : 'INGRESAR'} onPress={handleLogin} disabled={loading} />
            {loading ? <ActivityIndicator color={palette.hero} style={styles.loader} /> : null}
          </SurfaceCard>

          <Pressable style={styles.footer} onLongPress={openHiddenConfig} delayLongPress={700}>
            <Text style={styles.footerText}>{`${appConfig?.appName || APP_DISPLAY_NAME} · acceso operativo multirol`}</Text>
            <Text style={styles.footerHint}>{APP_LEGAL_TAGLINE}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showConfig} transparent animationType="slide">
        <View style={styles.overlay}>
          <SurfaceCard style={styles.configCard}>
            <Text style={styles.configTitle}>Configurar conexión</Text>
            <Text style={styles.configLabel}>URL del servicio</Text>
            <TextInput
              style={styles.configInput}
              value={newIp}
              onChangeText={setNewIp}
              autoCapitalize="none"
              placeholder="http://localhost:3001/api"
              placeholderTextColor={palette.inputPlaceholder}
            />
            <Text style={styles.hint}>Este acceso queda oculto para soporte técnico y ajustes del entorno.</Text>
            <View style={styles.configFooter}>
              <AppButton title="CANCELAR" variant="secondary" style={styles.modalButton} onPress={() => setShowConfig(false)} />
              <AppButton title="APLICAR" style={styles.modalButton} onPress={handleUpdateConfig} />
            </View>
          </SurfaceCard>
        </View>
      </Modal>

      <Modal visible={showTermsModal} transparent animationType="slide" onRequestClose={() => setShowTermsModal(false)}>
        <View style={styles.overlay}>
          <SurfaceCard style={styles.termsModalCard}>
            <Text style={styles.configTitle}>Términos y condiciones de uso</Text>
            <Text style={styles.termsModalSubtitle}>Leé el contenido completo y aceptalo para habilitar el ingreso a {appConfig?.appName || APP_DISPLAY_NAME}.</Text>

            <ScrollView style={styles.termsScroll} contentContainerStyle={styles.termsScrollContent}>
              <Text style={styles.termsFullText}>{TERMS_AND_CONDITIONS_TEXT}</Text>
            </ScrollView>

            <View style={styles.termsStatusRow}>
              <View style={[styles.checkbox, pendingTermsUser?.termsAccepted && styles.checkboxActive]}>
                {pendingTermsUser?.termsAccepted ? <Check color="#FFFFFF" size={14} strokeWidth={3} /> : null}
              </View>
              <Text style={styles.termsStatusText}>{pendingTermsUser?.termsAccepted ? 'Ya fueron aceptados para esta cuenta.' : `La cuenta ${pendingTermsUser?.username || ''} aún no aceptó los términos. Debes confirmarlos para continuar.`}</Text>
            </View>

            {termsError ? <Text style={styles.errorText}>{termsError}</Text> : null}

            <View style={styles.configFooter}>
              <AppButton title="CERRAR" variant="secondary" style={styles.modalButton} onPress={() => setShowTermsModal(false)} />
              <AppButton title={acceptingTerms ? 'REGISTRANDO...' : 'ACEPTAR TÉRMINOS'} style={styles.modalButton} onPress={handleAcceptTerms} disabled={acceptingTerms} />
            </View>
            {acceptingTerms ? <ActivityIndicator color={palette.hero} style={styles.loader} /> : null}
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
  termsCard: {
    marginBottom: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  termsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  termsIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsCopyWrap: { flex: 1, gap: 4 },
  termsTitle: { color: COLORS.brand.body, fontSize: 14, fontWeight: '800' },
  termsDescription: { color: palette.textMuted, fontSize: 12, lineHeight: 18 },
  termsActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: palette.hero,
    borderColor: palette.hero,
  },
  termsActionCopy: { flex: 1, gap: 2 },
  termsActionTitle: { color: COLORS.brand.body, fontSize: 13, fontWeight: '700' },
  termsActionHint: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  helperText: { color: palette.textMuted, marginBottom: 22, fontSize: 14, lineHeight: 21 },
  formSection: { marginBottom: 6 },
  fieldLabel: { color: COLORS.brand.body, fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  inputShell: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: palette.inputBorder, paddingHorizontal: 14, marginBottom: 15 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: COLORS.brand.body },
  errorText: { color: palette.errorText, marginBottom: 15, fontWeight: '700' },
  diagnosticBox: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: palette.inputBorder, padding: 12, marginBottom: 15 },
  diagnosticTitle: { color: COLORS.brand.body, fontWeight: '800', marginBottom: 6 },
  diagnosticText: { color: palette.textMuted, fontSize: 12 },
  termsBlockingHint: { color: palette.textMuted, marginBottom: 12, fontSize: 12, lineHeight: 18, textAlign: 'center' },
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
  termsModalCard: { width: '100%', maxWidth: 420, maxHeight: '88%' },
  termsModalSubtitle: { color: palette.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  termsScroll: {
    maxHeight: 380,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: '#F8FAFC',
  },
  termsScrollContent: { padding: 14 },
  termsFullText: { color: COLORS.brand.body, fontSize: 12, lineHeight: 19 },
  termsStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 18 },
  termsStatusText: { flex: 1, color: COLORS.brand.body, fontSize: 12, lineHeight: 18 },
});

export default LoginScreen;
