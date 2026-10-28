/**
 * Safely masks secret strings to prevent accidental exposure in UI and logs.
 * Preserves a short non-confidential prefix (up to 4 chars) and suffix (up to 2 chars)
 * when length allows, replacing the core with asterisks.
 */
export function maskSecretValue(secret: string): string {
  if (!secret) return '******';
  const len = secret.length;

  if (len <= 6) {
    return '*'.repeat(len);
  }

  // Preserve up to 4 chars prefix, up to 2 chars suffix, minimum 6 asterisks in the middle
  const prefixLen = Math.min(4, Math.floor(len / 4));
  const suffixLen = Math.min(2, Math.floor(len / 8));
  const prefix = secret.slice(0, prefixLen);
  const suffix = suffixLen > 0 ? secret.slice(-suffixLen) : '';
  const maskedMiddle = '*'.repeat(Math.max(6, len - prefixLen - suffixLen));

  return `${prefix}${maskedMiddle}${suffix}`;
}

/**
 * Builds a safe snippet of the source line containing the secret,
 * with the exact secret occurrence replaced by its masked representation.
 */
export function buildMaskedLineEvidence(
  lineText: string,
  column: number,
  matchLength: number,
  rawSecret: string,
  maxContextLen = 120
): string {
  const maskedVal = maskSecretValue(rawSecret);

  // Replace secret at the specified column offset (1-indexed)
  const colIndex = Math.max(0, column - 1);
  const before = lineText.slice(0, colIndex);
  const after = lineText.slice(colIndex + matchLength);
  const sanitizedLine = `${before}${maskedVal}${after}`.trim();

  if (sanitizedLine.length <= maxContextLen) {
    return sanitizedLine;
  }

  // If the line is very long (e.g. minified code), center around the masked value
  const maskedIndex = sanitizedLine.indexOf(maskedVal);
  if (maskedIndex === -1) {
    return sanitizedLine.slice(0, maxContextLen) + '...';
  }

  const start = Math.max(0, maskedIndex - 30);
  const end = Math.min(sanitizedLine.length, maskedIndex + maskedVal.length + 30);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < sanitizedLine.length ? '...' : '';

  return `${prefix}${sanitizedLine.slice(start, end)}${suffix}`;
}

