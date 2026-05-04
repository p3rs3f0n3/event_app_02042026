import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { adminChangeUserPassword } from '../api/api';
import { AppButton, SurfaceCard } from './ui';
import { getResponsiveTokens, SHADOWS } from '../theme/tokens';
import { useResponsiveMetrics } from '../utils/responsive';

const INITIAL_FORM = {
  newPassword: '',
  confirmPassword: '',
};

const MIN_PASSWORD_LENGTH = 8;

const AdminChangePasswordCard = ({ adminUser, targetUser, palette, buttonLabel = 'CAMBIAR CONTRASEÑA', buttonVariant = 'secondary' }) => {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [feedback, setFeedback] = useState({ tone: 'muted', message: '' });
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const styles = useMemo(() => createStyles(palette, metrics, tokens), [palette, metrics, tokens]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const closeModal = () => {
    if (saving) return;
    setVisible(false);
    setForm(INITIAL_FORM);
    setFeedback({ tone: 'muted', message: '' });
  };

  const handleSubmit = async () => {
    if (!form.newPassword || form.newPassword.trim().length < MIN_PASSWORD_LENGTH) {
      setFeedback({ tone: 'error', message: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setFeedback({ tone: 'error', message: 'La confirmación no coincide con la nueva contraseña.' });
      return;
    }

    if (!adminUser?.id || !targetUser?.id) {
      setFeedback({ tone: 'error', message: 'No pudimos identificar el usuario destino.' });
      return;
    }

    setSaving(true);
    setFeedback({ tone: 'muted', message: '' });

    try {
      await adminChangeUserPassword({
        actorUserId: adminUser.id,
        userId: targetUser.id,
        newPassword: form.newPassword,
      });

      setFeedback({ tone: 'success', message: 'La contraseña quedó actualizada.' });
      setForm(INITIAL_FORM);
    } catch (error) {
      setFeedback({ tone: 'error', message: typeof error === 'string' ? error : 'No se pudo actualizar la contraseña.' });
    } finally {
      setSaving(false);
    }
  };

  if (!targetUser?.id) {
    return null;
  }

  return (
    <>
      <AppButton title={buttonLabel} variant={buttonVariant} onPress={() => setVisible(true)} />

      <Modal visible={visible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.overlay}>
          <SurfaceCard style={styles.modalCard}>
            <Text style={styles.title}>Cambiar contraseña</Text>
            <Text style={styles.subtitle}>Usuario: @{targetUser?.username}</Text>
            <Text style={styles.helper}>La acción la ejecuta el administrador autenticado sin conocer la contraseña anterior.</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Nueva contraseña</Text>
              <TextInput
                style={styles.input}
                value={form.newPassword}
                onChangeText={(value) => updateField('newPassword', value)}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={palette.inputPlaceholder}
                secureTextEntry
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Confirmar nueva contraseña</Text>
              <TextInput
                style={styles.input}
                value={form.confirmPassword}
                onChangeText={(value) => updateField('confirmPassword', value)}
                placeholder="Repite la nueva contraseña"
                placeholderTextColor={palette.inputPlaceholder}
                secureTextEntry
              />
            </View>

            {feedback.message ? (
              <View style={[styles.feedbackBox, feedback.tone === 'error' ? styles.feedbackError : feedback.tone === 'success' ? styles.feedbackSuccess : null]}>
                <Text style={styles.feedbackText}>{feedback.message}</Text>
              </View>
            ) : null}

            {saving ? <ActivityIndicator color={palette.hero} /> : null}

            <View style={styles.actions}>
              <AppButton title="CERRAR" variant="secondary" style={styles.actionButton} onPress={closeModal} disabled={saving} />
              <AppButton title={saving ? 'GUARDANDO...' : 'GUARDAR'} style={styles.actionButton} onPress={handleSubmit} disabled={saving} />
            </View>
          </SurfaceCard>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (palette, metrics, tokens) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  modalCard: {
    gap: tokens.spacing.md,
    borderRadius: tokens.radii.lg,
    maxWidth: tokens.layout.modalMaxWidth,
    alignSelf: 'center',
    width: '100%',
    ...SHADOWS.floating,
  },
  title: { color: palette.text, fontSize: metrics.font(22, 0.95), fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: tokens.typography.body },
  helper: { color: palette.textMuted, fontSize: tokens.typography.caption, lineHeight: metrics.font(18, 0.8) },
  fieldWrap: { gap: tokens.spacing.xs },
  label: { color: palette.text, fontWeight: '800', fontSize: tokens.typography.label },
  input: {
    minHeight: tokens.sizes.inputMinHeight,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.inputBg,
    color: palette.inputText,
    fontSize: tokens.typography.bodyLg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + metrics.spacing(2),
  },
  feedbackBox: {
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + metrics.spacing(2),
  },
  feedbackSuccess: { backgroundColor: palette.successBg },
  feedbackError: { backgroundColor: palette.errorBg },
  feedbackText: { color: palette.text, fontWeight: '700', fontSize: tokens.typography.body },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: metrics.compactWidth ? '100%' : 0 },
});

export default AdminChangePasswordCard;
