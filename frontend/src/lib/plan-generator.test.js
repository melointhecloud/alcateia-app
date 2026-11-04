// frontend/src/lib/plan-generator.test.js
import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { eqAvailable } from './equipment.js'
import { modeOf, setsRepsOf, defaultConfig } from './history.js'
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
        // exercício de solo do slot de cardio: série de 30 a 40 s, nunca "min @ km/h" de esteira
        if (e.mode === 'time') { expect(e.sec).toBeGreaterThanOrEqual(30); expect(e.sec).toBeLessThanOrEqual(40); expect(modeOf(e)).toBe('time') }
        else expect(e.reps).toBeGreaterThanOrEqual(8)
        expect(modeOf(e), `${e.id} ${EXIDX[e.id].n}`).not.toBe('cardio')
        if (input.place === 'home') expect(eqAvailable(HOME_EQUIPMENT, EXIDX[e.id]), `${e.id} ${EXIDX[e.id].n}`).toBe(true)
      }
    }
  })
  it('escalador, polichinelo e burpee saem como séries de 40 s, sem parâmetros de esteira', () => {
    const plan = generatePlan({ goal: 'conditioning', place: 'home', days: 5, minutes: 45, level: 'advanced' })
    const cardio = plan.routines.flatMap(r => r.ex).filter(e => ['0630', '3094', '1160'].includes(e.id))
    expect(new Set(cardio.map(e => e.id)).size).toBe(3)
    for (const e of cardio) {
      expect(e).toMatchObject({ mode: 'time', sec: 40, weight: 0 })
      expect(e.min).toBeUndefined()
      expect(e.speed).toBeUndefined()
      expect(setsRepsOf(e)).toBe(`${e.sets} × 0:40`)
      expect(modeOf(e)).toBe('time')
    }
    // a escolha é do gerador, não da configuração padrão de esteira que o app daria ao 0630
    expect(defaultConfig('0630').speed).toBe(8)
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
