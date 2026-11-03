import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BRAND } from './brand.js'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (e.name === 'locales' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)])

describe('marca', () => {
  it('tem nome e link de código-fonte', () => {
    expect(BRAND.name).toBe('Alcateia')
    expect(BRAND.repoUrl).toMatch(/^https:\/\/github\.com\//)
  })
  it('não carrega doação nem divulgação do upstream no app', () => {
    const bad = /ko-fi\.com|buymeacoffee\.com|discord\.gg|opengym\.ch/i
    const hits = walk(SRC).filter(f => /\.(jsx?|css)$/.test(f) && !/\.test\./.test(f) && bad.test(fs.readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })
})
