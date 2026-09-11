import receiverRouter from "./receiver.route";
import trackStatusRouter from "./trackStatus.route";
import authRouter from "./auth.route";
import adminRouter from "./admin.route";
import aiRouter from "./ai.route";

export const routes = (app: any) => {
  // Simulation and status routes
  app.use("/api/receiver", receiverRouter);
  app.use("/api/status", trackStatusRouter);

  // AI Decision-Support routes (proxy to Python ai-service)
  app.use("/api/ai", aiRouter);

  // Auth routes (v1 API)
  app.use("/api/v1/auth", authRouter);

  // Admin routes (v1 API)
  app.use("/api/v1/admin", adminRouter);
};
