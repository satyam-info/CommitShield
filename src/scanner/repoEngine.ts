import type {
  RepositoryScanResult,
  RepositoryFileResult,
  FileFinding,
  FindingSummary,
  SkippedFile,
} from './types';
import { scanContent, redactSecrets, SCANNER_DISCLAIMER } from './engine';

export function scanRepository(
  files: Record<string, string>,
  repoName = 'Uploaded Archive',
  skippedFiles: SkippedFile[] = []
): RepositoryScanResult {
  const filePaths = Object.keys(files).sort();
  const fileResults: RepositoryFileResult[] = [];
  const allFindings: FileFinding[] = [];

  let totalLines = 0;
  let totalBytes = 0;

  const totalSummary: FindingSummary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  };

  for (const filePath of filePaths) {
    const content = files[filePath];
    const scanResult = scanContent(content, { fileName: filePath });

    totalLines += scanResult.scannedLines;
    totalBytes += scanResult.scannedBytes;

    totalSummary.critical += scanResult.summary.critical;
    totalSummary.high += scanResult.summary.high;
    totalSummary.medium += scanResult.summary.medium;
    totalSummary.low += scanResult.summary.low;
    totalSummary.total += scanResult.summary.total;

    for (const f of scanResult.findings) {
      allFindings.push({
        ...f,
        filePath,
      });
    }

    fileResults.push({
      filePath,
      findings: scanResult.findings,
      summary: scanResult.summary,
      lines: scanResult.scannedLines,
      bytes: scanResult.scannedBytes,
    });
  }

  // Sort findings by severity (critical first) then filePath, then line
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  allFindings.sort((a, b) => {
    if (a.severity !== b.severity) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    if (a.filePath !== b.filePath) {
      return a.filePath.localeCompare(b.filePath);
    }
    return a.line - b.line;
  });

  return {
    repoName,
    totalFilesScanned: filePaths.length,
    totalFilesSkipped: skippedFiles.length,
    totalLinesScanned: totalLines,
    totalBytesScanned: totalBytes,
    summary: totalSummary,
    files: fileResults,
    allFindings,
    skippedFiles,
    timestamp: new Date().toISOString(),
    disclaimer: SCANNER_DISCLAIMER,
  };
}

/**
 * Redacts secrets across all files in a repository.
 */
export function redactRepository(
  files: Record<string, string>,
  repoResult: RepositoryScanResult,
  mode: 'placeholder' | 'env' = 'placeholder'
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const fileResult of repoResult.files) {
    const rawContent = files[fileResult.filePath];
    if (!rawContent) continue;

    if (fileResult.findings.length > 0) {
      sanitized[fileResult.filePath] = redactSecrets(
        rawContent,
        fileResult.findings,
        mode
      );
    } else {
      sanitized[fileResult.filePath] = rawContent;
    }
  }

  return sanitized;
}

/**
 * Helper to group findings by file path.
 */
export function groupFindingsByFile<T extends FileFinding = FileFinding>(
  findings: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const f of findings) {
    const list = grouped.get(f.filePath) || [];
    list.push(f);
    grouped.set(f.filePath, list);
  }

  return grouped;
}
