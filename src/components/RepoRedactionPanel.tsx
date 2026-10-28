import React, { useState } from 'react';
import { Copy, Check, RotateCw, Download, ArrowLeftRight, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import JSZip from 'jszip';
import type { RepositoryScanResult } from '../scanner';
import { redactRepository, scanRepository, verifyRepoRemediation, type RemediationVerification } from '../scanner';
import { CodeDiffViewer } from './CodeDiffViewer';

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
  const [verification, setVerification] = useState<RemediationVerification | null>(null);

  const activeFilePath = selectedFile || repoResult.files.find((f) => f.findings.length > 0)?.filePath || Object.keys(files)[0] || '';
  const sanitizedFiles = redactRepository(files, repoResult, mode);
  const originalCode = files[activeFilePath] || '';
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

  const handleRescanAndVerify = () => {
    const rescanResult = scanRepository(sanitizedFiles, repoResult.repoName, repoResult.skippedFiles);
    const result = verifyRepoRemediation(repoResult, rescanResult);
    setVerification(result);
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
          <span>Remediation Review & Verification</span>
        </div>

        <div className="segment-tabs">
          <button
            type="button"
            className={`tab-btn ${mode === 'placeholder' ? 'active' : ''}`}
            onClick={() => { setMode('placeholder'); setVerification(null); }}
            title="Replace secrets with <REDACTED_TYPE> tags"
          >
            Placeholders
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'env' ? 'active' : ''}`}
            onClick={() => { setMode('env'); setVerification(null); }}
            title="Replace secrets with process.env.* variables"
          >
            Env Variables
          </button>
        </div>
      </div>

      <div style={{ padding: '0.45rem 1rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>Diff Target: <strong>{activeFilePath}</strong></span>
        </div>
        <span className="panel-meta">
          {repoResult.allFindings.length} secrets redacted across {repoResult.files.filter((f) => f.findings.length > 0).length} files
        </span>
      </div>

      {verification && (
        <div
          style={{
            backgroundColor: verification.isFullyRemediated ? 'var(--safe-bg)' : 'var(--high-bg)',
            color: verification.isFullyRemediated ? 'var(--safe-text)' : 'var(--high-text)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '0.75rem 1rem',
            fontSize: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            {verification.isFullyRemediated ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
            <span>{verification.statusMessage}</span>
          </div>
          <div style={{ fontSize: '0.6875rem', opacity: 0.9 }}>
            Resolved: <strong>{verification.totalResolved}</strong> / Remaining: <strong>{verification.totalRemaining}</strong> / New: <strong>{verification.totalNew}</strong>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontStyle: 'italic' }}>
            {verification.revocationDisclaimer}
          </div>
        </div>
      )}

      <CodeDiffViewer
        originalCode={originalCode}
        modifiedCode={activeRedactedCode}
        fileName={activeFilePath}
      />

      <div className="panel-footer">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            <CheckCircle2 size={14} />
            <span>Apply to Repo</span>
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleRescanAndVerify}
          title="Rescan modified repository files to verify secret removal"
        >
          <RotateCw size={14} />
          <span>Rescan & Verify</span>
        </button>
      </div>
    </div>
  );
};
