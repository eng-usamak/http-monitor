export type IncidentSeverity = 'warning' | 'critical';

export interface IncidentRecord {
  id: string;
  responseId: string;
  endpoint: string;
  severity: IncidentSeverity;
  durationMs: number;
  baselineAvgMs: number;
  ratio: number;
  summary: string;
  rootCauses: string[];
  recommendations: string[];
  llmGenerated: boolean;
  createdAt: Date;
}
