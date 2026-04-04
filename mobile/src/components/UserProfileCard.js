import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ChangePasswordCard from './ChangePasswordCard';
import { SurfaceCard } from './ui';
import { SPACING } from '../theme/tokens';

const UserProfileCard = ({
  user,
  palette,
  title = 'Perfil de usuario',
  description,
  buttonLabel = 'MI CONTRASEÑA',
  buttonVariant = 'primary',
}) => {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <SurfaceCard style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <View style={styles.profileInfo}>
          <Text style={styles.profileTitle}>{title}</Text>
          <Text style={styles.profileText}>
            {description || `Sesión activa como @${user?.username}. El cambio de contraseña quedó separado del trabajo operativo para evitar confusiones en los formularios.`}
          </Text>
        </View>
        <ChangePasswordCard user={user} palette={palette} buttonLabel={buttonLabel} buttonVariant={buttonVariant} />
      </View>
    </SurfaceCard>
  );
};

const createStyles = (palette) => StyleSheet.create({
  profileCard: { backgroundColor: '#FFFFFF' },
  profileHeader: { gap: SPACING.md },
  profileInfo: { gap: SPACING.xs },
  profileTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  profileText: { color: palette.textMuted, lineHeight: 20 },
});

export default UserProfileCard;
