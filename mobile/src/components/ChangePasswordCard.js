import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { changePassword } from '../api/api';
import { AppButton, SurfaceCard } from './ui';
import { RADII, SHADOWS, SPACING } from '../theme/tokens';

const INITIAL_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const ChangePasswordCard = ({ user, palette, buttonLabel = 'CAMBIAR CONTRASEÑA', buttonVariant = 'ghost' }) => {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [feedback, setFeedback] = useState({ tone: 'muted', message: '' });
  const styles = useMemo(() => createStyles(palette), [palette]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setVisible(false);
    setForm(INITIAL_FORM);
    setFeedback({ tone: 'muted', message: '' });
  };

  const handleSubmit = async () => {
    if (!form.currentPassword || !form.newPassword) {
      setFeedback({ tone: 'error', message: 'Completá la contraseña actual y la nueva.' });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setFeedback({ tone: 'error', message: 'La confirmación no coincide con la nueva contraseña.' });
      return;
    }

    setSaving(true);
    setFeedback({ tone: 'muted', message: '' });

    try {
      await changePassword({
        userId: user?.id,
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      setFeedback({ tone: 'success', message: 'Tu contraseña quedó actualizada.' });
      setForm(INITIAL_FORM);
    } catch (error) {
      setFeedback({ tone: 'error', message: typeof error === 'string' ? error : 'No se pudo actualizar la contraseña.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppButton title={buttonLabel} variant={buttonVariant} onPress={() => setVisible(true)} />

      <Modal visible={visible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.overlay}>
          <SurfaceCard style={styles.modalCard}>
            <Text style={styles.title}>Actualizar contraseña</Text>
            <Text style={styles.subtitle}>Usuario: @{user?.username}</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Contraseña actual</Text>
              <TextInput
                style={styles.input}
                value={form.currentPassword}
                onChangeText={(value) => updateField('currentPassword', value)}
                placeholder="Ingresá tu contraseña actual"
                placeholderTextColor={palette.inputPlaceholder}
                secureTextEntry
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Nueva contraseña</Text>
              <TextInput
                style={styles.input}
                value={form.newPassword}
                onChangeText={(value) => updateField('newPassword', value)}
                placeholder="Por ejemplo 123"
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
                placeholder="Repetí la nueva contraseña"
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

            <Pressable onPress={closeModal} disabled={saving}>
              <Text style={styles.helper}>Esta acción modifica únicamente tu usuario autenticado. No forma parte de los formularios operativos.</Text>
            </Pressable>
          </SurfaceCard>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (palette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    gap: SPACING.md,
    borderRadius: RADII.lg,
    ...SHADOWS.floating,
  },
  title: { color: palette.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: palette.textMuted },
  fieldWrap: { gap: SPACING.xs },
  label: { color: palette.text, fontWeight: '800', fontSize: 13 },
  input: {
    minHeight: 50,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.inputBg,
    color: palette.inputText,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackBox: {
    borderRadius: RADII.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackSuccess: { backgroundColor: palette.successBg },
  feedbackError: { backgroundColor: palette.errorBg },
  feedbackText: { color: palette.text, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  actionButton: { flex: 1 },
  helper: { color: palette.textMuted, fontSize: 12, lineHeight: 18 },
});

export default ChangePasswordCard;
