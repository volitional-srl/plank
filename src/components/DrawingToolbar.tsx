"use client";

import { useStore } from "@nanostores/react";
import {
  $angleSnapEnabled,
  $gridSnapEnabled,
  $isShiftPressed,
  gridActions,
} from "../stores/gridStore";
import {
  $currentZoom,
  $canZoomIn,
  $canZoomOut,
  cameraActions,
} from "../stores/cameraStore";

export default function DrawingToolbar() {
  const angleSnapEnabled = useStore($angleSnapEnabled);
  const gridSnapEnabled = useStore($gridSnapEnabled);
  const isShiftPressed = useStore($isShiftPressed);
  const currentZoom = useStore($currentZoom);
  const canZoomIn = useStore($canZoomIn);
  const canZoomOut = useStore($canZoomOut);

  return (
    <div className="flex items-center gap-4 mb-3 p-2 bg-white rounded-lg border">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={gridActions.toggleAngleSnap}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              angleSnapEnabled
                ? "bg-green-100 text-green-800 border border-green-300"
                : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full ${angleSnapEnabled ? "bg-green-500" : "bg-gray-400"}`}
            />
            Angle Snap
          </button>
          <span className="text-xs text-gray-500">
            {angleSnapEnabled ? "ON" : "OFF"}{" "}
            {isShiftPressed && "(SHIFT held)"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={gridActions.toggleGridSnap}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              gridSnapEnabled
                ? "bg-blue-100 text-blue-800 border border-blue-300"
                : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
            }`}
          >
            <div
              className={`w-3 h-3 rounded-sm ${gridSnapEnabled ? "bg-blue-500" : "bg-gray-400"}`}
            />
            Grid Snap
          </button>
          <span className="text-xs text-gray-500">
            {gridSnapEnabled ? "100mm" : "OFF"}
          </span>
        </div>

        <div className="flex items-center gap-1 border-l border-gray-300 pl-4">
          <button
            onClick={cameraActions.zoomOut}
            disabled={!canZoomOut}
            className="p-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom Out"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <span className="text-xs text-gray-600 min-w-[3rem] text-center">
            {Math.round(currentZoom * 100)}%
          </span>
          <button
            onClick={cameraActions.zoomIn}
            disabled={!canZoomIn}
            className="p-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom In"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="11" y1="8" x2="11" y2="14" />
            </svg>
          </button>
          <button
            onClick={cameraActions.resetZoom}
            className="text-xs text-gray-600 hover:text-gray-800 ml-1"
            title="Reset"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}