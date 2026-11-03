// @vitest-environment happy-dom
// O mini-quiz do Alcateia: cinco perguntas, uma por tela, e o plano gerado só entra no estado
// quando a aluna toca em "Começar". Os rótulos são os do pack pt-BR (o idioma do produto): as
// chaves do t() são em inglês, como no resto do app, e este arquivo fixa o idioma como o
// settings-pages.test.jsx faz.
import React, { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { setLang } from '../lib/i18n.js'
import AlcateiaQuiz from './AlcateiaQuiz.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const roots = []
beforeAll(async () => { await setLang('pt-BR') })
afterAll(async () => { await setLang('en') })
afterEach(() => { roots.splice(0).forEach(r => act(() => r.unmount())); document.body.innerHTML = '' })
beforeEach(() => { useStore.getState().update(st => { st.routines = []; st.week = {}; delete st.alcateia }) })

const mount = (props = {}) => {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host); roots.push(root); act(() => root.render(<AlcateiaQuiz {...props} />)); return host
}
const buttons = host => [...host.querySelectorAll('button')].map(b => b.textContent.trim())
const click = (host, label) => {
  const b = [...host.querySelectorAll('button')].find(x => x.textContent.trim() === label)
  if (!b) throw new Error('botão não encontrado: ' + label + ' | ' + host.textContent)
  act(() => b.click())
}
const answerAll = host => {
  click(host, 'Tonificar o corpo')       // objetivo
  click(host, 'Em casa')                 // local
  click(host, '3 dias')                  // frequência
  click(host, '30 minutos')              // duração
  click(host, 'Iniciante')               // nível
}

describe('AlcateiaQuiz', () => {
  it('cinco perguntas e termina com o plano aplicado', () => {
    const host = mount()
    answerAll(host)
    expect(host.textContent).toContain('Seu plano Alcateia')
    click(host, 'Começar')
    expect(useStore.getState().S.alcateia.quizDone).toBe(true)
    expect(useStore.getState().S.routines.length).toBe(3)
  })
  it('não avança sem escolher e permite voltar', () => {
    const host = mount()
    click(host, 'Tonificar o corpo')
    click(host, 'Voltar')
    expect(host.textContent).toContain('Qual é o seu objetivo?')
  })
  it('uma pergunta por tela, com todas as opções de cada uma', () => {
    const host = mount()
    expect(host.textContent).toContain('Pergunta 1 de 5')
    expect(buttons(host)).toEqual(['Perder gordura', 'Tonificar o corpo', 'Glúteos e pernas', 'Condicionamento'])
    click(host, 'Perder gordura')
    expect(host.textContent).toContain('Onde você vai treinar?')
    expect(buttons(host)).toEqual(['Em casa', 'Na academia', 'Os dois', 'Voltar'])
    click(host, 'Os dois')
    expect(host.textContent).toContain('Quantos dias por semana?')
    expect(buttons(host)).toEqual(['2 dias', '3 dias', '4 dias', '5 dias', 'Voltar'])
    click(host, '5 dias')
    expect(host.textContent).toContain('Quanto tempo por treino?')
    expect(buttons(host)).toEqual(['15 minutos', '30 minutos', '45 minutos', 'Voltar'])
    click(host, '15 minutos')
    expect(host.textContent).toContain('Qual é o seu nível?')
    expect(host.textContent).toContain('Pergunta 5 de 5')
    expect(buttons(host)).toEqual(['Iniciante', 'Intermediário', 'Avançado', 'Voltar'])
  })
  it('o resumo mostra o nome das rotinas e os dias da semana, sem gravar nada ainda', () => {
    const host = mount()
    answerAll(host)
    const rows = [...host.querySelectorAll('.item')].map(r => r.textContent)
    expect(rows.length).toBe(3)
    // tonificar, 3 dias: segunda, quarta e sexta
    expect(rows[0]).toMatch(/^seg/i)
    expect(rows[0]).toContain('Corpo Inteiro')
    expect(rows[1]).toMatch(/^qua/i)
    expect(rows[2]).toMatch(/^sex/i)
    expect(rows[0]).toMatch(/\d+ exercícios/)
    expect(host.textContent).toContain('3 treinos por semana')
    expect(useStore.getState().S.routines.length).toBe(0)
    expect(useStore.getState().S.alcateia).toBeUndefined()
  })
  it('os dias vêm no idioma da tela, inclusive terça e quinta (que o pack não traduz como chave)', () => {
    const host = mount()
    click(host, 'Glúteos e pernas'); click(host, 'Na academia'); click(host, '4 dias'); click(host, '45 minutos'); click(host, 'Intermediário')
    const days = [...host.querySelectorAll('.aq-day')].map(d => d.textContent.toLowerCase())
    expect(days).toEqual(['seg', 'ter', 'qui', 'sex'])
  })
  it('no resumo, Voltar reabre a última pergunta e mantém as respostas anteriores', () => {
    const host = mount()
    answerAll(host)
    click(host, 'Voltar')
    expect(host.textContent).toContain('Qual é o seu nível?')
    click(host, 'Avançado')
    click(host, 'Começar')
    expect(useStore.getState().S.alcateia.answers).toEqual({ goal: 'tone', place: 'home', days: 3, minutes: 30, level: 'advanced' })
  })
  it('chama onDone depois de aplicar o plano', () => {
    const onDone = vi.fn()
    const host = mount({ onDone })
    answerAll(host)
    click(host, 'Começar')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(useStore.getState().S.alcateia.quizDone).toBe(true)
  })
  it('"Pular por agora" só aparece quando há onSkip, e não grava nada', () => {
    expect(buttons(mount())).not.toContain('Pular por agora')
    document.body.innerHTML = ''
    const onSkip = vi.fn()
    const host = mount({ onSkip })
    expect(buttons(host)).toContain('Pular por agora')
    click(host, 'Pular por agora')
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(useStore.getState().S.alcateia).toBeUndefined()
    expect(useStore.getState().S.routines.length).toBe(0)
  })
  it('"Cancelar" (refazer o plano) só aparece quando há onCancel', () => {
    expect(buttons(mount())).not.toContain('Cancelar')
    document.body.innerHTML = ''
    const onCancel = vi.fn()
    const host = mount({ onCancel })
    click(host, 'Cancelar')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(useStore.getState().S.alcateia).toBeUndefined()
  })
  it('as opções são botões acessíveis sem travessão nos textos', () => {
    const host = mount()
    for (const b of host.querySelectorAll('button')) expect(b.getAttribute('type')).toBe('button')
    expect(host.textContent).not.toMatch(/[—–]/)
    answerAll(host)
    expect(host.textContent).not.toMatch(/[—–]/)
  })
})
