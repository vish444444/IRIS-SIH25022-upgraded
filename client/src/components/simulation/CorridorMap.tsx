import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useSimulation } from "../../hooks/useSimulation";
import { TrainMarker } from "./TrainMarker";
import { TrainClass } from "../../types/simulation.types";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const TRACK_HEIGHT = 8;
const TRACK_SPACING = 35;
const GROUP_SPACING = 40;
const STATION_WIDTH = 180;
const SCALE = 0.25;

interface CorridorMapProps {
  onTrainClick?: (trainId: string) => void;
  focusedTrainId?: string | null;
}

export const CorridorMap: React.FC<CorridorMapProps> = ({ onTrainClick, focusedTrainId }) => {
  const { pipelines, trains, update } = useSimulation();
  const [tooltip, setTooltip] = useState<{
    content: string;
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);

  const trackLayout = useMemo(() => {
    const layout: Array<{
      id: string;
      x: number;
      y: number;
      length: number;
      fromStation: string | null;
      toStation: string | null;
      stationX: number | null;
      fromPos: number;
      toPos: number;
      mergePoint: number | null;
      group: string;
      direction: string;
    }> = [];

    // Mumbai Central Line: CSMT to Thane
    const stationNames: Record<string, string> = {
      S1: "CSMT",
      S2: "Byculla",
      S3: "Dadar",
      S4: "Kurla",
      S5: "Ghatkopar",
      S6: "Thane",
    };

    const stationPlatforms: Record<string, number[]> = {
      S1: [1, 2, 3, 4],  // CSMT - major station
      S2: [1, 2, 3],      // Byculla
      S3: [1, 2, 3, 4],  // Dadar - major station
      S4: [1, 2, 3],      // Kurla
      S5: [1, 2, 3],      // Ghatkopar
      S6: [1, 2, 3, 4],   // Thane - terminal
    };

    // Mumbai Central Line layout: Up/Down tracks, Local/Express
    // Build config from all available pipelines
    const allPipelines = Array.from(pipelines.keys()).sort();
    const PIPELINE_CONFIG: Array<{
      id: string;
      from: number;
      to: number;
      fromStation: string | null;
      toStation: string | null;
      yOffset: number;
      mergePoint: number | null;
      group: string;
      direction: string;
    }> = [];

    allPipelines.forEach((pipelineId) => {
      const pipeline = pipelines.get(pipelineId);
      if (!pipeline) return;

      // Determine direction and type from pipeline ID
      let direction = "up";
      let group = "local";
      
      if (pipelineId.startsWith("P1") || pipelineId.startsWith("P2")) {
        direction = "up";
        group = pipelineId.startsWith("P1") && parseInt(pipelineId.replace("P", "")) <= 10 ? "local" : 
                pipelineId.startsWith("P2") ? "local" : "express";
      } else if (pipelineId.startsWith("P3") || pipelineId.startsWith("P4") || pipelineId.startsWith("P5")) {
        direction = "down";
        if (pipelineId.startsWith("P3") || pipelineId.startsWith("P4")) {
          group = "local";
        } else {
          group = "express";
        }
      }

      // Get position from pipeline - need to check actual pipeline structure
      // For now, use a simplified approach based on pipeline ID
      const pipelineNum = parseInt(pipelineId.replace("P", ""));
      let from = 0;
      let to = 1000;
      let fromStation: string | null = null;
      let toStation: string | null = null;

      // Map pipeline positions based on direction
      if (direction === "up") {
        if (pipelineNum <= 10) {
          // Up local track 1
          const section = pipelineNum;
          if (section === 1) { from = 0; to = 1250; fromStation = "S1"; }
          else if (section === 2) { from = 1250; to = 2500; toStation = "S2"; }
          else if (section === 3) { from = 2500; to = 3750; fromStation = "S2"; }
          else if (section === 4) { from = 3750; to = 5000; toStation = "S3"; }
          else if (section === 5) { from = 5000; to = 6500; fromStation = "S3"; }
          else if (section === 6) { from = 6500; to = 8000; toStation = "S4"; }
          else if (section === 7) { from = 8000; to = 9500; fromStation = "S4"; }
          else if (section === 8) { from = 9500; to = 11000; toStation = "S5"; }
          else if (section === 9) { from = 11000; to = 13000; fromStation = "S5"; }
          else if (section === 10) { from = 13000; to = 15000; toStation = "S6"; }
        } else if (pipelineNum >= 21 && pipelineNum <= 30) {
          // Up local track 2
          const section = pipelineNum - 20;
          if (section === 1) { from = 0; to = 1250; fromStation = "S1"; }
          else if (section === 2) { from = 1250; to = 2500; toStation = "S2"; }
          else if (section === 3) { from = 2500; to = 3750; fromStation = "S2"; }
          else if (section === 4) { from = 3750; to = 5000; toStation = "S3"; }
          else if (section === 5) { from = 5000; to = 6500; fromStation = "S3"; }
          else if (section === 6) { from = 6500; to = 8000; toStation = "S4"; }
          else if (section === 7) { from = 8000; to = 9500; fromStation = "S4"; }
          else if (section === 8) { from = 9500; to = 11000; toStation = "S5"; }
          else if (section === 9) { from = 11000; to = 13000; fromStation = "S5"; }
          else if (section === 10) { from = 13000; to = 15000; toStation = "S6"; }
        } else if (pipelineNum >= 11 && pipelineNum <= 13) {
          // Up express
          if (pipelineNum === 11) { from = 0; to = 5000; fromStation = "S1"; toStation = "S3"; }
          else if (pipelineNum === 12) { from = 5000; to = 11000; fromStation = "S3"; toStation = "S5"; }
          else if (pipelineNum === 13) { from = 11000; to = 15000; fromStation = "S5"; toStation = "S6"; }
        }
      } else {
        // Down direction
        if (pipelineNum >= 31 && pipelineNum <= 40) {
          // Down local track 1
          const section = pipelineNum - 30;
          if (section === 1) { from = 15000; to = 13000; toStation = "S6"; }
          else if (section === 2) { from = 13000; to = 11000; fromStation = "S5"; }
          else if (section === 3) { from = 11000; to = 9500; toStation = "S5"; }
          else if (section === 4) { from = 9500; to = 8000; fromStation = "S4"; }
          else if (section === 5) { from = 8000; to = 6500; toStation = "S4"; }
          else if (section === 6) { from = 6500; to = 5000; fromStation = "S3"; }
          else if (section === 7) { from = 5000; to = 3750; toStation = "S3"; }
          else if (section === 8) { from = 3750; to = 2500; fromStation = "S2"; }
          else if (section === 9) { from = 2500; to = 1250; toStation = "S2"; }
          else if (section === 10) { from = 1250; to = 0; toStation = "S1"; }
        } else if (pipelineNum >= 41 && pipelineNum <= 50) {
          // Down local track 2
          const section = pipelineNum - 40;
          if (section === 1) { from = 15000; to = 13000; toStation = "S6"; }
          else if (section === 2) { from = 13000; to = 11000; fromStation = "S5"; }
          else if (section === 3) { from = 11000; to = 9500; toStation = "S5"; }
          else if (section === 4) { from = 9500; to = 8000; fromStation = "S4"; }
          else if (section === 5) { from = 8000; to = 6500; toStation = "S4"; }
          else if (section === 6) { from = 6500; to = 5000; fromStation = "S3"; }
          else if (section === 7) { from = 5000; to = 3750; toStation = "S3"; }
          else if (section === 8) { from = 3750; to = 2500; fromStation = "S2"; }
          else if (section === 9) { from = 2500; to = 1250; toStation = "S2"; }
          else if (section === 10) { from = 1250; to = 0; toStation = "S1"; }
        } else if (pipelineNum >= 51 && pipelineNum <= 53) {
          // Down express
          if (pipelineNum === 51) { from = 15000; to = 11000; fromStation = "S6"; toStation = "S5"; }
          else if (pipelineNum === 52) { from = 11000; to = 5000; fromStation = "S5"; toStation = "S3"; }
          else if (pipelineNum === 53) { from = 5000; to = 0; fromStation = "S3"; toStation = "S1"; }
        }
      }

      PIPELINE_CONFIG.push({
        id: pipelineId,
        from: Math.min(from, to),
        to: Math.max(from, to),
        fromStation,
        toStation,
        yOffset: 0,
        mergePoint: null,
        group,
        direction,
      });
    });

    // Calculate Y positions with grouping: Up Local, Up Express, Down Local, Down Express
    // Group tracks by track number (parallel tracks)
    const getTrackNumber = (pipelineId: string): number => {
      const num = parseInt(pipelineId.replace("P", ""));
      if (num <= 10) return 1;
      if (num >= 21 && num <= 30) return 2;
      if (num >= 31 && num <= 40) return 1;
      if (num >= 41 && num <= 50) return 2;
      return 0; // Express tracks
    };
    
    const groupSpacing = GROUP_SPACING;
    const upLocalHeight = 2 * (TRACK_HEIGHT + TRACK_SPACING); // Track 1 and Track 2
    const upExpressHeight = TRACK_HEIGHT + TRACK_SPACING;
    const downLocalHeight = 2 * (TRACK_HEIGHT + TRACK_SPACING);
    
    PIPELINE_CONFIG.forEach((config) => {
      let y;
      const trackNum = getTrackNumber(config.id);
      
      // Tracks on the same route share Y level - sections connect seamlessly
      // Only parallel tracks (track 1 vs track 2) are on different Y levels
      if (config.direction === "up" && config.group === "local") {
        y = 70 + (trackNum - 1) * (TRACK_HEIGHT + TRACK_SPACING);
      } else if (config.direction === "up" && config.group === "express") {
        y = 70 + upLocalHeight + groupSpacing;
      } else if (config.direction === "down" && config.group === "local") {
        y = 70 + upLocalHeight + groupSpacing + upExpressHeight + groupSpacing + (trackNum - 1) * (TRACK_HEIGHT + TRACK_SPACING);
      } else {
        y = 70 + upLocalHeight + groupSpacing + upExpressHeight + groupSpacing + downLocalHeight + groupSpacing;
      }
      
      // Position tracks to connect seamlessly - no gaps between sections
      // Tracks connect end-to-end: P1 ends at 750, P2 starts at 750, etc.
      const x = config.from * SCALE;
      const length = (config.to - config.from) * SCALE;

      layout.push({
        id: config.id,
        x,
        y,
        length,
        fromStation: config.fromStation,
        toStation: config.toStation,
        stationX: config.fromStation ? config.from * SCALE : config.toStation ? config.to * SCALE : null,
        fromPos: config.from,
        toPos: config.to,
        mergePoint: config.mergePoint || null,
        group: config.group,
        direction: config.direction,
      });
    });

    return { layout, stationNames, stationPlatforms };
  }, [pipelines, trains]);

  const getTrackPoint = useCallback(
    (
      track: {
        id: string;
        x: number;
        y: number;
        length: number;
      },
      t: number
    ) => {
      const clampedT = Math.max(0, Math.min(1, t));
      const trackNum = parseInt(track.id.replace("P", ""));
      const variation = Math.sin(trackNum * 0.7) * 5;
      const midX = track.x + track.length / 2;
      const midY = track.y + TRACK_HEIGHT / 2;
      const controlY = midY + variation;
      const x =
        (1 - clampedT) * (1 - clampedT) * track.x +
        2 * (1 - clampedT) * clampedT * midX +
        clampedT * clampedT * (track.x + track.length);
      const y =
        (1 - clampedT) * (1 - clampedT) * midY +
        2 * (1 - clampedT) * clampedT * controlY +
        clampedT * clampedT * midY;
      return { x, y };
    },
    []
  );

  const totalWidth = 15000 * SCALE;
  // Calculate heights - tracks on same route share Y level, only parallel tracks are separate
  const upLocalHeight = 2 * (TRACK_HEIGHT + TRACK_SPACING); // Track 1 and Track 2
  const upExpressHeight = TRACK_HEIGHT + TRACK_SPACING; // Single express track
  const downLocalHeight = 2 * (TRACK_HEIGHT + TRACK_SPACING); // Track 1 and Track 2
  const downExpressHeight = TRACK_HEIGHT + TRACK_SPACING; // Single express track
  const totalHeight =
    50 +
    upLocalHeight +
    GROUP_SPACING +
    upExpressHeight +
    GROUP_SPACING +
    downLocalHeight +
    GROUP_SPACING +
    downExpressHeight +
    50;

  const clampPan = useCallback(
    (nextPan: { x: number; y: number }, zoomLevel: number) => {
      if (!containerRef.current) return nextPan;
      const { width, height } = containerRef.current.getBoundingClientRect();

      const contentWidth = totalWidth * zoomLevel;
      const contentHeight = totalHeight * zoomLevel;

      const minX = Math.min(0, width - contentWidth);
      const maxX = 0;
      const minY = Math.min(0, height - contentHeight);
      const maxY = 0;

      return {
        x: Math.min(maxX, Math.max(minX, nextPan.x)),
        y: Math.min(maxY, Math.max(minY, nextPan.y)),
      };
    },
    [totalWidth, totalHeight]
  );

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // When a train is focused (e.g. from an emergency), center on it once,
  // but allow the user to pan/zoom freely afterwards.
  useEffect(() => {
    if (!focusedTrainId) return;
    const train = trains.get(focusedTrainId);
    if (!train) return;
    const track = trackLayout.layout.find((t) => t.id === train.currentPipeline);
    if (!track) return;
    const trackLength = Math.max(1, track.toPos - track.fromPos);
    const progress = Math.max(0, Math.min(1, train.position / trackLength));
    const point = getTrackPoint(track, progress);
    const desiredZoom = Math.max(zoomRef.current, 1.3);
    setZoom(desiredZoom);
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const nextPan = {
        x: width / 2 - point.x * desiredZoom,
        y: height / 2 - point.y * desiredZoom,
      };
      setPan(clampPan(nextPan, desiredZoom));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTrainId]);

  // Initial centering of the corridor map
  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const initialPan = {
      x: width / 2 - (totalWidth * zoomRef.current) / 2,
      y: height / 2 - (totalHeight * zoomRef.current) / 2,
    };
    setPan((prev) =>
      prev.x === 0 && prev.y === 0 ? clampPan(initialPan, zoomRef.current) : prev
    );
  }, [totalWidth, totalHeight, clampPan]);

  const getTrainClassColor = (trainClass: string): string => {
    switch (trainClass) {
      case TrainClass.AC_LOCAL:
        return "#3b82f6";
      case TrainClass.LADIES_SPECIAL:
        return "#ec4899";
      case TrainClass.FAST_LOCAL:
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  const generateSignalId = (pipelineId: string, position: number): string => {
    const signalNum = parseInt(pipelineId.replace("P", "")) * 10 + Math.floor(position / 500);
    return `S${signalNum}`;
  };

  const generatePointId = (pipelineId: string): string => {
    const pointNum = parseInt(pipelineId.replace("P", "")) * 5;
    return `K${pointNum}`;
  };

  const generateBlockId = (pipelineId: string): string => {
    const blockNum = parseInt(pipelineId.replace("P", "")) * 3;
    return `BL${blockNum}`;
  };

  const handleMouseEnter = (e: React.MouseEvent, content: string) => {
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }

    // Show tooltip immediately (no delay for better UX)
    setTooltip({
      content,
      x: e.clientX,
      y: e.clientY - 10,
    });
  };


  const handleMouseLeave = () => {
    // Clear timeout if tooltip hasn't appeared yet
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    // Fade out tooltip
    setTooltip(null);
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // Zoom handlers – zoom towards cursor position
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const zoomStep = 0.08;
      const delta = e.deltaY > 0 ? -zoomStep : zoomStep;

      setZoom((prevZoom) => {
        const newZoom = Math.max(0.3, Math.min(3, prevZoom + delta));
        if (!containerRef.current) {
          return newZoom;
        }

        const rect = containerRef.current.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        setPan((prevPan) =>
          clampPan(
            {
              x: cursorX - ((cursorX - prevPan.x) * newZoom) / prevZoom,
              y: cursorY - ((cursorY - prevPan.y) * newZoom) / prevZoom,
            },
            newZoom
          )
        );

        return newZoom;
      });
    },
    [clampPan]
  );

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('button')) { // Left mouse button, not on button
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMapMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPan(
          clampPan(
            {
              x: e.clientX - dragStart.x,
              y: e.clientY - dragStart.y,
            },
            zoomRef.current
          )
        );
      }
    },
    [isDragging, dragStart, clampPan]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent, content: string) => {
    if (!isDragging && tooltip) {
      // Update tooltip position smoothly as mouse moves
      setTooltip({
        content,
        x: e.clientX,
        y: e.clientY - 10,
      });
    }
  }, [isDragging, tooltip]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  const handleResetView = useCallback(() => {
    if (!containerRef.current) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const { width, height } = containerRef.current.getBoundingClientRect();
    const resetZoom = 1;
    setZoom(resetZoom);
    const centeredPan = {
      x: width / 2 - (totalWidth * resetZoom) / 2,
      y: height / 2 - (totalHeight * resetZoom) / 2,
    };
    setPan(clampPan(centeredPan, resetZoom));
  }, [clampPan, totalWidth, totalHeight]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden relative">
      {tooltip && (
        <div
          className="fixed z-[9999] bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-2xl pointer-events-none whitespace-pre-line border border-gray-700"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, calc(-100% - 12px))',
            maxWidth: '300px',
            animation: 'tooltipFadeIn 0.15s ease-out',
          }}
        >
          <div className="relative">
            <div className="font-mono leading-relaxed">{tooltip.content}</div>
            {/* Arrow pointing down */}
            <div
              className="absolute left-1/2 top-full -translate-x-1/2 -mt-px"
              style={{
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid #111827',
              }}
            />
          </div>
          <style>{`
            @keyframes tooltipFadeIn {
              from {
                opacity: 0;
                transform: translate(-50%, calc(-100% - 8px)) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translate(-50%, calc(-100% - 12px)) scale(1);
              }
            }
          `}</style>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-12 bg-green-500 rounded"></div>
          <span className="text-xs text-gray-600">CLEAR</span>
          <div className="h-1.5 w-12 bg-red-600 rounded"></div>
          <span className="text-xs text-gray-600">OCCUPIED</span>
        </div>
        <div className="text-xs text-gray-500 font-mono">
          {update?.currentTime
            ? new Date(update.currentTime).toLocaleTimeString()
            : "--:--:--"}
        </div>
      </div>

      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMapMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleResetView}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg
          ref={svgRef}
          width={totalWidth}
          height={totalHeight}
          className="control-room-diagram"
          style={{
            backgroundColor: "#ffffff",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Arrowhead for merge lines */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
          </marker>
        </defs>

        {trackLayout.layout.map((track) => {
          const pipeline = pipelines.get(track.id);
          const isFrozen = pipeline?.isFrozen || false;
          
          // Find trains on this track to determine occupied sections
          const trainsOnTrack = Array.from(trains.values()).filter(
            (train) => train.currentPipeline === track.id
          );
          
          // Track is occupied if there's a train on it or if it's frozen
          const isOccupied = trainsOnTrack.length > 0 || isFrozen;
          const trackLength = track.toPos - track.fromPos; // Actual track length in meters
          const baseTrackColor = isOccupied ? "#dc2626" : "#22c55e"; // Red if occupied, green otherwise

          // Calculate signal positions on curved path
          const getPointOnCurve = (t: number) => {
            const trackNum = parseInt(track.id.replace("P", ""));
            const variation = Math.sin(trackNum * 0.7) * 5;
            const curveAmount = variation;
            const midX = track.x + track.length / 2;
            const midY = track.y + TRACK_HEIGHT / 2;
            const controlY = midY + curveAmount;
            const x = (1 - t) * (1 - t) * track.x + 2 * (1 - t) * t * midX + t * t * (track.x + track.length);
            const y = (1 - t) * (1 - t) * midY + 2 * (1 - t) * t * controlY + t * t * midY;
            return { x, y };
          };
          
          const signals = [
            { pos: 0.25, id: generateSignalId(track.id, track.fromPos), point: getPointOnCurve(0.25) },
            { pos: 0.5, id: generateSignalId(track.id, track.fromPos + 1250), point: getPointOnCurve(0.5) },
            { pos: 0.75, id: generateSignalId(track.id, track.fromPos + 1875), point: getPointOnCurve(0.75) },
          ];

          const trackTooltip = `Pipeline: ${track.id}\nBlock: ${generateBlockId(track.id)}\nStatus: ${isFrozen ? "FROZEN" : trainsOnTrack.length > 0 ? "OCCUPIED" : pipeline?.nextTrain ? "NEXT TRAIN APPROACHING" : "CLEAR"}\n${pipeline?.occupiedBy ? `Occupied by: ${pipeline.occupiedBy}` : ""}\n${pipeline?.nextTrain ? `Next train: ${pipeline.nextTrain}` : ""}\n${pipeline?.nextNextTrain ? `Following: ${pipeline.nextNextTrain}` : ""}\nLength: ${(trackLength / 1000).toFixed(1)} km`;

          return (
            <g key={track.id}>

              {/* Invisible larger hover area */}
              <rect
                x={track.x - 5}
                y={track.y - 10}
                width={track.length + 10}
                height={TRACK_HEIGHT + 20}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(e, trackTooltip)}
                onMouseMove={(e) => handleMouseMove(e, trackTooltip)}
                onMouseLeave={handleMouseLeave}
              />
              
              {/* Base track with curves - red if occupied/frozen, green otherwise */}
              {(() => {
                // Add gentle curves to tracks - vary by track number for realism
                const trackNum = parseInt(track.id.replace("P", ""));
                // Create smooth sinusoidal curves that vary by track
                const variation = Math.sin(trackNum * 0.7) * 5; // -5 to +5 pixel variation
                const curveAmount = variation;
                
                const midX = track.x + track.length / 2;
                const midY = track.y + TRACK_HEIGHT / 2;
                const controlY = midY + curveAmount;
                
                // Create curved path using quadratic bezier
                const pathData = `M ${track.x} ${midY} Q ${midX} ${controlY} ${track.x + track.length} ${midY}`;
                
                return (
                  <g>
                    {/* Track path with curve */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={baseTrackColor}
                      strokeWidth={TRACK_HEIGHT}
                      strokeLinecap="round"
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnter(e, trackTooltip)}
                      onMouseMove={(e) => handleMouseMove(e, trackTooltip)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <title>{trackTooltip}</title>
                    </path>
                    {/* Track outline */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={isOccupied ? "#dc2626" : "#4ade80"}
                      strokeWidth={isOccupied ? 2.5 : 1.5}
                      strokeLinecap="round"
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnter(e, trackTooltip)}
                      onMouseMove={(e) => handleMouseMove(e, trackTooltip)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <title>{trackTooltip}</title>
                    </path>
                  </g>
                );
              })()}
              
              

              {/* Track ID and Block - more compact */}
              <g>
                <rect
                  x={track.x - 45}
                  y={track.y - 2}
                  width={40}
                  height={TRACK_HEIGHT + 4}
                  fill={track.group === "express" ? "#f3e8ff" : "#eff6ff"}
                  stroke={track.group === "express" ? "#9333ea" : "#3b82f6"}
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={track.x - 25}
                  y={track.y + TRACK_HEIGHT / 2 + 4}
                  fill={track.group === "express" ? "#9333ea" : "#3b82f6"}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {track.id}
                </text>
              </g>

              {/* Block sections - simplified, only show divider lines, positioned on curve */}
              {[0.33, 0.67].map((pos, idx) => {
                const trackNum = parseInt(track.id.replace("P", ""));
                const variation = Math.sin(trackNum * 0.7) * 5;
                const curveAmount = variation;
                const midX = track.x + track.length / 2;
                const midY = track.y + TRACK_HEIGHT / 2;
                const controlY = midY + curveAmount;
                const t = pos;
                const x = (1 - t) * (1 - t) * track.x + 2 * (1 - t) * t * midX + t * t * (track.x + track.length);
                const y = (1 - t) * (1 - t) * midY + 2 * (1 - t) * t * controlY + t * t * midY;
                const sectionId = `${generateBlockId(track.id)}-${idx + 1}`;
                const sectionTooltip = `Block Section: ${sectionId}\nPipeline: ${track.id}`;
                return (
                  <g key={`section-${pos}`}>
                    <line
                      x1={x}
                      x2={x}
                      y1={y - 3}
                      y2={y + TRACK_HEIGHT + 3}
                      stroke="#d1d5db"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                      opacity={0.5}
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnter(e, sectionTooltip)}
                      onMouseMove={(e) => handleMouseMove(e, sectionTooltip)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <title>{sectionTooltip}</title>
                    </line>
                  </g>
                );
              })}


              {/* Signals - simplified, only show critical ones, positioned on curve */}
              {signals.filter((_, idx) => idx === signals.length - 1).map((signal) => {
                const signalState = trainsOnTrack.length > 0 ? "red" : 
                                  pipeline?.nextTrain ? "yellow" : "green";
                const signalTooltip = `Signal: ${signal.id}\nState: ${signalState.toUpperCase()}\nPipeline: ${track.id}`;
                const signalPoint = (signal as any).point;
                return (
                  <g key={signal.id}>
                    <circle
                      cx={signalPoint.x}
                      cy={signalPoint.y - 10}
                      r={8}
                      fill={signalState === "red" ? "#dc2626" : signalState === "yellow" ? "#fbbf24" : "#4ade80"}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnter(e, signalTooltip)}
                      onMouseMove={(e) => handleMouseMove(e, signalTooltip)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <title>{signalTooltip}</title>
                    </circle>
                  </g>
                );
              })}

              {track.fromStation && (() => {
                const stationId = track.fromStation;
                const platforms = trackLayout.stationPlatforms[stationId] || [];
                const stationName = trackLayout.stationNames[stationId] || "Unknown";
                const platformLength = STATION_WIDTH;
                const splitPointX = track.stationX!;
                
                // Find trains assigned to this station's platforms
                const trainsAtStation = Array.from(trains.values()).filter(
                  (t) => t.platform !== null && t.platform !== undefined
                );
                
                // Get occupied platforms for this station
                const occupiedPlatforms = new Set(
                  trainsAtStation
                    .filter((t) => {
                      return t.currentPipeline === track.id || 
                             (t.nextPipeline && t.nextPipeline === track.id);
                    })
                    .map((t) => t.platform)
                    .filter((p): p is number => p !== null && p !== undefined)
                );

                const trainsList = trainsAtStation
                  .filter((t) => occupiedPlatforms.has(t.platform!))
                  .map((t) => `  ${t.id} → PF${t.platform}`)
                  .join("\n");

                return (
                  <g>
                    {/* Station name label */}
                    <text
                      x={splitPointX + platformLength / 2}
                      y={track.y - 30}
                      fill="#1f2937"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {stationName}
                    </text>

                    {/* Split point - where main track branches into platforms */}
                    <circle
                      cx={splitPointX}
                      cy={track.y + TRACK_HEIGHT / 2}
                      r={5}
                      fill="#fbbf24"
                      stroke="#1f2937"
                      strokeWidth={1.5}
                    />
                    <text
                      x={splitPointX}
                      y={track.y + TRACK_HEIGHT + 15}
                      fill="#6b7280"
                      fontSize="7"
                      textAnchor="middle"
                    >
                      {generatePointId(track.id)}
                    </text>

                    {/* Platform tracks - split from main track and merge back */}
                    {platforms.map((pf, idx) => {
                      const isOccupied = occupiedPlatforms.has(pf);
                      const platformY = track.y + (idx - (platforms.length - 1) / 2) * (TRACK_HEIGHT + TRACK_SPACING / 2);
                      const platformColor = isOccupied ? "#dc2626" : "#22c55e";
                      const platformTooltip = `Platform ${pf}\nStation: ${stationName}\n${isOccupied ? "OCCUPIED" : "CLEAR"}\n${trainsList ? `Train: ${trainsList.split("→")[0].trim()}` : ""}`;
                      const mergePointX = splitPointX + platformLength;

                      return (
                        <g key={pf}>
                          {/* Split line from main track to platform */}
                          <path
                            d={`M ${splitPointX} ${track.y + TRACK_HEIGHT / 2} L ${splitPointX + 20} ${platformY + TRACK_HEIGHT / 2}`}
                            stroke="#6b7280"
                            strokeWidth={2}
                            fill="none"
                            strokeDasharray="3,2"
                          />
                          
                          {/* Platform track section */}
                          <rect
                            x={splitPointX + 20}
                            y={platformY}
                            width={platformLength - 40}
                            height={TRACK_HEIGHT}
                            fill={platformColor}
                            stroke={isOccupied ? "#dc2626" : "#4ade80"}
                            strokeWidth={isOccupied ? 3 : 2}
                            rx={2}
                            className="cursor-pointer"
                            onMouseEnter={(e) => {
                              handleMouseEnter(e, platformTooltip);
                            }}
                            onMouseMove={(e) => {
                              handleMouseMove(e, platformTooltip);
                            }}
                            onMouseLeave={handleMouseLeave}
                          >
                            <title>{platformTooltip}</title>
                          </rect>

                          {/* Merge line from platform back to main track */}
                          <path
                            d={`M ${mergePointX - 20} ${platformY + TRACK_HEIGHT / 2} L ${mergePointX} ${track.y + TRACK_HEIGHT / 2}`}
                            stroke="#6b7280"
                            strokeWidth={2}
                            fill="none"
                            strokeDasharray="3,2"
                          />

                          {/* Platform label */}
                          <text
                            x={splitPointX + platformLength / 2}
                            y={platformY + TRACK_HEIGHT / 2 + 4}
                            fill="#1f2937"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            PF{pf}
                          </text>

                          {/* Platform number badge */}
                          <circle
                            cx={splitPointX + 30}
                            cy={platformY + TRACK_HEIGHT / 2}
                            r={7}
                            fill={isOccupied ? "#f59e0b" : "#3b82f6"}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                          />
                          <text
                            x={splitPointX + 30}
                            y={platformY + TRACK_HEIGHT / 2 + 4}
                            fill="#ffffff"
                            fontSize="8"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {pf}
                          </text>

                          {/* Merge point at end of platform */}
                          <circle
                            cx={mergePointX - 20}
                            cy={platformY + TRACK_HEIGHT / 2}
                            r={4}
                            fill="#fbbf24"
                            stroke="#1f2937"
                            strokeWidth={1}
                          />
                        </g>
                      );
                    })}

                    {/* Merge point - where all platforms converge back into main track */}
                    <circle
                      cx={splitPointX + platformLength}
                      cy={track.y + TRACK_HEIGHT / 2}
                      r={5}
                      fill="#fbbf24"
                      stroke="#1f2937"
                      strokeWidth={1.5}
                    />
                    <text
                      x={splitPointX + platformLength}
                      y={track.y + TRACK_HEIGHT + 15}
                      fill="#6b7280"
                      fontSize="7"
                      textAnchor="middle"
                    >
                      {generatePointId(track.id)}-M
                    </text>
                  </g>
                );
              })()}

              {track.toStation && (() => {
                const stationId = track.toStation;
                const platforms = trackLayout.stationPlatforms[stationId] || [];
                const stationName = trackLayout.stationNames[stationId] || "Unknown";
                const platformLength = STATION_WIDTH;
                const mergePointX = track.x + track.length;
                
                // Find trains assigned to this station's platforms
                const trainsAtStation = Array.from(trains.values()).filter(
                  (t) => t.platform !== null && t.platform !== undefined
                );
                
                // Get occupied platforms for this station
                const occupiedPlatforms = new Set(
                  trainsAtStation
                    .filter((t) => {
                      return t.currentPipeline === track.id || 
                             (t.nextPipeline && t.nextPipeline === track.id);
                    })
                    .map((t) => t.platform)
                    .filter((p): p is number => p !== null && p !== undefined)
                );

                const trainsList = trainsAtStation
                  .filter((t) => occupiedPlatforms.has(t.platform!))
                  .map((t) => `  ${t.id} → PF${t.platform}`)
                  .join("\n");

                return (
                  <g>
                    {/* Station name label */}
                    <text
                      x={mergePointX - platformLength / 2}
                      y={track.y - 30}
                      fill="#1f2937"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {stationName}
                    </text>

                    {/* Split point - where main track branches into platforms (before station) */}
                    <circle
                      cx={mergePointX - platformLength}
                      cy={track.y + TRACK_HEIGHT / 2}
                      r={5}
                      fill="#fbbf24"
                      stroke="#1f2937"
                      strokeWidth={1.5}
                    />
                    <text
                      x={mergePointX - platformLength}
                      y={track.y + TRACK_HEIGHT + 15}
                      fill="#6b7280"
                      fontSize="7"
                      textAnchor="middle"
                    >
                      {generatePointId(track.id)}-S
                    </text>

                    {/* Platform tracks - split from main track and merge back */}
                    {platforms.map((pf, idx) => {
                      const isOccupied = occupiedPlatforms.has(pf);
                      const platformY = track.y + (idx - (platforms.length - 1) / 2) * (TRACK_HEIGHT + TRACK_SPACING / 2);
                      const platformColor = isOccupied ? "#dc2626" : "#22c55e";
                      const platformTooltip = `Platform ${pf}\nStation: ${stationName}\n${isOccupied ? "OCCUPIED" : "CLEAR"}\n${trainsList ? `Train: ${trainsList.split("→")[0].trim()}` : ""}`;
                      const splitPointX = mergePointX - platformLength;

                      return (
                        <g key={pf}>
                          {/* Split line from main track to platform */}
                          <path
                            d={`M ${splitPointX} ${track.y + TRACK_HEIGHT / 2} L ${splitPointX + 20} ${platformY + TRACK_HEIGHT / 2}`}
                            stroke="#6b7280"
                            strokeWidth={2}
                            fill="none"
                            strokeDasharray="3,2"
                          />

                          {/* Platform track section */}
                          <rect
                            x={splitPointX + 20}
                            y={platformY}
                            width={platformLength - 40}
                            height={TRACK_HEIGHT}
                            fill={platformColor}
                            stroke={isOccupied ? "#dc2626" : "#4ade80"}
                            strokeWidth={isOccupied ? 3 : 2}
                            rx={2}
                            className="cursor-pointer"
                            onMouseEnter={(e) => {
                              handleMouseEnter(e, platformTooltip);
                            }}
                            onMouseMove={(e) => {
                              handleMouseMove(e, platformTooltip);
                            }}
                            onMouseLeave={handleMouseLeave}
                          >
                            <title>{platformTooltip}</title>
                          </rect>

                          {/* Merge line from platform to main track */}
                          <path
                            d={`M ${mergePointX - 20} ${platformY + TRACK_HEIGHT / 2} L ${mergePointX} ${track.y + TRACK_HEIGHT / 2}`}
                            stroke="#6b7280"
                            strokeWidth={2}
                            fill="none"
                            strokeDasharray="3,2"
                          />

                          {/* Platform label */}
                          <text
                            x={splitPointX + platformLength / 2}
                            y={platformY + TRACK_HEIGHT / 2 + 4}
                            fill="#1f2937"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            PF{pf}
                          </text>

                          {/* Platform number badge */}
                          <circle
                            cx={splitPointX + 30}
                            cy={platformY + TRACK_HEIGHT / 2}
                            r={7}
                            fill={isOccupied ? "#f59e0b" : "#3b82f6"}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                          />
                          <text
                            x={splitPointX + 30}
                            y={platformY + TRACK_HEIGHT / 2 + 4}
                            fill="#ffffff"
                            fontSize="8"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {pf}
                          </text>

                          {/* Split point at start of platform */}
                          <circle
                            cx={splitPointX + 20}
                            cy={platformY + TRACK_HEIGHT / 2}
                            r={4}
                            fill="#fbbf24"
                            stroke="#1f2937"
                            strokeWidth={1}
                          />

                          {/* Merge point at end of platform */}
                          <circle
                            cx={mergePointX - 20}
                            cy={platformY + TRACK_HEIGHT / 2}
                            r={4}
                            fill="#fbbf24"
                            stroke="#1f2937"
                            strokeWidth={1}
                          />
                        </g>
                      );
                    })}

                    {/* Merge point - where all platforms converge into main track */}
                    <circle
                      cx={mergePointX}
                      cy={track.y + TRACK_HEIGHT / 2}
                      r={5}
                      fill="#fbbf24"
                      stroke="#1f2937"
                      strokeWidth={1.5}
                    />
                    <text
                      x={mergePointX}
                      y={track.y + TRACK_HEIGHT + 15}
                      fill="#6b7280"
                      fontSize="7"
                      textAnchor="middle"
                    >
                      {generatePointId(track.id)}-M
                    </text>
                  </g>
                );
              })()}

              {/* Track Merge Points */}
              {track.mergePoint && (() => {
                const mergeX = track.x + (track.mergePoint - track.fromPos) * SCALE;
                const mergeTooltip = `Track Merge Point\nPipeline: ${track.id}\nPosition: ${(track.mergePoint / 1000).toFixed(1)} km\n⚠ Multiple tracks merge here`;
                
                // Find the other track that merges at this point
                const mergingTrack = trackLayout.layout.find(
                  t => t.id !== track.id && t.mergePoint === track.mergePoint
                );
                
                return (
                  <g key={`merge-${track.mergePoint}`}>
                    {/* Merge indicator circle */}
                    <circle
                      cx={mergeX}
                      cy={track.y + TRACK_HEIGHT / 2}
                      r={8}
                      fill="#3b82f6"
                      stroke="#1e40af"
                      strokeWidth={2}
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnter(e, mergeTooltip)}
                      onMouseMove={(e) => handleMouseMove(e, mergeTooltip)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <title>{mergeTooltip}</title>
                    </circle>
                    {/* Merge arrow */}
                    <path
                      d={`M ${mergeX - 6} ${track.y + TRACK_HEIGHT / 2 - 3} L ${mergeX} ${track.y + TRACK_HEIGHT / 2} L ${mergeX - 6} ${track.y + TRACK_HEIGHT / 2 + 3}`}
                      fill="#1e40af"
                      stroke="#1e40af"
                      strokeWidth={1}
                    />
                    {/* Merge label */}
                    <text
                      x={mergeX}
                      y={track.y - 8}
                      fill="#1e40af"
                      fontSize="8"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      MERGE
                    </text>
                    {/* Draw merge line from other track if it exists */}
                    {mergingTrack && (
                      <line
                        x1={mergingTrack.x + (mergingTrack.mergePoint! - mergingTrack.fromPos) * SCALE}
                        y1={mergingTrack.y + TRACK_HEIGHT / 2}
                        x2={mergeX}
                        y2={track.y + TRACK_HEIGHT / 2}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="4,2"
                        opacity={0.6}
                        markerEnd="url(#arrowhead)"
                      />
                    )}
                  </g>
                );
              })()}


              {pipeline && (
                <>
                  <text
                    x={track.x + track.length / 2}
                    y={track.y - 12}
                    fill={trainsOnTrack.length > 0 ? "#dc2626" : "#4ade80"}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {trainsOnTrack.length > 0 ? `OCC: ${trainsOnTrack.map(t => t.id).join(", ")}` : "CLEAR"}
                  </text>
                  
                  {pipeline.nextTrain && (
                    <text
                      x={track.x + track.length / 2}
                      y={track.y + TRACK_HEIGHT + 15}
                      fill="#d97706"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      NEXT: {pipeline.nextTrain}
                    </text>
                  )}

                  {pipeline.nextNextTrain && (
                    <text
                      x={track.x + track.length / 2}
                      y={track.y + TRACK_HEIGHT + 28}
                      fill="#f59e0b"
                      fontSize="8"
                      textAnchor="middle"
                    >
                      NEXT+1: {pipeline.nextNextTrain}
                    </text>
                  )}

                  {isFrozen && (
                    <text
                      x={track.x + track.length / 2}
                      y={track.y + TRACK_HEIGHT / 2 + 4}
                      fill="#1f2937"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      STOP
                    </text>
                  )}
                </>
              )}

              {Array.from(trains.values())
                .filter((train) => train.currentPipeline === track.id)
                .map((train) => {
                  // Calculate position on curved path
                  const trackNum = parseInt(track.id.replace("P", ""));
                  const variation = Math.sin(trackNum * 0.7) * 5;
                  const curveAmount = variation;
                  const midX = track.x + track.length / 2;
                  const midY = track.y + TRACK_HEIGHT / 2;
                  const controlY = midY + curveAmount;
                  
                  // Get position along track (0 to trackLength)
                  const actualTrackLength = track.toPos - track.fromPos;
                  const positionPercent = Math.min(100, (train.position / actualTrackLength) * 100);
                  const t = positionPercent / 100; // Parameter along the curve (0 to 1)
                  
                  // Quadratic bezier: B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
                  const x = (1 - t) * (1 - t) * track.x + 2 * (1 - t) * t * midX + t * t * (track.x + track.length);
                  const y = (1 - t) * (1 - t) * midY + 2 * (1 - t) * t * controlY + t * t * midY;
                  
                  const trainClass = train.class || TrainClass.AC_LOCAL;
                  const isFocused = focusedTrainId === train.id;
                  
                  const trainTooltip = `Train: ${train.id}\nClass: ${train.class || "N/A"}\nState: ${train.state}\nSpeed: ${train.speed.toFixed(1)} m/s\nPosition: ${train.position.toFixed(0)} m\nPipeline: ${train.currentPipeline}\nNext: ${train.nextPipeline || "N/A"}\nDelay: ${train.delay > 0 ? train.delay.toFixed(0) + "s" : "On time"}\n${train.platform !== null ? `Platform: ${train.platform}` : ""}`;
                  
                  return (
                    <g
                      key={train.id}
                      onClick={() => onTrainClick?.(train.id)}
                      style={{ cursor: onTrainClick ? "pointer" : "default" }}
                    >
                      {/* Invisible larger hover area for train */}
                      <circle
                        cx={x}
                        cy={y}
                        r={35}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={(e) => handleMouseEnter(e, trainTooltip)}
                        onMouseMove={(e) => handleMouseMove(e, trainTooltip)}
                        onMouseLeave={handleMouseLeave}
                      />
                      
                      <g
                        onMouseEnter={(e) => handleMouseEnter(e, trainTooltip)}
                        onMouseMove={(e) => handleMouseMove(e, trainTooltip)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {isFocused && (
                          <circle
                            cx={x}
                            cy={y}
                            r={38}
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth={3}
                            strokeDasharray="6 4"
                          >
                            <animate
                              attributeName="r"
                              values="32;40;32"
                              dur="1.2s"
                              repeatCount="indefinite"
                            />
                          </circle>
                        )}
                        <TrainMarker
                          train={train}
                          x={x}
                          y={y}
                          color={getTrainClassColor(trainClass)}
                        />
                      {/* Train number label - simplified */}
                      <text
                        x={x}
                        y={y - 12}
                        fill="#1f2937"
                        fontSize="11"
                        fontWeight="bold"
                        textAnchor="middle"
                        style={{ textShadow: "0 1px 2px rgba(255,255,255,0.9)" }}
                      >
                        {train.id}
                      </text>
                      
                      </g>
                    </g>
                  );
                })}
            </g>
          );
        })}

        {/* Station labels at top - Mumbai Central Line */}
        {["S1", "S2", "S3", "S4", "S5", "S6"].map((stationId, idx) => {
          const stationPositions = [0, 2500, 5000, 8000, 11000, 15000];
          const stationX = stationPositions[idx] * SCALE;
          
          return (
            <g key={stationId}>
              <text
                x={stationX}
                y={40}
                fill="#1f2937"
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
              >
                {trackLayout.stationNames[stationId]}
              </text>
              {idx < 5 && (
                <line
                  x1={stationX}
                  y1={50}
                  x2={stationX}
                  y2={totalHeight - 20}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                  opacity="0.4"
                />
              )}
            </g>
          );
        })}
        
        {/* Group separators */}
        <line
          x1={0}
          y1={70 + upLocalHeight + 12}
          x2={totalWidth}
          y2={70 + upLocalHeight + 12}
          stroke="#e5e7eb"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity="0.5"
        />
        <line
          x1={0}
          y1={70 + upLocalHeight + GROUP_SPACING + upExpressHeight + 12}
          x2={totalWidth}
          y2={70 + upLocalHeight + GROUP_SPACING + upExpressHeight + 12}
          stroke="#dc2626"
          strokeWidth={2}
          strokeDasharray="6,6"
          opacity="0.6"
        />
        <line
          x1={0}
          y1={70 + upLocalHeight + GROUP_SPACING + upExpressHeight + GROUP_SPACING + downLocalHeight + 12}
          x2={totalWidth}
          y2={70 + upLocalHeight + GROUP_SPACING + upExpressHeight + GROUP_SPACING + downLocalHeight + 12}
          stroke="#e5e7eb"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity="0.5"
        />

        </svg>
        
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white border border-gray-200 rounded shadow-lg p-1 z-10">
          <button
            onClick={() => setZoom(prev => Math.min(prev + 0.2, 3))}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.3))}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      </div>
    </div>
  );
};
