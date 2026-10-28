import type { ScanResult, RepositoryScanResult } from './types';
import { SCANNER_RULES } from './rules';
import { maskSecretValue } from './masker';

/**
 * Sanitizes any raw string (such as an uploaded filename) to ensure
 * no sensitive patterns are inadvertently reflected.
 */
export function sanitizeString(text?: string): string {
  if (!text) return '';
  let sanitized = text;

  for (const rule of SCANNER_RULES) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    sanitized = sanitized.replace(regex, (match) => maskSecretValue(match));
  }

  return sanitized;
}

/**
 * Generates a clean, developer-focused Markdown report from scan results.
 * Never includes unmasked secrets.
 */
export function generateMarkdownReport(result: ScanResult): string {
  const dateStr = new Date(result.timestamp).toUTCString();
  const rawTarget = result.fileName || 'Pasted Code Snippet';
  const fileTarget = sanitizeString(rawTarget);

  let md = `# CommitShield Security Scan Report\n\n`;
  md += `- **Target:** \`${fileTarget}\`\n`;
  md += `- **Scan Timestamp:** ${dateStr}\n`;
  md += `- **Lines Scanned:** ${result.scannedLines}\n`;
  md += `- **Payload Size:** ${(result.scannedBytes / 1024).toFixed(2)} KB\n`;
  md += `- **Status:** ${result.findings.length === 0 ? '✅ PASSED (No heuristic matches flagged)' : '⚠️ ATTENTION REQUIRED'}\n\n`;

  md += `## Summary\n\n`;
  md += `| Total Findings | Critical | High | Medium | Low |\n`;
  md += `| :---: | :---: | :---: | :---: | :---: |\n`;
  md += `| **${result.summary.total}** | ${result.summary.critical} | ${result.summary.high} | ${result.summary.medium} | ${result.summary.low} |\n\n`;

  if (result.findings.length === 0) {
    md += `## Findings\n\n`;
    md += `*No exposed credential patterns detected by current heuristic rules.* (Note: A clean scan confirms no known signatures were triggered; conduct manual code review before publishing).\n\n`;
  } else {
    md += `## Detected Secrets (Masked)\n\n`;
    md += `| Line:Col | Severity | Type | Masked Evidence | Suggested Fix |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;

    for (const f of result.findings) {
      const loc = `L${f.line}:C${f.column}`;
      const sev = f.severity.toUpperCase();
      const safeEv = sanitizeString(f.maskedEvidence).replace(/\|/g, '\\|');
      const rep = `\`${f.suggestedReplacement}\``;
      md += `| ${loc} | **${sev}** | ${f.ruleName} | \`${safeEv}\` | ${rep} |\n`;
    }
    md += `\n`;

    md += `## Remediation Steps\n\n`;
    md += `1. **Revoke Exposed Credentials:** Any credentials that were committed or pushed must be considered compromised and rotated immediately.\n`;
    md += `2. **Use Environment Variables:** Move sensitive values into a local \`.env\` file and ensure \`.env\` is listed in \`.gitignore\`.\n`;
    md += `3. **Verify with CommitShield:** Apply safe redaction and rescan until 0 heuristic findings remain.\n\n`;
  }

  md += `## Disclaimer\n\n`;
  md += `> ${result.disclaimer}\n`;

  return md;
}

/**
 * Generates sanitized JSON report for automation or CI logging.
 */
export function generateJsonReport(result: ScanResult): string {
  const rawTarget = result.fileName || 'pasted-snippet';
  const sanitizedTarget = sanitizeString(rawTarget);

  const sanitized = {
    tool: 'CommitShield',
    version: '1.0.0',
    scanTarget: sanitizedTarget,
    timestamp: result.timestamp,
    stats: {
      lines: result.scannedLines,
      bytes: result.scannedBytes,
      findingsCount: result.summary.total,
      breakdown: result.summary,
    },
    findings: result.findings.map((f) => ({
      id: f.id,
      ruleId: f.ruleId,
      ruleName: f.ruleName,
      severity: f.severity,
      line: f.line,
      column: f.column,
      maskedEvidence: sanitizeString(f.maskedEvidence),
      suggestedReplacement: f.suggestedReplacement,
      description: f.description,
    })),
    disclaimer: result.disclaimer,
  };

  return JSON.stringify(sanitized, null, 2);
}

/**
 * Generates structured Markdown report for a multi-file repository scan.
 */
export function generateRepoMarkdownReport(repoResult: RepositoryScanResult): string {
  const dateStr = new Date(repoResult.timestamp).toUTCString();
  const repoName = sanitizeString(repoResult.repoName);

  let md = `# CommitShield Repository Security Report\n\n`;
  md += `- **Repository Target:** \`${repoName}\`\n`;
  md += `- **Scan Timestamp:** ${dateStr}\n`;
  md += `- **Files Scanned:** ${repoResult.totalFilesScanned}\n`;
  md += `- **Files Skipped:** ${repoResult.totalFilesSkipped}\n`;
  md += `- **Lines Scanned:** ${repoResult.totalLinesScanned}\n`;
  md += `- **Payload Size:** ${(repoResult.totalBytesScanned / 1024).toFixed(2)} KB\n`;
  md += `- **Status:** ${repoResult.summary.total === 0 ? '✅ PASSED (No heuristic matches flagged)' : '⚠️ ATTENTION REQUIRED'}\n\n`;

  md += `## Severity Summary\n\n`;
  md += `| Total Findings | Critical | High | Medium | Low |\n`;
  md += `| :---: | :---: | :---: | :---: | :---: |\n`;
  md += `| **${repoResult.summary.total}** | ${repoResult.summary.critical} | ${repoResult.summary.high} | ${repoResult.summary.medium} | ${repoResult.summary.low} |\n\n`;

  if (repoResult.summary.total === 0) {
    md += `## Findings\n\n`;
    md += `*No exposed credential patterns detected across ${repoResult.totalFilesScanned} scanned files.* (Note: A clean scan confirms no known heuristic signatures were triggered; conduct manual code review before publishing).\n\n`;
  } else {
    md += `## Detected Secrets by File\n\n`;
    md += `| File | Line:Col | Severity | Type | Masked Evidence | Suggested Fix |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const f of repoResult.allFindings) {
      const safePath = sanitizeString(f.filePath);
      const loc = `L${f.line}:C${f.column}`;
      const sev = f.severity.toUpperCase();
      const safeEv = sanitizeString(f.maskedEvidence).replace(/\|/g, '\\|');
      const rep = `\`${f.suggestedReplacement}\``;
      md += `| \`${safePath}\` | ${loc} | **${sev}** | ${f.ruleName} | \`${safeEv}\` | ${rep} |\n`;
    }
    md += `\n`;

    md += `## Remediation Steps\n\n`;
    md += `1. **Revoke Exposed Credentials:** Any credentials that were committed or pushed to source control must be rotated immediately.\n`;
    md += `2. **Move to Environment Variables:** Use local \`.env\` files (gitignored) or a secrets manager.\n`;
    md += `3. **Verify with CommitShield:** Use safe redaction and rescan to confirm zero heuristic findings remain.\n\n`;
  }

  if (repoResult.skippedFiles.length > 0) {
    md += `## Skipped Files (${repoResult.skippedFiles.length})\n\n`;
    md += `| File Path | Reason | Notes |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const s of repoResult.skippedFiles) {
      const safeP = sanitizeString(s.path);
      const safeDetails = s.details ? sanitizeString(s.details) : '';
      md += `| \`${safeP}\` | ${s.reason} | ${safeDetails} |\n`;
    }
    md += `\n`;
  }

  md += `## Disclaimer\n\n`;
  md += `> ${repoResult.disclaimer}\n`;

  return md;
}

/**
 * Generates structured JSON report for a multi-file repository scan.
 */
export function generateRepoJsonReport(repoResult: RepositoryScanResult): string {
  const sanitized = {
    tool: 'CommitShield',
    version: '1.1.0',
    scanMode: 'repository',
    repoName: sanitizeString(repoResult.repoName),
    timestamp: repoResult.timestamp,
    stats: {
      filesScanned: repoResult.totalFilesScanned,
      filesSkipped: repoResult.totalFilesSkipped,
      linesScanned: repoResult.totalLinesScanned,
      bytesScanned: repoResult.totalBytesScanned,
      totalFindings: repoResult.summary.total,
      breakdown: repoResult.summary,
    },
    findings: repoResult.allFindings.map((f) => ({
      filePath: sanitizeString(f.filePath),
      id: f.id,
      ruleId: f.ruleId,
      ruleName: f.ruleName,
      severity: f.severity,
      line: f.line,
      column: f.column,
      maskedEvidence: sanitizeString(f.maskedEvidence),
      suggestedReplacement: f.suggestedReplacement,
      description: f.description,
    })),
    filesBreakdown: repoResult.files.map((file) => ({
      filePath: sanitizeString(file.filePath),
      findingsCount: file.summary.total,
      breakdown: file.summary,
      lines: file.lines,
      bytes: file.bytes,
    })),
    skippedFiles: repoResult.skippedFiles.map((s) => ({
      path: sanitizeString(s.path),
      reason: s.reason,
      details: s.details ? sanitizeString(s.details) : undefined,
    })),
    disclaimer: repoResult.disclaimer,
  };

  return JSON.stringify(sanitized, null, 2);
}

