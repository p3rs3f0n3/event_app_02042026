export const getInactiveBadgeLabel = (event) => {
  if (!event?.isInactive) {
    return null;
  }

  return event.inactiveReason === 'manual' ? 'INACTIVO MANUAL' : 'INACTIVO POR FECHA';
};

export const getInactiveDescription = (event) => {
  if (!event?.isInactive) {
    return null;
  }

  if (event.inactiveReason === 'manual') {
    return event.manualInactivationComment || 'Evento inactivado manualmente por el ejecutivo';
  }

  return 'La fecha fin del evento ya pasó';
};
