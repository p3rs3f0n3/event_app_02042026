import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import CoordinatorEventDetailScreen from './CoordinatorEventDetailScreen';
import CoordinatorEventsScreen from './CoordinatorEventsScreen';
import { APP_DISPLAY_NAME } from '../config/appMetadata';
import UserProfileCard from '../components/UserProfileCard';
import { getUserDisplayName } from '../utils/user';
import { AppButton, ScreenShell, SectionTitle, StatusBadge, SurfaceCard } from '../components/ui';
import { getAppPalette, SPACING } from '../theme/tokens';

const CoordinatorHomeScreen = ({ user, onLogout, appConfig, roleConfig }) => {
  const [currentView, setCurrentView] = useState('menu');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const palette = getAppPalette(roleConfig?.theme || 'brown');
  const styles = useMemo(() => createStyles(palette), [palette]);

  if (currentView === 'events') {
    return (
      <CoordinatorEventsScreen
        user={user}
        onBack={() => setCurrentView('menu')}
        onSelectEvent={(event) => {
          setSelectedEvent(event);
          setCurrentView('detail');
        }}
        roleConfig={roleConfig}
        refreshToken={refreshToken}
      />
    );
  }

  if (currentView === 'detail' && selectedEvent) {
    return (
      <CoordinatorEventDetailScreen
        event={selectedEvent}
        user={user}
        onBack={() => setCurrentView('events')}
        onEventUpdated={(updatedEvent) => {
          setSelectedEvent(updatedEvent);
          setRefreshToken((current) => current + 1);
        }}
        roleConfig={roleConfig}
      />
    );
  }

  return (
    <ScreenShell palette={palette} contentContainerStyle={styles.content}>
      <SectionTitle
        kicker="Panel coordinador"
        title={appConfig?.appName || APP_DISPLAY_NAME}
        subtitle={`Hola, ${getUserDisplayName(user)}. Revisa puntos asignados, carga fotos y reportes, y mantén contacto con el ejecutivo.`}
      />

      <SurfaceCard style={styles.summaryCard}>
        <View style={styles.badges}>
          <StatusBadge label="Fotos" tone="info" />
          <StatusBadge label="Reportes" tone="warning" />
          <StatusBadge label="Contacto" tone="muted" />
        </View>
        <Text style={styles.cardTitle}>Gestión operativa en campo</Text>
        <Text style={styles.cardText}>La vista gestiona los flujos de carga de evidencia, informes y consulta de puntos.</Text>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.cardTitle}>Eventos asignados</Text>
        <Text style={styles.cardText}>Entra en la lista para ver el detalle, el equipo por punto y las acciones disponibles.</Text>
        <AppButton title="VER EVENTOS ASIGNADOS" onPress={() => setCurrentView('events')} />
      </SurfaceCard>

      <UserProfileCard
        user={user}
        palette={palette}
        title="Perfil coordinador"
        description={`Sesión activa como @${user?.username}.`}
        buttonLabel="MI CONTRASEÑA"
        buttonVariant="primary"
      />

      <AppButton title="REGRESAR / SALIR" variant="secondary" onPress={onLogout} />
    </ScreenShell>
  );
};

const createStyles = (palette) => StyleSheet.create({
  content: { justifyContent: 'space-between' },
  summaryCard: { backgroundColor: palette.surfaceMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  cardTitle: { fontSize: 22, fontWeight: '800', color: palette.text },
  cardText: { color: palette.textMuted, lineHeight: 20 },
});

export default CoordinatorHomeScreen;
