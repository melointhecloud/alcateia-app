// The Android app's first-launch card ("How do you want to use openGym?") showed the tab bar under
// it, and a tap on a tab changed the route behind the card and stacked history entries for back to
// walk through. Shell is not rendered in a test, so this reads the condition from the source.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

describe('the tab bar', () => {
  it('stays away from the first-launch onboarding', () => {
    const cond = app.match(/const noTabs = ([^\n]+)/)?.[1] || ''
    expect(cond).toContain('needsMobileOnboarding')
    expect(app).toMatch(/\{!noTabs && <TabBar /)
  })

  // O mini-quiz Alcateia é tela cheia, como o cartão de primeiro uso: sem barra de abas por cima.
  // Shell não é renderizado aqui, então a ligação é lida do fonte; a regra em si (conta, pull
  // feito, pular, visitante, demo) é testada em lib/quiz-gate.test.js.
  it('stays away from the Alcateia quiz, which is gated by showAlcateiaQuiz', () => {
    const cond = app.match(/const noTabs = ([^\n]+)/)?.[1] || ''
    expect(cond).toContain('showQuiz')
    expect(app).toMatch(/const showQuiz = showAlcateiaQuiz\(\{[^}]*demo: DEMO/s)
    expect(app).toMatch(/showQuiz \? \(\s*<AlcateiaQuiz/)
    // sem a barra de abas, e nada de pré-visualização do swipe por baixo
    expect(app).toMatch(/const showPreview = [^\n]*!showQuiz/)
  })
})
