'use strict';
const { query } = require('../config/db');

async function auditLog({ userId, action, entityType, entityId, changes, ipAddress, userAgent, storeId = 1 }) {
  try {
    await query(
      `INSERT INTO audit_logs (store_id, user_id, action, entity_type, entity_id, changes, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        storeId,
        userId || null,
        action,
        entityType || null,
        entityId || null,
        changes ? (typeof changes === 'string' ? changes : JSON.stringify(changes)) : null,
        ipAddress || null,
        userAgent || null
      ]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = { auditLog };
