import type { SecretFinding, ScanOptions, ScanResult, FindingSummary } from './types';
import { SCANNER_RULES } from './rules';
import { buildMaskedLineEvidence } from './masker';

export const SCANNER_DISCLAIMER =
  'CommitShield relies on deterministic pattern matching and heuristic rules. While it reliably flags known credential structures, it cannot detect every possible obfuscated, dynamic, or non-standard secret format.';

/**
 * Scans string content for exposed credentials and returns structured findings.
 * Never stores or exposes unmasked secrets in findings or logs.
 */
export function scanContent(content: string, options: ScanOptions = {}): ScanResult {
  if (typeof content !== 'string' || content.length === 0) {
    return {
      fileName: options.fileName,
      findings: [],
      summary: createEmptySummary(),
      scannedLines: 0,
      scannedBytes: 0,
      timestamp: new Date().toISOString(),
      disclaimer: SCANNER_DISCLAIMER,
    };
  }

  const lines = content.split(/\r?\n/);
  const findings: SecretFinding[] = [];
  const scannedBytes = new TextEncoder().encode(content).length;

  lines.forEach((lineText, lineIdx) => {
    const lineNumber = lineIdx + 1;

    for (const rule of SCANNER_RULES) {
      // Re-instantiate RegExp to ensure clean state and avoid thread-safety / state leak
      const regex = new RegExp(rule.regex.source, rule.regex.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(lineText)) !== null) {
        // If capture group specified (e.g. key value inside quotes), extract that group
        let secretValue = match[0];
        let matchOffset = match.index;

        if (rule.secretGroupIndex && match[rule.secretGroupIndex] !== undefined) {
          const groupVal = match[rule.secretGroupIndex];
          const groupOffsetInMatch = match[0].indexOf(groupVal);
          secretValue = groupVal;
          matchOffset = match.index + groupOffsetInMatch;
        }

        const column = matchOffset + 1; // 1-indexed
        const matchLength = secretValue.length;

        // Mask evidence safely
        const maskedEvidence = buildMaskedLineEvidence(
          lineText,
          column,
          matchLength,
          secretValue
        );

        // Check if overlapping finding already recorded for this range on the line
        const overlaps = findings.some(
          (f) =>
            f.line === lineNumber &&
            Math.max(f.column, column) <
              Math.min(f.column + f.matchLength, column + matchLength)
        );

        if (!overlaps) {
          findings.push({
            id: `${rule.id}-${lineNumber}-${column}-${findings.length + 1}`,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            line: lineNumber,
            column,
            matchLength,
            maskedEvidence,
            description: rule.description,
            suggestedReplacement: rule.suggestedReplacement,
          });
        }

        // Avoid infinite loop on zero-length matches
        if (regex.lastIndex === match.index) {
          regex.lastIndex++;
        }
      }
    }
  });

  // Sort findings by line then column
  findings.sort((a, b) => (a.line === b.line ? a.column - b.column : a.line - b.line));

  const summary = calculateSummary(findings);

  return {
    fileName: options.fileName,
    findings,
    summary,
    scannedLines: lines.length,
    scannedBytes,
    timestamp: new Date().toISOString(),
    disclaimer: SCANNER_DISCLAIMER,
  };
}

/**
 * Safely redacts secrets in content based on scanner findings.
 * Replaces findings from bottom-to-top / right-to-left to keep line/column offsets valid.
 */
export function redactSecrets(
  content: string,
  findings: SecretFinding[],
  mode: 'placeholder' | 'env' = 'placeholder'
): string {
  if (!findings || findings.length === 0) return content;

  const lines = content.split(/\r?\n/);

  // Group findings by line number (descending)
  const byLine = new Map<number, SecretFinding[]>();
  for (const f of findings) {
    const list = byLine.get(f.line) || [];
    list.push(f);
    byLine.set(f.line, list);
  }

  // Process lines
  for (const [lineNum, lineFindings] of byLine.entries()) {
    const lineIndex = lineNum - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    let line = lines[lineIndex];

    // Sort findings descending by column so later replacements don't shift earlier columns
    lineFindings.sort((a, b) => b.column - a.column);

    for (const f of lineFindings) {
      const colIndex = f.column - 1;
      const replacement =
        mode === 'env'
          ? f.suggestedReplacement
          : `<REDACTED_${f.ruleId.toUpperCase().replace(/-/g, '_')}>`;

      line =
        line.slice(0, colIndex) +
        replacement +
        line.slice(colIndex + f.matchLength);
    }

    lines[lineIndex] = line;
  }

  return lines.join('\n');
}

function calculateSummary(findings: SecretFinding[]): FindingSummary {
  const summary: FindingSummary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: findings.length,
  };

  for (const f of findings) {
    if (f.severity in summary) {
      summary[f.severity]++;
    }
  }

  return summary;
}

function createEmptySummary(): FindingSummary {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  };
}
