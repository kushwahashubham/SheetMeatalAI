import React, { useState, useCallback, useMemo } from 'react';
import { Upload, FileText, Cpu, CheckCircle, AlertCircle, Download, FileCode, FileSpreadsheet, Layers, Eye, X } from 'lucide-react';
import { processPdfWithGemini } from './services/geminiService';
import { generateFabricationFiles, parseDxf, DxfEntity, DxfBounds } from './services/dxfService';
import { ExtractedData, GeneratedFile, ProcessingStep } from './types';

// --- VISUAL PREVIEW COMPONENT ---
const DxfPreview = ({ content }: { content: string }) => {
  const { entities, bounds } = useMemo(() => parseDxf(content), [content]);
  
  const { minX, minY, maxX, maxY } = bounds;
  const width = maxX - minX;
  const height = maxY - minY;
  
  // Add padding (10%)
  const p = Math.max(width, height) * 0.1;
  const viewBox = `${minX - p} ${-maxY - p} ${width + p*2} ${height + p*2}`;

  // Helper to map Color IDs to Hex
  const getColor = (id: number) => {
    switch(id) {
      case 1: return '#ef4444'; // Red (Inner Cuts)
      case 2: return '#eab308'; // Yellow (Bends)
      case 3: return '#22c55e'; // Green (Dims)
      case 7: return '#1f2937'; // White/Black (Outer)
      default: return '#6b7280';
    }
  };

  // Helper to get Dash Array
  const getDash = (layer: string) => {
    return layer === 'BEND' ? '4 4' : undefined;
  };

  return (
    <div className="w-full h-full bg-white rounded-lg flex items-center justify-center p-4">
      <svg viewBox={viewBox} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* DXF coords are Y-Up, SVG is Y-Down. We flip coordinates by negating Y. */}
        
        {entities.map((e, i) => {
          const color = getColor(e.color);
          const dash = getDash(e.layer);

          if (e.type === 'LINE' && e.points) {
            return (
              <line 
                key={i} 
                x1={e.points[0].x} y1={-e.points[0].y} 
                x2={e.points[1].x} y2={-e.points[1].y} 
                stroke={color} 
                strokeWidth={width * 0.005} 
                strokeDasharray={dash}
              />
            );
          }
          if (e.type === 'POLYLINE' && e.points) {
            const pts = e.points.map(p => `${p.x},${-p.y}`).join(' ');
            return (
              <polygon 
                key={i} 
                points={pts} 
                fill="none" 
                stroke={color} 
                strokeWidth={width * 0.005}
                strokeDasharray={dash}
              />
            );
          }
          if (e.type === 'CIRCLE' && e.center && e.radius) {
             return (
               <circle 
                 key={i} 
                 cx={e.center.x} cy={-e.center.y} 
                 r={e.radius} 
                 fill="none" 
                 stroke={color} 
                 strokeWidth={width * 0.005}
               />
             );
          }
          if (e.type === 'TEXT' && e.text && e.x !== undefined && e.y !== undefined) {
            return (
              <text 
                key={i} 
                x={e.x} y={-e.y} 
                fill={color} 
                fontSize={e.height} 
                fontFamily="monospace"
                transform={`scale(1, -1) translate(0, 0)`} // Text needs special care if flipped, but since we map coords, just flipping scalar y is better?
                // Actually standard svg text draws down. If we place at -y, it draws down from -y.
                // DXF text draws up from baseline. 
                // Simple approximation: Just render it.
              >
                {e.text}
              </text>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
};


function App() {
  const [step, setStep] = useState<ProcessingStep>(ProcessingStep.IDLE);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrorMsg('Please upload a PDF file.');
      return;
    }

    setStep(ProcessingStep.READING);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64String = (e.target?.result as string).split(',')[1];
      
      try {
        setStep(ProcessingStep.EXTRACTING);
        const data = await processPdfWithGemini(base64String);
        setExtractedData(data);

        setStep(ProcessingStep.CALCULATING);
        // Artificial delay for UX perception of "Thinking"
        await new Promise(r => setTimeout(r, 800)); 
        
        const genFiles = generateFabricationFiles(data);
        setFiles(genFiles);
        
        setStep(ProcessingStep.COMPLETE);
      } catch (err) {
        setStep(ProcessingStep.ERROR);
        setErrorMsg('Failed to process. Ensure API Key is set and PDF is readable.');
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadFile = (file: GeneratedFile) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const StepIcon = ({ current, target, icon: Icon }: { current: ProcessingStep, target: ProcessingStep, icon: any }) => {
    const steps = [ProcessingStep.IDLE, ProcessingStep.READING, ProcessingStep.EXTRACTING, ProcessingStep.CALCULATING, ProcessingStep.COMPLETE];
    const currentIndex = steps.indexOf(current);
    const targetIndex = steps.indexOf(target);
    
    const isCompleted = currentIndex > targetIndex || current === ProcessingStep.COMPLETE;
    const isActive = current === target;

    return (
      <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${isActive ? 'border-brand-500 bg-brand-500 text-white scale-110 shadow-lg shadow-brand-500/30' : isCompleted ? 'border-green-500 bg-green-500 text-white' : 'border-industrial-300 text-industrial-400'}`}>
        {isCompleted ? <CheckCircle size={20} /> : <Icon size={20} />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-industrial-50 text-industrial-900 pb-20">
      
      {/* Header */}
      <header className="bg-white border-b border-industrial-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-600 p-2 rounded-lg text-white">
              <Layers size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-industrial-900">SheetMetal<span className="text-brand-600">AI</span></h1>
              <p className="text-xs text-industrial-500 font-medium tracking-wide">AUTOFAB SUITE</p>
            </div>
          </div>
          <div className="text-xs bg-industrial-100 text-industrial-600 px-3 py-1 rounded-full font-mono border border-industrial-200">
            v1.0.0
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        
        {/* Intro */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-extrabold text-industrial-900 tracking-tight sm:text-5xl mb-4">
            Automate Your Fabrication
          </h2>
          <p className="max-w-2xl mx-auto text-xl text-industrial-500">
            Upload your Technical Data Sheet (PDF). We'll handle the geometry, 
            extract dimensions, and generate production-ready DXF & CSV files instantly.
          </p>
        </div>

        {/* Workflow Visualizer */}
        <div className="flex justify-center items-center space-x-4 mb-12 relative">
           {/* Connecting Line */}
          <div className="absolute h-0.5 bg-industrial-200 w-64 -z-10 top-6"></div>
          
          <StepIcon current={step} target={ProcessingStep.READING} icon={FileText} />
          <div className="w-12"></div>
          <StepIcon current={step} target={ProcessingStep.EXTRACTING} icon={Cpu} />
          <div className="w-12"></div>
          <StepIcon current={step} target={ProcessingStep.CALCULATING} icon={Layers} />
        </div>

        {/* Upload Area */}
        <div className={`max-w-xl mx-auto mb-16 transition-all duration-500 ${step === ProcessingStep.IDLE ? 'scale-100 opacity-100' : 'scale-95 opacity-50 pointer-events-none'}`}>
          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-industrial-300 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-industrial-50 hover:border-brand-500 transition-colors shadow-sm group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <div className="p-4 bg-industrial-100 rounded-full mb-4 group-hover:bg-brand-50 group-hover:text-brand-600 text-industrial-400 transition-colors">
                <Upload className="w-8 h-8" />
              </div>
              <p className="mb-2 text-lg text-industrial-700 font-medium">Click to upload TDS</p>
              <p className="text-sm text-industrial-500">PDF documents only</p>
            </div>
            <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={step !== ProcessingStep.IDLE} />
          </label>
        </div>

        {/* Error State */}
        {step === ProcessingStep.ERROR && (
          <div className="max-w-xl mx-auto mb-10 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 animate-pulse">
            <AlertCircle size={24} />
            <span className="font-medium">{errorMsg}</span>
            <button onClick={() => setStep(ProcessingStep.IDLE)} className="ml-auto text-sm underline hover:text-red-800">Try Again</button>
          </div>
        )}

        {/* Results Dashboard */}
        {step === ProcessingStep.COMPLETE && extractedData && (
          <div className="animate-fade-in-up">
            
            {/* Extracted Data Cards */}
            <div className="mb-10">
              <h3 className="text-lg font-semibold text-industrial-900 mb-4 flex items-center gap-2">
                <Cpu size={20} className="text-brand-600"/> Extracted Parameters
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-xl border-l-4 border-brand-500 shadow-sm">
                  <p className="text-xs text-industrial-500 font-bold uppercase tracking-wider mb-1">Unit Reference</p>
                  <p className="text-2xl font-bold text-industrial-900">{extractedData.Unit_Ref}</p>
                  <p className="text-xs text-industrial-400 mt-2">Project: {extractedData.Project_ID}</p>
                </div>
                <div className="glass-panel p-5 rounded-xl border-l-4 border-emerald-500 shadow-sm">
                  <p className="text-xs text-industrial-500 font-bold uppercase tracking-wider mb-1">Global Dims</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-xs text-industrial-400">L</span> <span className="text-lg font-semibold">{extractedData.Global_Dims.L}</span>
                    </div>
                    <div>
                      <span className="text-xs text-industrial-400">W</span> <span className="text-lg font-semibold">{extractedData.Global_Dims.W}</span>
                    </div>
                    <div>
                      <span className="text-xs text-industrial-400">H</span> <span className="text-lg font-semibold">{extractedData.Global_Dims.H}</span>
                    </div>
                  </div>
                </div>
                <div className="glass-panel p-5 rounded-xl border-l-4 border-amber-500 shadow-sm">
                  <p className="text-xs text-industrial-500 font-bold uppercase tracking-wider mb-1">Construction</p>
                  <div className="space-y-1">
                    <p className="text-sm"><span className="text-industrial-400">Base:</span> {extractedData.Base_Height}mm</p>
                    <p className="text-sm"><span className="text-industrial-400">Insulation:</span> {extractedData.Material.Insulation}mm</p>
                  </div>
                </div>
                <div className="glass-panel p-5 rounded-xl border-l-4 border-purple-500 shadow-sm">
                  <p className="text-xs text-industrial-500 font-bold uppercase tracking-wider mb-1">Cuts Detected</p>
                   <div className="space-y-1">
                    <p className="text-sm"><span className="text-industrial-400">FA:</span> {extractedData.Cuts.Fresh_Air.W}x{extractedData.Cuts.Fresh_Air.H}</p>
                    <p className="text-sm"><span className="text-industrial-400">SA:</span> {extractedData.Cuts.Supply_Air.W}x{extractedData.Cuts.Supply_Air.H}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated Files List */}
            <div>
              <h3 className="text-lg font-semibold text-industrial-900 mb-4 flex items-center gap-2">
                <FileCode size={20} className="text-brand-600"/> Manufacturing Output
              </h3>
              <div className="bg-white rounded-xl shadow-lg border border-industrial-100 overflow-hidden">
                <ul className="divide-y divide-industrial-100">
                  {files.map((file, idx) => (
                    <li key={idx} className="p-4 hover:bg-industrial-50 transition-colors flex items-center justify-between group">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-lg ${file.type === 'dxf' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                          {file.type === 'dxf' ? <FileCode size={24} /> : <FileSpreadsheet size={24} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-industrial-900">{file.name}</p>
                          <p className="text-xs text-industrial-500">{file.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.type === 'dxf' && (
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-industrial-200 rounded-lg text-sm font-medium text-industrial-600 hover:border-brand-500 hover:text-brand-600 transition-all shadow-sm"
                          >
                            <Eye size={16} />
                            Preview
                          </button>
                        )}
                        <button 
                          onClick={() => downloadFile(file)}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-industrial-200 rounded-lg text-sm font-medium text-industrial-600 hover:border-brand-500 hover:text-brand-600 transition-all shadow-sm"
                        >
                          <Download size={16} />
                          Download
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="mt-12 text-center">
               <button 
                 onClick={() => { setStep(ProcessingStep.IDLE); setExtractedData(null); setFiles([]); }}
                 className="text-sm text-industrial-400 hover:text-brand-600 underline"
               >
                 Process Another Document
               </button>
            </div>

          </div>
        )}

      </main>

      {/* PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-scale-up">
             <div className="p-4 border-b border-industrial-200 flex justify-between items-center bg-industrial-50">
               <div>
                 <h3 className="font-bold text-lg text-industrial-900">{previewFile.name}</h3>
                 <p className="text-xs text-industrial-500">Visual Verification</p>
               </div>
               <button 
                 onClick={() => setPreviewFile(null)}
                 className="p-2 hover:bg-industrial-200 rounded-full transition-colors text-industrial-500"
               >
                 <X size={24} />
               </button>
             </div>
             <div className="flex-1 overflow-hidden p-8 bg-grid-pattern relative flex items-center justify-center bg-gray-50">
               <DxfPreview content={previewFile.content} />
             </div>
             <div className="p-4 border-t border-industrial-200 bg-white flex justify-between items-center text-xs text-industrial-500">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-full"></span> Inner Cut</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-800 rounded-full"></span> Outer Cut</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded-full"></span> Bend Line</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full"></span> Dimension</span>
                </div>
                <button 
                   onClick={() => downloadFile(previewFile)}
                   className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  <Download size={16} /> Download File
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;