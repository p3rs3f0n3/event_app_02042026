import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import CreateEventScreen from './CreateEventScreen';
import ReviewEventsScreen from './ReviewEventsScreen';
import ReportsScreen from './ReportsScreen';
import UserProfileCard from '../components/UserProfileCard';
import { getUserDisplayName } from '../utils/user';
import { AppButton, ScreenShell, SectionTitle, StatusBadge, SurfaceCard } from '../components/ui';
import { getAppPalette, RADII, SHADOWS, SPACING } from '../theme/tokens';

const ExecutiveHomeScreen = ({ user, onLogout, appConfig, roleConfig }) => {
  const [currentView, setCurrentView] = useState('menu');
  const [editingEvent, setEditingEvent] = useState(null);
  const palette = getAppPalette(roleConfig?.theme || 'green');
  const styles = useMemo(() => createStyles(palette), [palette]);
  const displayUsername = getUserDisplayName(user);

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setCurrentView('createEvent');
  };

  const handleBackToMenu = () => {
    setEditingEvent(null);
    setCurrentView('menu');
  };

  if (currentView === 'createEvent') {
    return <CreateEventScreen user={user} onBack={handleBackToMenu} eventToEdit={editingEvent} />;
  }

  if (currentView === 'reviewEvents') {
    return <ReviewEventsScreen user={user} onBack={handleBackToMenu} onEdit={handleEditEvent} />;
  }

  if (currentView === 'reports') {
    return <ReportsScreen user={user} onBack={handleBackToMenu} />;
  }

  return (
    <ScreenShell palette={palette} contentContainerStyle={styles.content}>
      <SectionTitle
        kicker="Panel ejecutivo"
        title={appConfig?.appName || 'EventApp'}
        subtitle={`Hola, ${displayUsername}. Gestioná creación, seguimiento y cierre ejecutivo desde un único panel.`}
      />

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.badgeRow}>
          <StatusBadge label="Operación activa" tone="success" />
          <StatusBadge label="Cobertura multirol" tone="info" />
        </View>
        <Text style={styles.heroTitle}>Centro de control comercial</Text>
        <Text style={styles.heroText}>Accedé rápido a la creación, revisión y publicación final de cada evento.</Text>
      </SurfaceCard>

      <UserProfileCard
        user={user}
        palette={palette}
        title="Perfil ejecutivo"
        description={`Sesión activa como @${user?.username}. El cambio de contraseña quedó asociado a tu usuario y separado del trabajo comercial para no mezclarlo con la operación.`}
        buttonLabel="MI CONTRASEÑA"
        buttonVariant="primary"
      />

      <View style={styles.menuContainer}>
        <SurfaceCard style={styles.menuCard}>
          <Text style={styles.menuTitle}>Crear evento</Text>
          <Text style={styles.menuText}>Definí cliente, ciudades, puntos operativos, disponibilidad y asignación.</Text>
          <AppButton title="ABRIR CREACIÓN" onPress={() => setCurrentView('createEvent')} />
        </SurfaceCard>

        <SurfaceCard style={styles.menuCard}>
          <Text style={styles.menuTitle}>Revisar eventos</Text>
          <Text style={styles.menuText}>Hacé seguimiento, edición e inactivación con el flujo actual.</Text>
          <AppButton title="ABRIR REVISIÓN" onPress={() => setCurrentView('reviewEvents')} />
        </SurfaceCard>

        <SurfaceCard style={styles.menuCard}>
          <Text style={styles.menuTitle}>Informe final</Text>
          <Text style={styles.menuText}>Consolidá fotos, reportes operativos y publicación para cliente.</Text>
          <AppButton title="ABRIR INFORME" onPress={() => setCurrentView('reports')} />
        </SurfaceCard>
      </View>

      <AppButton title="REGRESAR / SALIR" variant="secondary" onPress={onLogout} />
    </ScreenShell>
  );
};

const createStyles = (palette) => StyleSheet.create({
  content: { justifyContent: 'space-between' },
  heroCard: { backgroundColor: palette.surfaceMuted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  heroTitle: { fontSize: 24, fontWeight: '800', color: palette.text },
  heroText: { color: palette.textMuted, lineHeight: 20 },
  menuContainer: { gap: SPACING.md },
  menuCard: { gap: SPACING.md, borderRadius: RADII.lg, ...SHADOWS.card },
  menuTitle: { fontSize: 20, fontWeight: '800', color: palette.text },
  menuText: { color: palette.textMuted, lineHeight: 20 },
});

export default ExecutiveHomeScreen;
