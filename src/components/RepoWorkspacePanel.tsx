import React, { useRef, useState } from 'react';
import { UploadCloud, FolderArchive, ChevronDown, ChevronRight, AlertCircle, Sparkles, FolderGit2 } from 'lucide-react';
import type { RepositoryScanResult, FileFinding } from '../scanner';
import { SourceCodeViewer } from './SourceCodeViewer';

interface RepoWorkspacePanelProps {
  repoResult: RepositoryScanResult | null;
  files: Record<string, string>;
  selectedFile: string | null;
  activeFinding?: FileFinding | null;
  onSelectFile: (filePath: string) => void;
  onSelectFinding?: (finding: FileFinding) => void;
  onUploadZip: (file: File) => void;
  onLoadDemoRepo?: () => void;
  onOpenGitHubImport?: () => void;
  isProcessing: boolean;
  error?: string | null;
}

export const RepoWorkspacePanel: React.FC<RepoWorkspacePanelProps> = ({
  repoResult,
  files,
  selectedFile,
  activeFinding,
  onSelectFile,
  onUploadZip,
  onLoadDemoRepo,
  onOpenGitHubImport,
  isProcessing,
  error,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [filterText, setFilterText] = useState('');

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.zip')) {
        onUploadZip(file);
      }
    }
  };

  const fileList = Object.keys(files).filter((p) =>
    p.toLowerCase().includes(filterText.toLowerCase())
  );

  const selectedCode = selectedFile ? files[selectedFile] || '' : '';
  const affectedFilesCount = repoResult
    ? repoResult.files.filter((f) => f.findings.length > 0).length
    : 0;

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          {repoResult?.githubRef ? <FolderGit2 size={16} /> : <FolderArchive size={16} />}
          <span>{repoResult ? repoResult.repoName : 'Repository Archive (.zip)'}</span>
        </div>

        {repoResult && (
          <div className="panel-meta" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span><strong>{repoResult.totalFilesScanned}</strong> files</span>
            <span style={{ opacity: 0.4 }}>•</span>
            <span><strong style={{ color: affectedFilesCount > 0 ? 'var(--critical-text)' : 'inherit' }}>{affectedFilesCount}</strong> affected</span>
            <span style={{ opacity: 0.4 }}>•</span>
            <span><strong>{repoResult.totalLinesScanned.toLocaleString()}</strong> lines</span>
            {repoResult.totalFilesSkipped > 0 && (
              <>
                <span style={{ opacity: 0.4 }}>•</span>
                <span><strong>{repoResult.totalFilesSkipped}</strong> skipped</span>
              </>
            )}
          </div>
        )}
      </div>

      <div
        className={`dropzone-overlay ${dragActive ? 'active' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onClick={() => fileInputRef.current?.click()}
        title="Upload project ZIP archive"
      >
        <UploadCloud size={16} />
        <span>
          {isProcessing
            ? 'Extracting and verifying archive...'
            : 'Drop repository .zip archive here or click to browse (max 25MB)'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onUploadZip(e.target.files[0]);
            }
          }}
        />
      </div>

      {(!repoResult || Object.keys(files).length === 0) && (
        <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)', flexWrap: 'wrap' }}>
          {onOpenGitHubImport && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onOpenGitHubImport}
              title="Import public GitHub repository and scan source & history"
            >
              <FolderGit2 size={13} />
              <span>Import from GitHub</span>
            </button>
          )}

          {onLoadDemoRepo && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onLoadDemoRepo}
              title="Load built-in realistic multi-file repository with fabricated test credentials"
            >
              <Sparkles size={13} />
              <span>Load Demo Repository</span>
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ margin: '0.5rem 0.75rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--critical-bg)', color: 'var(--critical-text)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {repoResult && (
        <>
          {repoResult.totalFilesScanned === 0 && (
            <div style={{ margin: '1rem', padding: '1rem', backgroundColor: 'var(--bg-surface-subtle)', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Empty repository: No supported text or source files found in this archive.
            </div>
          )}

          {repoResult.totalFilesScanned > 0 && (
            <>
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-subtle)' }}>
                <input
                  type="text"
                  aria-label="Filter repository files"
                  placeholder="Filter repository files by path..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.65rem',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>

              <div className="repo-file-tree" aria-label="Repository files list">
                {fileList.map((filePath) => {
                  const fileStat = repoResult.files.find((f) => f.filePath === filePath);
                  const findingsCount = fileStat ? fileStat.findings.length : 0;
                  const isSelected = selectedFile === filePath;

                  return (
                    <button
                      type="button"
                      key={filePath}
                      className={`repo-file-item ${isSelected ? 'active' : ''}`}
                      onClick={() => onSelectFile(filePath)}
                      title={filePath}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {filePath}
                      </span>
                      {findingsCount > 0 ? (
                        <span className="file-findings-count has-findings">
                          {findingsCount} {findingsCount === 1 ? 'issue' : 'issues'}
                        </span>
                      ) : (
                        <span className="file-findings-count" style={{ color: 'var(--safe-text)' }}>
                          clean
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {repoResult.skippedFiles.length > 0 && (
                <div>
                  <button
                    type="button"
                    className="skipped-summary-toggle"
                    onClick={() => setShowSkipped(!showSkipped)}
                  >
                    <span>
                      <strong>{repoResult.skippedFiles.length}</strong> non-text or ignored files skipped
                    </span>
                    {showSkipped ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {showSkipped && (
                    <div style={{ maxHeight: '160px', overflowY: 'auto', borderTop: '1px solid var(--border-subtle)' }}>
                      <table className="skipped-table">
                        <thead>
                          <tr>
                            <th>Path</th>
                            <th>Reason</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {repoResult.skippedFiles.map((s, idx) => (
                            <tr key={`${s.path}-${idx}`}>
                              <td><code>{s.path}</code></td>
                              <td>{s.reason}</td>
                              <td>{s.details || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <SourceCodeViewer
                code={selectedCode}
                fileName={selectedFile || undefined}
                activeFinding={activeFinding?.filePath === selectedFile ? activeFinding : null}
              />
            </>
          )}
        </>
      )}

      <div className="disclaimer-banner">
        Deterministic repository scanning operates 100% locally in your browser. All ZIP extraction and heuristics run client-side.
      </div>
    </div>
  );
};
