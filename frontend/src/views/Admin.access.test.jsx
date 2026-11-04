// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Admin from './Admin.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* The "Access" card of the dashboard (Task D5): the rights the paid-access mode looks at, listed
   with e-mail, plan, status, validity and the profile each is linked to, and a form to grant or
   adjust one by hand (PUT /api/admin/entitlements). The dashboard is English-only on purpose. */
const mocks = vi.hoisted(() => ({ answers: {}, calls: [], fail: null, toasts: [], config: null }))
vi.mock('../lib/api.js', () => ({
  api: (path, init) => {
    const key = path.split('?')[0]
    mocks.calls.push({ path: key, method: init?.method || 'GET', body: init?.body ? JSON.parse(init.body) : undefined })
    if (key === '/api/admin/entitlements' && mocks.fail) return Promise.reject(mocks.fail)
    const a = mocks.answers[key + ':' + (init?.method || 'GET')] ?? mocks.answers[key]
    return a !== undefined ? Promise.resolve(typeof a === 'function' ? a(init) : a) : Promise.reject(new Error('not found'))
  }
}))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ user: { id: 'adm', name: 'Admin', admin: true }, S: {}, config: mocks.config })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: m => mocks.toasts.push(m), openSheet: () => {} })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {}, useLocation: () => ({ state: null }) }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: vi.fn() }))
vi.mock('./AdminCoach.jsx', () => ({ default: () => null }))

const mounted = []
function render(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(el))
  return host
}
const settle = () => act(() => new Promise(r => setTimeout(r, 0)))
// A controlled input only hears about a value set through the prototype's setter.
function type(el, value) {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  act(() => { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })) })
}
const card = page => [...page.querySelectorAll('.card')].find(c => c.querySelector('h2')?.textContent === 'Access')

const future = new Date(Date.now() + 30 * 86400000).toISOString()
const past = new Date(Date.now() - 5 * 86400000).toISOString()
const ROWS = [
  { email: 'ana@example.com', plan: 'mensal', status: 'active', validUntil: future, userId: 'u1', userName: 'Ana', source: 'cakto' },
  { email: 'bia@example.com', plan: 'trimestral', status: 'inactive', validUntil: past, userId: null, userName: null, source: 'cakto' },
]

beforeEach(() => {
  document.body.innerHTML = ''
  mocks.calls.length = 0; mocks.toasts.length = 0; mocks.fail = null; mocks.config = null
  mocks.answers = {
    '/api/admin/users': { users: [], invite_only: false },
    '/api/admin/invites': { invites: [] },
    '/api/admin/audit': { rows: [] },
    '/api/admin/entitlements': { entitlements: ROWS, access_mode: true, grace_days: 3 },
  }
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

const invitesLead = page => [...page.querySelectorAll('.card')].find(c => c.querySelector('h2')?.textContent === 'Invite codes').querySelector('.adm-lead').textContent

describe('Admin "Invite codes" card wording', () => {
  it('on an invite-only instance it says a code is needed', async () => {
    mocks.answers['/api/admin/users'] = { users: [], invite_only: true }
    const page = render(<Admin />)
    await settle()
    expect(invitesLead(page)).toContain('Sign-up is invite-only')
  })
  it('with paid access it says the purchase is the door, even with INVITE_ONLY left on', async () => {
    mocks.config = { access_mode: 'subscription', invite_only: true }
    mocks.answers['/api/admin/users'] = { users: [], invite_only: true }
    const page = render(<Admin />)
    await settle()
    const lead = invitesLead(page)
    expect(lead).not.toContain('invite-only')
    expect(lead).toContain('Sign-up is by purchase')
  })
})

describe('Admin "Access" card', () => {
  it('lists each right with e-mail, plan, status, validity and the linked profile', async () => {
    const page = render(<Admin />)
    await settle()
    const c = card(page)
    expect(c).toBeTruthy()
    const text = c.textContent
    expect(text).toContain('ana@example.com')
    expect(text).toContain('mensal')
    expect(text).toContain('Ana')
    expect(text).toContain('bia@example.com')
    expect(text).toContain('trimestral')
    expect(text).toContain('not signed up yet')
    const pills = [...c.querySelectorAll('.adm-pill')].map(p => p.textContent)
    expect(pills).toContain('active')
    expect(pills).toContain('off')
  })

  it('a right whose validity has passed reads "expired", not "active"', async () => {
    mocks.answers['/api/admin/entitlements'] = { entitlements: [{ ...ROWS[0], validUntil: past }], access_mode: true }
    const page = render(<Admin />)
    await settle()
    const pills = [...card(page).querySelectorAll('.adm-pill')].map(p => p.textContent)
    expect(pills).toContain('expired')
    expect(pills).not.toContain('active')
  })

  it('says so when there are no rights yet', async () => {
    mocks.answers['/api/admin/entitlements'] = { entitlements: [], access_mode: false }
    const page = render(<Admin />)
    await settle()
    expect(card(page).querySelector('.adm-empty').textContent).toMatch(/No access rights yet/)
    // the mode is off on this server: the card says nobody is blocked
    expect(card(page).textContent).toMatch(/ACCESS_MODE/)
  })

  it('shows why the list could not load, with a way to try again', async () => {
    mocks.fail = new Error('boom')
    const page = render(<Admin />)
    await settle()
    expect(card(page).textContent).toContain('boom')
    mocks.fail = null
    const retry = [...card(page).querySelectorAll('button')].find(b => b.textContent === 'Try again')
    expect(retry).toBeTruthy()
    act(() => retry.click())
    await settle()
    expect(card(page).textContent).toContain('ana@example.com')
  })

  it('"Grant access" sends the e-mail, plan, validity (end of the chosen day) and status', async () => {
    mocks.answers['/api/admin/entitlements:PUT'] = { entitlements: [...ROWS, { email: 'new@example.com', plan: 'semestral', status: 'active', validUntil: future }] }
    const page = render(<Admin />)
    await settle()
    const c = card(page)
    type(c.querySelector('input[type="email"]'), '  New@Example.com ')
    type(c.querySelector('select[name="plan"]'), 'semestral')
    type(c.querySelector('input[type="date"]'), '2030-06-15')
    const grant = [...c.querySelectorAll('button')].find(b => b.textContent === 'Grant access')
    act(() => grant.click())
    await settle()
    const put = mocks.calls.find(x => x.method === 'PUT')
    expect(put.path).toBe('/api/admin/entitlements')
    expect(put.body.email).toBe('new@example.com')
    expect(put.body.plan).toBe('semestral')
    expect(put.body.status).toBe('active')
    // end of June 15th in the browser's time zone, written as an instant
    expect(new Date(put.body.validUntil).getTime()).toBe(new Date(2030, 5, 15, 23, 59, 59).getTime())
    // the answer replaces the list
    expect(card(page).textContent).toContain('new@example.com')
  })

  it('asks for a valid e-mail and a date before it sends anything', async () => {
    const page = render(<Admin />)
    await settle()
    const c = card(page)
    const grant = [...c.querySelectorAll('button')].find(b => b.textContent === 'Grant access')
    act(() => grant.click())
    expect(c.querySelector('[role="alert"]').textContent).toMatch(/e-mail/i)
    type(c.querySelector('input[type="email"]'), 'x@example.com')
    act(() => grant.click())
    expect(c.querySelector('[role="alert"]').textContent).toMatch(/date/i)
    expect(mocks.calls.some(x => x.method === 'PUT')).toBe(false)
  })

  it('shows the server\'s refusal on the form', async () => {
    mocks.answers['/api/admin/entitlements:PUT'] = () => { throw new Error('that profile already has a right') }
    const page = render(<Admin />)
    await settle()
    const c = card(page)
    type(c.querySelector('input[type="email"]'), 'x@example.com')
    type(c.querySelector('input[type="date"]'), '2030-01-01')
    act(() => [...c.querySelectorAll('button')].find(b => b.textContent === 'Grant access').click())
    await settle()
    expect(c.querySelector('[role="alert"]').textContent).toContain('that profile already has a right')
  })

  it('tapping a right fills the form so it can be adjusted', async () => {
    const page = render(<Admin />)
    await settle()
    const c = card(page)
    const row = [...c.querySelectorAll('.item')].find(el => el.textContent.includes('ana@example.com'))
    act(() => row.click())
    expect(c.querySelector('input[type="email"]').value).toBe('ana@example.com')
    expect(c.querySelector('select[name="plan"]').value).toBe('mensal')
    expect(c.querySelector('input[type="date"]').value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect([...c.querySelectorAll('button')].some(b => b.textContent === 'Save changes')).toBe(true)
  })
})
