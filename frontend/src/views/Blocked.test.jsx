// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Blocked from './Blocked.jsx'
import { _setLangState } from '../lib/i18n-core.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* The screen a profile with a lapsed subscription sees instead of the app (paid access). It says
   the data is kept, offers the renewal link when the server has one (config.renew_url) and the
   support address when it does not, lets the person check again after renewing, and lets them
   sign out. */
const mocks = vi.hoisted(() => {
  const state = { config: null, signOut: null, recheck: null, toast: null, loadConfig: null }
  state.snapshot = () => ({ config: state.config, user: { id: 'u1', name: 'Ana' }, signOut: state.signOut, recheckAccess: state.recheck, loadConfig: state.loadConfig })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: m => mocks.toast(m) })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})

const mounted = []
function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(el))
  return host
}
const settle = () => act(() => new Promise(r => setTimeout(r, 0)))
const button = (host, text) => [...host.querySelectorAll('button, a')].find(b => b.textContent === text)

beforeEach(() => {
  _setLangState('en')
  mocks.config = null
  mocks.signOut = vi.fn(async () => ({ owed: false }))
  mocks.recheck = vi.fn(async () => false)
  mocks.loadConfig = vi.fn(async () => mocks.config)
  mocks.toast = vi.fn()
})
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('Blocked', () => {
  it('says the subscription is not active and that the data is kept', () => {
    const page = mount(<Blocked />)
    expect(page.querySelector('h1,h2').textContent).toBe('Subscription inactive')
    expect(page.textContent).toContain('Your data is saved')
  })

  it('"Renew my subscription" is a link to config.renew_url, opened in a new tab', () => {
    mocks.config = { access_mode: 'subscription', renew_url: 'https://pay.example/renew' }
    const page = mount(<Blocked />)
    const a = button(page, 'Renew my subscription')
    expect(a.tagName).toBe('A')
    expect(a.getAttribute('href')).toBe('https://pay.example/renew')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toContain('noopener')
  })

  it('without renew_url there is no renew button, and the support e-mail is shown instead', () => {
    mocks.config = { access_mode: 'subscription' }
    const page = mount(<Blocked />)
    expect(button(page, 'Renew my subscription')).toBeUndefined()
    const mail = page.querySelector('a[href^="mailto:"]')
    expect(mail.getAttribute('href')).toBe('mailto:suporte@alcateiademonstros.com.br')
    expect(page.textContent).toContain('suporte@alcateiademonstros.com.br')
  })

  it('refuses a renew_url that is not http(s)', () => {
    mocks.config = { renew_url: 'javascript:alert(1)' }
    const page = mount(<Blocked />)
    expect(button(page, 'Renew my subscription')).toBeUndefined()
    expect(page.querySelector('a[href^="javascript"]')).toBeNull()
  })

  it('asks for the config when it has none yet', () => {
    mount(<Blocked />)
    expect(mocks.loadConfig).toHaveBeenCalled()
  })

  it('"Sign out" signs out keeping what is owed, and does not touch the copy otherwise', async () => {
    const page = mount(<Blocked />)
    act(() => button(page, 'Sign out').click())
    await settle()
    expect(mocks.signOut).toHaveBeenCalledWith({ force: true })
  })

  it('"I already renewed" checks again; still inactive says so, and does not reload anything', async () => {
    const page = mount(<Blocked />)
    act(() => button(page, 'I already renewed, check again').click())
    await settle()
    expect(mocks.recheck).toHaveBeenCalledTimes(1)
    expect(page.textContent).toContain('Still not active')
  })

  it('a check that finds it active leaves the screen to the app (no message)', async () => {
    mocks.recheck = vi.fn(async () => true)
    const page = mount(<Blocked />)
    act(() => button(page, 'I already renewed, check again').click())
    await settle()
    expect(page.textContent).not.toContain('Still not active')
  })
})
