"use client";

import { setLogLevel } from "../lib/logger";

export default function CompactLoggingControls() {
  const handleQuickConfig = (config: string) => {
    switch (config) {
      case "cutting":
        setLogLevel("plankCutting", "DEBUG");
        setLogLevel("tessellation", "OFF");
        break;
      case "tessellation":
        setLogLevel("tessellation", "TRACE");
        setLogLevel("plankCutting", "OFF");
        break;
      case "both":
        setLogLevel("plankCutting", "DEBUG");
        setLogLevel("tessellation", "TRACE");
        break;
      case "off":
        setLogLevel("plankCutting", "OFF");
        setLogLevel("tessellation", "OFF");
        break;
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-600">Logs:</span>
      <button 
        onClick={() => handleQuickConfig("cutting")}
        className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
      >
        Cutting
      </button>
      <button 
        onClick={() => handleQuickConfig("tessellation")}
        className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
      >
        Tessellation
      </button>
      <button 
        onClick={() => handleQuickConfig("both")}
        className="px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
      >
        Both
      </button>
      <button 
        onClick={() => handleQuickConfig("off")}
        className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
      >
        Off
      </button>
    </div>
  );
}