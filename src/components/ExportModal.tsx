import React, { useState } from 'react';
import { Download, Copy, Check, X, FileText, Shield } from 'lucide-react';
import type { ScanResult, RepositoryScanResult } from '../scanner';
import {
  generateMarkdownReport,
  generateJsonReport,
  generateRepoMarkdownReport,
  generateRepoJsonReport,
  generateRepoSarifReport,
  generateSnippetSarifReport,
} from '../scanner';

interface ExportModalProps {
  scanResult: ScanResult | RepositoryScanResult;
  isRepoMode?: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  scanResult,
  isRepoMode,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'markdown' | 'json' | 'sarif'>('markdown');
  const [copied, setCopied] = useState(false);

  const isRepo = isRepoMode || 'repoName' in scanResult;

  const markdownContent = isRepo
    ? generateRepoMarkdownReport(scanResult as RepositoryScanResult)
    : generateMarkdownReport(scanResult as ScanResult);

  const jsonContent = isRepo
    ? generateRepoJsonReport(scanResult as RepositoryScanResult)
    : generateJsonReport(scanResult as ScanResult);

  const sarifContent = isRepo
    ? generateRepoSarifReport(scanResult as RepositoryScanResult)
    : generateSnippetSarifReport(scanResult as ScanResult);

  const currentContent =
    activeTab === 'markdown'
      ? markdownContent
      : activeTab === 'json'
        ? jsonContent
        : sarifContent;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy report', err);
    }
  };

  const handleDownload = () => {
    let filename: string;
    let mimeType: string;

    if (activeTab === 'sarif') {
      filename = isRepo ? 'commitshield_repo.sarif.json' : 'commitshield_snippet.sarif.json';
      mimeType = 'application/sarif+json';
    } else if (activeTab === 'markdown') {
      filename = isRepo ? 'COMMITSHIELD_REPO_REPORT.md' : 'COMMITSHIELD_REPORT.md';
      mimeType = 'text/markdown';
    } else {
      filename = isRepo ? 'commitshield_repo_report.json' : 'commitshield-report.json';
      mimeType = 'application/json';
    }

    const blob = new Blob([currentContent], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 50,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-dropdown)',
          maxWidth: '720px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
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
            <FileText size={18} />
            <span id="export-modal-title" style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
              Export Security Report
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="segment-tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'markdown' ? 'active' : ''}`}
                onClick={() => setActiveTab('markdown')}
                title="Human-readable markdown summary"
              >
                Markdown
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
                onClick={() => setActiveTab('json')}
                title="Raw JSON scan report"
              >
                JSON
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'sarif' ? 'active' : ''}`}
                onClick={() => setActiveTab('sarif')}
                title="OASIS SARIF 2.1.0 compatible security report"
              >
                <Shield size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                <span>SARIF 2.1.0</span>
              </button>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              title="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: '0.625rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            {activeTab === 'sarif'
              ? 'SARIF 2.1.0 Compatible format — ready for VS Code SARIF viewers, GitHub Code Scanning uploads, and CI/CD tools.'
              : 'Zero unmasked credentials: all secret values are strictly masked in exported reports.'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
            {activeTab === 'sarif' ? 'OASIS Standard v2.1.0' : activeTab.toUpperCase()}
          </span>
        </div>

        <pre
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1rem 1.25rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            backgroundColor: '#ffffff',
            whiteSpace: 'pre',
          }}
        >
          {currentContent}
        </pre>

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
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
            {copied ? <Check size={14} color="var(--safe-dot)" /> : <Copy size={14} />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Report'}</span>
          </button>

          <button type="button" className="btn btn-primary btn-sm" onClick={handleDownload}>
            <Download size={14} />
            <span>Download {activeTab === 'sarif' ? 'SARIF (2.1.0)' : activeTab.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
