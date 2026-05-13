import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'

interface RsyncOptions {
  source: string
  destination: string
  archive: boolean
  verbose: boolean
  delete: boolean
  dry_run: boolean
  progress: boolean  // Add progress flag
}

interface ProgressData {
  percentage: number
  speed: string
  size: string
  currentFile: string
}

function App() {
  const [source, setSource] = useState('/home/jyo/test/source/')
  const [dest, setDest] = useState('/home/jyo/test/backup/')
  const [archive, setArchive] = useState(false)
  const [verbose, setVerbose] = useState(true)
  const [deleteFlag, setDeleteFlag] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [progress, setProgress] = useState(true)  // Add progress state
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [progressData, setProgressData] = useState<ProgressData>({
    percentage: 0,
    speed: '',
    size: '',
    currentFile: ''
  })

  // Parse rsync progress output
  const parseProgress = (line: string) => {
    // Pattern for rsync progress: "filename.ext\n  1234567  45%  1.23MB/s    0:00:15"
    const progressMatch = line.match(/(\d+)\s+(\d+)%\s+([\d.]+[KMGT]?B\/s)?/)
    const fileMatch = line.match(/^([^/\n]+\.?[^/\n]*)$/)
    
    if (progressMatch) {
      const percentage = parseInt(progressMatch[2])
      const speed = progressMatch[3] || ''
      
      setProgressData(prev => ({
        ...prev,
        percentage: percentage || 0,
        speed: speed,
      }))
    } else if (fileMatch && !line.includes('%')) {
      setProgressData(prev => ({
        ...prev,
        currentFile: fileMatch[1]
      }))
    }
  }

  useEffect(() => {
    const outputListener = listen('rsync-output', (event) => {
      const line = event.payload as string
      setOutput(prev => prev + line + '\n')
      
      // Parse progress if enabled
      if (progress) {
        parseProgress(line)
      }
    })

    const errorListener = listen('rsync-error', (event) => {
      setOutput(prev => prev + `\nERROR: ${event.payload}\n`)
    })

    return () => {
      outputListener.then(unlisten => unlisten())
      errorListener.then(unlisten => unlisten())
    }
  }, [progress])

  const runRsync = async () => {
    if (!source || !dest) {
      alert("Please enter both source and destination paths")
      return
    }

    setIsRunning(true)
    setOutput('')
    setProgressData({ percentage: 0, speed: '', size: '', currentFile: '' })

    const opts: RsyncOptions = {
      source,
      destination: dest,
      archive,
      verbose,
      delete: deleteFlag,
      dry_run: dryRun,
      progress,
    }

    try {
      const result = await invoke<string>('run_rsync', { opts })
      setOutput(prev => prev + '\n✅ Rsync completed successfully!\n')
      setProgressData(prev => ({ ...prev, percentage: 100 }))
    } catch (error: any) {
      setOutput(prev => prev + `\n❌ Failed: ${error}\n`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2">Trsync</h1>

        {/* Progress Bar Section */}
        {progress && progressData.percentage > 0 && (
          <div className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-blue-400">Progress</span>
              <span>{progressData.percentage}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 mb-3">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressData.percentage}%` }}
              />
            </div>
            {progressData.currentFile && (
              <div className="text-xs text-zinc-400 mb-1">
                📄 {progressData.currentFile}
              </div>
            )}
            {progressData.speed && (
              <div className="text-xs text-zinc-500">
                Speed: {progressData.speed}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">Source Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={source}
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
                    multiple: false,
                    filters: [{ name: "All Files", extensions: ["*"] }]
                  })
                  if (selected) setSource(selected)
                }}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 rounded-lg"
              >
                📄 File
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
          <h3 className="text-lg mb-3">Output</h3>
          <pre className="bg-black border border-zinc-800 rounded-xl p-6 font-mono text-sm h-96 overflow-auto whitespace-pre-wrap">
            {output || 'Click "Run rsync" to start...'}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default App