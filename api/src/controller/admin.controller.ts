import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/rbac.middleware";
import userRepository from "../db/repositories/userRepository";
import auditLogRepository from "../db/repositories/auditLogRepository";
import refreshTokenRepository from "../db/repositories/refreshTokenRepository";
import { validatePassword } from "../utils/passwordPolicy";
import { VALID_ROLES, UserRole } from "../db/database";
import { TimetableService } from "../services/receiver/timetableService";

// Protected admin email - cannot be modified through normal flows
const SYSTEM_ADMIN_EMAIL = "admin@iris.com";

// Get client IP helper
const getClientIP = (req: any): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

// Create user (system_admin only) - REQUIRES initial_password
export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  const { email, name, firstName, lastName, role, initial_password } = req.body;
  const adminId = req.user?.id;

  if (!adminId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Validate role
  if (!role) {
    return res.status(400).json({ error: "Role is required" });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ 
      error: "Invalid role", 
      valid_roles: VALID_ROLES 
    });
  }

  // REQUIRE initial_password - no auto-generation
  if (!initial_password || initial_password.trim() === '') {
    return res.status(400).json({ 
      error: "initial_password is required when creating a user" 
    });
  }

  // Protect system admin email
  if (email.toLowerCase() === SYSTEM_ADMIN_EMAIL.toLowerCase()) {
    return res.status(400).json({ 
      error: "Cannot create user with system admin email" 
    });
  }

  try {
    // Check if user already exists
    const existingUser = userRepository.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email is already taken" });
    }

    // Validate password
    const passwordValidation = validatePassword(initial_password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: "Password does not meet requirements",
        details: passwordValidation.errors,
      });
    }

    // Hash password (server-side, once only)
    const hashedPassword = await userRepository.hashPassword(initial_password);

    // Create user
    const newUser = userRepository.create({
      email: email.toLowerCase(),
      name: name || `${firstName || ""} ${lastName || ""}`.trim() || email.split("@")[0],
      firstName,
      lastName,
      role: role as UserRole,
      hashed_password: hashedPassword,
      force_password_change: true,
      status: "pending",
      created_by: adminId,
    });

    // Create audit log
    auditLogRepository.create({
      actor_id: adminId,
      action: "user.create",
      resource: `user:${newUser.id}`,
      details: {
        email: newUser.email,
        role: newUser.role,
      },
      ip: getClientIP(req),
    });

    // Return user (password NOT returned - admin already has it from form)
    return res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        status: newUser.status,
        force_password_change: newUser.force_password_change,
        created_at: newUser.created_at,
      },
    });
  } catch (err: any) {
    console.error("Create user error:", err);
    return res.status(500).json({ error: err.message || "Failed to create user" });
  }
};

// Get users list
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, search, role, status } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  try {
    const result = userRepository.list(
      {
        search: search as string | undefined,
        role: role as string | undefined,
        status: status as string | undefined,
      },
      { page: pageNum, limit: limitNum }
    );

    // Remove sensitive data
    const users = result.users.map((u) => ({
      _id: u.id,
      id: u.id,
      email: u.email,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      status: u.status,
      force_password_change: u.force_password_change,
      last_login_at: u.last_login_at,
      createdAt: u.created_at,
    }));

    return res.json({
      users,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (err: any) {
    console.error("Get users error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch users" });
  }
};

// Get single user
export const getUser = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const user = userRepository.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      _id: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      force_password_change: user.force_password_change,
      last_login_at: user.last_login_at,
      createdAt: user.created_at,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch user" });
  }
};

// Update user
export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, firstName, lastName, role, status } = req.body;
  const adminId = req.user?.id;

  if (!adminId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Validate role if provided
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ 
      error: "Invalid role", 
      valid_roles: VALID_ROLES 
    });
  }

  try {
    const user = userRepository.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Protect system admin role changes
    if (user.email.toLowerCase() === SYSTEM_ADMIN_EMAIL.toLowerCase()) {
      if (role && role !== "system_admin") {
        return res.status(400).json({ 
          error: "Cannot change system admin role" 
        });
      }
    }

    const updatedUser = userRepository.update(id, {
      name,
      firstName,
      lastName,
      role: role as UserRole | undefined,
      status,
    });

    // Create audit log
    auditLogRepository.create({
      actor_id: adminId,
      action: "user.update",
      resource: `user:${id}`,
      details: { updated_fields: Object.keys(req.body) },
      ip: getClientIP(req),
    });

    return res.json({
      _id: updatedUser?.id,
      id: updatedUser?.id,
      email: updatedUser?.email,
      name: updatedUser?.name,
      role: updatedUser?.role,
      status: updatedUser?.status,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update user" });
  }
};

// Reset user password (Admin sets new password explicitly)
export const resetUserPassword = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { new_password } = req.body;
  const adminId = req.user?.id;

  if (!adminId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // REQUIRE new_password - no auto-generation
  if (!new_password || new_password.trim() === '') {
    return res.status(400).json({ 
      error: "new_password is required" 
    });
  }

  try {
    const user = userRepository.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate password
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: "Password does not meet requirements",
        details: passwordValidation.errors,
      });
    }

    // Hash password (server-side, once only)
    const hashedPassword = await userRepository.hashPassword(new_password);

    userRepository.update(id, {
      hashed_password: hashedPassword,
      force_password_change: true,
    });

    // Revoke all refresh tokens
    refreshTokenRepository.revokeAllForUser(id);

    auditLogRepository.create({
      actor_id: adminId,
      action: "user.password_reset",
      resource: `user:${id}`,
      details: { reset_at: new Date().toISOString() },
      ip: getClientIP(req),
    });

    // Return success without password
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      force_password_change: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to reset password" });
  }
};

// Toggle user status (enable/disable)
export const toggleUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const adminId = req.user?.id;

  if (!adminId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!["active", "disabled", "pending"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const user = userRepository.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Protect system admin from being disabled
    if (user.email.toLowerCase() === SYSTEM_ADMIN_EMAIL.toLowerCase() && status === "disabled") {
      return res.status(400).json({ 
        error: "Cannot disable system admin account" 
      });
    }

    const oldStatus = user.status;
    const updatedUser = userRepository.update(id, { status });

    // If disabling, revoke all refresh tokens
    if (status === "disabled") {
      refreshTokenRepository.revokeAllForUser(id);
    }

    auditLogRepository.create({
      actor_id: adminId,
      action: "user.status_change",
      resource: `user:${id}`,
      details: { old_status: oldStatus, new_status: status },
      ip: getClientIP(req),
    });

    return res.json({
      _id: updatedUser?.id,
      id: updatedUser?.id,
      email: updatedUser?.email,
      name: updatedUser?.name,
      role: updatedUser?.role,
      status: updatedUser?.status,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update user status" });
  }
};

// Get audit logs for a user
export const getUserAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  try {
    const result = auditLogRepository.findByResource(`user:${id}`, {
      page: pageNum,
      limit: limitNum,
    });

    return res.json({
      logs: result.logs,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch audit logs" });
  }
};

// Get full timetable for admin management (system_admin only)
export const getAdminTimetable = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const timetableService = TimetableService.getInstance();
    const timetable = timetableService.getAllTimetableEntries();
    return res.json({
      success: true,
      count: timetable.length,
      timetable,
    });
  } catch (err: any) {
    console.error("Error getting admin timetable:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch timetable" });
  }
};

// Update train timetable schedule (system_admin only)
export const updateAdminTimetable = async (req: AuthenticatedRequest, res: Response) => {
  const { trainId } = req.params;
  const { departure, stop_times } = req.body;
  const adminId = req.user?.id;

  if (!adminId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!trainId) {
    return res.status(400).json({ error: "trainId is required" });
  }

  try {
    const timetableService = TimetableService.getInstance();
    const updated = timetableService.updateTrainSchedule(trainId, { departure, stop_times });

    if (!updated) {
      return res.status(404).json({ error: `Train '${trainId}' not found in timetable` });
    }

    // Log audit action
    auditLogRepository.create({
      actor_id: adminId,
      action: "timetable.update",
      resource: `train:${trainId}`,
      details: { trainId, departure, stopCount: stop_times?.length },
      ip: getClientIP(req),
    });

    const train = timetableService.getTimetableEntry(trainId);
    return res.json({
      success: true,
      message: `Timetable for train ${trainId} updated successfully`,
      train,
    });
  } catch (err: any) {
    console.error("Error updating timetable:", err);
    return res.status(500).json({ error: err.message || "Failed to update timetable" });
  }
};

// Add new train to timetable (system_admin only)
export const addAdminTrain = async (req: AuthenticatedRequest, res: Response) => {
  const {
    train_id,
    from,
    to,
    departure,
    direction = "UP",
    service_type = "slow",
    stop_times,
    color,
    rake_type = "MRVC",
    rake_length = "15_car",
    flags = {},
  } = req.body;
  const adminId = req.user?.id;

  if (!adminId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!train_id || !from || !to || !departure || !Array.isArray(stop_times) || stop_times.length < 2) {
    return res.status(400).json({
      error: "train_id, from, to, departure, and at least 2 stop_times are required",
    });
  }

  const normalizedDirection = String(direction).toUpperCase() === "DOWN" ? "DOWN" : "UP";
  const normalizedService = String(service_type).toLowerCase() === "fast" ? "fast" : "slow";

  const newTrain = {
    train_id: String(train_id).trim(),
    trip_id: `${String(train_id).trim()}_${String(departure).trim()}`,
    pattern_id: `${String(from).toLowerCase()}_${String(to).toLowerCase()}_${normalizedService}_v1`,
    service_type: normalizedService,
    train_subtype: "regular",
    rake_type,
    rake_length,
    direction: normalizedDirection,
    line_type: `${normalizedDirection}_${normalizedService}`,
    track_type: `${normalizedDirection.toLowerCase()}_${normalizedService}`,
    track_variant: `${normalizedDirection.toLowerCase()}_${normalizedService}_1`,
    lane_index: 0,
    lane_count: 2,
    from: String(from).trim().toUpperCase(),
    to: String(to).trim().toUpperCase(),
    departure: String(departure).trim(),
    peak: false,
    color: color || (normalizedService === "fast" ? "#9333ea" : normalizedDirection === "UP" ? "#007AFF" : "#f59e0b"),
    speed_profile: normalizedService,
    flags: {
      is_ac: Boolean(flags?.is_ac),
      is_womens: Boolean(flags?.is_womens),
      is_fast: normalizedService === "fast",
      is_peak_service: Boolean(flags?.is_peak_service),
    },
    stop_times,
  };

  try {
    const timetableService = TimetableService.getInstance();
    const result = timetableService.addTrain(newTrain);

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to add train" });
    }

    // Log audit action
    auditLogRepository.create({
      actor_id: adminId,
      action: "timetable.add_train",
      resource: `train:${train_id}`,
      details: { train_id, from, to, departure, stopsCount: stop_times.length },
      ip: getClientIP(req),
    });

    return res.status(201).json({
      success: true,
      message: `Train ${train_id} added to timetable successfully`,
      train: newTrain,
    });
  } catch (err: any) {
    console.error("Error adding train:", err);
    return res.status(500).json({ error: err.message || "Failed to add train" });
  }
};

// Delete train from timetable (system_admin only)
export const deleteAdminTrain = async (req: AuthenticatedRequest, res: Response) => {
  const { trainId } = req.params;
  const adminId = req.user?.id;

  if (!adminId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!trainId) {
    return res.status(400).json({ error: "trainId is required" });
  }

  try {
    const timetableService = TimetableService.getInstance();
    const deleted = timetableService.removeTrain(trainId);

    if (!deleted) {
      return res.status(404).json({ error: `Train '${trainId}' not found in timetable` });
    }

    // Log audit action
    auditLogRepository.create({
      actor_id: adminId,
      action: "timetable.delete_train",
      resource: `train:${trainId}`,
      details: { trainId },
      ip: getClientIP(req),
    });

    return res.json({
      success: true,
      message: `Train ${trainId} removed from timetable successfully`,
    });
  } catch (err: any) {
    console.error("Error deleting train:", err);
    return res.status(500).json({ error: err.message || "Failed to delete train" });
  }
};
