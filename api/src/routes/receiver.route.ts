import { Router } from "express";
import { ReceiverController } from "../controller/receiver.controller";

const router = Router();
const receiverController = new ReceiverController();

// POST /receiver - Receive train telemetry data
router.post("/", receiverController.receiveTrainData);

// GET /receiver - Get all trains
router.get("/", receiverController.getAllTrains);

// GET /receiver/moving - Get moving trains
router.get("/moving", receiverController.getMovingTrains);

// GET /receiver/stationary - Get stationary trains
router.get("/stationary", receiverController.getStationaryTrains);

// GET /receiver/timetable - Get timetable data (must be before /:trainId)
router.get("/timetable", receiverController.getTimetable);

// GET /receiver/logs - Get train logs (must be before /:trainId)
router.get("/logs", receiverController.getTrainLogs);

// POST /receiver/emergency/resolve - Resolve an emergency (must be before /:trainId)
router.post("/emergency/resolve", receiverController.resolveEmergency);

// POST /receiver/emergency/test - Generate a test emergency (must be before /:trainId)
router.post("/emergency/test", receiverController.createTestEmergency);

// DELETE /receiver/stale - Remove stale trains (must be before /:trainId)
router.delete("/stale", receiverController.removeStaleTrains);

// GET /receiver/control - Check if simulation is running
router.get("/control", receiverController.getSimulationControl);

// POST /receiver/control - Start/stop simulation
router.post("/control", receiverController.postSimulationControl);

// GET /receiver/:trainId - Get a specific train (must be last)
router.get("/:trainId", receiverController.getTrainById);

// DELETE /receiver/:trainId - Remove a specific train
router.delete("/:trainId", receiverController.removeTrain);

export default router;
