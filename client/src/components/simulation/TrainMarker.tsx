import React from "react";
import { TrainUpdate, TrainState } from "../../types/simulation.types";

interface TrainMarkerProps {
  train: TrainUpdate;
  x: number;
  y: number;
  color: string;
}

export const TrainMarker: React.FC<TrainMarkerProps> = ({ train, x, y, color }) => {
  const isEmergency = train.state === TrainState.EMERGENCY;
  
  return (
    <g>
      {/* Outer glow/shadow circle */}
      <circle
        cx={x}
        cy={y}
        r={18}
        fill={isEmergency ? "#dc2626" : color}
        opacity={0.3}
      />
      <circle
        cx={x}
        cy={y}
        r={14}
        fill={isEmergency ? "#dc2626" : color}
        opacity={0.5}
      />
      
      {/* Main train body - larger */}
      <rect
        x={x - 18}
        y={y - 10}
        width={36}
        height={20}
        fill={isEmergency ? "#dc2626" : color}
        stroke="#ffffff"
        strokeWidth={isEmergency ? 3 : 2.5}
        rx={4}
        className="transition-all duration-300"
        filter="url(#glow)"
      />
      
      {/* Inner highlight */}
      <rect
        x={x - 16}
        y={y - 8}
        width={32}
        height={16}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1}
        rx={3}
      />
      
      {isEmergency && (
        <animate
          attributeName="opacity"
          values="1;0.5;1"
          dur="1s"
          repeatCount="indefinite"
        />
      )}
      
      {/* Train ID text - larger and more visible */}
      <text
        x={x}
        y={y + 5}
        textAnchor="middle"
        fill="#ffffff"
        fontSize="11"
        fontWeight="bold"
        style={{ textShadow: "0 0 4px rgba(0,0,0,0.8)" }}
      >
        {train.id}
      </text>
      
      {/* Direction indicator arrow */}
      <polygon
        points={`${x + 12},${y - 2} ${x + 20},${y} ${x + 12},${y + 2}`}
        fill="#ffffff"
        opacity={0.9}
      />
    </g>
  );
};


