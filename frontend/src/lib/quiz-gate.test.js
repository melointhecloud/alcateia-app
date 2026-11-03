import { describe, expect, it } from 'vitest'
import { showAlcateiaQuiz, quizSynced } from './quiz-gate.js'

// A aluna logada, com o estado já puxado do servidor, que ainda não fez o quiz.
const base = { user: { id: 'u1' }, isGuest: false, demo: false, setupDone: true, quizDone: false, synced: true, skippedFor: null, redo: false }

describe('showAlcateiaQuiz (a porta de entrada)', () => {
  it('mostra para quem está logada, sincronizada e ainda não fez o quiz', () => {
    expect(showAlcateiaQuiz(base)).toBe(true)
  })
  it('não mostra a quem já fez (inclusive em outro aparelho, depois do pull)', () => {
    expect(showAlcateiaQuiz({ ...base, quizDone: true })).toBe(false)
  })
  it('espera o estado do servidor: sem o primeiro pull não mostra, para não perguntar de novo a quem já fez em outro aparelho', () => {
    expect(showAlcateiaQuiz({ ...base, synced: false })).toBe(false)
  })
  it('espera o setup inicial terminar (boot, passos do app nativo)', () => {
    expect(showAlcateiaQuiz({ ...base, setupDone: false })).toBe(false)
  })
  it('nunca para visitante, demo ou sem sessão', () => {
    expect(showAlcateiaQuiz({ ...base, user: null, isGuest: true })).toBe(false)
    expect(showAlcateiaQuiz({ ...base, user: null })).toBe(false)
    expect(showAlcateiaQuiz({ ...base, demo: true })).toBe(false)
    expect(showAlcateiaQuiz({ ...base, isGuest: true })).toBe(false)
  })
  it('"Pular por agora" vale para esta conta nesta sessão e não para outra conta', () => {
    expect(showAlcateiaQuiz({ ...base, skippedFor: 'u1' })).toBe(false)
    expect(showAlcateiaQuiz({ ...base, skippedFor: 'outra' })).toBe(true)
  })
  it('"Refazer meu plano" abre o quiz mesmo com quizDone, e ignora o pular, mas segue sem sessão', () => {
    expect(showAlcateiaQuiz({ ...base, quizDone: true, redo: true })).toBe(true)
    expect(showAlcateiaQuiz({ ...base, quizDone: true, redo: true, skippedFor: 'u1' })).toBe(true)
    expect(showAlcateiaQuiz({ ...base, quizDone: true, redo: true, synced: false })).toBe(true)
    expect(showAlcateiaQuiz({ ...base, user: null, redo: true })).toBe(false)
    expect(showAlcateiaQuiz({ ...base, redo: true, setupDone: false })).toBe(false)
  })
})

describe('quizSynced', () => {
  it('só com o servidor alcançado ao menos uma vez e nada pendente', () => {
    expect(quizSynced({ user: { id: 'u1' }, sync: { status: 'ok', lastSynced: 123 } })).toBe(true)
    expect(quizSynced({ user: { id: 'u1' }, sync: { status: 'ok', lastSynced: 0 } })).toBe(false)
    expect(quizSynced({ user: { id: 'u1' }, sync: { status: 'offline', lastSynced: 123 } })).toBe(false)
    expect(quizSynced({ user: { id: 'u1' }, sync: { status: 'held', lastSynced: 123 } })).toBe(false)
    expect(quizSynced({ user: null, sync: { status: 'local', lastSynced: 0 } })).toBe(false)
    expect(quizSynced({ user: { id: 'u1' } })).toBe(false)
  })
})
