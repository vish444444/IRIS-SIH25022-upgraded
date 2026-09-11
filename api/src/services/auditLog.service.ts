import auditLogRepository from "../db/repositories/auditLogRepository";
import { Request } from "express";

export interface AuditLogData {
  actor_id?: string;
  action: string;
  resource: string;
  details?: Record<string, any>;
  ip: string;
}

export const getClientIP = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

export const createAuditLog = async (data: AuditLogData): Promise<void> => {
  try {
    auditLogRepository.create({
      actor_id: data.actor_id,
      action: data.action,
      resource: data.resource,
      details: data.details || {},
      ip: data.ip,
    });
  } catch (error) {
    // Log error but don't throw - audit logging should not break the main flow
    console.error("Failed to create audit log:", error);
  }
};
