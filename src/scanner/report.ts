import type { ScanResult } from './types';

/**
 * Generates a clean, developer-focused Markdown report from scan results.
 * Never includes unmasked secrets.
 */
export function generateMarkdownReport(result: ScanResult): string {
  const dateStr = new Date(result.timestamp).toUTCString();
  const fileTarget = result.fileName || 'Pasted Code Snippet';

  let md = `# CommitShield Security Scan Report\n\n`;
  md += `- **Target:** \`${fileTarget}\`\n`;
  md += `- **Scan Timestamp:** ${dateStr}\n`;
  md += `- **Lines Scanned:** ${result.scannedLines}\n`;
  md += `- **Payload Size:** ${(result.scannedBytes / 1024).toFixed(2)} KB\n`;
  md += `- **Status:** ${result.findings.length === 0 ? '✅ PASSED (No secrets detected)' : '⚠️ ATTENTION REQUIRED'}\n\n`;

  md += `## Summary\n\n`;
  md += `| Total Findings | Critical | High | Medium | Low |\n`;
  md += `| :---: | :---: | :---: | :---: | :---: |\n`;
  md += `| **${result.summary.total}** | ${result.summary.critical} | ${result.summary.high} | ${result.summary.medium} | ${result.summary.low} |\n\n`;

  if (result.findings.length === 0) {
    md += `## Findings\n\n`;
    md += `*No exposed credential patterns detected in this scan.* Ready for commit.\n\n`;
  } else {
    md += `## Detected Secrets (Masked)\n\n`;
    md += `| Line:Col | Severity | Type | Masked Evidence | Suggested Fix |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;

    for (const f of result.findings) {
      const loc = `L${f.line}:C${f.column}`;
      const sev = f.severity.toUpperCase();
      const safeEv = f.maskedEvidence.replace(/\|/g, '\\|');
      const rep = `\`${f.suggestedReplacement}\``;
      md += `| ${loc} | **${sev}** | ${f.ruleName} | \`${safeEv}\` | ${rep} |\n`;
    }
    md += `\n`;

    md += `## Remediation Steps\n\n`;
    md += `1. **Revoke Exposed Credentials:** Any credentials that were committed or pushed must be considered compromised and rotated immediately.\n`;
    md += `2. **Use Environment Variables:** Move sensitive values into a local \`.env\` file and ensure \`.env\` is listed in \`.gitignore\`.\n`;
    md += `3. **Verify with CommitShield:** Apply safe redaction and rescan until 0 findings remain.\n\n`;
  }

  md += `## Disclaimer\n\n`;
  md += `> ${result.disclaimer}\n`;

  return md;
}

/**
 * Generates sanitized JSON report for automation or CI logging.
 */
export function generateJsonReport(result: ScanResult): string {
  // Ensure findings inside JSON do not contain any accidental leaks
  const sanitized = {
    tool: 'CommitShield',
    version: '1.0.0',
    scanTarget: result.fileName || 'pasted-snippet',
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
      maskedEvidence: f.maskedEvidence,
      suggestedReplacement: f.suggestedReplacement,
      description: f.description,
    })),
    disclaimer: result.disclaimer,
  };

  return JSON.stringify(sanitized, null, 2);
}
