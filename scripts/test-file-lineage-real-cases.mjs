import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = path.join(root, 'app')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const result = spawnSync(npmCommand, ['run', 'test:file-lineage'], {
  cwd: app,
  encoding: 'utf8',
  stdio: 'pipe',
  shell: process.platform === 'win32',
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

console.log('PASS file-lineage real cases use the production protocol and decision implementation')
