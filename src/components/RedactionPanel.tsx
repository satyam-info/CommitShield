import React, { useState } from 'react';
import { Copy, Check, RotateCw, Download, ArrowLeftRight, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ScanResult } from '../scanner';
import { redactSecrets, scanContent, verifySnippetRemediation, type RemediationVerification } from '../scanner';
import { CodeDiffViewer } from './CodeDiffViewer';

interface RedactionPanelProps {
  originalCode: string;
  scanResult: ScanResult;
  onApplyToEditor: (sanitizedCode: string) => void;
  onRescanRedacted?: (sanitizedCode: string, rescanResult: ScanResult) => void;
}

export const RedactionPanel: React.FC<RedactionPanelProps> = ({
  originalCode,
  scanResult,
  onApplyToEditor,
  onRescanRedacted,
}) => {
  const [mode, setMode] = useState<'placeholder' | 'env'>('placeholder');
  const [copied, setCopied] = useState(false);
  const [verification, setVerification] = useState<RemediationVerification | null>(null);

  const redactedCode = redactSecrets(originalCode, scanResult.findings, mode);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(redactedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([redactedCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = scanResult.fileName
      ? `redacted_${scanResult.fileName}`
      : 'commitshield_redacted.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRescanAndVerify = () => {
    const rescanResult = scanContent(redactedCode, { fileName: scanResult.fileName });
    const result = verifySnippetRemediation(scanResult, rescanResult);
    setVerification(result);

    if (onRescanRedacted) {
      onRescanRedacted(redactedCode, rescanResult);
    }
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
            onClick={() => {
              setMode('placeholder');
              setVerification(null);
            }}
            title="Replace secrets with <REDACTED_TYPE> tags"
          >
            Placeholders
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'env' ? 'active' : ''}`}
            onClick={() => {
              setMode('env');
              setVerification(null);
            }}
            title="Replace secrets with process.env.* variables"
          >
            Env Variables
          </button>
        </div>
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
        modifiedCode={redactedCode}
        fileName={scanResult.fileName || 'snippet.ts'}
      />

      <div className="panel-footer">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopy}
            title="Copy sanitized code to clipboard"
          >
            {copied ? <Check size={14} color="var(--safe-dot)" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownload}
            title="Download sanitized file"
          >
            <Download size={14} />
            <span>Download</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onApplyToEditor(redactedCode)}
            title="Replace editor code with this sanitized version"
          >
            <CheckCircle2 size={14} />
            <span>Apply to Editor</span>
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleRescanAndVerify}
          title="Rescan sanitized code to verify 0 secrets remain"
        >
          <RotateCw size={14} />
          <span>Rescan & Verify</span>
        </button>
      </div>
    </div>
  );
};
