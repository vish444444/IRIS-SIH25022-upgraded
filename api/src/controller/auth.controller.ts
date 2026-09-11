import { Response, Request } from "express";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { validatePassword } from "../utils/passwordPolicy";
import userRepository from "../db/repositories/userRepository";
import refreshTokenRepository from "../db/repositories/refreshTokenRepository";
import auditLogRepository from "../db/repositories/auditLogRepository";
import { AuthenticatedRequest } from "../middleware/rbac.middleware";

// Get client IP helper
const getClientIP = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

// Login - POST /api/v1/auth/login
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = userRepository.findByEmail(email);

    if (!user) {
      auditLogRepository.create({
        action: "user.login_failed",
        resource: `email:${email}`,
        details: { reason: "User not found" },
        ip: getClientIP(req),
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.status === "disabled") {
      auditLogRepository.create({
        actor_id: user.id,
        action: "user.login_failed",
        resource: `user:${user.id}`,
        details: { reason: "Account disabled" },
        ip: getClientIP(req),
      });
      return res.status(403).json({ error: "Your account has been disabled. Please contact an administrator." });
    }

    const isValidPassword = await userRepository.comparePassword(user, password);
    if (!isValidPassword) {
      auditLogRepository.create({
        actor_id: user.id,
        action: "user.login_failed",
        resource: `user:${user.id}`,
        details: { reason: "Invalid password" },
        ip: getClientIP(req),
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate tokens with single role
    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = generateRefreshToken();
    const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY || "7") || 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.create(user.id, refreshTokenValue, expiresAt);

    // Update last login and activate pending users
    const updateData: any = { last_login_at: new Date().toISOString() };
    if (user.status === "pending") {
      updateData.status = "active";
    }
    userRepository.update(user.id, updateData);

    // Log successful login
    auditLogRepository.create({
      actor_id: user.id,
      action: "user.login",
      resource: `user:${user.id}`,
      details: { role: user.role },
      ip: getClientIP(req),
    });

    return res.json({
      access_token: accessToken,
      refresh_token: refreshTokenValue,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        role: user.role,
        roles: [user.role], // Backward compat for frontend
        force_password_change: user.force_password_change,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "An error occurred during login" });
  }
};

// Refresh token - POST /api/v1/auth/refresh
export const refreshToken = async (req: Request, res: Response) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: "Refresh token required" });
  }

  try {
    // Find valid token
    const tokenRecord = await refreshTokenRepository.findValidTokenByPlain(refresh_token);
    if (!tokenRecord) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    // Get user
    const user = userRepository.findById(tokenRecord.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.status === "disabled") {
      return res.status(403).json({ error: "Account disabled" });
    }

    // Revoke old token (rotation)
    await refreshTokenRepository.revoke(tokenRecord.token.id);

    // Generate new tokens
    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const newRefreshTokenValue = generateRefreshToken();
    const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY || "7") || 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.create(user.id, newRefreshTokenValue, expiresAt);

    return res.json({
      access_token: accessToken,
      refresh_token: newRefreshTokenValue,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        role: user.role,
        roles: [user.role],
        force_password_change: user.force_password_change,
      },
    });
  } catch (err: any) {
    console.error("Refresh token error:", err);
    return res.status(500).json({ error: "Token refresh failed" });
  }
};

// Logout - POST /api/v1/auth/logout
export const logout = async (req: AuthenticatedRequest, res: Response) => {
  const { refresh_token } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    if (refresh_token) {
      const tokenRecord = await refreshTokenRepository.findValidTokenByPlain(refresh_token);
      if (tokenRecord && tokenRecord.userId === userId) {
        await refreshTokenRepository.revoke(tokenRecord.token.id);
      }
    }

    auditLogRepository.create({
      actor_id: userId,
      action: "user.logout",
      resource: `user:${userId}`,
      details: {},
      ip: getClientIP(req),
    });

    return res.json({ message: "Logged out successfully" });
  } catch (err: any) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "Logout failed" });
  }
};

// Change password - POST /api/v1/auth/change-password
export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  const { old_password, new_password } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const user = userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // If not force change, verify old password
    if (!user.force_password_change && old_password) {
      const isValidOldPassword = await userRepository.comparePassword(user, old_password);
      if (!isValidOldPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }

    // Validate new password
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: "Password does not meet requirements",
        details: passwordValidation.errors,
      });
    }

    // Hash and update password
    const hashedPassword = await userRepository.hashPassword(new_password);
    userRepository.update(userId, {
      hashed_password: hashedPassword,
      force_password_change: false,
      status: user.status === "pending" ? "active" : user.status,
    });

    // Revoke all refresh tokens for security
    refreshTokenRepository.revokeAllForUser(userId);

    auditLogRepository.create({
      actor_id: userId,
      action: "user.password_change",
      resource: `user:${userId}`,
      details: { forced: user.force_password_change },
      ip: getClientIP(req),
    });

    // Generate new tokens
    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = generateRefreshToken();
    const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY || "7") || 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.create(user.id, refreshTokenValue, expiresAt);

    return res.json({
      message: "Password changed successfully",
      access_token: accessToken,
      refresh_token: refreshTokenValue,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roles: [user.role],
        force_password_change: false,
      },
    });
  } catch (err: any) {
    console.error("Change password error:", err);
    return res.status(500).json({ error: "Password change failed" });
  }
};

// Get current user - GET /api/v1/auth/me
export const me = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const user = userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      role: user.role,
      roles: [user.role],
      status: user.status,
      force_password_change: user.force_password_change,
      last_login_at: user.last_login_at,
    });
  } catch (err: any) {
    console.error("Get user error:", err);
    return res.status(500).json({ error: "Failed to get user info" });
  }
};
