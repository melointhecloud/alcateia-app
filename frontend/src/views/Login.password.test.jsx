// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login.jsx'
import { passwordRegister } from '../lib/api.js'
import { _setLangState } from '../lib/i18n-core.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* The sign-in screen with password sign-in (#118). Only an instance that advertises
   `password_login` shows any of it; there, a browser without passkey support finally has a way
   in instead of being told to stay local, and creating a profile can use a password. */
const mocks = vi.hoisted(() => {
  const state = { webauthn: true, config: null, sheets: [] }
  state.snapshot = () => ({
    config: state.config, S: {},
    setUser: vi.fn(), adoptProfile: vi.fn(), setGuest: vi.fn(), loadConfig: vi.fn(async () => state.config),
    pushState: vi.fn(), pullState: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: render => { mocks.sheets.push(render); return {} } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('../lib/api.js', () => ({
  webauthnOK: () => mocks.webauthn, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), BIO: 'your fingerprint', bio: () => 'your fingerprint',
  api: vi.fn(), passkeyAssertion: vi.fn(), passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(),
}))
vi.mock('../lib/demo.js', () => ({ DEMO: false, REPO: 'https://example.invalid' }))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: vi.fn(), confirmSheet: vi.fn() }))

const mounted = []
function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(el))
  return host
}
const buttons = host => [...host.querySelectorAll('button')].map(b => b.textContent)
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text)

beforeEach(() => { mocks.webauthn = true; mocks.config = null; mocks.sheets.length = 0; _setLangState('en'); window.location.hash = ''; vi.mocked(passwordRegister).mockReset() })
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('Login with password sign-in', () => {
  it('an instance without it looks exactly as before', () => {
    const page = mount(<Login />)
    expect(buttons(page)).not.toContain('Sign in with password')
    expect(page.textContent).toContain('Passkeys use your fingerprint. No passwords to remember.')
    mocks.webauthn = false
    const noPasskeys = mount(<Login />)
    expect(noPasskeys.textContent).toContain("This browser doesn't do passkeys, but you can still use Alcateia locally on this device.")
    expect(buttons(noPasskeys)).not.toContain('Sign in with password')
  })

  it('next to passkeys it is a second button, and the footer no longer says "no passwords"', () => {
    mocks.config = { password_login: true, allow_guest: true }
    const page = mount(<Login />)
    expect(buttons(page).slice(0, 3)).toEqual(['Sign in with passkey', 'Sign in with password', 'Create new profile'])
    expect(page.textContent).toContain('Passkeys use your fingerprint. A password works too, where passkeys do not.')
    act(() => button(page, 'Sign in with password').click())
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(sheet.querySelector('h3').textContent).toBe('Sign in with password')
    expect(sheet.querySelector('input[autocomplete="current-password"]')).toBeTruthy()
  })

  it('a browser without passkeys gets a way in instead of "stay local"', () => {
    mocks.webauthn = false
    mocks.config = { password_login: true, allow_guest: false }
    const page = mount(<Login />)
    expect(page.textContent).toContain("This browser doesn't support passkeys. Sign in with your name and password instead.")
    expect(page.textContent).not.toContain('Try a browser or device with passkey support.')
    expect(buttons(page)).toEqual(['Sign in with password', 'Create new profile', 'Lost access?'])
    // Creating a profile here can only mean a password: no passkey/password choice to make.
    act(() => button(page, 'Create new profile').click())
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(sheet.querySelector('.seg')).toBeNull()
    expect(sheet.querySelector('input[placeholder="Repeat the password"]')).toBeTruthy()
    expect(buttons(sheet)).toContain('Create profile')
  })

  it('where both work, creating a profile starts on the passkey and switches to a password', () => {
    mocks.config = { password_login: true, invite_only: true }
    const page = mount(<Login />)
    act(() => button(page, 'Create new profile').click())
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(buttons(sheet)).toContain('Create passkey')
    act(() => button(sheet, 'Password').click())
    expect(buttons(sheet)).toContain('Create profile')
    expect(sheet.querySelector('input[placeholder="Invite code"]')).toBeTruthy()
    expect(sheet.querySelector('input[autocomplete="new-password"]')).toBeTruthy()
  })
})

/* Paid access (ACCESS_MODE=subscription): the e-mail of the purchase is what lets a person in, so
   the sign-up asks for it (required), words the server's one neutral refusal kindly, and a
   passkey sign-up (which on that server needs an invite) is not the road offered. The Cakto
   "thank you" page points at /#/login?cadastro=1, which opens the sign-up directly. */
describe('Sign-up with paid access on', () => {
  const sub = { password_login: true, access_mode: 'subscription', renew_url: 'https://pay.example/renew' }
  const input = (host, sel) => host.querySelector(sel)
  function type(el, value) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
    act(() => { el.dispatchEvent(new Event('input', { bubbles: true })) })
  }
  const openSheet = () => {
    const page = mount(<Login />)
    act(() => button(page, 'I already bought, create my account').click())
    return { page, sheet: mount(mocks.sheets[0](() => {})) }
  }
  const fill = (sheet, { email = 'ana@example.com', name = 'Ana', pw = 'correct horse battery' } = {}) => {
    type(input(sheet, 'input[name="username"]'), name)
    type(input(sheet, 'input[name="email"]'), email)
    type(input(sheet, 'input[name="new-password"]'), pw)
    type(input(sheet, 'input[name="new-password-again"]'), pw)
  }
  const submit = sheet => act(() => { sheet.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })

  it('the entrance says "I already bought" and opens the password sign-up with no passkey choice', () => {
    mocks.config = sub
    const { page, sheet } = openSheet()
    expect(buttons(page)).not.toContain('Create new profile')
    expect(sheet.querySelector('.seg')).toBeNull()
    expect(buttons(sheet)).not.toContain('Create passkey')
    expect(input(sheet, 'input[name="email"]').placeholder).toBe('Purchase e-mail')
    expect(sheet.textContent).toContain('Use the same e-mail you bought with')
    expect(sheet.textContent).not.toContain('E-mail (optional)')
  })

  it('the e-mail is required: an empty one stops the sign-up before the server is asked', () => {
    mocks.config = sub
    const { sheet } = openSheet()
    fill(sheet, { email: '' })
    submit(sheet)
    expect(sheet.querySelector('[role="alert"]').textContent).toBe('Enter the e-mail used in the purchase.')
    expect(passwordRegister).not.toHaveBeenCalled()
  })

  it('a malformed e-mail is stopped too', () => {
    mocks.config = sub
    const { sheet } = openSheet()
    fill(sheet, { email: 'not-an-email' })
    submit(sheet)
    expect(sheet.querySelector('[role="alert"]').textContent).toBe('That is not an e-mail address.')
    expect(passwordRegister).not.toHaveBeenCalled()
  })

  it('sends the e-mail with the sign-up', async () => {
    mocks.config = sub
    vi.mocked(passwordRegister).mockResolvedValue({ id: 'u1', name: 'Ana' })
    const { sheet } = openSheet()
    fill(sheet)
    submit(sheet)
    await act(() => new Promise(r => setTimeout(r, 0)))
    expect(passwordRegister).toHaveBeenCalledWith('Ana', 'correct horse battery', '', 'ana@example.com')
  })

  it('the server\'s neutral refusal (403 no-subscription) is shown kindly, with the support address', async () => {
    mocks.config = sub
    vi.mocked(passwordRegister).mockRejectedValue(Object.assign(new Error('não encontramos uma assinatura ativa para este e-mail'), { status: 403, data: { code: 'no-subscription' } }))
    const { sheet } = openSheet()
    fill(sheet)
    submit(sheet)
    await act(() => new Promise(r => setTimeout(r, 0)))
    const alert = sheet.querySelector('[role="alert"]').textContent
    expect(alert).toContain('We could not find an active subscription for this e-mail. Check the e-mail used in the purchase.')
    expect(sheet.textContent).toContain('suporte@alcateiademonstros.com.br')
  })

  it('without the mode on, the e-mail stays optional and nothing changes', async () => {
    mocks.config = { password_login: true }
    vi.mocked(passwordRegister).mockResolvedValue({ id: 'u1', name: 'Ana' })
    const page = mount(<Login />)
    act(() => button(page, 'Create new profile').click())
    const sheet = mount(mocks.sheets[0](() => {}))
    act(() => button(sheet, 'Password').click())
    expect(input(sheet, 'input[name="email"]').placeholder).toBe('E-mail (optional)')
    fill(sheet, { email: '' })
    submit(sheet)
    await act(() => new Promise(r => setTimeout(r, 0)))
    expect(passwordRegister).toHaveBeenCalledWith('Ana', 'correct horse battery', '', '')
  })

  it('/#/login?cadastro=1 opens the password sign-up by itself', () => {
    mocks.config = sub
    window.location.hash = '#/login?cadastro=1'
    mount(<Login />)
    expect(mocks.sheets).toHaveLength(1)
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(input(sheet, 'input[name="email"]').placeholder).toBe('Purchase e-mail')
  })

  it('without ?cadastro=1 nothing opens on its own', () => {
    mocks.config = sub
    mount(<Login />)
    expect(mocks.sheets).toHaveLength(0)
  })

  it('with no password sign-in on the server, the passkey road asks for the invite code it needs', () => {
    mocks.config = { access_mode: 'subscription' }
    const page = mount(<Login />)
    act(() => button(page, 'I already bought, create my account').click())
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(buttons(sheet)).toContain('Create passkey')
    expect(sheet.querySelector('input[placeholder="Invite code"]')).toBeTruthy()
  })
})
