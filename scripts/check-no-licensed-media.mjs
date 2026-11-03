#!/usr/bin/env node
// Falha se a mídia licenciada (Gym visual) voltar ao repositório. Rodar em CI e antes de cada release.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const problems = []

if (fs.existsSync(path.join(ROOT, 'catalogue/media'))) problems.push('catalogue/media existe')

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
for (const f of tracked) {
  if (/^catalogue\/media\//.test(f)) problems.push('rastreado: ' + f)
  if (/exercise-media\//.test(f) && !/\.(md|mjs|js|jsx|json|yml|yaml)$/.test(f)) problems.push('mídia: ' + f)
}

const docker = fs.readFileSync(path.join(ROOT, 'web/Dockerfile'), 'utf8')
if (/COPY\s+catalogue\/media/.test(docker)) problems.push('web/Dockerfile copia catalogue/media')

if (problems.length) {
  console.error('Mídia licenciada detectada:\n - ' + problems.join('\n - '))
  process.exit(1)
}
console.log('ok: nenhuma mídia licenciada no repositório')
