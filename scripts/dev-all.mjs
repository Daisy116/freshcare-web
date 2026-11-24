import { spawn } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const processes = [
  spawn(npm, ['run', 'dev:session'], { stdio: 'inherit' }),
  spawn(npm, ['run', 'dev:frontend'], { stdio: 'inherit' }),
]

let stopping = false
function stopAll(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of processes) {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
  process.exitCode = code
}

for (const child of processes) {
  child.on('error', (error) => {
    console.error('Unable to start a development service:', error.message)
    stopAll(1)
  })
  child.on('exit', (code) => {
    if (!stopping) stopAll(code ?? 1)
  })
}

process.on('SIGINT', () => stopAll())
process.on('SIGTERM', () => stopAll())
