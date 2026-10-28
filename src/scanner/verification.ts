import type { FileFinding, ScanResult, RepositoryScanResult } from './types';

export interface RemediationVerification {
  isFullyRemediated: boolean;
  totalBaseline: number;
  totalRemaining: number;
  totalResolved: number;
  totalNew: number;
  resolutionPercentage: number;
  resolvedFindings: FileFinding[];
  remainingFindings: FileFinding[];
  newFindings: FileFinding[];
  statusMessage: string;
  revocationDisclaimer: string;
}

export const REVOCATION_NOTICE =
  'Security Notice: Redacting or replacing secrets in code prevents them from entering git commits or packages. It does NOT revoke or invalidate the credential. You must rotate or revoke exposed keys immediately in their respective cloud provider consoles.';

/**
 * Compares single-file baseline findings with rescan findings.
 */
export function verifySnippetRemediation(
  baseline: ScanResult,
  rescan: ScanResult
): RemediationVerification {
  const baselineFindings: FileFinding[] = baseline.findings.map((f) => ({
    ...f,
    filePath: baseline.fileName || 'snippet',
  }));

  const rescanFindings: FileFinding[] = rescan.findings.map((f) => ({
    ...f,
    filePath: rescan.fileName || 'snippet',
  }));

  return compareFindings(baselineFindings, rescanFindings);
}

/**
 * Compares multi-file repository baseline scan with rescan results.
 */
export function verifyRepoRemediation(
  baseline: RepositoryScanResult,
  rescan: RepositoryScanResult
): RemediationVerification {
  return compareFindings(baseline.allFindings, rescan.allFindings);
}

/**
 * Deterministically compares two sets of findings to categorize resolved, remaining, and new.
 */
function compareFindings(
  baselineFindings: FileFinding[],
  rescanFindings: FileFinding[]
): RemediationVerification {
  const remainingFindings: FileFinding[] = [];
  const resolvedFindings: FileFinding[] = [];
  const newFindings: FileFinding[] = [];

  // Match based on filePath + ruleId
  // Build a pool of baseline findings
  const unmatchedBaseline = [...baselineFindings];

  for (const rf of rescanFindings) {
    const matchIdx = unmatchedBaseline.findIndex(
      (bf) => bf.filePath === rf.filePath && bf.ruleId === rf.ruleId
    );

    if (matchIdx !== -1) {
      // Still present in rescan
      remainingFindings.push(rf);
      unmatchedBaseline.splice(matchIdx, 1);
    } else {
      // Newly detected finding that was not in baseline
      newFindings.push(rf);
    }
  }

  // Any unmatched baseline findings were resolved!
  resolvedFindings.push(...unmatchedBaseline);

  const totalBaseline = baselineFindings.length;
  const totalRemaining = remainingFindings.length;
  const totalResolved = resolvedFindings.length;
  const totalNew = newFindings.length;

  const resolutionPercentage =
    totalBaseline > 0 ? Math.round((totalResolved / totalBaseline) * 100) : 100;

  const isFullyRemediated = totalRemaining === 0 && totalNew === 0;

  let statusMessage: string;
  if (isFullyRemediated) {
    statusMessage = `Verified Clean: All ${totalBaseline} detected secret exposures have been successfully redacted. 0 findings remain.`;
  } else if (totalResolved > 0) {
    statusMessage = `Partial Remediation: ${totalResolved} of ${totalBaseline} findings resolved (${resolutionPercentage}%). ${totalRemaining} findings remain.`;
  } else {
    statusMessage = `Remediation Incomplete: All ${totalBaseline} findings remain unredacted.`;
  }

  return {
    isFullyRemediated,
    totalBaseline,
    totalRemaining,
    totalResolved,
    totalNew,
    resolutionPercentage,
    resolvedFindings,
    remainingFindings,
    newFindings,
    statusMessage,
    revocationDisclaimer: REVOCATION_NOTICE,
  };
}
