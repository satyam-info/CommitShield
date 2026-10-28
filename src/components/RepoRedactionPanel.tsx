import React, { useState } from 'react';
import { Copy, Check, RotateCw, Download, ArrowLeftRight, CheckCircle2, FileCode } from 'lucide-react';
import JSZip from 'jszip';
import type { RepositoryScanResult } from '../scanner';
import { redactRepository, scanRepository } from '../scanner';

interface RepoRedactionPanelProps {
  files: Record<string, string>;
  repoResult: RepositoryScanResult;
  selectedFile: string | null;
  onApplyToRepo: (sanitizedFiles: Record<string, string>, newResult: RepositoryScanResult) => void;
}

export const RepoRedactionPanel: React.FC<RepoRedactionPanelProps> = ({
  files,
  repoResult,
  selectedFile,
  onApplyToRepo,
}) => {
  const [mode, setMode] = useState<'placeholder' | 'env'>('placeholder');
  const [copied, setCopied] = useState(false);
  const [rescanVerified, setRescanVerified] = useState<boolean | null>(null);

  const activeFilePath = selectedFile || repoResult.files.find((f) => f.findings.length > 0)?.filePath || Object.keys(files)[0] || '';
  const sanitizedFiles = redactRepository(files, repoResult, mode);
  const activeRedactedCode = sanitizedFiles[activeFilePath] || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeRedactedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleDownloadSanitizedZip = async () => {
    const zip = new JSZip();
    for (const [path, content] of Object.entries(sanitizedFiles)) {
      zip.file(path, content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sanitized_${repoResult.repoName || 'repository'}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRescan = () => {
    const rescanResult = scanRepository(sanitizedFiles, repoResult.repoName, repoResult.skippedFiles);
    setRescanVerified(rescanResult.summary.total === 0);
  };

  const handleApply = () => {
    const rescanResult = scanRepository(sanitizedFiles, repoResult.repoName, repoResult.skippedFiles);
    onApplyToRepo(sanitizedFiles, rescanResult);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ArrowLeftRight size={16} />
          <span>Repository Safe Redaction</span>
        </div>

        <div className="segment-tabs">
          <button
            type="button"
            className={`tab-btn ${mode === 'placeholder' ? 'active' : ''}`}
            onClick={() => { setMode('placeholder'); setRescanVerified(null); }}
            title="Replace secrets with <REDACTED_TYPE> tags"
          >
            Placeholders
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'env' ? 'active' : ''}`}
            onClick={() => { setMode('env'); setRescanVerified(null); }}
            title="Replace secrets with process.env.* variables"
          >
            Env Variables
          </button>
        </div>
      </div>

      <div style={{ padding: '0.45rem 1rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <FileCode size={13} />
          <span>Viewing: <strong>{activeFilePath}</strong></span>
        </div>
        <span className="panel-meta">
          {repoResult.allFindings.length} secrets redacted across {repoResult.files.filter((f) => f.findings.length > 0).length} files
        </span>
      </div>

      {rescanVerified && (
        <div style={{
          backgroundColor: 'var(--safe-bg)',
          color: 'var(--safe-text)',
          borderBottom: '1px solid var(--safe-border)',
          padding: '0.625rem 1.125rem',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <CheckCircle2 size={15} />
          <span><strong>Rescan Verified:</strong> 0 heuristic pattern matches remain across all {repoResult.totalFilesScanned} repository files.</span>
        </div>
      )}

      <pre className="redaction-preview-area">{activeRedactedCode}</pre>

      <div className="panel-footer">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopy}
            title="Copy active sanitized file"
          >
            {copied ? <Check size={14} color="var(--safe-dot)" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy File'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownloadSanitizedZip}
            title="Download complete sanitized repository as ZIP"
          >
            <Download size={14} />
            <span>Download Clean ZIP</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleApply}
            title="Apply sanitized changes across repository"
          >
            <span>Apply to Repo</span>
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleRescan}
          title="Rescan all sanitized repository files to verify 0 secrets remain"
        >
          <RotateCw size={14} />
          <span>Rescan Clean Repo</span>
        </button>
      </div>
    </div>
  );
};

