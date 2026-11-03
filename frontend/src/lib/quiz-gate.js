// A porta de entrada do mini-quiz Alcateia (App.jsx). Decisões aqui, sem React, para ter teste.
//
// O quiz aparece para quem tem conta (nunca visitante nem demo), depois do setup inicial e só
// depois de o estado vir do servidor: quem já fez o quiz em outro aparelho tem `alcateia.quizDone`
// no estado do servidor, e perguntar antes do pull mostraria o quiz de novo a quem já fez.

// "O estado do servidor já chegou nesta conta": o servidor foi alcançado ao menos uma vez e nada
// está pendente ou preso (o mesmo sinal que o convite do tour usa em App.jsx).
export const quizSynced = st => !!st?.user && st.sync?.status === 'ok' && st.sync.lastSynced > 0

/**
 * @param {object} c
 * @param {{id:string}|null} c.user       conta logada
 * @param {boolean} c.isGuest             modo visitante
 * @param {boolean} c.demo                build de demonstração
 * @param {boolean} c.setupDone           boot pronto e sem telas de setup do app nativo
 * @param {boolean} c.quizDone            S.alcateia?.quizDone
 * @param {boolean} c.synced              o pull inicial desta conta já terminou
 * @param {string|null} c.skippedFor      id da conta que tocou em "Pular por agora" nesta sessão
 * @param {boolean} c.redo                "Refazer meu plano" (Configurações) pediu o quiz
 */
export function showAlcateiaQuiz({ user, isGuest, demo, setupDone, quizDone, synced, skippedFor, redo }) {
  if (!user || isGuest || demo || !setupDone) return false
  if (redo) return true
  if (quizDone || !synced) return false
  return skippedFor !== user.id
}

// "Pular por agora" vale só para esta sessão do navegador (sessionStorage) e para a conta que
// pulou: recarregar a página não pergunta de novo, mas um novo login em outro dia pergunta.
const SKIP_KEY = 'alcateia_quiz_skipped'
export const readQuizSkip = () => { try { return sessionStorage.getItem(SKIP_KEY) } catch { return null } }
export const writeQuizSkip = uid => { try { sessionStorage.setItem(SKIP_KEY, uid) } catch { /* sem storage: vale até recarregar */ } }
