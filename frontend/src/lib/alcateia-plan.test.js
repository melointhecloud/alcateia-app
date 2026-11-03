// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../store/useStore.js'
import { applyAlcateiaPlan } from './alcateia-plan.js'

const input = { goal: 'tone', place: 'home', days: 3, minutes: 30, level: 'beginner' }
const S = () => useStore.getState().S
const plannedDays = () => Object.keys(S().week).filter(d => [].concat(S().week[d] || []).length)

describe('applyAlcateiaPlan', () => {
  beforeEach(() => { useStore.getState().update(st => { st.routines = []; st.week = {}; delete st.alcateia }) })

  it('adiciona as rotinas, põe nos dias e marca o quiz como feito', () => {
    expect(applyAlcateiaPlan(input)).toBe(true)
    expect(S().routines.length).toBe(3)
    const days = plannedDays()
    expect(days.length).toBe(3)
    for (const d of days) expect(S().routines.some(r => r.id === [].concat(S().week[d])[0])).toBe(true)
    expect(S().alcateia.quizDone).toBe(true)
    expect(S().alcateia.answers).toEqual(input)
    expect(typeof S().alcateia.at).toBe('number')
  })
  it('entrada inválida não muda nada', () => {
    expect(applyAlcateiaPlan({ ...input, days: 9 })).toBe(false)
    expect(S().routines.length).toBe(0)
    expect(S().alcateia).toBeUndefined()
  })
  it('refazer o quiz troca os dias do plano e mantém as rotinas antigas', () => {
    applyAlcateiaPlan(input)
    applyAlcateiaPlan({ ...input, days: 2 })
    expect(S().routines.length).toBe(5)
    expect(plannedDays().length).toBe(2)
  })
})
