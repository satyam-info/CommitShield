import React, { useState } from 'react';
import {
  X,
  FolderGit2,
  Search,
  AlertCircle,
  GitBranch,
  Star,
  GitFork,
  HardDrive,
  Shield,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  parseGitHubUrl,
  fetchGitHubRepoMetadata,
  fetchGitHubBranches,
  downloadGitHubZipArchive,
  scanGitHubHistory,
  extractZipArchive,
  scanRepository,
  type GitHubRepoMetadata,
  type RepositoryScanResult,
} from '../scanner';

interface GitHubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (files: Record<string, string>, result: RepositoryScanResult) => void;
}

export const GitHubImportModal: React.FC<GitHubImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [repoInput, setRepoInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [metadata, setMetadata] = useState<GitHubRepoMetadata | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [scanHistory, setScanHistory] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const parsed = parseGitHubUrl(repoInput);

  const handleInspect = async () => {
    if (!parsed.isValid) {
      setErrorMessage(parsed.error || 'Please enter a valid GitHub repository identifier.');
      return;
    }

    setErrorMessage(null);
    setIsValidating(true);
    setMetadata(null);

    try {
      const { metadata: meta } = await fetchGitHubRepoMetadata(parsed.owner, parsed.repo);
      setMetadata(meta);
      setSelectedBranch(parsed.branch || meta.defaultBranch);

      const branchList = await fetchGitHubBranches(parsed.owner, parsed.repo);
      setBranches(branchList);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to inspect GitHub repository.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleStartImport = async () => {
    const owner = metadata ? metadata.owner : parsed.owner;
    const repo = metadata ? metadata.repo : parsed.repo;
    const branch = selectedBranch || (metadata ? metadata.defaultBranch : 'main');

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Step 1: Download archive directly into browser
      setStatusMessage(`Downloading source archive from GitHub (${owner}/${repo}@${branch})...`);
      const zipBlob = await downloadGitHubZipArchive(owner, repo, branch);

      // Step 2: Extract client-side with security boundary safeguards
      setStatusMessage('Extracting files and enforcing archive limits locally in browser...');
      const extraction = await extractZipArchive(zipBlob);

      if (!extraction.success) {
        throw new Error(extraction.error || 'Failed to extract repository archive.');
      }

      if (Object.keys(extraction.files).length === 0) {
        throw new Error('No supported text or source files found in this repository archive.');
      }

      // Step 3: Run repository secret scanner
      setStatusMessage(`Scanning ${Object.keys(extraction.files).length} repository files client-side...`);
      const repoScanResult = scanRepository(
        extraction.files,
        `github.com/${owner}/${repo} (${branch})`,
        extraction.skippedFiles
      );

      repoScanResult.githubRef = {
        owner,
        repo,
        branch,
      };

      // Step 4: Scan bounded Git history if requested
      if (scanHistory) {
        setStatusMessage('Scanning recent Git commit patches for historical or lingering secrets...');
        const historyResult = await scanGitHubHistory(
          owner,
          repo,
          branch,
          repoScanResult.allFindings,
          10
        );
        repoScanResult.gitHistory = historyResult;
      }

      onImportSuccess(extraction.files, repoScanResult);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error importing repository from GitHub.');
    } finally {
      setIsProcessing(false);
      setStatusMessage(null);
    }
  };

  const loadSampleRepo = (sampleUrl: string) => {
    setRepoInput(sampleUrl);
    setErrorMessage(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 50,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-dropdown)',
          maxWidth: '620px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FolderGit2 size={20} />
            <span id="github-modal-title" style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
              Import GitHub Repository
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={isProcessing}
            title="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          <div>
            <label
              htmlFor="github-repo-url"
              style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary)' }}
            >
              Public Repository URL or owner/repo:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="github-repo-url"
                type="text"
                value={repoInput}
                onChange={(e) => {
                  setRepoInput(e.target.value);
                  setMetadata(null);
                  setErrorMessage(null);
                }}
                placeholder="e.g. satyam-info/CommitShield or https://github.com/facebook/react"
                disabled={isProcessing || isValidating}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleInspect}
                disabled={!repoInput.trim() || isValidating || isProcessing}
              >
                {isValidating ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                <span>Inspect</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>Quick test:</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.1rem 0.4rem', fontSize: '0.6875rem' }}
                onClick={() => loadSampleRepo('satyam-info/CommitShield')}
              >
                satyam-info/CommitShield
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.1rem 0.4rem', fontSize: '0.6875rem' }}
                onClick={() => loadSampleRepo('https://github.com/expressjs/express')}
              >
                expressjs/express
              </button>
            </div>
          </div>

          {metadata && (
            <div
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {metadata.fullName}
                </span>
                <span className="location-pill" style={{ color: 'var(--safe-text)' }}>
                  Verified Public Repository
                </span>
              </div>

              {metadata.description && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {metadata.description}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Star size={12} /> {metadata.stars.toLocaleString()} stars
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <GitFork size={12} /> {metadata.forks.toLocaleString()} forks
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <HardDrive size={12} /> {(metadata.sizeKb / 1024).toFixed(1)} MB reported size
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem' }}>
                <label htmlFor="branch-select" style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                  Select Branch:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <GitBranch size={13} />
                  <select
                    id="branch-select"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {branches.length > 0 ? (
                      branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))
                    ) : (
                      <option value={metadata.defaultBranch}>{metadata.defaultBranch}</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>
              <input
                type="checkbox"
                checked={scanHistory}
                onChange={(e) => setScanHistory(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
                disabled={isProcessing}
              />
              <div>
                <strong>Scan Recent Git Commit History (Bounded: 10 Commits)</strong>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem', marginTop: '0.15rem' }}>
                  Analyzes recent commit patch diffs to detect credentials committed historically even if deleted from the latest HEAD files.
                </div>
              </div>
            </label>
          </div>

          <div
            style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.6875rem',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.4rem',
            }}
          >
            <Shield size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-secondary)' }} />
            <span>
              <strong>Zero-Knowledge & Token-Free:</strong> CommitShield fetches public repository archives directly into browser memory. No GitHub credentials, tokens, or passwords are ever requested, stored, or sent to external servers.
            </span>
          </div>

          {statusMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <Loader2 size={14} className="spin" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--critical-text)', backgroundColor: 'var(--critical-bg)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={metadata ? handleStartImport : handleInspect}
            disabled={!parsed.isValid || isValidating || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="spin" />
                <span>Importing & Scanning...</span>
              </>
            ) : metadata ? (
              <>
                <Sparkles size={14} />
                <span>Import & Scan Repository</span>
              </>
            ) : (
              <>
                <Search size={14} />
                <span>Inspect Repository</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
