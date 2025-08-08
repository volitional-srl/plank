"use client";

import { useStore } from "@nanostores/react";
import { $points, $isComplete } from "../stores/polygonStore";
import { $isAngleSnapActive, $isGridSnapActive } from "../stores/gridStore";

export default function StatusDisplay() {
  const points = useStore($points);
  const isComplete = useStore($isComplete);
  const isAngleSnapActive = useStore($isAngleSnapActive);
  const isGridSnapActive = useStore($isGridSnapActive);

  return (
    <p className="text-sm text-gray-600">
      {isComplete
        ? `Polygon complete with ${points.length} points`
        : `Click to add points (${points.length} added)${
            isAngleSnapActive || isGridSnapActive
              ? ` - ${[
                  isAngleSnapActive && "Angle snap",
                  isGridSnapActive && "Grid snap",
                ]
                  .filter(Boolean)
                  .join(" + ")} active`
              : ""
          } - Hold SPACE to pan or use middle mouse button`}
    </p>
  );
}