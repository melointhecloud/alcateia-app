// @vitest-environment happy-dom
// O card "Alimentação, em breve" na Home: só aviso, sem função, e some com o módulo Corpo desligado.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { presetModules } from '../lib/modules.js'
import { setLang } from '../lib/i18n.js'
import Home from './Home.jsx'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
}))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  navigate.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => { act(() => root.unmount()); host.remove(); await setLang('en') })

const mountWith = modules => {
  useStore.setState(s => ({
    S: { ...s.S, routines: [{ id: 'r1', name: 'Push', ex: [] }], workouts: [], bodyweight: [], dayPlan: {}, week: {}, active: null, modules, homeMuscleSets: false },
    user: null,
  }))
  act(() => root.render(<Home />))
}
const card = () => host.querySelector('.soon-card')

describe('Home: card Alimentação em breve', () => {
  it('em pt-BR mostra "Alimentação" e "Em breve"', async () => {
    await setLang('pt-BR')
    mountWith(undefined)
    expect(card()).toBeTruthy()
    expect(card().querySelector('.card-head-title').textContent).toBe('Alimentação')
    expect(card().textContent).toContain('Em breve')
    expect(card().textContent).not.toMatch(/[—–]/)
  })

  it('não faz nada: não é botão nem link, e tocar não navega', () => {
    mountWith(undefined)
    expect(card().querySelector('button, a')).toBeNull()
    expect(card().getAttribute('aria-disabled')).toBe('true')
    act(() => { card().dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('pode ser ocultado: o módulo Corpo desligado leva o card junto', () => {
    mountWith(presetModules('training'))
    expect(card()).toBeNull()
    mountWith({ body: false })
    expect(card()).toBeNull()
    mountWith({ body: true })
    expect(card()).toBeTruthy()
  })
})
