import React from "react";
import { SimulationProvider } from "../context/SimulationContext";
import { JsonCorridorMap } from "../components/simulation/JsonCorridorMap";

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (
    envUrl &&
    typeof envUrl === "string" &&
    envUrl !== "undefined" &&
    envUrl !== "serverurl" &&
    envUrl.startsWith("http")
  ) {
    return envUrl;
  }
  return "http://localhost:3000";
};

const JsonMapContent: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <h1 className="text-lg font-semibold text-gray-900">
          JSON-Driven Corridor Map Demo
        </h1>
        <p className="text-xs text-gray-500">
          CSMT – Kalyan Corridor (Data-driven from sampleTrackData.json)
        </p>
      </header>

      <div className="h-[calc(100vh-60px)] p-4">
        <div className="h-full bg-white rounded border border-gray-200 shadow-sm overflow-hidden relative">
          <JsonCorridorMap />
        </div>
      </div>
    </div>
  );
};

export const JsonMapDemo: React.FC = () => {
  const serverUrl = getApiBaseUrl();
  console.log("JsonMapDemo server URL:", serverUrl);

  return (
    <SimulationProvider serverUrl={serverUrl}>
      <JsonMapContent />
    </SimulationProvider>
  );
};
