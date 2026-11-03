// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

/* Alcateia não tem mídia nativa de exercício (docs/FORK-NOTAS.md): a licença da Gym visual não cobre
   uso comercial. Nenhum código do app pode montar uma URL `exercise-media/`, senão o app volta a
   pedir arquivos que não existem (404, imagem quebrada) ou, pior, a servir mídia licenciada.
   Varre o código-fonte (não os testes) e a configuração do build; comentários não contam. */

const root = fileURLToPath(new URL('../../', import.meta.url))
const CODE = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.html', '.json', '.webmanifest'])
const isTest = f => /\.test\.[cm]?[jt]sx?$/.test(f)

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (CODE.has(extname(p)) && !isTest(name)) out.push(p)
  }
  return out
}
// Tira /* ... */ e // ... (um // dentro de uma URL não conta: vem colado ao texto, sem espaço antes).
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')

describe('nenhum caminho exercise-media/ no código do app', () => {
  const files = [...walk(join(root, 'src')), ...walk(join(root, 'public')), join(root, 'vite.config.js'), join(root, 'index.html')]
  it('varre o código-fonte, o service worker e a configuração do build', () => {
    expect(files.length).toBeGreaterThan(100)
    expect(files.some(f => f.endsWith('sw.js'))).toBe(true)
  })
  it('nenhum arquivo monta ou cita uma URL exercise-media/', () => {
    const hits = files.filter(f => /exercise-media/.test(stripComments(readFileSync(f, 'utf8'))))
    expect(hits.map(f => f.slice(root.length))).toEqual([])
  })
})
