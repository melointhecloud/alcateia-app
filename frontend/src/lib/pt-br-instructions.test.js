import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import ptBR from '../instr/pt-BR.js'
import ptBRDesc from '../exercise-desc/pt-BR.js'
import { EXDB } from './exercises-data.js'
import { INSTR_LANGS } from './i18n-core.js'
import V13_IDS from './catalogue-v13-ids.json' with { type: 'json' }
// English steps live in their own pack since the catalogue moved to catalogue/ (v1.4.0)
import EN from '../instr/en.js'

describe('Brazilian Portuguese exercise instructions', () => {
  const exercises = new Map(EXDB.map(exercise => [exercise.id, exercise]))
  const catalogue = JSON.parse(readFileSync(new URL('../../../catalogue/i18n/pt-BR.json', import.meta.url), 'utf8'))

  // The v1.3 catalogue was translated in full; the v1.4 additions fall back to English until
  // someone writes them, so coverage is pinned on the legacy ids only.
  test('is built from catalogue/i18n and covers the v1.3 catalogue', () => {
    const steps = Object.fromEntries(Object.entries(catalogue).filter(([, row]) => row.instructions).map(([id, row]) => [id, row.instructions]))
    expect(ptBR).toEqual(steps)
    for (const id of V13_IDS) expect(ptBR, id).toHaveProperty(id)
  })

  test('enables pt-BR instructions when there is a pack', () => {
    expect(INSTR_LANGS.includes('pt-BR')).toBe(Object.keys(ptBR).length > 0)
  })

  test('contains only known exercises with complete, non-empty step lists', () => {
    for (const [id, steps] of Object.entries(ptBR)) {
      const exercise = exercises.get(id)
      expect(exercise, `unknown exercise ${id}`).toBeDefined()
      // The v1.3 translation follows the English step by step. A curated entry (it has its own
      // description, see plan-exercises-pt.test.js) was written for Brazilian lifters and may
      // group or split steps, so it only has to stay inside 4 to 7 steps.
      const curated = Boolean(ptBRDesc[id])
      if (curated) expect(steps.length, id).toBeGreaterThanOrEqual(4)
      if (curated) expect(steps.length, id).toBeLessThanOrEqual(7)
      else expect(steps, id).toHaveLength(EN[id].length)
      steps.forEach((step, index) => {
        expect(step.trim(), `${id} step ${index + 1}`).not.toBe('')
        expect(step, `${id} step ${index + 1}`).not.toBe(EN[id][index])
        expect(step, `${id} step ${index + 1}`).not.toMatch(/(?:^|[^\p{L}])(?:the|your|with|from|towards?|repeat|desired|starting|slowly|hold|while|then|back|straight|ground|feet|hands|body|legs|arms|knees|shoulders)(?=$|[^\p{L}])/iu)
        expect(step, `${id} step ${index + 1}`).not.toMatch(/(?:^|[^\p{L}])(?:ginásio|anca|abdómen|gémeos|ecrã|core|banda|piso|omoplata|peso de mão|barra de elevações|pegada por cima|pegada invertida|pegada inversa|bola suíça)(?=$|[^\p{L}])/iu)
        expect(step, `${id} step ${index + 1}`).not.toMatch(/flexion\p{L}*\s+(?:a\s+|o\s+|os\s+|um\s+|uma\s+)?(?:barra|pesos?|halter(?:es)?|mão)(?=$|[^\p{L}])/iu)
      })
    }
  })

  test('does not replace kettlebells with dumbbells', () => {
    for (const exercise of EXDB) {
      if (!ptBR[exercise.id]) continue
      if (/kettlebells?/iu.test(EN[exercise.id].join(' '))) {
        expect(ptBR[exercise.id].join(' '), exercise.id).toMatch(/kettlebells?/iu)
      }
    }
  })

  test('uses wrist extension for reverse wrist curls', () => {
    const reverseWristCurlIds = ['0079', '0082', '0104', '0210', '0224', '0358', '0367', '0368', '0385', '0771', '0994', '1441']
    reverseWristCurlIds.forEach(id => expect(ptBR[id].join(' '), id).toMatch(/estend\p{L}*(?: lentamente)? (?:o |os )?punhos?/iu))
  })
})
