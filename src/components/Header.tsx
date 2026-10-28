import React from 'react';
import { ShieldCheck, FileWarning, CheckCircle2, RotateCcw, Download, FolderArchive, FileCode, FolderGit2 } from 'lucide-react';

interface HeaderProps {
  scanMode: 'snippet' | 'repository';
  onModeChange: (mode: 'snippet' | 'repository') => void;
  onLoadVulnerableSample: () => void;
  onLoadSafeSample: () => void;
  onOpenGitHubImport?: () => void;
  onClear: () => void;
  hasFindings: boolean;
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  scanMode,
  onModeChange,
  onLoadVulnerableSample,
  onLoadSafeSample,
  onOpenGitHubImport,
  onClear,
  hasFindings,
  onOpenExport,
}) => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon" aria-hidden="true">
          <ShieldCheck size={20} strokeWidth={2.2} />
        </div>
        <div>
          <div className="brand-title">
            <span>CommitShield</span>
            <span className="brand-badge">Local Offline Security</span>
          </div>
        </div>

        <div className="segment-tabs" style={{ marginLeft: 16 }}>
          <button
            type="button"
            className={`tab-btn ${scanMode === 'snippet' ? 'active' : ''}`}
            onClick={() => onModeChange('snippet')}
            title="Scan pasted code snippet or single file"
          >
            <FileCode size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            <span>Code Snippet</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${scanMode === 'repository' ? 'active' : ''}`}
            onClick={() => onModeChange('repository')}
            title="Scan multi-file project repository (.zip)"
          >
            <FolderArchive size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            <span>Repository (.zip)</span>
          </button>
        </div>
      </div>

      <div className="header-actions">
        {onOpenGitHubImport && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenGitHubImport}
            title="Import public GitHub repository and scan source & history"
          >
            <FolderGit2 size={14} />
            <span>Import GitHub</span>
          </button>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onLoadVulnerableSample}
          title={scanMode === 'repository' ? 'Load realistic multi-file repository with fabricated test secrets' : 'Load code snippet containing fictional dummy test secrets'}
        >
          <FileWarning size={14} />
          <span>{scanMode === 'repository' ? 'Load Demo Repo' : 'Vulnerable Sample'}</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onLoadSafeSample}
          title={scanMode === 'repository' ? 'Load clean sample repository without credentials' : 'Load safe code snippet without credentials'}
        >
          <CheckCircle2 size={14} />
          <span>{scanMode === 'repository' ? 'Safe Repo' : 'Safe Sample'}</span>
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onClear}
          title="Clear editor and scan results"
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onOpenExport}
          title="Export scan report as Markdown or JSON"
        >
          <Download size={14} />
          <span>Export Report</span>
          {hasFindings && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--critical-dot)',
                display: 'inline-block',
                marginLeft: 2,
              }}
              title="Findings detected"
            />
          )}
        </button>
      </div>
    </header>
  );
};
