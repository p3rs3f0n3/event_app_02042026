import { Alert, Linking } from 'react-native';

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');

export const contactExecutive = async (executiveContact) => {
  const phone = normalizePhone(executiveContact?.phone);

  if (phone) {
    const whatsappUrl = `whatsapp://send?phone=${phone}`;
    const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);

    if (canOpenWhatsApp) {
      await Linking.openURL(whatsappUrl);
      return;
    }

    const phoneUrl = `tel:${phone}`;
    const canCall = await Linking.canOpenURL(phoneUrl);

    if (canCall) {
      await Linking.openURL(phoneUrl);
      return;
    }
  }

  const executiveName = executiveContact?.fullName || executiveContact?.username || 'Ejecutivo sin nombre';
  const username = executiveContact?.username ? `Usuario: ${executiveContact.username}` : 'Sin username disponible';

  Alert.alert('Contacto no disponible', `${executiveName}\n${username}\nTodavía no hay teléfono utilizable configurado para contacto directo.`);
};
