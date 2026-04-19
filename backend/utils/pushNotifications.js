const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const normalizePushToken = (value) => (typeof value === 'string' ? value.trim() : '');

const sendExpoPushNotification = async ({ expoPushToken, title, body, data = {} }) => {
  const token = normalizePushToken(expoPushToken);
  if (!token) {
    return { skipped: true, reason: 'missing-token' };
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: title || 'Eventrix',
        body: body || '',
        data,
        sound: 'default',
      }),
    });

    const payload = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error?.message || 'push-send-failed',
    };
  }
};

module.exports = {
  sendExpoPushNotification,
};
