const cloneAuditPayload = (value) => {
  if (value == null) {
    return null;
  }

  return JSON.parse(JSON.stringify(value));
};

const normalizeAuditPayload = (value) => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  return cloneAuditPayload(value);
};

const sanitizeAuditLogRecord = ({ auditLog, actor = null }) => ({
  id: Number(auditLog.id || 0) || null,
  entityType: auditLog.entityType || auditLog.entity_type || null,
  entityId: Number(auditLog.entityId || auditLog.entity_id || 0) || null,
  action: auditLog.action || null,
  actorUserId: Number(auditLog.actorUserId || auditLog.actor_user_id || actor?.id || 0) || null,
  actorUsername: actor?.username || auditLog.actorUsername || auditLog.actor_username || null,
  actorFullName: actor?.fullName || actor?.full_name || auditLog.actorFullName || auditLog.actor_full_name || null,
  previousValues: normalizeAuditPayload(auditLog.previousValues || auditLog.previous_values),
  newValues: normalizeAuditPayload(auditLog.newValues || auditLog.new_values),
  timestamp: auditLog.timestamp || auditLog.createdAt || auditLog.created_at || new Date().toISOString(),
});

module.exports = {
  cloneAuditPayload,
  sanitizeAuditLogRecord,
};
