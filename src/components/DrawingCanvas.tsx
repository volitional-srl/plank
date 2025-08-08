"use client";

import { useRef, useEffect, type ReactNode } from "react";
import { useStore } from "@nanostores/react";
import { cameraActions, $isPanning, $isSpacePressed, $zoomTransform } from "../stores/cameraStore";
import { gridActions, $gridSnapEnabled } from "../stores/gridStore";
import type { Point } from "../lib/geometry";

interface DrawingCanvasProps {
  children: ReactNode;
  onMouseMove: (canvasPoint: Point) => void;
  onCanvasClick: (canvasPoint: Point) => void;
}

export default function DrawingCanvas({ children, onMouseMove, onCanvasClick }: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useStore($isPanning);
  const isSpacePressed = useStore($isSpacePressed);
  const zoomTransform = useStore($zoomTransform);
  const gridSnapEnabled = useStore($gridSnapEnabled);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        gridActions.setShiftPressed(true);
      } else if (event.key === " ") {
        event.preventDefault();
        cameraActions.setSpacePressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        gridActions.setShiftPressed(false);
      } else if (event.key === " ") {
        cameraActions.setSpacePressed(false);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const mouseX = event.clientX;
      const mouseY = event.clientY;

      if (
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      ) {
        event.preventDefault();

        if (event.deltaY < 0) {
          cameraActions.zoomIn();
        } else {
          cameraActions.zoomOut();
        }
      }
    };

    const handleGlobalMouseUp = () => {
      cameraActions.stopPanning();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  const handleSVGMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if (event.button === 1 || (event.button === 0 && isSpacePressed)) {
      event.preventDefault();
      cameraActions.startPanning(event.clientX, event.clientY);
      return;
    }
  };

  const handleSVGMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;

    if (isPanning) {
      cameraActions.updatePanning(event.clientX, event.clientY);
      return;
    }

    const rect = svg.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const canvasPoint = cameraActions.screenToCanvas(screenX, screenY);

    onMouseMove(canvasPoint);
  };

  const handleSVGMouseUp = () => {
    if (isPanning) {
      cameraActions.stopPanning();
      return;
    }
  };

  const handleSVGClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (isSpacePressed || isPanning) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const canvasPoint = cameraActions.screenToCanvas(screenX, screenY);

    onCanvasClick(canvasPoint);
  };

  return (
    <svg
      ref={svgRef}
      className={`w-full h-full border ${
        isPanning
          ? "cursor-grabbing"
          : isSpacePressed
            ? "cursor-grab"
            : "cursor-crosshair"
      }`}
      onClick={handleSVGClick}
      onMouseDown={handleSVGMouseDown}
      onMouseMove={handleSVGMouseMove}
      onMouseUp={handleSVGMouseUp}
      style={{ minHeight: "500px" }}
    >
      {/* Grid Pattern */}
      {gridSnapEnabled && (
        <defs>
          <pattern
            id="grid"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 10 0 L 0 0 0 10"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
      )}

      {/* Content with zoom/pan transform */}
      <g transform={zoomTransform}>
        {/* Grid Background */}
        {gridSnapEnabled && (
          <rect
            x="-1000"
            y="-1000"
            width="2000"
            height="2000"
            fill="url(#grid)"
          />
        )}
        {children}
      </g>
    </svg>
  );
}