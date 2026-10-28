import React, { useState } from 'react';
import { Header } from './components/Header';
import { CodeInputPanel } from './components/CodeInputPanel';
import { FindingsPanel } from './components/FindingsPanel';
import { RedactionPanel } from './components/RedactionPanel';
import { RepoWorkspacePanel } from './components/RepoWorkspacePanel';
import { RepoFindingsPanel } from './components/RepoFindingsPanel';
import { RepoRedactionPanel } from './components/RepoRedactionPanel';
import { GitHistoryPanel } from './components/GitHistoryPanel';
import { GitHubImportModal } from './components/GitHubImportModal';
import { ExportModal } from './components/ExportModal';
import {
  scanContent,
  scanRepository,
  extractZipArchive,
  prioritizeFindings,
  SAMPLE_VULNERABLE_CODE,
  SAFE_CODE_SAMPLE,
  DEMO_REPOSITORY_FILES,
  SAMPLE_SAFE_REPO_FIXTURE,
  type ScanResult,
  type RepositoryScanResult,
  type FileFinding,
  type PrioritizedFinding,
} from './scanner';
import './App.css';

export const App: React.FC = () => {
  // Mode: snippet vs repository
  const [scanMode, setScanMode] = useState<'snippet' | 'repository'>('snippet');

  // Single file state
  const [code, setCode] = useState<string>(SAMPLE_VULNERABLE_CODE);
  const [fileName, setFileName] = useState<string | undefined>('demo_config.ts');
  const [scanResult, setScanResult] = useState<ScanResult | null>(() =>
    scanContent(SAMPLE_VULNERABLE_CODE, { fileName: 'demo_config.ts' })
  );
  const [snippetTab, setSnippetTab] = useState<'findings' | 'redaction'>('findings');
  const [isScanningSnippet, setIsScanningSnippet] = useState<boolean>(false);

  // Repository state
  const [repoFiles, setRepoFiles] = useState<Record<string, string>>(DEMO_REPOSITORY_FILES);
  const [repoResult, setRepoResult] = useState<RepositoryScanResult | null>(() =>
    scanRepository(DEMO_REPOSITORY_FILES, 'demo-repository')
  );
  const [selectedRepoFile, setSelectedRepoFile] = useState<string | null>('src/config.ts');
  const [activeRepoFinding, setActiveRepoFinding] = useState<PrioritizedFinding | FileFinding | null>(() => {
    const initialRepo = scanRepository(DEMO_REPOSITORY_FILES, 'demo-repository');
    const prioritized = prioritizeFindings(initialRepo.allFindings);
    return prioritized[0] || null;
  });
  const [repoTab, setRepoTab] = useState<'findings' | 'redaction' | 'history'>('findings');
  const [isProcessingZip, setIsProcessingZip] = useState<boolean>(false);
  const [zipError, setZipError] = useState<string | null>(null);

  // Modals
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showGitHubModal, setShowGitHubModal] = useState<boolean>(false);

  // Single snippet actions
  const handleScanSnippet = () => {
    setIsScanningSnippet(true);
    setTimeout(() => {
      const result = scanContent(code, { fileName });
      setScanResult(result);
      setIsScanningSnippet(false);
      if (result.findings.length > 0) {
        setSnippetTab('findings');
      }
    }, 40);
  };

  const handleApplySnippetToEditor = (sanitizedCode: string) => {
    setCode(sanitizedCode);
    const result = scanContent(sanitizedCode, { fileName });
    setScanResult(result);
    setSnippetTab('findings');
  };

  // ZIP archive processing
  const handleUploadZip = async (file: File) => {
    setZipError(null);
    setIsProcessingZip(true);

    try {
      const extraction = await extractZipArchive(file);
      if (!extraction.success) {
        setZipError(extraction.error || 'Failed to extract ZIP archive.');
        setIsProcessingZip(false);
        return;
      }

      setRepoFiles(extraction.files);
      const res = scanRepository(extraction.files, file.name, extraction.skippedFiles);
      setRepoResult(res);

      const prioritized = prioritizeFindings(res.allFindings);
      const firstFileWithIssues = prioritized[0]?.filePath;
      const initialFile = firstFileWithIssues || Object.keys(extraction.files)[0] || null;
      setSelectedRepoFile(initialFile);
      setActiveRepoFinding(prioritized[0] || null);

      setScanMode('repository');
      setRepoTab('findings');
    } catch (err) {
      setZipError(`Error processing archive: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessingZip(false);
    }
  };

  // Sample loading
  const handleLoadVulnerableSample = () => {
    if (scanMode === 'snippet') {
      setCode(SAMPLE_VULNERABLE_CODE);
      setFileName('sample_vulnerable.ts');
      const result = scanContent(SAMPLE_VULNERABLE_CODE, { fileName: 'sample_vulnerable.ts' });
      setScanResult(result);
      setSnippetTab('findings');
    } else {
      setRepoFiles(DEMO_REPOSITORY_FILES);
      const result = scanRepository(DEMO_REPOSITORY_FILES, 'demo-repository');
      setRepoResult(result);
      const prioritized = prioritizeFindings(result.allFindings);
      const firstFileWithIssues = prioritized[0]?.filePath || 'src/config.ts';
      setSelectedRepoFile(firstFileWithIssues);
      const firstFinding = prioritized.find((f) => f.filePath === firstFileWithIssues) || prioritized[0] || null;
      setActiveRepoFinding(firstFinding);
      setRepoTab('findings');
      setZipError(null);
    }
  };

  const handleLoadSafeSample = () => {
    if (scanMode === 'snippet') {
      setCode(SAFE_CODE_SAMPLE);
      setFileName('safe_production_code.ts');
      const result = scanContent(SAFE_CODE_SAMPLE, { fileName: 'safe_production_code.ts' });
      setScanResult(result);
      setSnippetTab('findings');
    } else {
      setRepoFiles(SAMPLE_SAFE_REPO_FIXTURE);
      const result = scanRepository(SAMPLE_SAFE_REPO_FIXTURE, 'safe-production-repo');
      setRepoResult(result);
      setSelectedRepoFile(Object.keys(SAMPLE_SAFE_REPO_FIXTURE)[0] || null);
      setActiveRepoFinding(null);
      setRepoTab('findings');
      setZipError(null);
    }
  };

  const handleClear = () => {
    if (scanMode === 'snippet') {
      setCode('');
      setFileName(undefined);
      setScanResult(null);
      setSnippetTab('findings');
    } else {
      setRepoFiles({});
      setRepoResult(null);
      setSelectedRepoFile(null);
      setActiveRepoFinding(null);
      setRepoTab('findings');
      setZipError(null);
    }
  };

  const handleSelectRepoFile = (filePath: string) => {
    setSelectedRepoFile(filePath);
    if (!repoResult) {
      setActiveRepoFinding(null);
      return;
    }
    const prioritized = prioritizeFindings(repoResult.allFindings);
    const firstFindingInFile = prioritized.find((f) => f.filePath === filePath);
    setActiveRepoFinding(firstFindingInFile || null);
  };

  const handleSelectRepoFinding = (finding: FileFinding) => {
    setSelectedRepoFile(finding.filePath);
    setActiveRepoFinding(finding);
  };

  const handleApplyToRepo = (sanitizedFiles: Record<string, string>, newResult: RepositoryScanResult) => {
    setRepoFiles(sanitizedFiles);
    setRepoResult(newResult);
    setActiveRepoFinding(null);
    setRepoTab('findings');
  };

  const hasFindings =
    scanMode === 'snippet'
      ? Boolean(scanResult && scanResult.findings.length > 0)
      : Boolean(repoResult && repoResult.allFindings.length > 0);

  return (
    <div className="app-container">
      <Header
        scanMode={scanMode}
        onModeChange={setScanMode}
        onLoadVulnerableSample={handleLoadVulnerableSample}
        onLoadSafeSample={handleLoadSafeSample}
        onOpenGitHubImport={() => setShowGitHubModal(true)}
        onClear={handleClear}
        hasFindings={hasFindings}
        onOpenExport={() => setShowExportModal(true)}
      />

      <main className="workspace-grid">
        {scanMode === 'snippet' ? (
          <>
            <CodeInputPanel
              code={code}
              fileName={fileName}
              onCodeChange={setCode}
              onFileNameChange={setFileName}
              onScan={handleScanSnippet}
              isScanning={isScanningSnippet}
              onZipUpload={handleUploadZip}
            />

            {snippetTab === 'findings' ? (
              <FindingsPanel
                scanResult={scanResult}
                activeTab={snippetTab}
                onTabChange={setSnippetTab}
              />
            ) : scanResult ? (
              <RedactionPanel
                originalCode={code}
                scanResult={scanResult}
                onApplyToEditor={handleApplySnippetToEditor}
              />
            ) : (
              <FindingsPanel
                scanResult={scanResult}
                activeTab={snippetTab}
                onTabChange={setSnippetTab}
              />
            )}
          </>
        ) : (
          <>
            <RepoWorkspacePanel
              repoResult={repoResult}
              files={repoFiles}
              selectedFile={selectedRepoFile}
              activeFinding={activeRepoFinding}
              onSelectFile={handleSelectRepoFile}
              onSelectFinding={handleSelectRepoFinding}
              onUploadZip={handleUploadZip}
              onLoadDemoRepo={handleLoadVulnerableSample}
              onOpenGitHubImport={() => setShowGitHubModal(true)}
              isProcessing={isProcessingZip}
              error={zipError}
            />

            {repoTab === 'history' && repoResult?.gitHistory ? (
              <GitHistoryPanel
                historyResult={repoResult.gitHistory}
                repoFullName={repoResult.githubRef ? `${repoResult.githubRef.owner}/${repoResult.githubRef.repo}` : repoResult.repoName}
                activeTab={repoTab}
                onTabChange={setRepoTab}
                findingsCount={repoResult.summary.total}
              />
            ) : repoTab === 'redaction' && repoResult ? (
              <RepoRedactionPanel
                files={repoFiles}
                repoResult={repoResult}
                selectedFile={selectedRepoFile}
                onApplyToRepo={handleApplyToRepo}
              />
            ) : (
              <RepoFindingsPanel
                repoResult={repoResult}
                activeTab={repoTab}
                onTabChange={setRepoTab}
                selectedFile={selectedRepoFile}
                onSelectFile={handleSelectRepoFile}
                activeFinding={activeRepoFinding}
                onSelectFinding={handleSelectRepoFinding}
              />
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <div>
          <strong>CommitShield</strong> — Local Zero-Knowledge Developer Security
        </div>
        <div>
          100% Client-side execution / No cloud data transfer / Heuristic inspection
        </div>
      </footer>

      {showExportModal && (
        <ExportModal
          scanResult={scanMode === 'snippet' ? (scanResult as ScanResult) : (repoResult as RepositoryScanResult)}
          isRepoMode={scanMode === 'repository'}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showGitHubModal && (
        <GitHubImportModal
          isOpen={showGitHubModal}
          onClose={() => setShowGitHubModal(false)}
          onImportSuccess={(files, result) => {
            setRepoFiles(files);
            setRepoResult(result);
            const firstFileWithIssues = result.files.find((f) => f.findings.length > 0)?.filePath;
            const initialFile = firstFileWithIssues || Object.keys(files)[0] || null;
            setSelectedRepoFile(initialFile);
            const prioritized = prioritizeFindings(result.allFindings);
            setActiveRepoFinding(prioritized[0] || null);
            setScanMode('repository');
            if (result.gitHistory && result.gitHistory.totalHistoricalFindings > 0 && result.allFindings.length === 0) {
              setRepoTab('history');
            } else {
              setRepoTab('findings');
            }
          }}
        />
      )}
    </div>
  );
};

export default App;
