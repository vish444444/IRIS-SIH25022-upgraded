import { Router } from "express";
const router = Router();

import {
  createUserValidator,
  updateUserValidator,
  resetPasswordValidator,
} from "../validators/admin.validator";

import { runValidation } from "../validators/index.validator";
import { authenticate, requirePermission } from "../middleware/rbac.middleware";
import {
  createUser,
  getUsers,
  getUser,
  updateUser,
  resetUserPassword,
  toggleUserStatus,
  getUserAuditLogs,
  getAdminTimetable,
  updateAdminTimetable,
  addAdminTrain,
  deleteAdminTrain,
} from "../controller/admin.controller";

// All admin routes require authentication and system_admin permission
router.use(authenticate);
router.use(requirePermission("user:read"));

// User management routes
router.post("/users", requirePermission("user:create"), createUserValidator, runValidation, createUser);
router.get("/users", getUsers);
router.get("/users/:id", getUser);
router.patch("/users/:id", requirePermission("user:update"), updateUserValidator, runValidation, updateUser);

// Reset password (admin explicitly sets new password)
router.post(
  "/users/:id/reset-password",
  requirePermission("user:update"),
  resetPasswordValidator,
  runValidation,
  resetUserPassword
);

// Enable/Disable user
router.patch("/users/:id/status", requirePermission("user:update"), toggleUserStatus);

// Audit logs
router.get("/users/:id/audit-logs", requirePermission("audit:read"), getUserAuditLogs);

// Timetable management routes (system_admin only)
router.get("/timetable", getAdminTimetable);
router.post("/timetable", addAdminTrain);
router.put("/timetable/:trainId", updateAdminTimetable);
router.delete("/timetable/:trainId", deleteAdminTrain);

export default router;
