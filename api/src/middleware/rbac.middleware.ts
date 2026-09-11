import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JWTPayload } from "../utils/jwt";
import userRepository from "../db/repositories/userRepository";

// Extended Request with user info
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<string, string[]> = {
  system_admin: ["user:read", "user:create", "user:update", "user:delete", "audit:read", "role:manage"],
  section_controller: ["dashboard:read", "decision:accept", "decision:override", "log:write"],
  signal_operator: ["signals:read", "alerts:ack", "log:write"],
  loco_pilot: ["instructions:read", "log:write"],
};

// Get permissions for a single role
const getRolePermissions = (role: string): string[] => {
  return ROLE_PERMISSIONS[role] || [];
};

// Authenticate middleware - verify JWT and attach user
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization header required" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token required" });
    }

    let payload: JWTPayload;
    try {
      payload = verifyAccessToken(token);
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ error: "Invalid token" });
    }

    // Verify user still exists and is active
    const user = userRepository.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.status === "disabled") {
      return res.status(403).json({ error: "Account disabled" });
    }

    // Get permissions from role in token (single role)
    const role = payload.role || payload.roles?.[0] || user.role;
    const permissions = getRolePermissions(role);

    // Attach user to request
    req.user = {
      id: payload.sub,
      email: payload.email,
      role,
      permissions,
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ error: "Authentication error" });
  }
};

// Require specific permission
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ 
        error: "Forbidden", 
        message: `Missing required permission: ${permission}` 
      });
    }

    next();
  };
};

// Require one of the specified roles
export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Forbidden", 
        message: `Required role: ${roles.join(" or ")}` 
      });
    }

    next();
  };
};
