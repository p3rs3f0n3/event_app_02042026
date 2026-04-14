import React, { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, LockKeyhole, FileText, ShieldCheck, UserRound, Wifi } from 'lucide-react-native';

import { acceptTerms, getBaseUrl, login, setBaseUrl } from '../api/api';
import BrandMark from '../components/BrandMark';
import { AppButton, SurfaceCard } from '../components/ui';
import { APP_DISPLAY_NAME, APP_LEGAL_TAGLINE, LOGIN_BRAND_SUBTITLE, TERMS_AND_CONDITIONS_TEXT } from '../config/appMetadata';
import { COLORS } from '../theme/colors';
import { getAppPalette, getResponsiveTokens } from '../theme/tokens';
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
  const tokens = getResponsiveTokens(metrics);
  const palette = getAppPalette();
  const styles = useMemo(() => createStyles(palette, metrics, tokens), [palette, metrics, tokens]);

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

const createStyles = (palette, metrics, tokens) => StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: palette.pageBg },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: metrics.screenPadding,
    paddingVertical: metrics.verticalPadding,
  },
  backgroundOrbTop: { position: 'absolute', top: metrics.spacing(40), right: -metrics.spacing(50), width: metrics.size(190), height: metrics.size(190), borderRadius: metrics.radius(95), backgroundColor: COLORS.brand.glowStrong },
  backgroundOrbBottom: { position: 'absolute', bottom: metrics.spacing(60), left: -metrics.spacing(70), width: metrics.size(230), height: metrics.size(230), borderRadius: metrics.radius(115), backgroundColor: COLORS.brand.glowSoft },
  header: { alignItems: 'center', marginBottom: metrics.spacing(28), gap: tokens.spacing.lg },
  valueStrip: {
    width: '100%',
    maxWidth: metrics.contentMaxWidth,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm + metrics.spacing(2),
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: tokens.spacing.xs,
  },
  valueItem: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacing.sm },
  valueText: { color: COLORS.brand.onDark, fontSize: tokens.typography.label, fontWeight: '500' },
  card: { backgroundColor: COLORS.brand.cardSoft, borderRadius: tokens.radii.lg, padding: metrics.cardPadding, gap: tokens.spacing.sm },
  kickerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  kicker: { color: palette.hero, fontSize: tokens.typography.caption, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  kickerMeta: { flexGrow: 1, flexShrink: 1, color: palette.textMuted, fontSize: tokens.typography.caption, textAlign: metrics.compactWidth ? 'left' : 'right' },
  subtitle: { fontSize: metrics.subtitleSize, fontWeight: '800', color: COLORS.brand.body, marginBottom: tokens.spacing.sm },
  termsCard: {
    marginBottom: tokens.spacing.lg,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  termsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing.sm },
  termsIconWrap: {
    width: metrics.size(38, 0.95),
    height: metrics.size(38, 0.95),
    borderRadius: metrics.radius(19),
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsCopyWrap: { flex: 1, gap: metrics.spacing(4, 0.9) },
  termsTitle: { color: COLORS.brand.body, fontSize: tokens.typography.body, fontWeight: '800' },
  termsDescription: { color: palette.textMuted, fontSize: tokens.typography.caption, lineHeight: metrics.font(18, 0.8) },
  termsActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    padding: tokens.spacing.sm + metrics.spacing(2),
    backgroundColor: '#FFFFFF',
  },
  checkbox: {
    width: metrics.size(22, 0.9),
    height: metrics.size(22, 0.9),
    borderRadius: metrics.radius(6, 0.5),
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
  termsActionTitle: { color: COLORS.brand.body, fontSize: tokens.typography.label, fontWeight: '700' },
  termsActionHint: { color: palette.textMuted, fontSize: tokens.typography.caption, lineHeight: metrics.font(17, 0.8) },
  helperText: { color: palette.textMuted, marginBottom: metrics.spacing(22), fontSize: tokens.typography.body, lineHeight: metrics.font(21, 0.85) },
  formSection: { marginBottom: 6 },
  fieldLabel: { color: COLORS.brand.body, fontSize: tokens.typography.label, fontWeight: '700', marginBottom: tokens.spacing.xs, marginLeft: 4 },
  inputShell: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, backgroundColor: '#FFFFFF', borderRadius: tokens.radii.sm, borderWidth: 1, borderColor: palette.inputBorder, paddingHorizontal: tokens.spacing.md, marginBottom: metrics.spacing(15) },
  input: { flex: 1, paddingVertical: metrics.spacing(15), fontSize: metrics.inputTextSize, color: COLORS.brand.body },
  errorText: { color: palette.errorText, marginBottom: metrics.spacing(15), fontWeight: '700', fontSize: tokens.typography.body },
  diagnosticBox: { backgroundColor: '#F8FAFC', borderRadius: tokens.radii.sm, borderWidth: 1, borderColor: palette.inputBorder, padding: tokens.spacing.sm + metrics.spacing(2), marginBottom: metrics.spacing(15) },
  diagnosticTitle: { color: COLORS.brand.body, fontWeight: '800', marginBottom: metrics.spacing(6, 0.85), fontSize: tokens.typography.body },
  diagnosticText: { color: palette.textMuted, fontSize: tokens.typography.caption },
  termsBlockingHint: { color: palette.textMuted, marginBottom: tokens.spacing.sm, fontSize: tokens.typography.caption, lineHeight: metrics.font(18, 0.8), textAlign: 'center' },
  loader: { marginTop: tokens.spacing.sm },
  secondaryCopy: { color: palette.textMuted, fontSize: tokens.typography.caption, lineHeight: metrics.font(18, 0.8), marginTop: metrics.spacing(16), textAlign: 'center' },
  footer: { alignItems: 'center', marginTop: metrics.spacing(24) },
  footerText: { color: COLORS.brand.onDark, fontSize: tokens.typography.caption, opacity: 0.74 },
  footerHint: { color: COLORS.brand.muted, fontSize: metrics.font(11, 0.75), marginTop: metrics.spacing(6, 0.85) },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: metrics.screenPadding },
  configCard: { width: '100%', maxWidth: metrics.modalMaxWidth },
  configTitle: { fontSize: metrics.cardTitleSize, fontWeight: '800', color: COLORS.brand.body, marginBottom: metrics.spacing(15) },
  configLabel: { fontSize: tokens.typography.body, color: palette.textMuted, marginBottom: tokens.spacing.xs },
  configInput: { backgroundColor: '#F4F7FA', borderRadius: tokens.radii.sm, padding: tokens.spacing.sm + metrics.spacing(2), fontSize: tokens.typography.body, color: COLORS.brand.body, marginBottom: metrics.spacing(10), borderWidth: 1, borderColor: palette.inputBorder },
  hint: { fontSize: metrics.font(11, 0.75), color: palette.textMuted, marginBottom: metrics.spacing(20), lineHeight: metrics.font(16, 0.8) },
  configFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: tokens.spacing.sm },
  modalButton: { flexGrow: 1, flexBasis: metrics.compactWidth ? '100%' : 0 },
  termsModalCard: { width: '100%', maxWidth: metrics.modalMaxWidth, maxHeight: '88%' },
  termsModalSubtitle: { color: palette.textMuted, fontSize: tokens.typography.label, lineHeight: metrics.font(19, 0.82), marginBottom: tokens.spacing.md },
  termsScroll: {
    maxHeight: metrics.size(380, 0.95),
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: '#F8FAFC',
  },
  termsScrollContent: { padding: tokens.spacing.md },
  termsFullText: { color: COLORS.brand.body, fontSize: tokens.typography.caption, lineHeight: metrics.font(19, 0.82) },
  termsStatusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: tokens.spacing.sm, marginTop: tokens.spacing.md, marginBottom: tokens.spacing.lg },
  termsStatusText: { flex: 1, color: COLORS.brand.body, fontSize: tokens.typography.caption, lineHeight: metrics.font(18, 0.8) },
});

export default LoginScreen;
