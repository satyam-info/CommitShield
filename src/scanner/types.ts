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

export interface FileFinding extends SecretFinding {
  filePath: string;
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

export type SkippedReason =
  | 'binary'
  | 'ignored_directory'
  | 'unsupported_extension'
  | 'oversized'
  | 'path_traversal'
  | 'unreadable';

export interface SkippedFile {
  path: string;
  reason: SkippedReason;
  details?: string;
}

export interface RepositoryFileResult {
  filePath: string;
  findings: SecretFinding[];
  summary: FindingSummary;
  lines: number;
  bytes: number;
}

export interface RepositoryScanResult {
  repoName: string;
  totalFilesScanned: number;
  totalFilesSkipped: number;
  totalLinesScanned: number;
  totalBytesScanned: number;
  summary: FindingSummary;
  files: RepositoryFileResult[];
  allFindings: FileFinding[];
  skippedFiles: SkippedFile[];
  timestamp: string;
  disclaimer: string;
}

export interface ArchiveLimits {
  maxCompressedBytes?: number;
  maxTotalExtractedBytes?: number;
  maxFileCount?: number;
  maxSingleFileBytes?: number;
}
