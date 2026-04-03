import { Alert, Linking } from 'react-native';

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');

const getContactLabel = (contact) => contact?.fullName || contact?.name || contact?.username || 'Contacto';

const openUrlIfPossible = async (url) => {
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    return false;
  }

  await Linking.openURL(url);
  return true;
};

const showUnavailableContactAlert = (contact) => {
  Alert.alert(
    'Contacto no disponible',
    `${getContactLabel(contact)}\nTodavía no hay un teléfono utilizable para llamada o WhatsApp.`,
  );
};

export const contactByPhoneCall = async (contact) => {
  const phone = normalizePhone(contact?.phone);
  if (!phone) {
    showUnavailableContactAlert(contact);
    return false;
  }

  const opened = await openUrlIfPossible(`tel:${phone}`);
  if (!opened) {
    Alert.alert('Llamada no disponible', 'No se pudo abrir la llamada en este dispositivo.');
  }

  return opened;
};

export const contactByWhatsApp = async (contact) => {
  const phone = normalizePhone(contact?.phone);
  if (!phone) {
    showUnavailableContactAlert(contact);
    return false;
  }

  const opened = await openUrlIfPossible(`whatsapp://send?phone=${phone}`);
  if (!opened) {
    Alert.alert('WhatsApp no disponible', 'No se pudo abrir WhatsApp en este dispositivo.');
  }

  return opened;
};

export const hasDirectContactPhone = (contact) => Boolean(normalizePhone(contact?.phone));
