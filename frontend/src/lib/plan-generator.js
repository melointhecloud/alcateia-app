// Gerador do plano Alcateia. Função pura: a mesma entrada dá o mesmo plano (os ids das rotinas
// são novos a cada chamada, como em buildStarterPlan). Os exercícios vêm de listas curadas
// à mão (POOLS), nunca de sorteio. Spec: docs/superpowers/specs/2026-11-03-alcateia-app-design.md §5.
import { uid } from './format.js'

export const GOALS = ['lose-fat', 'tone', 'glutes-legs', 'conditioning']
export const PLACES = ['home', 'gym', 'both']
export const LEVELS = ['beginner', 'intermediate', 'advanced']
export const DAYS = [2, 3, 4, 5]
export const MINUTES = [15, 30, 45]
export const HOME_EQUIPMENT = ['body weight', 'dumbbell', 'band', 'resistance band']

// slot -> ids do catálogo, melhores primeiro. Sem bench/incline/barra fixa no pool de casa.
export const POOLS = {
  home: {
    squat:   ['1197', '1760', '5121'],
    hinge:   ['1459', '4604'],
    glute:   ['6435', '4742', '2072', '3013'],
    lunge:   ['0612', '0336', '0781', '2960', '0801', '0431'],
    abduct:  ['4031'],
    push:    ['0662', '2398'],
    press:   ['0405', '0426'],
    lateral: ['0334', '0380'],
    pull:    ['0293', '0292', '0930', '3896'],
    core:    ['0276', '1241', '0274', '0871'],
    calves:  ['3018'],
    arms:    ['0294', '2188'],
    cardio:  ['3094', '0630', '1160'],
  },
  gym: {
    squat:   ['2267', '0770', '0585', '1039'],
    hinge:   ['0085', '0586', '1459'],
    glute:   ['1060', '1206', '5120', '4742'],
    lunge:   ['0336', '2960', '0431', '0612'],
    abduct:  ['1034', '3048', '4031'],
    push:    ['0576', '0289', '0662'],
    press:   ['0603', '0405'],
    lateral: ['0334', '0380'],
    pull:    ['0198', '0861', '1350', '0293'],
    core:    ['0276', '1241', '0274', '0871'],
    calves:  ['3018', '0594'],
    arms:    ['0294', '2188'],
    cardio:  ['3094', '0630', '1160'],
  },
}

// sessão -> slots em ordem de importância (o tempo corta pelo fim)
const SESSIONS = {
  'glute-a':     ['glute', 'squat', 'lunge', 'hinge', 'abduct', 'calves', 'core', 'cardio'],
  'glute-b':     ['hinge', 'glute', 'lunge', 'squat', 'abduct', 'core', 'calves', 'cardio'],
  upper:         ['press', 'pull', 'push', 'lateral', 'arms', 'core', 'pull', 'cardio'],
  'full-a':      ['squat', 'push', 'pull', 'glute', 'core', 'lunge', 'lateral', 'cardio'],
  'full-b':      ['hinge', 'press', 'pull', 'lunge', 'glute', 'core', 'arms', 'cardio'],
  'cardio-core': ['cardio', 'core', 'squat', 'push', 'cardio', 'lunge', 'core', 'pull'],
}
const LABELS = {
  'glute-a': 'Glúteo e Pernas', 'glute-b': 'Glúteo e Posterior', upper: 'Superiores',
  'full-a': 'Corpo Inteiro', 'full-b': 'Corpo Inteiro', 'cardio-core': 'Cardio e Abdômen',
}
const SPLITS = {
  'glutes-legs': { 2: ['glute-a', 'full-a'], 3: ['glute-a', 'upper', 'glute-b'], 4: ['glute-a', 'upper', 'glute-b', 'full-a'], 5: ['glute-a', 'upper', 'glute-b', 'cardio-core', 'full-b'] },
  tone:          { 2: ['full-a', 'full-b'], 3: ['full-a', 'glute-a', 'upper'], 4: ['glute-a', 'upper', 'glute-b', 'full-a'], 5: ['glute-a', 'upper', 'full-b', 'glute-b', 'cardio-core'] },
  'lose-fat':    { 2: ['full-a', 'cardio-core'], 3: ['full-a', 'cardio-core', 'full-b'], 4: ['full-a', 'cardio-core', 'full-b', 'glute-a'], 5: ['full-a', 'cardio-core', 'full-b', 'glute-a', 'upper'] },
  conditioning:  { 2: ['cardio-core', 'full-a'], 3: ['cardio-core', 'full-a', 'full-b'], 4: ['cardio-core', 'full-a', 'cardio-core', 'full-b'], 5: ['cardio-core', 'full-a', 'glute-a', 'cardio-core', 'full-b'] },
}
// DAYN: 1 = segunda (mesma convenção de starter.js)
const WEEKDAYS = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6] }
const COUNT = { 15: 4, 30: 6, 45: 8 }
const SETS = { beginner: 2, intermediate: 3, advanced: 4 }
const REPS = { 'lose-fat': 15, tone: 12, 'glutes-legs': 12, conditioning: 15 }
// Duração estimada de uma rotina: cada série ~40 s de execução + o descanso padrão do app
// (restSec = 90 em useStore.js). O orçamento de séries por sessão sai daí, com 20% de folga.
export const SET_SEC = 40
export const REST_SEC = 90
export const SLACK = 1.2
export const estimateMinutes = r => r.ex.reduce((a, e) => a + e.sets, 0) * (SET_SEC + REST_SEC) / 60
const SET_BUDGET = Object.fromEntries(MINUTES.map(m => [m, Math.floor(m * SLACK * 60 / (SET_SEC + REST_SEC))]))
const FINISHER = new Set(['core', 'cardio', 'calves', 'arms', 'lateral', 'abduct'])

const valid = i => !!i && GOALS.includes(i.goal) && PLACES.includes(i.place) && LEVELS.includes(i.level)
  && DAYS.includes(i.days) && MINUTES.includes(i.minutes)

// Escolhe o exercício do slot começando no `offset` (varia entre sessões) e pulando os já usados.
function pick(pool, offset, used) {
  for (let k = 0; k < pool.length; k++) {
    const id = pool[(offset + k) % pool.length]
    if (!used.has(id)) return id
  }
  return null
}

function buildRoutine(key, name, placeKey, input, sessionIndex) {
  const used = new Set()
  const base = SETS[input.level]
  const ex = []
  for (const slot of SESSIONS[key].slice(0, COUNT[input.minutes])) {
    const id = pick(POOLS[placeKey][slot], sessionIndex, used)
    if (!id) continue
    used.add(id)
    ex.push({
      id,
      sets: FINISHER.has(slot) ? Math.min(base, 3) : base,
      reps: slot === 'cardio' ? 20 : REPS[input.goal],
      weight: 0,
    })
  }
  // Passou do orçamento de tempo: tira uma série por vez, do fim da lista (o que menos importa) para
  // o começo, sempre do exercício com mais séries, até caber. Nunca desce de 2 séries.
  let total = ex.reduce((a, e) => a + e.sets, 0)
  while (total > SET_BUDGET[input.minutes]) {
    const max = Math.max(...ex.map(e => e.sets))
    if (max <= 2) break
    ex.findLast(e => e.sets === max).sets--
    total--
  }
  return { id: uid(), name, emoji: placeKey === 'home' ? 'figureStrength' : 'legs', ex }
}

/** { routines, schedule } no formato de buildStarterPlan, ou null para entrada inválida. */
export function generatePlan(input) {
  if (!valid(input)) return null
  const placeKey = input.place === 'home' ? 'home' : 'gym'
  const keys = SPLITS[input.goal][input.days]
  const seen = {}
  const total = {}
  keys.forEach(k => { total[LABELS[k]] = (total[LABELS[k]] || 0) + 1 })
  const routines = keys.map((key, i) => {
    const label = LABELS[key]
    seen[label] = (seen[label] || 0) + 1
    const name = total[label] > 1 ? `${label} ${String.fromCharCode(64 + seen[label])}` : label
    return buildRoutine(key, name, placeKey, input, i)
  })
  const schedule = routines.map((r, i) => ({ day: WEEKDAYS[input.days][i], routineId: r.id }))
  if (input.place === 'both') routines.push(buildRoutine('full-a', 'Treino em Casa', 'home', input, keys.length))
  return { routines, schedule }
}
