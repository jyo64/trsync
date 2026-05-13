import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import {
  Progress
} from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SshOptions {
  enabled: boolean
  username: string
  host: string
  port?: number
  is_alias: boolean
}

interface RsyncOptions {
  source: string[]
  destination: string
  archive: boolean
  verbose: boolean
  delete: boolean
  dry_run: boolean
  progress: boolean  // Add progress flag
  recursive: boolean
  source_ssh?: SshOptions
  dest_ssh?: SshOptions
}

interface ProgressData {
  percentage: number
  speed: string
  size: string
  currentFile: string
}

function App() {

    // Add SSH states
  const [sourceSshEnabled, setSourceSshEnabled] = useState(false)
  const [sourceSshUsername, setSourceSshUsername] = useState('')
  const [sourceSshHost, setSourceSshHost] = useState('')
  const [sourceSshPort, setSourceSshPort] = useState('22')
  const [sourceSshIsAlias, setSourceSshIsAlias] = useState(true)
  const [sourceSshAlias, setSourceSshAlias] = useState('')
  
  const [destSshEnabled, setDestSshEnabled] = useState(false)
  const [destSshUsername, setDestSshUsername] = useState('')
  const [destSshHost, setDestSshHost] = useState('')
  const [destSshPort, setDestSshPort] = useState('22')
  const [destSshIsAlias, setDestSshIsAlias] = useState(true)
  const [destSshAlias, setDestSshAlias] = useState('')

  const [source, setSource] = useState<string[]>(['/home/jyo/Downloads/Test.txt'])
  const [dest, setDest] = useState('/home/jyo/Downloads/O')
  const [archive, setArchive] = useState(false)
  const [verbose, setVerbose] = useState(true)
  const [deleteFlag, setDeleteFlag] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [progress, setProgress] = useState(true)  // Add progress state
  const [recursive, setRecursive] = useState(true)
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

    if (sourceSshEnabled) {
      if (sourceSshIsAlias) {
        if (!sourceSshAlias) {
          alert("Please enter SSH alias for source")
          return
        }
      } else {
        if (!sourceSshUsername || !sourceSshHost) {
          alert("Please enter SSH username and host for source")
          return
        }
      }
    }

    if (destSshEnabled) {
      if (destSshIsAlias) {
        if (!destSshAlias) {
          alert("Please enter SSH alias for destination")
          return
        }
      } else {
        if (!destSshUsername || !destSshHost) {
          alert("Please enter SSH username and host for destination")
          return
        }
      }
    }

    setIsRunning(true)
    setOutput('')
    setProgressData({ percentage: 0, speed: '', size: '', currentFile: '' })

    const opts: RsyncOptions = {
      source: source,
      destination: dest,
      archive,
      verbose,
      delete: deleteFlag,
      dry_run: dryRun,
      progress,
      recursive,
      source_ssh: sourceSshEnabled ? {
        enabled: true,
        username: sourceSshIsAlias ? sourceSshAlias : sourceSshUsername,
        host: sourceSshIsAlias ? '' : sourceSshHost,
        port: sourceSshIsAlias ? undefined : (sourceSshPort ? parseInt(sourceSshPort) : undefined),
        is_alias: sourceSshIsAlias
      } : undefined,
      dest_ssh: destSshEnabled ? {
        enabled: true,
        username: destSshIsAlias ? destSshAlias : destSshUsername,
        host: destSshIsAlias ? '' : destSshHost,
        port: destSshIsAlias ? undefined : (destSshPort ? parseInt(destSshPort) : undefined),
        is_alias: destSshIsAlias
      } : undefined,
    }

    try {
      await invoke<string>('run_rsync', { opts })
      setOutput(prev => prev + '\n✅ Rsync completed successfully!\n')
      setProgressData(prev => ({ ...prev, percentage: 100 }))
    } catch (error: any) {
      setOutput(prev => prev + `\n❌ Failed: ${error}\n`)
    } finally {
      setIsRunning(false)
    }
  }

  // Helper function to convert array to string for display
  const sourceToString = (sourceArray: string[]): string => {
    return sourceArray.join(', ')
  }

  // Helper function to convert comma-separated string to array
  const stringToSourceArray = (str: string): string[] => {
    return str.split(',').map(s => s.trim()).filter(s => s)
  }

  return (
    <div className="min-h-screen text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="space-y-4">
          {/* Source Path Section with SSH */}
          <div>
            <div className="flex items-center gap-4 mb-2">
              <label className="block text-base">Source Path</label>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="sourceSsh"
                  checked={sourceSshEnabled}
                  onCheckedChange={(checked) => setSourceSshEnabled(checked === true)}
                />
                <FieldLabel htmlFor="sourceSsh">SSH</FieldLabel>
              </div>
            </div>
            
            {sourceSshEnabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox 
                    id="sourceSshIsAlias"
                    checked={sourceSshIsAlias}
                    disabled={true}
                    onCheckedChange={(checked) => setSourceSshIsAlias(checked === true)}
                  />
                  <FieldLabel htmlFor="sourceSshIsAlias">Use SSH Alias</FieldLabel>
                </div>
                
                {sourceSshIsAlias ? (
                  <Input
                    type="text"
                    placeholder="SSH Alias (e.g., server1, production-server)"
                    value={sourceSshAlias}
                    onChange={(e) => setSourceSshAlias(e.target.value)}
                    className="border rounded-lg px-4 py-3"
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="text"
                        placeholder="Username"
                        value={sourceSshUsername}
                        onChange={(e) => setSourceSshUsername(e.target.value)}
                        className="border rounded-lg px-4 py-3"
                      />
                      <Input
                        type="text"
                        placeholder="Host (e.g., 192.168.1.100)"
                        value={sourceSshHost}
                        onChange={(e) => setSourceSshHost(e.target.value)}
                        className="border rounded-lg px-4 py-3"
                      />
                    </div>
                    <Input
                      type="number"
                      placeholder="Port (optional, default: 22)"
                      value={sourceSshPort}
                      onChange={(e) => setSourceSshPort(e.target.value)}
                      className="border rounded-lg px-4 py-3"
                    />
                  </>
                )}
                
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Remote Path"
                    value={sourceToString(source)}
                    onChange={(e) => setSource(stringToSourceArray(e.target.value))}
                    className="flex-1 border rounded-lg px-4 py-3"
                  />
                  <Button
                    onClick={async () => {
                      const selected = await open({
                        directory: true,
                        multiple: true,
                        title: "Select Source Folder"
                      })
                      if (selected) {
                        const paths = Array.isArray(selected) ? selected : [selected]
                        setSource(paths)
                      }
                    }}
                    className="px-4 rounded-lg"
                  >
                    📁 Folder
                  </Button>
                  <Button
                    onClick={async () => {
                      const selected = await open({
                        multiple: true,
                        filters: [{ name: "All Files", extensions: ["*"] }]
                      })
                      if (selected && selected.length > 0) {
                        setSource(selected)
                      }
                    }}
                    className="px-4 rounded-lg"
                  >
                    📄 File(s)
                  </Button>
                </div>
                <p className="text-xs">
                  Format: /path/to/file or multiple: /path1,/path2 (comma separated)
                </p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={sourceToString(source)}
                  onChange={(e) => setSource(stringToSourceArray(e.target.value))}
                  className="flex-1 border rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
                <Button
                  onClick={async () => {
                    const selected = await open({
                      directory: true,
                      multiple: true,
                      title: "Select Source Folder"
                  })
                    if (selected) setSource(selected)
                  }}
                  className="px-4 rounded-lg"
                >
                  📁 Folder
                </Button>
                <Button
                  onClick={async () => {
                    const selected = await open({
                      multiple: true,
                      filters: [{ name: "All Files", extensions: ["*"] }]
                    })
                    if (selected && selected.length > 0) {
                      setSource(selected)
                    }
                  }}
                  className="px-4 rounded-lg"
                >
                  📄 File(s)
                </Button>
              </div>
            )}
          </div>

          {/* Destination Path Section with SSH */}
          <div>
            <div className="flex items-center gap-4 mb-2">
              <label className="block text-base">Destination Path</label>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="destSsh"
                  checked={destSshEnabled}
                  onCheckedChange={(checked) => setDestSshEnabled(checked === true)}
                />
                <FieldLabel htmlFor="destSsh">SSH</FieldLabel>
              </div>
            </div>
            
            {destSshEnabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox 
                    id="destSshIsAlias"
                    checked={destSshIsAlias}
                    disabled={true}
                    onCheckedChange={(checked) => setDestSshIsAlias(checked === true)}
                  />
                  <FieldLabel htmlFor="destSshIsAlias">Use SSH Alias</FieldLabel>
                </div>
                
                {destSshIsAlias ? (
                  <Input
                    type="text"
                    placeholder="SSH Alias (e.g., server1, production-server)"
                    value={destSshAlias}
                    onChange={(e) => setDestSshAlias(e.target.value)}
                    className="border rounded-lg px-4 py-3"
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="text"
                        placeholder="Username"
                        value={destSshUsername}
                        onChange={(e) => setDestSshUsername(e.target.value)}
                        className="border rounded-lg px-4 py-3"
                      />
                      <Input
                        type="text"
                        placeholder="Host (e.g., 192.168.1.100)"
                        value={destSshHost}
                        onChange={(e) => setDestSshHost(e.target.value)}
                        className="border rounded-lg px-4 py-3"
                      />
                    </div>
                    <Input
                      type="number"
                      placeholder="Port (optional, default: 22)"
                      value={destSshPort}
                      onChange={(e) => setDestSshPort(e.target.value)}
                      className="border rounded-lg px-4 py-3"
                    />
                  </>
                )}
                
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Remote Path"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    className="flex-1 border rounded-lg px-4 py-3"
                  />
                  <Button
                    onClick={async () => {
                      const selected = await open({
                        directory: true,
                        multiple: false,
                        title: "Select Destination Folder"
                      })
                      if (selected) setDest(selected)
                    }}
                    className="px-4 rounded-lg"
                  >
                    📁 Folder
                  </Button>
                </div>
                <p className="text-xs">
                  Remote path format: /absolute/path/on/remote/server
                </p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={dest}
                  onChange={(e) => setDest(e.target.value)}
                  className="flex-1 border  rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
                <Button
                  onClick={async () => {
                    const selected = await open({
                      directory: true,
                      multiple: false,
                      title: "Select Destination Folder"
                    })
                    if (selected) setDest(selected)
                  }}
                  className="px-4 rounded-lg"
                >
                  📁 Folder
                </Button>
              </div>
            )}
          </div>

          {/* Rest of your existing UI (checkboxes, buttons, output, etc.) remains the same */}
          <div className="grid grid-cols-2 gap-4">
            <Field orientation="horizontal">
              <Checkbox 
                id="archive" 
                checked={archive} 
                onCheckedChange={(checked) => setArchive(checked === true)}
              />
              <FieldLabel htmlFor="archive">Archive (-a)</FieldLabel>
            </Field>
            
            <Field orientation="horizontal">
              <Checkbox 
                id="verbose" 
                checked={verbose} 
                onCheckedChange={(checked) => setVerbose(checked === true)}
              />
              <FieldLabel htmlFor="verbose">Verbose (-v)</FieldLabel>
            </Field>
            
            <Field orientation="horizontal">
              <Checkbox 
                id="delete" 
                checked={deleteFlag} 
                onCheckedChange={(checked) => setDeleteFlag(checked === true)}
              />
              <FieldLabel htmlFor="delete">--delete</FieldLabel>
            </Field>
            
            <Field orientation="horizontal">
              <Checkbox 
                id="dryrun" 
                checked={dryRun} 
                onCheckedChange={(checked) => setDryRun(checked === true)}
              />
              <FieldLabel htmlFor="dryrun">Dry Run (-n)</FieldLabel>
            </Field>
            
            <Field orientation="horizontal">
              <Checkbox 
                id="progress" 
                checked={progress} 
                onCheckedChange={(checked) => setProgress(checked === true)}
              />
              <FieldLabel htmlFor="progress">Show Progress (--progress)</FieldLabel>
            </Field>

            <Field orientation="horizontal">
              <Checkbox 
                id="recursive" 
                checked={recursive} 
                onCheckedChange={(checked) => setRecursive(checked === true)}
              />
              <FieldLabel htmlFor="recursive">Recurse Into Directories</FieldLabel>
            </Field>
          </div>

          <Button
            onClick={runRsync}
            disabled={isRunning}
            className="w-full py-4 rounded-xl font-semibold text-lg transition"
          >
            {isRunning ? 'Running...' : 'Run rsync'}
          </Button>
        </div>

        {/* Output and Progress sections remain exactly the same as your existing code */}
        <div className="mt-8">
          <Button
            onClick={() => setOutputExpanded(!outputExpanded)}
            className="w-full flex items-center justify-between text-lg mb-3 transition-colors"
          >
            <h3>Output</h3>
            <span>{outputExpanded ? '▼' : '▶'}</span>
          </Button>
          
          {outputExpanded && (
            <pre className="bg-black border rounded-xl p-6 font-mono text-sm h-96 overflow-auto whitespace-pre-wrap">
              {output || 'Click "Run rsync" to start...'}
            </pre>
          )}
        </div>

        {progress && (isRunning || progressData.percentage > 0) && (
          <div className="mb-6 p-4 rounded-xl border">
            <Progress value={progressData.percentage} className="w-full h-2" />

            {progressData.currentFile && (
              <div className="mt-3 text-xs line-clamp-1">
                📄 {progressData.currentFile}
              </div>
            )}

            {progressData.speed && (
              <div className="text-xs mt-1">
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
