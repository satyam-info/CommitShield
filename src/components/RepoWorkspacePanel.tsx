import React, { useRef, useState } from 'react';
import { UploadCloud, FolderArchive, ChevronDown, ChevronRight, AlertCircle, FileCode } from 'lucide-react';
import type { RepositoryScanResult } from '../scanner';

interface RepoWorkspacePanelProps {
  repoResult: RepositoryScanResult | null;
  files: Record<string, string>;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  onUploadZip: (file: File) => void;
  isProcessing: boolean;
  error?: string | null;
}

export const RepoWorkspacePanel: React.FC<RepoWorkspacePanelProps> = ({
  repoResult,
  files,
  selectedFile,
  onSelectFile,
  onUploadZip,
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
  const selectedLines = selectedCode ? selectedCode.split(/\r?\n/).length : 0;

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <FolderArchive size={16} />
          <span>{repoResult ? repoResult.repoName : 'Repository Archive (.zip)'}</span>
        </div>

        {repoResult && (
          <div className="panel-meta">
            <span>{repoResult.totalFilesScanned} scanned</span>
            <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
            <span>{repoResult.totalFilesSkipped} skipped</span>
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

      {error && (
        <div style={{ margin: '0 0.75rem 0.5rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--critical-bg)', color: 'var(--critical-text)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {repoResult && (
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

          <div className="repo-file-tree">
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

          <div style={{ padding: '0.5rem 0.875rem', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)' }}>
              <FileCode size={13} />
              <span>{selectedFile || 'Select a file'}</span>
            </div>
            {selectedFile && (
              <span className="panel-meta">
                {selectedLines} {selectedLines === 1 ? 'line' : 'lines'}
              </span>
            )}
          </div>

          <div className="editor-container" style={{ minHeight: '260px' }}>
            <textarea
              readOnly
              aria-label="Selected file content"
              className="code-textarea"
              style={{ minHeight: '260px', backgroundColor: 'var(--bg-surface-subtle)' }}
              value={selectedCode}
              placeholder="// Select a file from the repository tree above to view source code..."
              spellCheck={false}
            />
          </div>
        </>
      )}

      <div className="disclaimer-banner">
        Deterministic repository scanning operates 100% locally in your browser. All ZIP extraction and heuristics run client-side.
      </div>
    </div>
  );
};
