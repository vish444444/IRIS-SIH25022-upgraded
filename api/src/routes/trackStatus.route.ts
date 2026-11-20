import { Router } from "express";
import { TrackStatusController } from "../controller/trackStatus.controller";
import { SectorBlockageController } from "../controller/sectorBlockage.controller";

const router = Router();
const trackStatusController = new TrackStatusController();
const sectorBlockageController = new SectorBlockageController();

router.post("/track-closure", trackStatusController.updateTrackClosure);
router.get("/track-closures", trackStatusController.getActiveClosures);
router.get("/track-closure/:id", trackStatusController.getClosureById);
router.get("/stations", trackStatusController.getStations);
router.get("/track-info", trackStatusController.getTrackInfo);
router.get("/vdu-snapshot", trackStatusController.getVduSnapshot);

// Sector blockage routes
router.post("/sector-blockage", sectorBlockageController.reportBlockage);
router.get("/sector-blockages", sectorBlockageController.getBlockedSectors);
router.delete("/sector-blockage/:sectorId", sectorBlockageController.removeBlockage);
router.get("/sectors", sectorBlockageController.getSectors);

export default router;

