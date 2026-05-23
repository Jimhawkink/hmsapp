import { Router } from 'express';
import { getUsers, createUser, updateUser, deactivateUser, getRolesWithPermissions, updateRolePermissions, getAuditLog, getSettings, updateSettings } from '../controllers/adminController';

const router = Router();

router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.patch('/users/:id/deactivate', deactivateUser);
router.get('/roles', getRolesWithPermissions);
router.put('/roles/:id/permissions', updateRolePermissions);
router.get('/audit-log', getAuditLog);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

export default router;
