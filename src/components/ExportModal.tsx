import React, { useState } from 'react';
import { Download, Copy, Check, X, FileText } from 'lucide-react';
import type { ScanResult } from '../scanner';
import { generateMarkdownReport, generateJsonReport } from '../scanner';

interface ExportModalProps {
  scanResult: ScanResult;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ scanResult, onClose }) => {
  const [activeTab, setActiveTab] = useState<'markdown' | 'json'>('markdown');
  const [copied, setCopied] = useState(false);

  const markdownContent = generateMarkdownReport(scanResult);
  const jsonContent = generateJsonReport(scanResult);
  const currentContent = activeTab === 'markdown' ? markdownContent : jsonContent;

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
    const filename =
      activeTab === 'markdown' ? 'COMMITSHIELD_REPORT.md' : 'commitshield-report.json';
    const mimeType = activeTab === 'markdown' ? 'text/markdown' : 'application/json';

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
          maxWidth: '680px',
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
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Export Security Report</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="segment-tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'markdown' ? 'active' : ''}`}
                onClick={() => setActiveTab('markdown')}
              >
                Markdown
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
                onClick={() => setActiveTab('json')}
              >
                JSON
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

        <div style={{ padding: '0.75rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-subtle)' }}>
          All detected credentials in this report are automatically masked and safe to commit or share with your team.
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
            <span>Download {activeTab.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
