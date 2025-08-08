"use client";

import { useStore } from "@nanostores/react";
import {
  $plankDimensions,
  $planks,
  $spares,
  $gaps,
  $isPlacingPlank,
  plankActions,
} from "../stores/plankStore";
import { $isComplete } from "../stores/polygonStore";

export default function PlankConfigPanel() {
  const plankDimensions = useStore($plankDimensions);
  const planks = useStore($planks);
  const spares = useStore($spares);
  const gaps = useStore($gaps);
  const isPlacingPlank = useStore($isPlacingPlank);
  const isComplete = useStore($isComplete);

  return (
    <div className="mb-3 p-3 bg-white rounded-lg border">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">
        Plank Configuration
      </h3>
      
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="plank-length"
            className="text-xs text-gray-600 min-w-[40px]"
          >
            Length:
          </label>
          <input
            id="plank-length"
            type="number"
            value={plankDimensions.length}
            onChange={(e) =>
              plankActions.setPlankLength(Number(e.target.value))
            }
            className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            min="100"
            max="5000"
            step="10"
          />
          <span className="text-xs text-gray-500">mm</span>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="plank-width"
            className="text-xs text-gray-600 min-w-[35px]"
          >
            Width:
          </label>
          <input
            id="plank-width"
            type="number"
            value={plankDimensions.width}
            onChange={(e) =>
              plankActions.setPlankWidth(Number(e.target.value))
            }
            className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            min="50"
            max="1000"
            step="5"
          />
          <span className="text-xs text-gray-500">mm</span>
        </div>
      </div>

      {isComplete && (
        <div className="flex items-center gap-2">
          <button
            onClick={plankActions.startPlacingPlank}
            disabled={isPlacingPlank}
            className="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPlacingPlank ? "Click to Place Plank" : "Place First Plank"}
          </button>
          {planks.length > 0 && (
            <button
              onClick={plankActions.clearPlanks}
              className="px-3 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
            >
              Clear Planks ({planks.length})
            </button>
          )}
        </div>
      )}

      {/* Spares and Gaps Information */}
      {(spares.length > 0 || gaps.length > 0) && (
        <div className="flex items-center gap-4 text-xs mt-2">
          {spares.length > 0 && (
            <div className="text-green-700">
              <span className="font-medium">Spares:</span> {spares.length}{" "}
              pieces
              {spares.map((spare, idx) => (
                <span key={spare.id} className="ml-1">
                  {idx > 0 && ", "}
                  {spare.length}mm
                </span>
              ))}
            </div>
          )}
          {gaps.length > 0 && (
            <div className="text-red-700">
              <span className="font-medium">Unfilled Gaps:</span>{" "}
              {gaps.length}
            </div>
          )}
        </div>
      )}

      {/* Color Legend */}
      {planks.length > 0 && (
        <div className="flex items-center gap-4 text-xs mt-2 p-2 bg-gray-50 rounded">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-800 rounded-sm" />
            <span>Full Planks</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded-sm" />
            <span>Cut Planks</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500 rounded-sm" />
            <span>Shape-Cut Planks</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-pink-500 rounded-sm" />
            <span>Multi-Line Cut Planks</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-sm" />
            <span>Spare Pieces</span>
          </div>
          {gaps.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-red-500 border-dashed rounded-sm bg-red-200" />
              <span>Gaps</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}