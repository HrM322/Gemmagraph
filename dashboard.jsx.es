import React, { useState } from 'react';
import { Folder, FileCode, Cpu, Terminal, Play, Loader2, AlertCircle } from 'lucide-react';

const GemmaGraphDashboard = () => {
  const [targetPath, setTargetPath] = useState('./src');
  const [graphData, setGraphData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);

  const generateGraph = async () => {
    setIsLoading(true);
    setError(null);
    setGraphData(null);
    setSelectedFile(null);
    
    try {
      const response = await fetch('http://localhost:8000/api/parse-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath }),
      });
      
      if (!response.ok) throw new Error('Directory not found or server offline.');
      
      const result = await response.json();
      setGraphData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDraftFix = async () => {
    if (!selectedFile) return;
    setIsDrafting(true);
    setAgentResponse('Gemma 4 is analyzing the graph and drafting a fix...\n(This runs entirely offline)');
    
    try {
      const response = await fetch('http://localhost:8000/api/draft-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          file_path: selectedFile.id,
          user_prompt: userPrompt 
        }),
      });
      
      if (!response.ok) throw new Error('Failed to connect to agent');
      
      const result = await response.json();
      setAgentResponse(result.reply);
    } catch (err) {
      setAgentResponse(`Error: ${err.message}. Is Ollama running?`);
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-300 via-pink-300 to-cyan-300 p-8 font-sans">
      
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-5xl font-black tracking-tighter text-black uppercase drop-shadow-[4px_4px_0_rgba(255,255,255,1)]">
          GemmaGraph
        </h1>
        <div className="flex items-center gap-4 bg-white border-4 border-black px-6 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-bold text-lg">
          <Cpu className="w-6 h-6 text-black" />
          <span>Gemma 4: OFFLINE & READY</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Repository Controls */}
        <div className="lg:col-span-1 space-y-8">
          
          <div className="bg-white/40 backdrop-blur-md border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-xl">
            <h2 className="text-2xl font-black mb-4 uppercase">Target Repo</h2>
            <input 
              type="text" 
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              className="w-full bg-white/60 border-2 border-black p-3 mb-4 font-mono text-sm focus:outline-none focus:bg-white transition-colors"
            />
            <button 
              onClick={generateGraph}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-black text-white font-bold py-3 px-4 border-2 border-black hover:bg-yellow-400 hover:text-black transition-all active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              {isLoading ? 'SCANNING...' : 'GENERATE GRAPH'}
            </button>
            
            {error && (
              <div className="mt-4 p-3 bg-red-400 border-2 border-black flex items-center gap-2 font-bold text-sm">
                <AlertCircle className="w-5 h-5" /> {error}
              </div>
            )}
          </div>

          <div className="bg-white/30 backdrop-blur-lg border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-xl h-[400px] overflow-y-auto">
            <h2 className="text-xl font-black mb-4 uppercase">Architecture</h2>
            <ul className="space-y-3 font-mono text-sm font-semibold">
              {!graphData && !isLoading && (
                <li className="text-black/60 italic">Awaiting repository scan...</li>
              )}
              {graphData?.nodes.map((node) => (
                <li 
                  key={node.id}
                  onClick={() => node.type === 'file' && setSelectedFile(node)}
                  className={`flex items-center gap-2 bg-white/50 p-2 border-2 border-black transition-colors ${
                    node.type === 'file' ? 'hover:bg-cyan-300 cursor-pointer' : 'hover:bg-pink-300'
                  } ${
                    selectedFile?.id === node.id ? 'bg-cyan-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' : ''
                  }`}
                  style={{ marginLeft: node.type !== 'root' ? '1rem' : '0' }}
                >
                  {node.type === 'file' ? <FileCode className="w-4 h-4" /> : <Folder className="w-4 h-4 fill-black" />}
                  {node.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column: Code Viewer & Agent Integration */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-white/20 backdrop-blur-xl border-4 border-black h-[500px] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] rounded-2xl relative overflow-hidden flex flex-col">
            <div className="bg-black text-white p-3 font-mono text-sm flex justify-between items-center">
              <span>{selectedFile ? selectedFile.id : 'Select a file to inspect'}</span>
              {selectedFile && <span className="bg-cyan-400 text-black px-2 py-1 font-bold text-xs uppercase">Target Locked</span>}
            </div>
            
            <div className="p-6 font-mono text-sm text-black/90 flex-1 overflow-auto bg-white/50 whitespace-pre-wrap">
              {agentResponse || (selectedFile 
                  ? `// ${selectedFile.label} is locked in.\n// Write a prompt below to send this file to local Gemma 4...` 
                  : 'Waiting for file selection...')}
            </div>
          </div>

          <div className="bg-cyan-200/60 backdrop-blur-md border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex gap-4 items-center rounded-xl">
            <Terminal className="w-8 h-8 text-black shrink-0" />
            <input 
              type="text" 
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDraftFix()}
              placeholder={selectedFile ? `Ask Gemma to edit ${selectedFile.label}...` : 'Select a file first...'}
              disabled={!selectedFile || isDrafting}
              className="flex-1 bg-transparent border-b-4 border-black focus:outline-none text-xl font-bold placeholder-black/50 py-2 disabled:opacity-50"
            />
            <button 
              onClick={handleDraftFix}
              disabled={!selectedFile || isDrafting || !userPrompt}
              className="bg-black text-white font-black uppercase tracking-widest py-3 px-8 border-2 border-black hover:bg-white hover:text-black transition-colors shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white shrink-0"
            >
              {isDrafting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Draft Fix'}
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default GemmaGraphDashboard;