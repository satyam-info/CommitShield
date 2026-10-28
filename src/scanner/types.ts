export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecretFinding {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: FindingSeverity;
  line: number;
  column: number;
  matchLength: number;
  maskedEvidence: string;
  description: string;
  suggestedReplacement: string;
}

export interface ScanOptions {
  fileName?: string;
  customRedactionPlaceholder?: string;
}

export interface FindingSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface ScanResult {
  fileName?: string;
  findings: SecretFinding[];
  summary: FindingSummary;
  scannedLines: number;
  scannedBytes: number;
  timestamp: string;
  disclaimer: string;
}

