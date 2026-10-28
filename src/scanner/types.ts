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
  githubRef?: GitHubRepoRef;
  gitHistory?: GitHistoryScanResult;
}

export interface ArchiveLimits {
  maxCompressedBytes?: number;
  maxTotalExtractedBytes?: number;
  maxFileCount?: number;
  maxSingleFileBytes?: number;
}

export interface GitHubRepoRef {
  owner: string;
  repo: string;
  branch?: string;
  commitSha?: string;
}

export interface GitHubRepoMetadata {
  owner: string;
  repo: string;
  fullName: string;
  description?: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  isPrivate: boolean;
  sizeKb: number;
  htmlUrl: string;
}

export interface HistoricalCommitFinding {
  id: string;
  commitSha: string;
  shortSha: string;
  commitMessage: string;
  author: string;
  timestamp: string;
  commitUrl: string;
  filePath: string;
  ruleId: string;
  ruleName: string;
  severity: FindingSeverity;
  maskedEvidence: string;
  suggestedReplacement: string;
  isHistoricalOnly: boolean; // true if no longer present in HEAD files
}

export interface GitHistoryScanResult {
  commitsScanned: number;
  commitsWithFindings: number;
  totalHistoricalFindings: number;
  historicalOnlyFindingsCount: number;
  findings: HistoricalCommitFinding[];
  rateLimitRemaining?: number;
  rateLimitLimit?: number;
  rateLimitReset?: string;
  isRateLimited: boolean;
  error?: string;
}
