import JSZip from 'jszip';
import type { SkippedFile, ArchiveLimits } from './types';

export const DEFAULT_ARCHIVE_LIMITS: Required<ArchiveLimits> = {
  maxCompressedBytes: 25 * 1024 * 1024, // 25 MB
  maxTotalExtractedBytes: 50 * 1024 * 1024, // 50 MB
  maxFileCount: 1000,
  maxSingleFileBytes: 5 * 1024 * 1024, // 5 MB
};

const IGNORED_DIRECTORY_NAMES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '__pycache__',
  '.idea',
  '.vscode',
  '.turbo',
  'coverage',
  '.cache',
  'vendor',
  '.DS_Store',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.tiff',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.wasm', '.bin', '.dat',
  '.pyc', '.pyd', '.pyo', '.class', '.jar', '.war', '.ear',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.mov', '.avi', '.mkv', '.flac', '.wav',
  '.sqlite', '.db', '.sqlite3', '.lockb',
]);

const SUPPORTED_TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.csv',
  '.env',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.php', '.cs', '.c', '.cpp', '.h', '.hpp', '.dart', '.swift',
  '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.sql', '.graphql', '.gql',
  '.md', '.txt', '.cfg', '.conf', '.ini', '.properties',
  '.html', '.htm', '.css', '.scss', '.less', '.vue', '.svelte',
]);

export interface ArchiveExtractionResult {
  success: boolean;
  files: Record<string, string>;
  skippedFiles: SkippedFile[];
  totalBytes: number;
  error?: string;
}

/**
 * Validates a relative file path for zip-slip / path-traversal attacks.
 * Rejects paths with "..", absolute drive roots, or invalid characters.
 */
export function isPathTraversal(rawPath: string): boolean {
  if (!rawPath || typeof rawPath !== 'string') return true;

  // Normalize backslashes to forward slashes
  const normalized = rawPath.replace(/\\/g, '/');

  // Check for absolute path roots or Windows drive letters
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return true;
  }

  // Check path segments for '..'
  const segments = normalized.split('/');
  return segments.some((seg) => seg === '..');
}

/**
 * Checks whether any directory segment of the path should be ignored (e.g. node_modules, .git).
 */
export function isIgnoredDirectory(normalizedPath: string): boolean {
  const segments = normalizedPath.split('/');
  return segments.some((seg) => IGNORED_DIRECTORY_NAMES.has(seg));
}

/**
 * Determines whether a file path qualifies as a supported source/configuration text file.
 */
export function isSupportedTextFile(normalizedPath: string): { supported: boolean; reason?: 'binary' | 'unsupported_extension' } {
  const fileName = normalizedPath.split('/').pop() || '';
  const lowerName = fileName.toLowerCase();

  // Known dotfile exceptions without normal extensions
  if (
    lowerName === 'dockerfile' ||
    lowerName === 'makefile' ||
    lowerName === 'jenkinsfile' ||
    lowerName === '.gitignore' ||
    lowerName === '.npmrc' ||
    lowerName === '.dockerignore' ||
    lowerName.startsWith('.env')
  ) {
    return { supported: true };
  }

  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) {
    return { supported: false, reason: 'unsupported_extension' };
  }

  const ext = fileName.slice(dotIndex).toLowerCase();

  if (BINARY_EXTENSIONS.has(ext)) {
    return { supported: false, reason: 'binary' };
  }

  if (SUPPORTED_TEXT_EXTENSIONS.has(ext)) {
    return { supported: true };
  }

  return { supported: false, reason: 'unsupported_extension' };
}

/**
 * Safely extracts text files from a ZIP archive with strict boundary checks.
 */
export async function extractZipArchive(
  archiveData: File | Blob | ArrayBuffer | Uint8Array,
  limits: ArchiveLimits = {}
): Promise<ArchiveExtractionResult> {
  const maxCompressed = limits.maxCompressedBytes ?? DEFAULT_ARCHIVE_LIMITS.maxCompressedBytes;
  const maxTotalExtracted = limits.maxTotalExtractedBytes ?? DEFAULT_ARCHIVE_LIMITS.maxTotalExtractedBytes;
  const maxFiles = limits.maxFileCount ?? DEFAULT_ARCHIVE_LIMITS.maxFileCount;
  const maxSingleFile = limits.maxSingleFileBytes ?? DEFAULT_ARCHIVE_LIMITS.maxSingleFileBytes;

  // Check compressed file size if File/Blob
  if ('size' in archiveData && typeof archiveData.size === 'number') {
    if (archiveData.size > maxCompressed) {
      return {
        success: false,
        files: {},
        skippedFiles: [],
        totalBytes: 0,
        error: `Archive exceeds maximum compressed size of ${(maxCompressed / (1024 * 1024)).toFixed(0)} MB.`,
      };
    }
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(archiveData);
  } catch (err) {
    return {
      success: false,
      files: {},
      skippedFiles: [],
      totalBytes: 0,
      error: `Failed to open ZIP archive: ${err instanceof Error ? err.message : 'Invalid or corrupt archive'}.`,
    };
  }

  const extractedFiles: Record<string, string> = {};
  const skippedFiles: SkippedFile[] = [];
  let totalExtractedBytes = 0;
  let fileCount = 0;

  const entries = Object.keys(zip.files);

  // Detect common single root directory (e.g. GitHub archive prefixes like owner-repo-sha/)
  const fileEntries = entries.filter((p) => !zip.files[p].dir && !p.endsWith('/') && !p.endsWith('\\'));
  let commonRoot: string | null = null;
  if (fileEntries.length > 0) {
    const firstNormalized = fileEntries[0].replace(/\\/g, '/');
    const firstSlash = firstNormalized.indexOf('/');
    if (firstSlash !== -1) {
      const candidate = firstNormalized.slice(0, firstSlash + 1);
      if (fileEntries.every((p) => p.replace(/\\/g, '/').startsWith(candidate))) {
        commonRoot = candidate;
      }
    }
  }

  for (const rawPath of entries) {
    const entry = zip.files[rawPath];

    // Skip directory entries
    if (entry.dir || rawPath.endsWith('/') || rawPath.endsWith('\\')) {
      continue;
    }

    let normalizedPath = rawPath.replace(/\\/g, '/');

    // Security Check: Path Traversal
    if (isPathTraversal(normalizedPath)) {
      skippedFiles.push({
        path: normalizedPath,
        reason: 'path_traversal',
        details: 'Rejected relative directory traversal sequence.',
      });
      continue;
    }

    // Strip common GitHub zipball root directory if present
    if (commonRoot && normalizedPath.startsWith(commonRoot)) {
      normalizedPath = normalizedPath.slice(commonRoot.length);
    }

    if (!normalizedPath) continue;

    // Security Check again after stripping
    if (isPathTraversal(normalizedPath)) {
      skippedFiles.push({
        path: normalizedPath,
        reason: 'path_traversal',
        details: 'Rejected relative directory traversal sequence.',
      });
      continue;
    }

    // Filter: Ignored Dependencies / Artifact Directories
    if (isIgnoredDirectory(normalizedPath)) {
      skippedFiles.push({
        path: normalizedPath,
        reason: 'ignored_directory',
        details: 'Ignored build, cache, or dependency directory.',
      });
      continue;
    }

    // Filter: Binary vs Supported Text
    const supportCheck = isSupportedTextFile(normalizedPath);
    if (!supportCheck.supported) {
      skippedFiles.push({
        path: normalizedPath,
        reason: supportCheck.reason || 'unsupported_extension',
        details: 'File extension not recognized as a source or configuration format.',
      });
      continue;
    }

    // Security Check: File count limits
    fileCount++;
    if (fileCount > maxFiles) {
      skippedFiles.push({
        path: normalizedPath,
        reason: 'oversized',
        details: `Exceeded archive file limit (${maxFiles} files).`,
      });
      continue;
    }

    try {
      const textContent = await entry.async('string');
      const fileBytes = new TextEncoder().encode(textContent).length;

      // Security Check: Single file size
      if (fileBytes > maxSingleFile) {
        skippedFiles.push({
          path: normalizedPath,
          reason: 'oversized',
          details: `Single file exceeds ${(maxSingleFile / (1024 * 1024)).toFixed(0)} MB limit.`,
        });
        continue;
      }

      // Security Check: Total extracted size (zip bomb protection)
      if (totalExtractedBytes + fileBytes > maxTotalExtracted) {
        skippedFiles.push({
          path: normalizedPath,
          reason: 'oversized',
          details: `Archive exceeds total extraction limit of ${(maxTotalExtracted / (1024 * 1024)).toFixed(0)} MB.`,
        });
        continue;
      }

      // Content Check: Null byte detection (binary files disguised with text extensions)
      if (textContent.slice(0, 1024).includes('\0')) {
        skippedFiles.push({
          path: normalizedPath,
          reason: 'binary',
          details: 'Contains null byte sequences indicative of binary data.',
        });
        continue;
      }

      extractedFiles[normalizedPath] = textContent;
      totalExtractedBytes += fileBytes;
    } catch {
      skippedFiles.push({
        path: normalizedPath,
        reason: 'unreadable',
        details: 'Could not decode file content as UTF-8 text.',
      });
    }
  }

  return {
    success: true,
    files: extractedFiles,
    skippedFiles,
    totalBytes: totalExtractedBytes,
  };
}

