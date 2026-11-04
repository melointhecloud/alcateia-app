import { afterEach, describe, expect, it } from 'vitest'
import { weekStreakLabel } from './streak.js'
import { _setLangState } from './i18n-core.js'
import pt from '../locales/pt.js'
import ptBR from '../locales/pt-BR.js'

// "sequência de 1 semanas" and a lowercase title on Home (E2E): the singular, and a capital.
describe('weekStreakLabel', () => {
  afterEach(() => _setLangState('en', {}, null, null))

  it('English keeps "N week streak"', () => {
    expect(weekStreakLabel(0)).toBe('0 week streak')
    expect(weekStreakLabel(1)).toBe('1 week streak')
    expect(weekStreakLabel(6)).toBe('6 week streak')
  })

  it.each([['pt', pt], ['pt-BR', ptBR]])('%s: singular, plural and a capital letter', (lang, pack) => {
    _setLangState(lang, pack, null, null)
    expect(weekStreakLabel(0)).toBe('Sequência de 0 semanas')
    expect(weekStreakLabel(1)).toBe('Sequência de 1 semana')
    expect(weekStreakLabel(2)).toBe('Sequência de 2 semanas')
  })
})

describe('the chart range "1Y"', () => {
  afterEach(() => _setLangState('en', {}, null, null))
  it.each([['pt', pt], ['pt-BR', ptBR]])('%s reads 1A (ano), not 1Y', async (lang, pack) => {
    const { t } = await import('./i18n-core.js')
    _setLangState(lang, pack, null, null)
    expect(t('1Y')).toBe('1A')
    expect(t('1M')).toBe('1M')
  })
})
