import React, { useState } from 'react';
import { Copy, Check, RotateCw, Download, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import type { ScanResult } from '../scanner';
import { redactSecrets, scanContent } from '../scanner';

interface RedactionPanelProps {
  originalCode: string;
  scanResult: ScanResult;
  onApplyToEditor: (sanitizedCode: string) => void;
  onRescanRedacted: (sanitizedCode: string, rescanResult: ScanResult) => void;
}

export const RedactionPanel: React.FC<RedactionPanelProps> = ({
  originalCode,
  scanResult,
  onApplyToEditor,
  onRescanRedacted,
}) => {
  const [mode, setMode] = useState<'placeholder' | 'env'>('placeholder');
  const [copied, setCopied] = useState(false);
  const [rescanVerified, setRescanVerified] = useState<boolean | null>(null);

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

  const handleRescan = () => {
    const rescanResult = scanContent(redactedCode, { fileName: scanResult.fileName });
    setRescanVerified(rescanResult.findings.length === 0);
    onRescanRedacted(redactedCode, rescanResult);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ArrowLeftRight size={16} />
          <span>Safe Redaction Preview</span>
        </div>

        <div className="segment-tabs">
          <button
            type="button"
            className={`tab-btn ${mode === 'placeholder' ? 'active' : ''}`}
            onClick={() => {
              setMode('placeholder');
              setRescanVerified(null);
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
              setRescanVerified(null);
            }}
            title="Replace secrets with process.env.* variables"
          >
            Env Variables
          </button>
        </div>
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
          <span><strong>Rescan Verified:</strong> 0 exposed secrets remain in the sanitized code. Safe to commit!</span>
        </div>
      )}

      <pre className="redaction-preview-area">{redactedCode}</pre>

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
            <span>Apply to Editor</span>
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleRescan}
          title="Rescan this sanitized code to confirm 0 secrets remain"
        >
          <RotateCw size={14} />
          <span>Rescan Redacted Code</span>
        </button>
      </div>
    </div>
  );
};
