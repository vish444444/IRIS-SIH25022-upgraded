import React, { useMemo, memo } from "react";
import { LineId, LiveTrainData, TRAIN_TYPE_COLORS, TRAIN_TYPE_LABELS } from "../../types/liveTrains.types";
import { GPSToMapConverter, getTrackIndexForType } from "../../utils/gpsToMapConverter";

interface LiveTrainMarkerProps {
  train: LiveTrainData;
  converter: GPSToMapConverter;
  onMouseEnter?: (e: React.MouseEvent, content: string) => void;
  onMouseMove?: (e: React.MouseEvent, content: string) => void;
  onMouseLeave?: () => void;
  onClick?: (trainId: string) => void;
  isFocused?: boolean;
  computeTrainY?: (train: LiveTrainData, defaultY: number) => number;
}

/**
 * Individual train marker component - optimized with React.memo
 */
export const LiveTrainMarker: React.FC<LiveTrainMarkerProps> = memo(({
  train,
  converter,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onClick,
  isFocused = false,
  computeTrainY,
}) => {
  // Determine track based on train type AND destination (direction)
  const trackIndex = getTrackIndexForType(train.type, train.destination);
  const defaultPosition = converter.convert(train.lat, train.lng, trackIndex);
  const position = {
    x: defaultPosition.x,
    y: computeTrainY ? computeTrainY(train, defaultPosition.y) : defaultPosition.y,
  };
  const color = TRAIN_TYPE_COLORS[train.type] || "#3b82f6";

  const isGoingDown = train.destination?.toUpperCase().includes("CSMT") || 
                      train.destination?.toUpperCase().includes("CST") ||
                      train.destination?.toUpperCase().includes("VT");

  const width = isFocused ? 38 : 30;
  const height = isFocused ? 14 : 11;

  const tooltipContent = useMemo(() => {
    const lineLabel = train.line_id === "secr-raipur" ? "SECR Raipur Division" : train.line_id === "csmt-kalyan" ? "Central Main Line" : "Harbour Line";
    const statusText = train.isMoving ? `Moving @ ${train.speed.toFixed(1)} km/h` : "Dwell / Stationary";
    return `🚆 ${train.train_id} (${TRAIN_TYPE_LABELS[train.type] || train.type.toUpperCase()})\n` +
      `📍 Towards: ${train.destination}\n` +
      `🛤️ Line: ${lineLabel}\n` +
      `⚡ Status: ${statusText}\n` +
      `🧭 GPS: ${train.lat.toFixed(5)}, ${train.lng.toFixed(5)}`;
  }, [train]);

  const handleMouseEnter = (e: React.MouseEvent) => {
    onMouseEnter?.(e, tooltipContent);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    onMouseMove?.(e, tooltipContent);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(train.train_id);
  };

  const headX = isGoingDown ? position.x - width / 2 : position.x + width / 2;
  const beamDirection = isGoingDown ? -1 : 1;

  return (
    <g
      className="live-train-marker"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={handleClick}
      style={{ cursor: "pointer" }}
    >
      {/* Headlight beam for moving trains */}
      {train.isMoving && train.speed > 3 && (
        <polygon
          points={`${headX},${position.y - 4} ${headX + beamDirection * 35},${position.y - 12} ${headX + beamDirection * 35},${position.y + 12} ${headX},${position.y + 4}`}
          fill={isGoingDown ? "url(#headlight-down)" : "url(#headlight-up)"}
          opacity={0.7}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Focus / Selection halo */}
      {isFocused && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={position.x - width / 2 - 4}
            y={position.y - height / 2 - 4}
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
            cx={position.x}
            cy={position.y}
            r={width / 2 + 10}
            fill="none"
            stroke="#facc15"
            strokeWidth={1}
            opacity={0.3}
          />
        </g>
      )}

      {/* Movement pulse ring */}
      {train.isMoving && (
        <rect
          x={position.x - width / 2 - 2}
          y={position.y - height / 2 - 2}
          width={width + 4}
          height={height + 4}
          rx={4}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          opacity={0.4}
        />
      )}

      {/* Main Coach Body */}
      <rect
        x={position.x - width / 2}
        y={position.y - height / 2}
        width={width}
        height={height}
        rx={3}
        fill={color}
        stroke="#0f172a"
        strokeWidth={1.5}
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.35))"
      />

      {/* Streamlined Cab Front */}
      <path
        d={
          isGoingDown
            ? `M ${position.x - width / 2 + 3} ${position.y - height / 2 + 1} 
               L ${position.x - width / 2 + 1} ${position.y} 
               L ${position.x - width / 2 + 3} ${position.y + height / 2 - 1} Z`
            : `M ${position.x + width / 2 - 3} ${position.y - height / 2 + 1} 
               L ${position.x + width / 2 - 1} ${position.y} 
               L ${position.x + width / 2 - 3} ${position.y + height / 2 - 1} Z`
        }
        fill="#ffffff"
        opacity={0.9}
      />

      {/* Windshield / Cab Glass */}
      <rect
        x={isGoingDown ? position.x - width / 2 + 3 : position.x + width / 2 - 7}
        y={position.y - height / 2 + 2}
        width={4}
        height={height - 4}
        rx={1}
        fill="#38bdf8"
        stroke="#0f172a"
        strokeWidth={0.5}
      />

      {/* Passenger Windows */}
      <rect
        x={position.x - 5}
        y={position.y - height / 2 + 2.5}
        width={3.5}
        height={height - 5}
        rx={0.6}
        fill="#ffffff"
        opacity={0.8}
      />
      <rect
        x={position.x + 0.5}
        y={position.y - height / 2 + 2.5}
        width={3.5}
        height={height - 5}
        rx={0.6}
        fill="#ffffff"
        opacity={0.8}
      />
      <rect
        x={isGoingDown ? position.x + 6 : position.x - 10.5}
        y={position.y - height / 2 + 2.5}
        width={3.5}
        height={height - 5}
        rx={0.6}
        fill="#ffffff"
        opacity={0.8}
      />

      {/* Direction Arrow on Roof */}
      <path
        d={
          isGoingDown
            ? `M ${position.x + 2} ${position.y} L ${position.x - 2} ${position.y - 2.5} L ${position.x - 2} ${position.y + 2.5} Z`
            : `M ${position.x - 2} ${position.y} L ${position.x + 2} ${position.y - 2.5} L ${position.x + 2} ${position.y + 2.5} Z`
        }
        fill="#0f172a"
        opacity={0.8}
      />

      {/* Train ID Tag Pill (Above Train) */}
      <g transform={`translate(${position.x}, ${position.y - height / 2 - 11})`}>
        <rect
          x={-22}
          y={-1}
          width={44}
          height={11}
          rx={3}
          fill={isFocused ? "#1e293b" : "#0f172a"}
          stroke={isFocused ? "#facc15" : color}
          strokeWidth={1}
          opacity={0.92}
        />
        <text
          x={0}
          y={7.5}
          fill="#ffffff"
          fontSize="7.5"
          fontWeight="bold"
          fontFamily="ui-monospace, monospace"
          textAnchor="middle"
        >
          {train.train_id}
        </text>
      </g>

      {/* Speed Badge (Below Train for moving trains) */}
      {train.isMoving && train.speed > 2 && (
        <g transform={`translate(${position.x}, ${position.y + height / 2 + 3})`}>
          <rect
            x={-16}
            y={0}
            width={32}
            height={9}
            rx={2}
            fill="#0f172a"
            stroke="#334155"
            strokeWidth={0.5}
            opacity={0.85}
          />
          <text
            x={0}
            y={6.8}
            fill="#34d399"
            fontSize="6.5"
            fontWeight="bold"
            fontFamily="ui-monospace, monospace"
            textAnchor="middle"
          >
            {Math.round(train.speed)}kph
          </text>
        </g>
      )}
    </g>
  );
});

LiveTrainMarker.displayName = "LiveTrainMarker";

interface LiveTrainsLayerProps {
  trains: LiveTrainData[];
  mapWidth: number;
  mapHeight: number;
  kmToPixels?: number;
  computeTrainY?: (train: LiveTrainData, defaultY: number) => number;
  lineId?: LineId;
  focusedTrainId?: string | null;
  onTrainClick?: (trainId: string) => void;
  onMouseEnter?: (e: React.MouseEvent, content: string) => void;
  onMouseMove?: (e: React.MouseEvent, content: string) => void;
  onMouseLeave?: () => void;
}

/**
 * Layer component that renders all live trains on the map
 */
export const LiveTrainsLayer: React.FC<LiveTrainsLayerProps> = memo(({
  trains,
  mapWidth,
  mapHeight,
  kmToPixels = 150,
  lineId,
  computeTrainY,
  focusedTrainId,
  onTrainClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) => {
  // Create converter with map dimensions
  const converter = useMemo(() => {
    return new GPSToMapConverter(
      {
        width: mapWidth,
        height: mapHeight,
        paddingX: 100,
        paddingY: 40,
      },
      kmToPixels
    );
  }, [mapWidth, mapHeight, kmToPixels]);

  // Filter trains by line if lineId is provided
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

