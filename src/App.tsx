import React, { useState } from 'react';
import { Header } from './components/Header';
import { CodeInputPanel } from './components/CodeInputPanel';
import { FindingsPanel } from './components/FindingsPanel';
import { RedactionPanel } from './components/RedactionPanel';
import { RepoWorkspacePanel } from './components/RepoWorkspacePanel';
import { RepoFindingsPanel } from './components/RepoFindingsPanel';
import { RepoRedactionPanel } from './components/RepoRedactionPanel';
import { ExportModal } from './components/ExportModal';
import {
  scanContent,
  scanRepository,
  extractZipArchive,
  SAMPLE_VULNERABLE_CODE,
  SAFE_CODE_SAMPLE,
  DEMO_REPOSITORY_FILES,
  SAMPLE_SAFE_REPO_FIXTURE,
  type ScanResult,
  type RepositoryScanResult,
  type FileFinding,
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
  const [activeRepoFinding, setActiveRepoFinding] = useState<FileFinding | null>(() => {
    const initialRepo = scanRepository(DEMO_REPOSITORY_FILES, 'demo-repository');
    return initialRepo.allFindings[0] || null;
  });
  const [repoTab, setRepoTab] = useState<'findings' | 'redaction'>('findings');
  const [isProcessingZip, setIsProcessingZip] = useState<boolean>(false);
  const [zipError, setZipError] = useState<string | null>(null);

  // Common export modal
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

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

      const firstFileWithIssues = res.files.find((f) => f.findings.length > 0)?.filePath;
      const initialFile = firstFileWithIssues || Object.keys(extraction.files)[0] || null;
      setSelectedRepoFile(initialFile);

      const firstFinding = res.allFindings.find((f) => f.filePath === initialFile) || res.allFindings[0] || null;
      setActiveRepoFinding(firstFinding);

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
      const firstFileWithIssues = result.files.find((f) => f.findings.length > 0)?.filePath || 'src/config.ts';
      setSelectedRepoFile(firstFileWithIssues);
      const firstFinding = result.allFindings.find((f) => f.filePath === firstFileWithIssues) || result.allFindings[0] || null;
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
    // Auto-select the first finding in this file if any
    const firstFindingInFile = repoResult?.allFindings.find((f) => f.filePath === filePath);
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
              isProcessing={isProcessingZip}
              error={zipError}
            />

            {repoTab === 'findings' ? (
              <RepoFindingsPanel
                repoResult={repoResult}
                activeTab={repoTab}
                onTabChange={setRepoTab}
                selectedFile={selectedRepoFile}
                onSelectFile={handleSelectRepoFile}
                activeFinding={activeRepoFinding}
                onSelectFinding={handleSelectRepoFinding}
              />
            ) : repoResult ? (
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
    </div>
  );
};

export default App;
