// frontend/src/lib/plan-generator.test.js
import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { eqAvailable } from './equipment.js'
import { generatePlan, estimateMinutes, SLACK, POOLS, GOALS, PLACES, LEVELS, DAYS, MINUTES, HOME_EQUIPMENT } from './plan-generator.js'

const inputs = []
for (const goal of GOALS) for (const place of PLACES) for (const days of DAYS)
  for (const minutes of MINUTES) for (const level of LEVELS) inputs.push({ goal, place, days, minutes, level })

describe('pools', () => {
  it('todo id de todo pool existe no catálogo', () => {
    for (const place of ['home', 'gym']) for (const [slot, ids] of Object.entries(POOLS[place]))
      for (const id of ids) expect(EXIDX[id], `${place}.${slot} ${id}`).toBeTruthy()
  })
  it('o pool de casa só usa o equipamento de casa', () => {
    for (const [slot, ids] of Object.entries(POOLS.home))
      for (const id of ids) expect(eqAvailable(HOME_EQUIPMENT, EXIDX[id]), `home.${slot} ${id} ${EXIDX[id].n}`).toBe(true)
  })
})

describe('generatePlan', () => {
  it('é determinístico (ignora ids gerados)', () => {
    const strip = p => p.routines.map(r => ({ name: r.name, ex: r.ex.map(e => [e.id, e.sets, e.reps]) }))
    const a = generatePlan({ goal: 'tone', place: 'home', days: 3, minutes: 30, level: 'beginner' })
    const b = generatePlan({ goal: 'tone', place: 'home', days: 3, minutes: 30, level: 'beginner' })
    expect(strip(a)).toEqual(strip(b))
  })
  it('recusa entrada inválida', () => {
    expect(generatePlan(null)).toBeNull()
    expect(generatePlan({ goal: 'x', place: 'home', days: 3, minutes: 30, level: 'beginner' })).toBeNull()
    expect(generatePlan({ goal: 'tone', place: 'home', days: 6, minutes: 30, level: 'beginner' })).toBeNull()
    expect(generatePlan({ goal: 'tone', place: 'moon', days: 3, minutes: 30, level: 'beginner' })).toBeNull()
  })
  it.each(inputs)('plano válido: %o', input => {
    const plan = generatePlan(input)
    expect(plan).not.toBeNull()
    const ids = new Set(plan.routines.map(r => r.id))
    expect(ids.size).toBe(plan.routines.length)
    // um dia por sessão, dias distintos, rotinas existentes
    expect(plan.schedule.length).toBe(input.days)
    expect(new Set(plan.schedule.map(s => s.day)).size).toBe(input.days)
    for (const s of plan.schedule) expect(ids.has(s.routineId)).toBe(true)
    const max = { 15: 4, 30: 6, 45: 8 }[input.minutes]
    // duração estimada (séries x (40 s + descanso padrão de 90 s)) <= minutes + folga de 20%
    for (const r of plan.routines) expect(estimateMinutes(r), `${r.name} ${estimateMinutes(r)}min`).toBeLessThanOrEqual(input.minutes * SLACK)
    // nenhuma sessão repete a outra do mesmo plano
    const keys = plan.routines.map(r => r.ex.map(e => e.id).join())
    expect(new Set(keys).size).toBe(keys.length)
    for (const r of plan.routines) {
      expect(r.ex.length).toBeGreaterThanOrEqual(3)
      expect(r.ex.length).toBeLessThanOrEqual(max)
      expect(new Set(r.ex.map(e => e.id)).size).toBe(r.ex.length) // sem repetir exercício na rotina
      for (const e of r.ex) {
        expect(EXIDX[e.id], e.id).toBeTruthy()
        expect(e.sets).toBeGreaterThanOrEqual(2)
        expect(e.reps).toBeGreaterThanOrEqual(8)
        if (input.place === 'home') expect(eqAvailable(HOME_EQUIPMENT, EXIDX[e.id]), `${e.id} ${EXIDX[e.id].n}`).toBe(true)
      }
    }
  })
  it('"ambos" acrescenta uma rotina de casa fora do calendário', () => {
    const plan = generatePlan({ goal: 'tone', place: 'both', days: 3, minutes: 30, level: 'beginner' })
    const scheduled = new Set(plan.schedule.map(s => s.routineId))
    const extra = plan.routines.filter(r => !scheduled.has(r.id))
    expect(extra.length).toBe(1)
    expect(extra[0].name).toMatch(/casa/i)
    for (const e of extra[0].ex) expect(eqAvailable(HOME_EQUIPMENT, EXIDX[e.id])).toBe(true)
  })
  it('nome de rotina repetida ganha letra', () => {
    const plan = generatePlan({ goal: 'lose-fat', place: 'home', days: 5, minutes: 30, level: 'beginner' })
    const names = plan.routines.map(r => r.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
