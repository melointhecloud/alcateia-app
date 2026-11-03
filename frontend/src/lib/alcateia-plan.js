import { useStore } from '../store/useStore.js'
import { generatePlan } from './plan-generator.js'

// Mesma regra de sheets.jsx:loadStarterPlan: acrescenta as rotinas (as antigas ficam) e
// reatribui os dias do calendário. Refazer o quiz limpa os dias da semana antes de aplicar,
// senão sobrariam dias do plano anterior. Devolve false, sem tocar em nada, se a entrada for inválida.
export function applyAlcateiaPlan(input) {
  const plan = generatePlan(input)
  if (!plan) return false
  useStore.getState().update(st => {
    plan.routines.forEach(r => st.routines.push(r))
    for (const d of Object.keys(st.week || {})) st.week[d] = []
    plan.schedule.forEach(({ day, routineId }) => { st.week[day] = [routineId] })
    st.alcateia = { quizDone: true, answers: { ...input }, at: Date.now() }
  })
  return true
}
