import { Request, Response, NextFunction } from "express";
import { TrainStore } from "../services/receiver/trainStore";
import { TrainReceiverPayload } from "../Interfaces/receiver/trainReceiver.interface";
import { TimetableService } from "../services/receiver/timetableService";
import { TrainLogService } from "../services/simulation/trainLogService";
import { TrainLogEventType } from "../Interfaces/simulation/trainLog.interface";
import auditLogRepository from "../db/repositories/auditLogRepository";

export class ReceiverController {
  private trainStore: TrainStore;
  private timetableService: TimetableService;
  private trainLogService: TrainLogService;

  constructor() {
    this.trainStore = TrainStore.getInstance();
    this.timetableService = TimetableService.getInstance();
    this.trainLogService = TrainLogService.getInstance();
  }

  /**
   * POST /receiver
   * Receives train telemetry data and updates the store
   */
  receiveTrainData = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const payload: TrainReceiverPayload = req.body;

      // Validate required fields
      if (!payload.train_id) {
        res.status(400).json({ error: "train_id is required" });
        return;
      }

      if (typeof payload.lat !== "number" || typeof payload.lng !== "number") {
        res.status(400).json({ error: "lat and lng must be numbers" });
        return;
      }

      if (typeof payload.speed !== "number") {
        res.status(400).json({ error: "speed must be a number" });
        return;
      }

      if (!["slow", "fast", "womens", "ac"].includes(payload.type)) {
        res.status(400).json({ error: "type must be one of: slow, fast, womens, ac" });
        return;
      }

      if (!payload.line_id || !["csmt-kalyan", "csmt-panvel", "secr-raipur"].includes(payload.line_id)) {
        res.status(400).json({ error: "line_id must be one of: csmt-kalyan, csmt-panvel, secr-raipur" });
        return;
      }

      if (!payload.destination || typeof payload.destination !== "string" || payload.destination.trim() === "") {
        res.status(400).json({ error: "destination is required and must be a non-empty string" });
        return;
      }

      // Handle timestamp: accept both number (Unix ms) and ISO string
      let timestamp: number;
      if (typeof payload.timestamp === "number") {
        timestamp = payload.timestamp;
      } else if (typeof payload.timestamp === "string") {
        const parsed = Date.parse(payload.timestamp);
        if (isNaN(parsed)) {
          res.status(400).json({ error: "timestamp must be a valid number or ISO date string" });
          return;
        }
        timestamp = parsed;
      } else {
        res.status(400).json({ error: "timestamp must be a number or ISO date string" });
        return;
      }

      // Get existing train data before update for comparison
      const existingTrain = this.trainStore.getTrain(payload.train_id);
      const isNewTrain = !existingTrain;

      // Upsert the train data with normalized timestamp
      const updatedTrain = this.trainStore.upsertTrain({ ...payload, timestamp });

      // Log train events
      this.logTrainEvents(existingTrain, updatedTrain, isNewTrain);

      res.status(200).json({
        success: true,
        message: "Train data received successfully",
        train: updatedTrain,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /receiver
   * Returns all trains currently in the store
   */
  getAllTrains = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const trains = this.trainStore.getAllTrainsWithCurrentTimings();
      const countByType = this.trainStore.getTrainCountByType();
      const state = this.trainStore.getState();

      res.status(200).json({
        success: true,
        totalTrains: state.totalTrains,
        lastUpdated: state.lastUpdated,
        countByType,
        trains,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /receiver/:trainId
   * Returns a specific train by ID
   */
  getTrainById = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { trainId } = req.params;
      const train = this.trainStore.getTrain(trainId);

      if (!train) {
        res.status(404).json({
          success: false,
          error: `Train with ID ${trainId} not found`,
        });
        return;
      }

      // Update timeSinceLastUpdate for current time
      const now = new Date();
      const trainWithCurrentTiming = {
        ...train,
        timeSinceLastUpdate: now.getTime() - train.lastUpdateTime.getTime(),
      };

      res.status(200).json({
        success: true,
        train: trainWithCurrentTiming,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /receiver/:trainId
   * Removes a train from the store
   */
  removeTrain = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { trainId } = req.params;
      const train = this.trainStore.getTrain(trainId);
      const removed = this.trainStore.removeTrain(trainId);

      if (!removed) {
        res.status(404).json({
          success: false,
          error: `Train with ID ${trainId} not found`,
        });
        return;
      }

      // Log train removal
      if (train) {
        this.trainLogService.logEvent(
          trainId,
          TrainLogEventType.STATE_CHANGE,
          `Train ${trainId} removed from system`,
          {
            lastPosition: { lat: train.lat, lng: train.lng },
            lastSpeed: train.speed,
            destination: train.destination,
          }
        );
      }

      res.status(200).json({
        success: true,
        message: `Train ${trainId} removed successfully`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /receiver/stale
   * Removes trains that haven't updated in a while
   */
  removeStaleTrains = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const maxAge = parseInt(req.query.maxAge as string) || 300000; // Default 5 minutes
      
      // Get trains before removal to log them
      const trainsBeforeRemoval = this.trainStore.getAllTrains();
      const removedTrainIds = this.trainStore.removeStaleTrains(maxAge);

      // Log removal of each stale train
      for (const trainId of removedTrainIds) {
        const train = trainsBeforeRemoval.find(t => t.train_id === trainId);
        if (train) {
          this.trainLogService.logEvent(
            trainId,
            TrainLogEventType.STATE_CHANGE,
            `Train ${trainId} removed due to inactivity (stale for ${maxAge}ms)`,
            {
              lastPosition: { lat: train.lat, lng: train.lng },
              lastSpeed: train.speed,
              destination: train.destination,
              timeSinceLastUpdate: train.timeSinceLastUpdate,
            }
          );
        }
      }

      res.status(200).json({
        success: true,
        message: `Removed ${removedTrainIds.length} stale trains`,
        removedTrains: removedTrainIds,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /receiver/moving
   * Returns trains that are currently moving
   */
  getMovingTrains = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const trains = this.trainStore.getMovingTrains();

      res.status(200).json({
        success: true,
        count: trains.length,
        trains,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /receiver/stationary
   * Returns trains that are currently stationary
   */
  getStationaryTrains = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const trains = this.trainStore.getStationaryTrains();

      res.status(200).json({
        success: true,
        count: trains.length,
        trains,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /receiver/timetable
   * Returns timetable data based on receiver train data combined with timetable
   */
  getTimetable = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const allTrains = this.trainStore.getAllTrainsWithCurrentTimings();
      const stationFilter = req.query.station as string | undefined;

      // Combine live train data with timetable data
      const timetable = this.timetableService.combineWithLiveTrains(allTrains)
        .filter((entry) => {
          if (stationFilter && entry.station !== stationFilter) {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          // Sort by scheduled arrival time if available, otherwise by train ID
          if (a.scheduledArrival && b.scheduledArrival) {
            return new Date(a.scheduledArrival).getTime() - new Date(b.scheduledArrival).getTime();
          }
          return a.trainId.localeCompare(b.trainId);
        });

      res.status(200).json({
        success: true,
        timetable,
        count: timetable.length,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /receiver/logs
   * Returns train logs (using TrainLogService which can be populated by simulator)
   * Also includes sector blockage audit logs
   */
  getTrainLogs = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const trainLogService = TrainLogService.getInstance();
      const trainId = req.query.trainId as string | undefined;
      const eventType = req.query.eventType as TrainLogEventType | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      // Get train logs
      const trainLogs = trainLogService.getLogs({
        trainId,
        eventType,
        limit: limit ? limit * 2 : undefined, // Get more to account for audit logs
      });

      // Get sector blockage audit logs
      const sectorAuditLogs = auditLogRepository.findByAction(
        ["sector.block", "sector.unblock"],
        limit ? Math.min(limit * 2, 100) : 100 // Cap at 100 to avoid too many results
      );

      // Convert audit logs to train log format
      const convertedAuditLogs = sectorAuditLogs.map((auditLog) => {
        const sectorId = auditLog.resource.replace("sector:", "");
        const isBlock = auditLog.action === "sector.block";
        
        return {
          id: `audit-${auditLog.id}`,
          trainId: `SECTOR:${sectorId}`, // Use sector ID as trainId for display
          eventType: isBlock ? "sector_blocked" : "sector_unblocked",
          timestamp: auditLog.timestamp ? new Date(auditLog.timestamp) : new Date(),
          description: isBlock
            ? `Sector ${sectorId} blocked${auditLog.details?.reason ? `: ${auditLog.details.reason}` : ""}`
            : `Sector ${sectorId} unblocked`,
          metadata: {
            sector_id: sectorId,
            action: auditLog.action,
            reason: auditLog.details?.reason || null,
            reported_by: auditLog.details?.reported_by || auditLog.details?.removed_by || "system",
            actor_id: auditLog.actor_id || null,
            ip: auditLog.ip,
            ...auditLog.details,
          },
        };
      });

      // Combine and sort by timestamp (newest first)
      const allLogs = [...trainLogs, ...convertedAuditLogs].sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA; // Descending order
      });

      // Apply limit after combining
      const limitedLogs = limit ? allLogs.slice(0, limit) : allLogs;

      // Filter by eventType if specified (for sector events)
      let filteredLogs = limitedLogs;
      if (eventType) {
        const sectorEventMap: Record<string, string> = {
          sector_blocked: "sector.block",
          sector_unblocked: "sector.unblock",
        };
        filteredLogs = limitedLogs.filter((log) => {
          if (log.eventType === eventType) return true;
          if (sectorEventMap[log.eventType] === eventType) return true;
          return false;
        });
      }

      res.status(200).json({
        success: true,
        logs: filteredLogs,
        count: filteredLogs.length,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Detect and log emergencies based on train data
   */
  private detectEmergencies(
    existingTrain: any,
    updatedTrain: any,
    isNewTrain: boolean
  ): void {
    if (isNewTrain || !existingTrain) return;

    const trainId = updatedTrain.train_id;
    const speedDropThreshold = 10; // km/h - sudden speed drop (lowered for more detection)
    const overspeedThreshold = 90; // km/h - overspeed (lowered for more detection)
    const stallThreshold = 180000; // 3 minutes in ms - train stopped too long (lowered)

    // Check for speed drop emergency
    const speedDrop = existingTrain.speed - updatedTrain.speed;
    if (speedDrop >= speedDropThreshold && existingTrain.speed > 5 && updatedTrain.speed < existingTrain.speed * 0.5) {
      // Check if we already logged this emergency recently (avoid duplicates)
      const recentLogs = this.trainLogService.getLogs({ trainId, limit: 10 });
      const recentEmergency = recentLogs.find((log: any) => 
        log.eventType === TrainLogEventType.EMERGENCY_DETECTED && 
        log.metadata?.type === 'speed_drop' &&
        Date.now() - new Date(log.timestamp).getTime() < 30000 // Within 30 seconds
      );
      
      if (!recentEmergency) {
        const emergencyId = `emergency-${trainId}-${Date.now()}`;
        this.trainLogService.logEvent(
          trainId,
          TrainLogEventType.EMERGENCY_DETECTED,
          `Sudden speed drop detected: ${existingTrain.speed.toFixed(1)} km/h to ${updatedTrain.speed.toFixed(1)} km/h`,
          {
            emergencyId,
            type: 'speed_drop',
            pipelineId: updatedTrain.destination || 'unknown',
            reason: `Speed dropped by ${speedDrop.toFixed(1)} km/h`,
            previousSpeed: existingTrain.speed,
            currentSpeed: updatedTrain.speed,
          }
        );
      }
    }

    // Check for overspeed emergency
    if (updatedTrain.speed > overspeedThreshold) {
      // Check if we already logged this emergency recently (avoid duplicates)
      const recentLogs = this.trainLogService.getLogs({ trainId, limit: 10 });
      const recentEmergency = recentLogs.find((log: any) => 
        log.eventType === TrainLogEventType.EMERGENCY_DETECTED && 
        log.metadata?.type === 'overspeed' &&
        Date.now() - new Date(log.timestamp).getTime() < 30000 // Within 30 seconds
      );
      
      if (!recentEmergency) {
        const emergencyId = `emergency-${trainId}-${Date.now()}`;
        console.log(`[Emergency] Overspeed detected for ${trainId}: ${updatedTrain.speed.toFixed(1)} km/h`);
        this.trainLogService.logEvent(
          trainId,
          TrainLogEventType.EMERGENCY_DETECTED,
          `Overspeed detected: ${updatedTrain.speed.toFixed(1)} km/h exceeds safe limit`,
          {
            emergencyId,
            type: 'overspeed',
            pipelineId: updatedTrain.destination || 'unknown',
            reason: `Train speed ${updatedTrain.speed.toFixed(1)} km/h exceeds safe limit of ${overspeedThreshold} km/h`,
            speed: updatedTrain.speed,
          }
        );
      }
    }

    // Check for stall emergency (train stopped for too long while not at station)
    const timeSinceLastUpdate = updatedTrain.timeSinceLastUpdate || 0;
    if (!updatedTrain.isMoving && timeSinceLastUpdate > stallThreshold && existingTrain.speed === 0 && updatedTrain.speed === 0) {
      // Check if we already logged this emergency recently (avoid duplicates)
      const recentLogs = this.trainLogService.getLogs({ trainId, limit: 10 });
      const recentEmergency = recentLogs.find((log: any) => 
        log.eventType === TrainLogEventType.EMERGENCY_DETECTED && 
        log.metadata?.type === 'stall' &&
        Date.now() - new Date(log.timestamp).getTime() < 60000 // Within 1 minute
      );
      
      if (!recentEmergency) {
        const emergencyId = `emergency-${trainId}-${Date.now()}`;
        console.log(`[Emergency] Stall detected for ${trainId}: stopped for ${(timeSinceLastUpdate / 1000 / 60).toFixed(1)} minutes`);
        this.trainLogService.logEvent(
          trainId,
          TrainLogEventType.EMERGENCY_DETECTED,
          `Train stall detected: stopped for ${(timeSinceLastUpdate / 1000 / 60).toFixed(1)} minutes`,
          {
            emergencyId,
            type: 'stall',
            pipelineId: updatedTrain.destination || 'unknown',
            reason: `Train has been stopped for ${(timeSinceLastUpdate / 1000 / 60).toFixed(1)} minutes`,
            stoppedDuration: timeSinceLastUpdate,
          }
        );
      }
    }
  }

  /**
   * Log train events based on changes in train data
   */
  private logTrainEvents(
    existingTrain: any,
    updatedTrain: any,
    isNewTrain: boolean
  ): void {
    const trainId = updatedTrain.train_id;
    const SPEED_CHANGE_THRESHOLD = 2; // km/h - log speed changes above this threshold
    const MOVEMENT_THRESHOLD = 0.5; // km/h - threshold for considering train moving

    // Detect emergencies first
    this.detectEmergencies(existingTrain, updatedTrain, isNewTrain);

    if (isNewTrain) {
      // Log new train added
      this.trainLogService.logEvent(
        trainId,
        TrainLogEventType.STATE_CHANGE,
        `Train ${trainId} added to system`,
        {
          type: updatedTrain.type,
          destination: updatedTrain.destination,
          line_id: updatedTrain.line_id,
          initialSpeed: updatedTrain.speed,
          initialPosition: { lat: updatedTrain.lat, lng: updatedTrain.lng },
        }
      );
    } else {
      // Log speed changes
      const speedDiff = Math.abs(updatedTrain.speed - existingTrain.speed);
      if (speedDiff >= SPEED_CHANGE_THRESHOLD) {
        this.trainLogService.logEvent(
          trainId,
          TrainLogEventType.STATE_CHANGE,
          `Speed changed from ${existingTrain.speed.toFixed(1)} km/h to ${updatedTrain.speed.toFixed(1)} km/h`,
          {
            previousSpeed: existingTrain.speed,
            newSpeed: updatedTrain.speed,
            speedChange: updatedTrain.speed - existingTrain.speed,
          }
        );
      }


      // Log movement state changes (started/stopped moving)
      const wasMoving = existingTrain.isMoving;
      const isMoving = updatedTrain.isMoving;
      if (wasMoving !== isMoving) {
        if (isMoving) {
          this.trainLogService.logEvent(
            trainId,
            TrainLogEventType.STATE_CHANGE,
            `Train started moving at ${updatedTrain.speed.toFixed(1)} km/h`,
            {
              speed: updatedTrain.speed,
              position: { lat: updatedTrain.lat, lng: updatedTrain.lng },
            }
          );
        } else {
          this.trainLogService.logEvent(
            trainId,
            TrainLogEventType.STATE_CHANGE,
            `Train stopped moving`,
            {
              speed: updatedTrain.speed,
              position: { lat: updatedTrain.lat, lng: updatedTrain.lng },
            }
          );
        }
      }

      // Log destination changes
      if (existingTrain.destination !== updatedTrain.destination) {
        this.trainLogService.logEvent(
          trainId,
          TrainLogEventType.ROUTE_CHANGED,
          `Destination changed from ${existingTrain.destination} to ${updatedTrain.destination}`,
          {
            previousDestination: existingTrain.destination,
            newDestination: updatedTrain.destination,
          }
        );
      }

      // Log when train arrives at a station (speed drops to near zero after moving)
      if (wasMoving && !isMoving && updatedTrain.speed < MOVEMENT_THRESHOLD) {
        this.trainLogService.logEvent(
          trainId,
          TrainLogEventType.ARRIVAL,
          `Train arrived at position (${updatedTrain.lat.toFixed(6)}, ${updatedTrain.lng.toFixed(6)})`,
          {
            position: { lat: updatedTrain.lat, lng: updatedTrain.lng },
            speed: updatedTrain.speed,
            destination: updatedTrain.destination,
          }
        );
      }

      // Log when train departs from a station (speed increases from near zero)
      if (!wasMoving && isMoving && existingTrain.speed < MOVEMENT_THRESHOLD) {
        this.trainLogService.logEvent(
          trainId,
          TrainLogEventType.DEPARTURE,
          `Train departed from position (${existingTrain.lat.toFixed(6)}, ${existingTrain.lng.toFixed(6)})`,
          {
            position: { lat: existingTrain.lat, lng: existingTrain.lng },
            speed: updatedTrain.speed,
            destination: updatedTrain.destination,
          }
        );
      }
    }
  }

  /**
   * POST /receiver/emergency/test
   * Create a test emergency for a train
   */
  createTestEmergency = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { trainId, type } = req.body;

      if (!trainId) {
        res.status(400).json({
          success: false,
          error: "trainId is required",
        });
        return;
      }

      const train = this.trainStore.getTrain(trainId);
      if (!train) {
        res.status(404).json({
          success: false,
          error: `Train ${trainId} not found`,
        });
        return;
      }

      const emergencyType = type || 'speed_drop';
      const emergencyId = `emergency-${trainId}-${Date.now()}`;
      
      let reason = '';
      let metadata: any = {
        emergencyId,
        type: emergencyType,
        pipelineId: train.destination || 'unknown',
      };

      switch (emergencyType) {
        case 'speed_drop':
          reason = `Test: Sudden speed drop detected (simulated emergency)`;
          metadata.previousSpeed = train.speed;
          metadata.currentSpeed = Math.max(0, train.speed * 0.3);
          break;
        case 'overspeed':
          reason = `Test: Overspeed detected - ${train.speed + 20} km/h exceeds safe limit (simulated emergency)`;
          metadata.speed = train.speed + 20;
          break;
        case 'stall':
          reason = `Test: Train stall detected - stopped for extended period (simulated emergency)`;
          metadata.stoppedDuration = 200000;
          break;
        default:
          reason = `Test: Emergency detected (simulated)`;
      }

      this.trainLogService.logEvent(
        trainId,
        TrainLogEventType.EMERGENCY_DETECTED,
        reason,
        metadata
      );

      res.status(200).json({
        success: true,
        message: `Test emergency created for train ${trainId}`,
        emergency: {
          id: emergencyId,
          trainId,
          type: emergencyType,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /receiver/emergency/resolve
   * Resolve an emergency by logging a resolution event
   */
  resolveEmergency = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { emergencyId, trainId, strategy } = req.body;

      if (!emergencyId && !trainId) {
        res.status(400).json({
          success: false,
          error: "emergencyId or trainId is required",
        });
        return;
      }

      const targetTrainId = trainId || emergencyId.split('-')[1] || 'unknown';

      // Log emergency resolution
      this.trainLogService.logEvent(
        targetTrainId,
        TrainLogEventType.EMERGENCY_RESOLVED,
        `Emergency resolved using strategy: ${strategy || 'manual'}`,
        {
          emergencyId: emergencyId || `emergency-${targetTrainId}`,
          strategy: strategy || 'manual',
        }
      );

      res.status(200).json({
        success: true,
        message: `Emergency ${emergencyId || 'resolved'} resolved successfully`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /receiver/control
   * Returns simulation control state (running, speedMultiplier, resetGeneration)
   */
  getSimulationControl = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json({
        success: true,
        running: this.trainStore.isSimulationRunning(),
        speedMultiplier: this.trainStore.getSpeedMultiplier(),
        resetGeneration: this.trainStore.getResetGeneration(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /receiver/control
   * Starts, stops, adjusts speed, or resets the simulation
   */
  postSimulationControl = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { running, speedMultiplier, reset } = req.body;

      if (
        running === undefined &&
        speedMultiplier === undefined &&
        reset === undefined
      ) {
        res.status(400).json({ error: "Provide at least one of: running, speedMultiplier, reset" });
        return;
      }

      if (running !== undefined && typeof running !== "boolean") {
        res.status(400).json({ error: "running must be a boolean" });
        return;
      }

      if (speedMultiplier !== undefined) {
        if (typeof speedMultiplier !== "number" || speedMultiplier < 0.5 || speedMultiplier > 50) {
          res.status(400).json({ error: "speedMultiplier must be a number between 0.5 and 50" });
          return;
        }
        this.trainStore.setSpeedMultiplier(speedMultiplier);
      }

      if (running !== undefined) {
        this.trainStore.setSimulationRunning(running);
      }

      if (reset === true) {
        this.trainStore.triggerReset();
      }

      res.status(200).json({
        success: true,
        message: `Simulation control updated`,
        running: this.trainStore.isSimulationRunning(),
        speedMultiplier: this.trainStore.getSpeedMultiplier(),
        resetGeneration: this.trainStore.getResetGeneration(),
      });
    } catch (error) {
      next(error);
    }
  };
}
