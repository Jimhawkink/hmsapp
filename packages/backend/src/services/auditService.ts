import { sequelize } from '../config/db';

interface AuditUser {
  id?: number;
  name?: string;
  role?: string;
  ip?: string;
}

/**
 * Log an audit event to hms_audit_log.
 * Call this from all create/update/delete controller operations.
 */
export const logAudit = async (
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW',
  resourceName: string,
  resourceId: string | number | null,
  user: AuditUser,
  oldValues?: Record<string, any> | null,
  newValues?: Record<string, any> | null
): Promise<void> => {
  try {
    await sequelize.query(
      `INSERT INTO hms_audit_log
        (action_type, resource_name, resource_id, user_id, user_name, user_role, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      {
        bind: [
          actionType,
          resourceName,
          resourceId ? String(resourceId) : null,
          user.id || null,
          user.name || null,
          user.role || null,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          user.ip || null,
        ],
      }
    );
  } catch (err) {
    // Audit log failures must never crash the main operation
    console.error('[AuditLog] Failed to write audit entry:', err);
  }
};
