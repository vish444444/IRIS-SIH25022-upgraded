import React, { useEffect, useState, useMemo } from "react";
import { useSimulation } from "../../hooks/useSimulation";
import { audioService } from "../../utils/audioService";
import { AlertTriangle, Minimize2, Maximize2 } from "lucide-react";

interface EmergencyAlertProps {
  onFocusTrain?: (trainId: string, emergencyReason?: string | null) => void;
}

const typeLabel: Record<string, string> = {
  speed_drop: "Speed Drop",
  overspeed: "Overspeed",
  stall: "Stall",
  signal_violation: "Signal",
  power_failure: "Power",
  unknown: "Unknown",
};

export const EmergencyAlert: React.FC<EmergencyAlertProps> = ({ onFocusTrain }) => {
  const { emergencyEvents } = useSimulation();
  const [isFlashing, setIsFlashing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const groupedSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    emergencyEvents.forEach((e) => {
      const key = (e as any).type || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 4);
  }, [emergencyEvents]);

  useEffect(() => {
    if (emergencyEvents.length > 0) {
      audioService.playBuzzer(2000);
      setIsFlashing(true);
      const interval = setInterval(() => {
        setIsFlashing((prev) => !prev);
      }, 500);

      return () => {
        clearInterval(interval);
      };
    } else {
      setIsFlashing(false);
    }
  }, [emergencyEvents]);

  if (emergencyEvents.length === 0) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-40 max-w-md w-[320px] sm:w-[360px] bg-red-600 text-white text-left font-bold rounded-lg shadow-2xl border border-red-800 ${
        isFlashing ? "opacity-100" : "opacity-95"
      } transition-opacity duration-300`}
    >
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 animate-pulse" />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm leading-snug">Emergency mode active</div>
            <button
              type="button"
              onClick={() => setIsMinimized((previous) => !previous)}
              aria-expanded={!isMinimized}
              aria-label={isMinimized ? "Expand emergency mode" : "Minimize emergency mode"}
              title={isMinimized ? "Expand emergency mode" : "Minimize emergency mode"}
              className="p-1 -mr-1 -mt-1 rounded hover:bg-red-700/60 transition-colors"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="text-[11px] font-normal mt-0.5 text-red-100/90">
            {emergencyEvents.length} active emergency
            {emergencyEvents.length > 1 ? " events" : " event"}
          </div>
          {!isMinimized && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {groupedSummary.map(([type, count]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 rounded-full bg-red-500/40 border border-red-200/70 px-1.5 py-0.5 text-[10px] font-medium"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-100" />
                  {typeLabel[type] || "Emergency"}
                  <span className="text-red-100/80">· {count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {!isMinimized && (
        <div className="border-t border-red-500/60 max-h-32 overflow-y-auto">
          {emergencyEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onFocusTrain?.(event.trainId, event.reason)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] font-normal text-white/90 hover:bg-red-700/70 transition-colors text-left"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="inline-flex items-center rounded-full bg-red-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {typeLabel[(event as any).type] || "EMERGENCY"}
                </span>
                <span className="truncate">
                  Train {event.trainId} on {event.pipelineId}: {event.reason}
                </span>
              </div>
              <span className="text-[10px] text-red-100/80 whitespace-nowrap">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
