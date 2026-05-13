import { useState, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import {
  Progress,
} from "@/components/ui/progress"

interface ProgressData {
  percentage: number
  speed: string
  size: string
  currentFile: string
}

function App() {
  const [source, setSource] = useState<string | string[]>('/home/jyo/Downloads/I/File.mp4')
  const [dest, setDest] = useState('/home/jyo/Downloads/O')
  const [archive, setArchive] = useState(false)
  const [verbose, setVerbose] = useState(true)
  const [deleteFlag, setDeleteFlag] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [progress, setProgress] = useState(true)  // Add progress state
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [outputExpanded, setOutputExpanded] = useState(false)
  const [progressData, setProgressData] = useState<ProgressData>({
    percentage: 0,
    speed: '',
    size: '',
    currentFile: ''
  })

  const parseProgress = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    console.log("React - Parsing Progress - ", progress)

    // Match progress2 output format: "  423,297,024  44%  134.64MB/s  0:00:03"
    const progressRegex = /([\d,]+)\s+(\d+)%\s+([\d.]+[KMGT]?B\/s)?/;
    const match = trimmed.match(progressRegex);

    if (match) {
      console.log("React - Progress Regex Matched")
      // Remove commas from byte count and parse percentage
      const percentage = parseInt(match[2], 10);
      console.log("React - Progress Percent - ", percentage)
      const speed = match[3] || '';
      console.log("React - Progress speed - ", speed)

      setProgressData(prev => ({
        ...prev,
        percentage: Math.min(Math.max(percentage, 0), 100),
        speed,
      }));
      return;
    }

    // Try to extract current file (appears before progress line or in xfr output)
    // Match pattern like: "filename.ext" or "sending incremental file list"
    if (!trimmed.includes('%') && 
        !trimmed.includes('xfr#') && 
        !trimmed.startsWith('sent') && 
        !trimmed.startsWith('total') &&
        trimmed.length < 200 &&
        !trimmed.includes('bytes/sec')) {
      
      setProgressData(prev => ({
        ...prev,
        currentFile: trimmed
      }));
    }
  };

  useEffect(() => {
    let outputUnlisten: () => void;
    let errorUnlisten: () => void;

    const setupListeners = async () => {
      const outputListener = await listen<string>('rsync-output', (event) => {
        const line = event.payload;
        console.log("Progress Line - ", line);

        if (progress) {
          parseProgress(line);
          // Don't dump raw progress lines into the text output
          const isProgressLine = /\d+%/.test(line);
          if (!isProgressLine) {
            setOutput(prev => prev + line + '\n');
          }
        } else {
          setOutput(prev => prev + line + '\n');
        }
      });

      const errorListener = await listen<string>('rsync-error', (event) => {
        setOutput(prev => prev + `\nERROR: ${event.payload}\n`);
      });

      outputUnlisten = outputListener;
      errorUnlisten = errorListener;
    };

    setupListeners();

    return () => {
      outputUnlisten?.();
      errorUnlisten?.();
    };
  }, [progress]);

  const runRsync = async () => {
    console.log("React - Clicked on Run Rsync")
    if (!source || !dest) {
      alert("Please enter both source and destination paths")
      return
    }

    setIsRunning(true)
    setOutput('')
    setProgressData({ percentage: 0, speed: '', size: '', currentFile: '' })

    try {
      setOutput(prev => prev + '\nRsync completed successfully!\n')
      setProgressData(prev => ({ ...prev, percentage: 100 }))
    } catch (error: any) {
      setOutput(prev => prev + `\nFailed: ${error}\n`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2">Trsync</h1>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">Source Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={Array.isArray(source) ? source.join(', ') : source}
                onChange={(e) => setSource(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={async () => {
                  const selected = await open({
                    directory: true,
                    multiple: false,
                    title: "Select Source Folder"
                  })
                  if (selected) setSource(selected)
                }}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 rounded-lg"
              >
                📁 Folder
              </button>
              <button
                onClick={async () => {
                  const selected = await open({
                    multiple: true,
                    filters: [{ name: "All Files", extensions: ["*"] }]
                  })
                  if (selected && selected.length > 0) {
                    setSource(selected) // Store as array
                  }
                }}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 rounded-lg"
              >
                📄 File(s)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2">Destination Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={async () => {
                  const selected = await open({
                    directory: true,
                    multiple: false,
                    title: "Select Destination Folder"
                  })
                  if (selected) setDest(selected)
                }}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 rounded-lg"
              >
                📁 Folder
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={archive} onChange={e => setArchive(e.target.checked)} />
              Archive (-a)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={verbose} onChange={e => setVerbose(e.target.checked)} />
              Verbose (-v)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={deleteFlag} onChange={e => setDeleteFlag(e.target.checked)} />
              --delete
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
              Dry Run (-n)
            </label>
            <label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={progress} 
                onChange={e => setProgress(e.target.checked)} 
              />
              Show Progress (--progress)
            </label>
          </div>

          <button
            onClick={runRsync}
            disabled={isRunning}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 py-4 rounded-xl font-semibold text-lg transition"
          >
            {isRunning ? 'Running...' : '🚀 Run rsync'}
          </button>
        </div>

        <div className="mt-8">
          <button
            onClick={() => setOutputExpanded(!outputExpanded)}
            className="w-full flex items-center justify-between text-lg mb-3 hover:text-zinc-300 transition-colors"
          >
            <h3>Output</h3>
            <span>{outputExpanded ? '▼' : '▶'}</span>
          </button>
          
          {outputExpanded && (
            <pre className="bg-black border border-zinc-800 rounded-xl p-6 font-mono text-sm h-96 overflow-auto whitespace-pre-wrap">
              {output || 'Click "Run rsync" to start...'}
            </pre>
          )}
        </div>

        {progress && (isRunning || progressData.percentage > 0) && (
          <div className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <Progress value={progressData.percentage} className="w-full h-2" />

            {progressData.currentFile && (
              <div className="mt-3 text-xs text-zinc-400 line-clamp-1">
                📄 {progressData.currentFile}
              </div>
            )}

            {progressData.speed && (
              <div className="text-xs text-zinc-500 mt-1">
                ⚡ Speed: {progressData.speed}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App