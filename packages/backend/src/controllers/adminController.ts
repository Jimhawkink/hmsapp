import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sendSMS } from '../services/smsService';

// ─── Users ────────────────────────────────────────────────────────────────────
export const getUsers = async (_req: Request, res: Response) => {
  try {
    const rows = await sequelize.query(
      `SELECT id, name, email, role, created_at FROM hms_users ORDER BY name`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email, role, password, phone } = req.body;
    if (!name || !email || !role || !password) return res.status(400).json({ message: 'name, email, role, password required' });

    const hashed = await bcrypt.hash(password, 10);
    const [user]: any = await sequelize.query(
      `INSERT INTO hms_users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role`,
      { bind: [name, email, hashed, role], type: QueryTypes.SELECT }
    );

    // Send welcome SMS if phone provided
    if (phone) {
      try {
        await sendSMS(phone, `Welcome to the HMS, ${name}! Your account has been created. Role: ${role}.`);
      } catch { /* non-critical */ }
    }

    res.status(201).json(user);
  } catch (err: any) {
    if (err?.parent?.code === '23505') return res.status(409).json({ message: 'Email already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;
    await sequelize.query(
      `UPDATE hms_users SET name=$1, email=$2, role=$3, updated_at=NOW() WHERE id=$4`,
      { bind: [name, email, role, id] }
    );
    res.json({ message: 'User updated' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // We don't delete — just mark inactive via a note in audit log
    await sequelize.query(
      `UPDATE hms_users SET role='inactive', updated_at=NOW() WHERE id=$1`,
      { bind: [id] }
    );
    res.json({ message: 'User deactivated' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ─── Roles & Permissions ──────────────────────────────────────────────────────
export const getRolesWithPermissions = async (_req: Request, res: Response) => {
  try {
    const roles = await sequelize.query(
      'SELECT * FROM hms_user_roles WHERE is_active = TRUE ORDER BY role_name',
      { type: QueryTypes.SELECT }
    );
    const permissions = await sequelize.query(
      'SELECT * FROM hms_permissions ORDER BY category, sort_order',
      { type: QueryTypes.SELECT }
    );
    const rolePermissions = await sequelize.query(
      'SELECT * FROM hms_role_permissions',
      { type: QueryTypes.SELECT }
    );
    res.json({ roles, permissions, rolePermissions });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const updateRolePermissions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body; // [{ permission_id, can_create, can_edit, can_view, can_archive }]

    for (const perm of (permissions || [])) {
      await sequelize.query(
        `INSERT INTO hms_role_permissions (role_id, permission_id, can_create, can_edit, can_view, can_archive)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (role_id, permission_id) DO UPDATE SET
           can_create=$3, can_edit=$4, can_view=$5, can_archive=$6, "updatedAt"=NOW()`,
        { bind: [id, perm.permission_id, !!perm.can_create, !!perm.can_edit, !!perm.can_view, !!perm.can_archive] }
      );
    }
    res.json({ message: 'Permissions updated' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const getAuditLog = async (req: Request, res: Response) => {
  try {
    const { from, to, userId, resource } = req.query;
    let sql = `SELECT * FROM hms_audit_log WHERE 1=1`;
    const bind: any[] = [];
    let idx = 1;

    if (from) { sql += ` AND DATE(created_at) >= $${idx++}`; bind.push(from); }
    if (to) { sql += ` AND DATE(created_at) <= $${idx++}`; bind.push(to); }
    if (userId) { sql += ` AND user_id = $${idx++}`; bind.push(userId); }
    if (resource) { sql += ` AND resource_name = $${idx++}`; bind.push(resource); }

    sql += ` ORDER BY created_at DESC LIMIT 500`;
    const rows = await sequelize.query(sql, { bind, type: QueryTypes.SELECT });
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ─── System Settings ──────────────────────────────────────────────────────────
export const getSettings = async (_req: Request, res: Response) => {
  try {
    const rows = await sequelize.query(
      'SELECT setting_key, setting_value, setting_type, description FROM hms_system_settings ORDER BY setting_key',
      { type: QueryTypes.SELECT }
    );
    // Convert to key-value object
    const settings: Record<string, string> = {};
    (rows as any[]).forEach((r: any) => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const settings = req.body; // { key: value, ... }
    for (const [key, value] of Object.entries(settings)) {
      await sequelize.query(
        `UPDATE hms_system_settings SET setting_value=$1, updated_at=NOW() WHERE setting_key=$2`,
        { bind: [value, key] }
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
