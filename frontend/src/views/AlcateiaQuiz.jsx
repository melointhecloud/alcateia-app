// O mini-quiz do Alcateia: cinco perguntas, uma por tela, e o resumo do plano gerado. Nada entra
// no estado até a aluna tocar em "Começar" (applyAlcateiaPlan). Quem monta a tela decide o resto:
//   onDone    o plano foi aplicado
//   onSkip    mostra "Pular por agora" (primeira vez, para não prender quem não quer)
//   onCancel  mostra "Cancelar" (refazer o plano, a partir de Configurações)
// Spec: docs/superpowers/specs/2026-11-03-alcateia-app-design.md §5.
import { useEffect, useRef, useState } from 'react'
import { t, dateLocale } from '../lib/i18n.js'
import { exCount } from '../lib/format.js'
import { generatePlan } from '../lib/plan-generator.js'
import { applyAlcateiaPlan } from '../lib/alcateia-plan.js'

// As chaves do t() são o inglês, como no resto do app; o pack pt-BR dá os rótulos da tela.
const QUESTIONS = [
  { key: 'goal', title: () => t('What is your goal?'), options: () => [
    ['lose-fat', t('Lose fat')], ['tone', t('Tone up')],
    ['glutes-legs', t('Glutes and legs')], ['conditioning', t('Conditioning')]] },
  { key: 'place', title: () => t('Where will you train?'), options: () => [
    ['home', t('At home')], ['gym', t('At the gym')], ['both', t('Both places')]] },
  { key: 'days', title: () => t('How many days a week?'), options: () => [2, 3, 4, 5].map(n => [n, t('{0} days', n)]) },
  { key: 'minutes', title: () => t('How long per workout?'), options: () => [15, 30, 45].map(n => [n, t('{0} minutes', n)]) },
  { key: 'level', title: () => t('What is your level?'), options: () => [
    ['beginner', t('Beginner')], ['intermediate', t('Intermediate')], ['advanced', t('Experienced')]] },
]

// "seg", "ter"...: o nome curto do dia no idioma da tela, vindo do Intl (o pack não tem "Tue" nem
// "Thu", e assim vale para todos os idiomas). 0 = domingo, 1 = segunda; 7/1/2024 foi um domingo.
const shortDay = d => new Intl.DateTimeFormat(dateLocale(), { weekday: 'short' }).format(new Date(2024, 0, 7 + d)).replace(/\.$/, '')

function Summary({ answers, onBack, onStart }) {
  const plan = generatePlan(answers)
  if (!plan) return null
  const dayOf = Object.fromEntries(plan.schedule.map(s => [s.routineId, s.day]))
  return <>
    <h2 className="aq-title" tabIndex={-1}>{t('Your Alcateia plan')}</h2>
    <p className="aq-lead">{t('{0} workouts a week, built for your goal and level.', plan.schedule.length)}</p>
    <div className="list aq-plan">
      {plan.routines.map(r => <div key={r.id} className="item">
        <div className="aq-day">{dayOf[r.id] == null ? '' : shortDay(dayOf[r.id])}</div>
        <div className="grow">
          <div className="tt">{r.name}</div>
          <div className="ss">{dayOf[r.id] == null ? t('Any day') + ' · ' : ''}{exCount(r.ex.length)}</div>
        </div>
      </div>)}
    </div>
    <div className="aq-foot">
      <button type="button" className="btn primary" onClick={onStart}>{t('Start')}</button>
      <button type="button" className="btn ghost dim" onClick={onBack}>{t('Back')}</button>
    </div>
  </>
}

export default function AlcateiaQuiz({ onDone, onSkip, onCancel }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const rootRef = useRef(null)
  const moved = useRef(false)
  const done = step >= QUESTIONS.length
  // Cada tela nova leva o foco ao título: leitor de tela e teclado seguem a pergunta, não ficam num
  // botão que sumiu. Não na primeira vez, para a página não rolar sozinha ao abrir.
  useEffect(() => { if (moved.current) rootRef.current?.querySelector('.aq-title')?.focus({ preventScroll: true }); moved.current = true }, [step])

  const start = () => { if (applyAlcateiaPlan(answers)) onDone?.() }
  const q = QUESTIONS[step]
  return <div className="narrow aq" ref={rootRef}>
    <div className="aq-top">
      <div className="aq-bar" aria-hidden="true">{QUESTIONS.map((x, i) => <i key={x.key} className={i <= step ? 'on' : ''} />)}</div>
      {!done && <div className="aq-count small dim">{t('Question {0} of {1}', step + 1, QUESTIONS.length)}</div>}
    </div>
    <div className="aq-body">
      {done
        ? <Summary answers={answers} onBack={() => setStep(QUESTIONS.length - 1)} onStart={start} />
        : <>
          <h2 className="aq-title" tabIndex={-1}>{q.title()}</h2>
          {step === 0 && <p className="aq-lead">{t('Five quick questions and your week is ready.')}</p>}
          <div className="list aq-opts">
            {q.options().map(([value, label]) => <button key={String(value)} type="button"
              className={'btn aq-opt' + (answers[q.key] === value ? ' on' : '')} aria-pressed={answers[q.key] === value}
              onClick={() => { setAnswers(a => ({ ...a, [q.key]: value })); setStep(step + 1) }}>{label}</button>)}
          </div>
          <div className="aq-foot">
            {step > 0 && <button type="button" className="btn ghost dim" onClick={() => setStep(step - 1)}>{t('Back')}</button>}
          </div>
        </>}
    </div>
    {(onSkip || onCancel) && <div className="aq-exit">
      {onSkip && <button type="button" className="btn ghost dim" onClick={onSkip}>{t('Skip for now')}</button>}
      {onCancel && <button type="button" className="btn ghost dim" onClick={onCancel}>{t('Cancel')}</button>}
    </div>}
  </div>
}
