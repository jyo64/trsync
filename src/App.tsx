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
}

function App() {
  const [source, setSource] = useState('/home/jyo/test/source/')
  const [dest, setDest] = useState('/home/jyo/test/backup/')
  const [archive, setArchive] = useState(true)
  const [verbose, setVerbose] = useState(true)
  const [deleteFlag, setDeleteFlag] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  // Listen to real-time output from Rust
  useEffect(() => {
    const outputListener = listen('rsync-output', (event) => {
      setOutput(prev => prev + event.payload)
    })

    const errorListener = listen('rsync-error', (event) => {
      setOutput(prev => prev + `\nERROR: ${event.payload}`)
    })

    return () => {
      outputListener.then(unlisten => unlisten())
      errorListener.then(unlisten => unlisten())
    }
  }, [])

  const runRsync = async () => {
    if (!source || !dest) {
      alert("Please enter both source and destination paths")
      return
    }

    setIsRunning(true)
    setOutput('🚀 Starting rsync...\n\n')

    const opts: RsyncOptions = {
      source,
      destination: dest,
      archive,
      verbose,
      delete: deleteFlag,
      dry_run: dryRun,
    }

    try {
      const result = await invoke<string>('run_rsync', { opts })
      setOutput(prev => prev + (result || '\n✅ Rsync completed successfully!'))
    } catch (error: any) {
      setOutput(prev => prev + `\n❌ Failed: ${error}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2">Trsync</h1>

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
          </div>

          <button
            onClick={runRsync}
            disabled={isRunning}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 py-4 rounded-xl font-semibold text-lg transition"
          >
            {isRunning ? 'Running...' : '🚀 Run rsync'}
          </button>
        
        

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