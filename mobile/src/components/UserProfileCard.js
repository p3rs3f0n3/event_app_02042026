import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ChangePasswordCard from './ChangePasswordCard';
import { SurfaceCard } from './ui';
import { getResponsiveTokens } from '../theme/tokens';
import { useResponsiveMetrics } from '../utils/responsive';

const UserProfileCard = ({
  user,
  palette,
  title = 'Perfil de usuario',
  description,
  buttonLabel = 'MI CONTRASEÑA',
  buttonVariant = 'primary',
}) => {
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const styles = useMemo(() => createStyles(palette, metrics, tokens), [palette, metrics, tokens]);

  return (
    <SurfaceCard style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <View style={styles.profileInfo}>
          <Text style={styles.profileTitle}>{title}</Text>
          <Text style={styles.profileText}>
            {description || `Sesión activa como @${user?.username}.`}
          </Text>
        </View>
        <ChangePasswordCard user={user} palette={palette} buttonLabel={buttonLabel} buttonVariant={buttonVariant} />
      </View>
    </SurfaceCard>
  );
};

const createStyles = (palette, metrics, tokens) => StyleSheet.create({
  profileCard: { backgroundColor: '#FFFFFF' },
  profileHeader: { gap: tokens.spacing.md },
  profileInfo: { gap: tokens.spacing.xs },
  profileTitle: { color: palette.text, fontSize: metrics.font(18, 0.9), fontWeight: '800' },
  profileText: { color: palette.textMuted, fontSize: tokens.typography.body, lineHeight: metrics.font(20, 0.85) },
});

export default UserProfileCard;
