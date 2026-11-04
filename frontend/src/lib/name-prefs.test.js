import { describe, expect, it } from 'vitest'
import { enParensOn } from './name-prefs.js'

// "Nomes de exercícios em inglês": in Portuguese the translated name stands alone unless the person
// turned the English one on; every other language keeps showing it, as before.
describe('enParensOn', () => {
  it('is off by default in pt and pt-BR, on elsewhere', () => {
    expect(enParensOn({}, 'pt')).toBe(false)
    expect(enParensOn({}, 'pt-BR')).toBe(false)
    expect(enParensOn({}, 'es')).toBe(true)
    expect(enParensOn({}, 'de')).toBe(true)
    expect(enParensOn(undefined, 'pt-BR')).toBe(false)
  })
  it('an explicit choice wins, in both directions', () => {
    expect(enParensOn({ enParens: { 'pt-BR': true } }, 'pt-BR')).toBe(true)
    expect(enParensOn({ enParens: { pt: true } }, 'pt')).toBe(true)
    expect(enParensOn({ enParens: { es: false } }, 'es')).toBe(false)
    expect(enParensOn({ enParens: { 'pt-BR': false } }, 'pt-BR')).toBe(false)
  })
  it('a choice made in another language does not leak', () => {
    expect(enParensOn({ enParens: { es: true, de: false } }, 'pt-BR')).toBe(false)
  })
})
