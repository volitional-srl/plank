"use client";

import { useStore } from "@nanostores/react";
import {
  $points,
  $isComplete,
  $polygonArea,
  $polygonPerimeter,
  unitUtils,
} from "../stores/polygonStore";

export default function MeasurementsPanel() {
  const points = useStore($points);
  const isComplete = useStore($isComplete);
  const polygonArea = useStore($polygonArea);
  const polygonPerimeter = useStore($polygonPerimeter);

  if (points.length === 0) return null;

  return (
    <div className="mb-3 p-2 bg-white rounded-lg border">
      <div className="flex items-center gap-6 text-sm">
        <div className="text-gray-600">
          <span className="font-medium">Points:</span> {points.length}
        </div>
        {points.length >= 2 && (
          <div className="text-gray-600">
            <span className="font-medium">Perimeter:</span>{" "}
            {unitUtils.formatMm(polygonPerimeter)}
          </div>
        )}
        {isComplete && polygonArea > 0 && (
          <div className="text-gray-600">
            <span className="font-medium">Area:</span>{" "}
            {unitUtils.formatArea(polygonArea)}
          </div>
        )}
      </div>
    </div>
  );
}