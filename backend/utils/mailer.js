const nodemailer = require('nodemailer');

const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;

const buildFromAddress = ({ fromName, fromEmail }) => {
  if (!hasValue(fromName)) {
    return fromEmail;
  }

  return `"${String(fromName).replace(/"/g, '')}" <${fromEmail}>`;
};

const getMailConfigurationStatus = (smtpConfig = {}) => {
  if (!hasValue(smtpConfig.host)) {
    return { enabled: false, reason: 'SMTP deshabilitado: falta SMTP_HOST.' };
  }

  if (!Number.isInteger(Number(smtpConfig.port)) || Number(smtpConfig.port) <= 0) {
    return { enabled: false, reason: 'SMTP deshabilitado: falta SMTP_PORT válido.' };
  }

  if (!hasValue(smtpConfig.fromEmail)) {
    return { enabled: false, reason: 'SMTP deshabilitado: falta SMTP_FROM_EMAIL.' };
  }

  if (!hasValue(smtpConfig.user) || !hasValue(smtpConfig.password)) {
    return { enabled: false, reason: 'SMTP deshabilitado: faltan SMTP_USER y/o SMTP_PASSWORD.' };
  }

  return { enabled: true, reason: null };
};

const createSmtpTransporter = (smtpConfig = {}) => {
  const configStatus = getMailConfigurationStatus(smtpConfig);
  const transporter = configStatus.enabled
    ? nodemailer.createTransport({
      host: smtpConfig.host,
      port: Number(smtpConfig.port),
      secure: Boolean(smtpConfig.secure),
      requireTLS: Boolean(smtpConfig.requireTls),
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password,
      },
    })
    : null;

  return { configStatus, transporter };
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildWelcomeEmailContent = ({ recipientName, roleLabel, username, password }) => {
  const safeRecipientName = recipientName || 'bienvenido';
  const safeRoleLabel = roleLabel || 'usuario';

  return {
    subject: 'Bienvenido a Eventrix',
    text: [
      `Hola ${safeRecipientName},`,
      '',
      'Te damos la bienvenida a Eventrix.',
      `Tu perfil fue creado como ${safeRoleLabel}.`,
      '',
      'Tus credenciales de acceso son:',
      `Usuario: ${username}`,
      `Contraseña: ${password}`,
      '',
      'Te recomendamos cambiar la contraseña luego de tu primer ingreso.',
      '',
      'Equipo Eventrix',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1F2937; line-height: 1.6;">
        <p>Hola <strong>${escapeHtml(safeRecipientName)}</strong>,</p>
        <p>Te damos la bienvenida a <strong>Eventrix</strong>.</p>
        <p>Tu perfil fue creado como <strong>${escapeHtml(safeRoleLabel)}</strong>.</p>
        <p>Tus credenciales de acceso son:</p>
        <ul>
          <li><strong>Usuario:</strong> ${escapeHtml(username)}</li>
          <li><strong>Contraseña:</strong> ${escapeHtml(password)}</li>
        </ul>
        <p>Te recomendamos cambiar la contraseña luego de tu primer ingreso.</p>
        <p>Equipo Eventrix</p>
      </div>
    `,
  };
};

const buildEventMilestoneEmailContent = ({ milestoneType, recipientName, eventName }) => {
  const safeRecipientName = recipientName || 'hola';
  const safeEventName = eventName || 'tu evento';
  const isStart = milestoneType === 'event_start';
  const subject = isStart ? `Evento iniciado: ${safeEventName}` : `Evento finalizado: ${safeEventName}`;
  const textIntro = isStart
    ? `El evento "${safeEventName}" acaba de iniciar.`
    : `El evento "${safeEventName}" ha finalizado.`;

  return {
    subject,
    text: [
      `Hola ${safeRecipientName},`,
      '',
      textIntro,
      '',
      'Ingresa a Eventrix para ver los detalles.',
      '',
      'Equipo Eventrix',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1F2937; line-height: 1.6;">
        <p>Hola <strong>${escapeHtml(safeRecipientName)}</strong>,</p>
        <p>${escapeHtml(textIntro)}</p>
        <p>Ingresa a <strong>Eventrix</strong> para ver los detalles.</p>
        <p>Equipo Eventrix</p>
      </div>
    `,
  };
};

const createWelcomeEmailService = ({ smtpConfig, logger = console }) => {
  const { configStatus, transporter } = createSmtpTransporter(smtpConfig);

  return {
    async sendWelcomeCredentialsEmail({ to, recipientName, roleLabel, username, password }) {
      if (!hasValue(to)) {
        return {
          status: 'skipped',
          message: 'Mail de bienvenida pendiente: el perfil no tiene email válido para envío.',
        };
      }

      if (!configStatus.enabled || !transporter) {
        logger.warn('⚠️ Welcome email skipped', {
          to,
          roleLabel,
          reason: configStatus.reason,
        });

        return {
          status: 'skipped',
          message: `Mail de bienvenida pendiente: ${configStatus.reason}`,
        };
      }

      const emailContent = buildWelcomeEmailContent({
        recipientName,
        roleLabel,
        username,
        password,
      });

      try {
        const info = await transporter.sendMail({
          from: buildFromAddress(smtpConfig),
          to,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });

        logger.info('✅ Welcome email sent', {
          to,
          roleLabel,
          messageId: info.messageId,
        });

        return {
          status: 'sent',
          message: `Mail de bienvenida enviado a ${to}.`,
          messageId: info.messageId,
        };
      } catch (error) {
        logger.warn('⚠️ Welcome email failed', {
          to,
          roleLabel,
          error: error.message,
        });

        return {
          status: 'failed',
          message: 'Mail de bienvenida pendiente: no se pudo entregar por SMTP.',
        };
      }
    },
  };
};

const createEventNotificationEmailService = ({ smtpConfig, logger = console }) => {
  const { configStatus, transporter } = createSmtpTransporter(smtpConfig);

  return {
    async sendEventMilestoneEmail({ to, recipientName, recipientRole, milestoneType, eventName, eventId }) {
      if (!hasValue(to)) {
        logger.warn('⚠️ Event notification email skipped', {
          to,
          recipientRole,
          eventId,
          milestoneType,
          reason: 'missing-email',
        });

        return {
          status: 'skipped',
          message: 'Mail del evento pendiente: el perfil no tiene email válido para envío.',
        };
      }

      if (!configStatus.enabled || !transporter) {
        logger.warn('⚠️ Event notification email skipped', {
          to,
          recipientRole,
          eventId,
          milestoneType,
          reason: configStatus.reason,
        });

        return {
          status: 'skipped',
          message: `Mail del evento pendiente: ${configStatus.reason}`,
        };
      }

      const emailContent = buildEventMilestoneEmailContent({
        milestoneType,
        recipientName,
        eventName,
      });

      try {
        const info = await transporter.sendMail({
          from: buildFromAddress(smtpConfig),
          to,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });

        logger.info('✅ Event notification email sent', {
          to,
          recipientRole,
          eventId,
          milestoneType,
          messageId: info.messageId,
        });

        return {
          status: 'sent',
          message: `Mail del evento enviado a ${to}.`,
          messageId: info.messageId,
        };
      } catch (error) {
        logger.warn('⚠️ Event notification email failed', {
          to,
          recipientRole,
          eventId,
          milestoneType,
          error: error.message,
        });

        return {
          status: 'failed',
          message: 'Mail del evento pendiente: no se pudo entregar por SMTP.',
        };
      }
    },
  };
};

module.exports = {
  createWelcomeEmailService,
  createEventNotificationEmailService,
};
