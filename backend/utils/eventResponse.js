const { enrichEventLifecycle } = require('./eventLifecycle');
const { normalizeExecutiveContact } = require('./coordinatorEvents');

const normalizeExecutiveAssociation = (event, executiveContact = null) => {
  const normalizedContact = normalizeExecutiveContact(executiveContact || event?.executiveContact || null);
  const executiveId = Number(
    event?.executiveId
    || event?.createdByUserId
    || event?.created_by_user_id
    || normalizedContact?.userId
    || 0,
  ) || null;

  return {
    executiveId,
    createdByUserId: Number(event?.createdByUserId || event?.created_by_user_id || executiveId || 0) || null,
    executive: normalizedContact
      ? {
        id: normalizedContact.userId,
        name: normalizedContact.fullName,
        fullName: normalizedContact.fullName,
        phone: normalizedContact.phone,
        whatsappPhone: normalizedContact.whatsappPhone,
        email: normalizedContact.email,
      }
      : null,
    executiveContact: normalizedContact,
  };
};

const buildEventResponse = (event, { executiveContact = null } = {}) => {
  const canonicalEvent = enrichEventLifecycle(event);
  const executiveAssociation = normalizeExecutiveAssociation(canonicalEvent, executiveContact);

  return {
    ...canonicalEvent,
    event_status: canonicalEvent.eventStatus,
    ...executiveAssociation,
  };
};

module.exports = {
  buildEventResponse,
  normalizeExecutiveAssociation,
};
