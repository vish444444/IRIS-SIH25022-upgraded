import React, { useMemo, memo } from "react";
import { LineId, LiveTrainData, TRAIN_TYPE_COLORS, TRAIN_TYPE_LABELS } from "../../types/liveTrains.types";
import { GPSToMapConverter, Station, getTrackIndexForType } from "../../utils/gpsToMapConverter";
import { useIsDarkMode } from "../theme-provider";

interface LiveTrainMarkerProps {
  train: LiveTrainData;
  converter: GPSToMapConverter;
  isDarkMode: boolean;
  onMouseEnter?: (e: React.MouseEvent, content: string) => void;
  onMouseMove?: (e: React.MouseEvent, content: string) => void;
  onMouseLeave?: () => void;
  onClick?: (trainId: string) => void;
  isFocused?: boolean;
  computeTrainY?: (train: LiveTrainData, defaultY: number) => number;
}

const SIGNAL_DOT_COLORS: Record<string, string> = {
  RED: "#ef4444",
  YELLOW: "#eab308",
  DOUBLE_YELLOW: "#f97316",
  GREEN: "#22c55e",
};

/**
 * Individual train marker component — GPU-composited 60fps linear slide
 * with distinct Indian Railways rolling stock silhouettes (Vande Bharat, Express, MEMU, Freight).
 */
export const LiveTrainMarker: React.FC<LiveTrainMarkerProps> = memo(({
  train,
  converter,
  isDarkMode,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onClick,
  isFocused = false,
  computeTrainY,
}) => {
  const trackIndex = getTrackIndexForType(
    train.type,
    train.destination,
    train.lat,
    train.trackType
  );
  const defaultPosition = converter.convert(train.lat, train.lng, trackIndex);
  const posX = defaultPosition.x;
  const posY = computeTrainY ? computeTrainY(train, defaultPosition.y) : defaultPosition.y;

  const isVandeBharat = train.train_id.includes("VB_");
  const isFreight = train.train_id.includes("COAL") || train.train_id.includes("STEEL") || train.train_id.includes("FREIGHT");
  const isExpress = train.train_id.includes("EXP_") || train.train_id.includes("INT_");

  const color = isVandeBharat
    ? "#f97316"
    : isFreight
    ? "#94a3b8"
    : isExpress
    ? "#a855f7"
    : TRAIN_TYPE_COLORS[train.type] || "#3b82f6";

  const isGoingDown = useMemo(() => {
    if (train.trackType) {
      const lower = train.trackType.toLowerCase();
      if (lower.startsWith("down")) return true;
      if (lower.startsWith("up")) return false;
    }
    const dest = train.destination?.toUpperCase() || "";
    return ["CSMT", "CHURCHGATE", "CST", "VT", "DURG", "BPHB", "BIA", "SRWN"].some((d) =>
      dest.includes(d)
    );
  }, [train.trackType, train.destination]);

  const width = isFreight ? 38 : isVandeBharat ? 36 : isFocused ? 38 : 30;
  const height = isFocused ? 14 : 11;
  const signalColor = SIGNAL_DOT_COLORS[train.signalAspect || "GREEN"] || "#22c55e";
  const isSignalHeld = train.signalAspect === "RED" && !train.isMoving;

  const tooltipContent = useMemo(() => {
    const lineLabel =
      train.line_id === "secr-raipur"
        ? "SECR Raipur Division (DRM HQ)"
        : train.line_id === "csmt-kalyan"
        ? "Central Railway Main Line"
        : "Harbour Line";
    const statusText = isSignalHeld
      ? `RED SIGNAL HOLD (${train.stateReason || "Ahead Blocked/Occupied"})`
      : train.isMoving
      ? `Moving @ ${train.speed.toFixed(1)} km/h`
      : "Station Dwell";
    const delayText =
      train.delaySeconds && train.delaySeconds > 0
        ? `\n⏱ Delay: +${Math.round(train.delaySeconds)}s`
        : "";
    const routeText =
      train.currentStation && train.nextStation && train.currentStation !== train.nextStation
        ? `\n🛤️ Segment: ${train.currentStation} ➔ ${train.nextStation}`
        : "";

    return (
      `🚆 ${train.train_id} (${isVandeBharat ? "Vande Bharat Express" : isFreight ? "Freight Rake" : TRAIN_TYPE_LABELS[train.type] || train.type.toUpperCase()})\n` +
      `📍 Towards: ${train.destination}${routeText}\n` +
      `🗺️ Corridor: ${lineLabel}\n` +
      `🚦 Signal: ${train.signalAspect || "GREEN"} | ${statusText}${delayText}\n` +
      `🧭 GPS: ${train.lat.toFixed(5)}, ${train.lng.toFixed(5)}`
    );
  }, [train, isSignalHeld, isVandeBharat, isFreight]);

  const handleMouseEnter = (e: React.MouseEvent) => onMouseEnter?.(e, tooltipContent);
  const handleMouseMove = (e: React.MouseEvent) => onMouseMove?.(e, tooltipContent);
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(train.train_id);
  };

  const headX = isGoingDown ? -width / 2 : width / 2;
  const beamDirection = isGoingDown ? -1 : 1;

  return (
    <g
      className="live-train-marker"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={handleClick}
      style={{
        cursor: "pointer",
        transform: `translate(${posX}px, ${posY}px)`,
        transition: "transform 0.95s linear",
      }}
    >
      {/* Headlight beam for moving trains */}
      {train.isMoving && train.speed > 3 && (
        <polygon
          points={`${headX},${-4} ${headX + beamDirection * 38},${-12} ${headX + beamDirection * 38},${12} ${headX},${4}`}
          fill={isGoingDown ? "url(#headlight-down)" : "url(#headlight-up)"}
          opacity={isDarkMode ? 0.78 : 0.45}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Focus / Selection halo */}
      {isFocused && (
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={-width / 2 - 4}
            y={-height / 2 - 4}
            width={width + 8}
            height={height + 8}
            rx={6}
            fill="none"
            stroke="#facc15"
            strokeWidth={2}
            strokeDasharray="4,2"
            className="animate-pulse"
          />
          <circle
            cx={0}
            cy={0}
            r={width / 2 + 11}
            fill="none"
            stroke="#facc15"
            strokeWidth={1}
            opacity={0.35}
          />
        </g>
      )}

      {/* Signal hold pulsing warning ring */}
      {isSignalHeld && (
        <rect
          x={-width / 2 - 3}
          y={-height / 2 - 3}
          width={width + 6}
          height={height + 6}
          rx={5}
          fill="none"
          stroke="#ef4444"
          strokeWidth={1.6}
          className="animate-pulse"
        />
      )}

      {/* Movement aura ring */}
      {train.isMoving && !isSignalHeld && (
        <rect
          x={-width / 2 - 2}
          y={-height / 2 - 2}
          width={width + 4}
          height={height + 4}
          rx={4}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          opacity={0.4}
        />
      )}

      {/* Main Coach / Locomotive Body */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={isVandeBharat ? 5 : isFreight ? 1.5 : 3}
        fill={isVandeBharat ? "#f8fafc" : color}
        stroke={isVandeBharat ? "#f97316" : "#0f172a"}
        strokeWidth={1.5}
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))"
      />

      {/* Vande Bharat characteristic saffron aero stripe */}
      {isVandeBharat && (
        <rect
          x={-width / 2 + 2}
          y={-1.5}
          width={width - 4}
          height={3}
          fill="#f97316"
        />
      )}

      {/* Freight wagon coupling dividers */}
      {isFreight ? (
        <>
          <line x1={-width / 6} y1={-height / 2} x2={-width / 6} y2={height / 2} stroke="#0f172a" strokeWidth={1.2} />
          <line x1={width / 6} y1={-height / 2} x2={width / 6} y2={height / 2} stroke="#0f172a" strokeWidth={1.2} />
          <rect x={isGoingDown ? -width / 2 : width / 2 - 9} y={-height / 2} width={9} height={height} fill="#eab308" stroke="#0f172a" strokeWidth={1} rx={1} />
        </>
      ) : (
        <>
          {/* Cab Nose & Windshield */}
          <path
            d={
              isGoingDown
                ? `M ${-width / 2 + 3} ${-height / 2 + 1} L ${-width / 2 + 1} 0 L ${-width / 2 + 3} ${height / 2 - 1} Z`
                : `M ${width / 2 - 3} ${-height / 2 + 1} L ${width / 2 - 1} 0 L ${width / 2 - 3} ${height / 2 - 1} Z`
            }
            fill={isVandeBharat ? "#0f172a" : "#ffffff"}
            opacity={0.9}
          />
          <rect
            x={isGoingDown ? -width / 2 + 3 : width / 2 - 7}
            y={-height / 2 + 2}
            width={4}
            height={height - 4}
            rx={1}
            fill="#38bdf8"
            stroke="#0f172a"
            strokeWidth={0.5}
          />
          {/* Passenger Windows */}
          {!isVandeBharat && (
            <>
              <rect x={-5} y={-height / 2 + 2.5} width={3.5} height={height - 5} rx={0.6} fill="#ffffff" opacity={0.85} />
              <rect x={0.5} y={-height / 2 + 2.5} width={3.5} height={height - 5} rx={0.6} fill="#ffffff" opacity={0.85} />
              <rect x={isGoingDown ? 6 : -10.5} y={-height / 2 + 2.5} width={3.5} height={height - 5} rx={0.6} fill="#ffffff" opacity={0.85} />
            </>
          )}
        </>
      )}

      {/* Direction Arrow */}
      <path
        d={isGoingDown ? `M 2 0 L -2 -2.5 L -2 2.5 Z` : `M -2 0 L 2 -2.5 L 2 2.5 Z`}
        fill="#0f172a"
        opacity={0.8}
      />

      {/* Train ID Tag Pill with Signal Aspect Indicator */}
      <g transform={`translate(0, ${-height / 2 - 12})`}>
        <rect
          x={-26}
          y={-1}
          width={52}
          height={11.5}
          rx={3}
          fill={isDarkMode ? (isFocused ? "#1e293b" : "#0b1120") : (isFocused ? "#fefce8" : "#ffffff")}
          stroke={isSignalHeld ? "#ef4444" : isFocused ? "#eab308" : color}
          strokeWidth={isFocused ? 1.4 : 1}
          opacity={0.96}
          filter={isDarkMode ? undefined : "drop-shadow(0 1px 2px rgba(15,23,42,0.16))"}
        />
        <circle cx={-20} cy={4.8} r={2.2} fill={signalColor} />
        <text
          x={2}
          y={7.4}
          fill={isDarkMode ? "#ffffff" : "#0f172a"}
          fontSize="7"
          fontWeight="bold"
          fontFamily="ui-monospace, monospace"
          textAnchor="middle"
        >
          {train.train_id.replace("SECR_", "").slice(0, 11)}
        </text>
      </g>

      {/* Speed / Hold Badge below train */}
      {(train.isMoving && train.speed > 2) || isSignalHeld ? (
        <g transform={`translate(0, ${height / 2 + 3})`}>
          <rect
            x={-20}
            y={0}
            width={40}
            height={9}
            rx={2}
            fill={isSignalHeld ? (isDarkMode ? "#7f1d1d" : "#fee2e2") : (isDarkMode ? "#0f172a" : "#f1f5f9")}
            stroke={isSignalHeld ? "#ef4444" : (isDarkMode ? "#334155" : "#cbd5e1")}
            strokeWidth={0.7}
            opacity={0.95}
          />
          <text
            x={0}
            y={6.8}
            fill={isSignalHeld ? (isDarkMode ? "#fecaca" : "#b91c1c") : (isDarkMode ? "#34d399" : "#047857")}
            fontSize="6.5"
            fontWeight="bold"
            fontFamily="ui-monospace, monospace"
            textAnchor="middle"
          >
            {isSignalHeld ? "SIG HOLD" : `${Math.round(train.speed)} kph`}
          </text>
        </g>
      ) : null}
    </g>
  );
});

LiveTrainMarker.displayName = "LiveTrainMarker";

interface LiveTrainsLayerProps {
  trains: LiveTrainData[];
  mapWidth: number;
  mapHeight: number;
  kmToPixels?: number;
  paddingX?: number;
  stations?: Station[];
  computeTrainY?: (train: LiveTrainData, defaultY: number) => number;
  lineId?: LineId;
  focusedTrainId?: string | null;
  onTrainClick?: (trainId: string) => void;
  onMouseEnter?: (e: React.MouseEvent, content: string) => void;
  onMouseMove?: (e: React.MouseEvent, content: string) => void;
  onMouseLeave?: () => void;
}

export const LiveTrainsLayer: React.FC<LiveTrainsLayerProps> = memo(({
  trains,
  mapWidth,
  mapHeight,
  kmToPixels = 150,
  paddingX = 150,
  stations,
  lineId,
  computeTrainY,
  focusedTrainId,
  onTrainClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) => {
  const themeDark = useIsDarkMode();
  const converter = useMemo(() => {
    return new GPSToMapConverter(
      {
        width: mapWidth,
        height: mapHeight,
        paddingX,
        paddingY: 40,
      },
      kmToPixels,
      stations
    );
  }, [mapWidth, mapHeight, paddingX, kmToPixels, stations]);

  const filteredTrains = useMemo(() => {
    if (!lineId) return trains;
    return trains.filter((train) => train.line_id === lineId);
  }, [trains, lineId]);

  if (filteredTrains.length === 0) {
    return null;
  }

  return (
    <g className="live-trains-layer">
      {filteredTrains.map((train) => (
        <LiveTrainMarker
          key={train.train_id}
          train={train}
          converter={converter}
          isDarkMode={themeDark}
          computeTrainY={computeTrainY}
          isFocused={focusedTrainId === train.train_id}
          onClick={onTrainClick}
          onMouseEnter={onMouseEnter}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        />
      ))}
    </g>
  );
});

LiveTrainsLayer.displayName = "LiveTrainsLayer";
