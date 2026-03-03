"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

function AgentEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as { active?: boolean; label?: string } | undefined;
  const isActive = edgeData?.active ?? false;
  const label = edgeData?.label;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isActive ? "#22c55e" : "#475569",
          strokeWidth: isActive ? 2 : 1.5,
          strokeDasharray: isActive ? undefined : "4 3",
          filter: isActive ? "drop-shadow(0 0 4px rgba(34,197,94,0.6))" : undefined,
          transition: "all 0.4s ease",
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="bg-slate-800 text-slate-300 text-xs px-1.5 py-0.5 rounded border border-slate-600"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const AgentEdge = memo(AgentEdgeComponent);
