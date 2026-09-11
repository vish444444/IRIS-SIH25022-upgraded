export type SectorBlockageStatus = "blocked" | "open";

export interface SectorBlockageStatusData {
  id: string;
  sector_id: string;
  status: SectorBlockageStatus;
  reason?: string;
  reported_by?: string;
  timestamp: Date;
}

export interface SectorBlockageStore {
  blockages: Map<string, SectorBlockageStatusData>;
  lastUpdated: Date;
}

export interface SectorBlockageRequest {
  sector_id: string;
  status: SectorBlockageStatus;
  reason?: string;
  reported_by?: string;
}

