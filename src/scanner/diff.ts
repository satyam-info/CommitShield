export interface DiffLine {
  type: 'unchanged' | 'removed' | 'added';
  originalLineNumber?: number;
  modifiedLineNumber?: number;
  content: string;
}

export interface DiffSummary {
  linesAdded: number;
  linesRemoved: number;
  linesUnchanged: number;
  changedFilesCount?: number;
}

/**
 * Computes a clean line-by-line diff between original and modified code.
 * Optimized for local in-memory redaction review.
 */
export function computeLineDiff(original: string, modified: string): {
  lines: DiffLine[];
  summary: DiffSummary;
} {
  const origLines = original === '' ? [] : original.split(/\r?\n/);
  const modLines = modified === '' ? [] : modified.split(/\r?\n/);

  const diffLines: DiffLine[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  // If line counts are equal, directly compare line by line
  if (origLines.length === modLines.length) {
    for (let i = 0; i < origLines.length; i++) {
      const orig = origLines[i];
      const mod = modLines[i];

      if (orig === mod) {
        diffLines.push({
          type: 'unchanged',
          originalLineNumber: i + 1,
          modifiedLineNumber: i + 1,
          content: orig,
        });
        unchangedCount++;
      } else {
        diffLines.push({
          type: 'removed',
          originalLineNumber: i + 1,
          content: orig,
        });
        diffLines.push({
          type: 'added',
          modifiedLineNumber: i + 1,
          content: mod,
        });
        removedCount++;
        addedCount++;
      }
    }
  } else {
    // When lines differ in count (e.g. multiline private key redacted to single line)
    // Use longest common subsequence / dynamic alignment
    let origIdx = 0;
    let modIdx = 0;

    while (origIdx < origLines.length || modIdx < modLines.length) {
      if (origIdx >= origLines.length) {
        // Remaining modified lines are added
        diffLines.push({
          type: 'added',
          modifiedLineNumber: modIdx + 1,
          content: modLines[modIdx],
        });
        addedCount++;
        modIdx++;
      } else if (modIdx >= modLines.length) {
        // Remaining original lines are removed
        diffLines.push({
          type: 'removed',
          originalLineNumber: origIdx + 1,
          content: origLines[origIdx],
        });
        removedCount++;
        origIdx++;
      } else if (origLines[origIdx] === modLines[modIdx]) {
        diffLines.push({
          type: 'unchanged',
          originalLineNumber: origIdx + 1,
          modifiedLineNumber: modIdx + 1,
          content: origLines[origIdx],
        });
        unchangedCount++;
        origIdx++;
        modIdx++;
      } else {
        // Check if next lines match
        if (origIdx + 1 < origLines.length && origLines[origIdx + 1] === modLines[modIdx]) {
          diffLines.push({
            type: 'removed',
            originalLineNumber: origIdx + 1,
            content: origLines[origIdx],
          });
          removedCount++;
          origIdx++;
        } else if (modIdx + 1 < modLines.length && origLines[origIdx] === modLines[modIdx + 1]) {
          diffLines.push({
            type: 'added',
            modifiedLineNumber: modIdx + 1,
            content: modLines[modIdx],
          });
          addedCount++;
          modIdx++;
        } else {
          // Replace
          diffLines.push({
            type: 'removed',
            originalLineNumber: origIdx + 1,
            content: origLines[origIdx],
          });
          diffLines.push({
            type: 'added',
            modifiedLineNumber: modIdx + 1,
            content: modLines[modIdx],
          });
          removedCount++;
          addedCount++;
          origIdx++;
          modIdx++;
        }
      }
    }
  }

  return {
    lines: diffLines,
    summary: {
      linesAdded: addedCount,
      linesRemoved: removedCount,
      linesUnchanged: unchangedCount,
    },
  };
}
