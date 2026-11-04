// BRAND.leanSettings: this deploy hides what does not make sense for the buyer (Zepp OS watch,
// Integrations, Seasonal themes, the Coach module, exercise drawings and animations). Both states.
import { afterEach, describe, expect, it } from 'vitest'
import { BRAND, leanHides } from '../lib/brand.js'
import { PAGES, ROOT_GROUPS, pageVisible, searchSettings } from './settings-pages.js'

const ctx = { user: { id: 'u1' }, mobile: false, demo: false, ios: false, android: false }
const was = BRAND.leanSettings
afterEach(() => { BRAND.leanSettings = was })
const rootPages = () => ROOT_GROUPS.flat().filter(id => pageVisible(id, ctx))
const hit = q => searchSettings(q, ctx).map(h => h.label)

describe('leanSettings on (this deploy)', () => {
  it('is the default of this fork', () => { expect(was).toBe(true) })

  it('takes the Zepp OS watch and Integrations off the root, and their pages away', () => {
    BRAND.leanSettings = true
    const root = rootPages()
    expect(root).not.toContain('zepp')
    expect(root).not.toContain('integrations')
    expect(root).toContain('workout')
    for (const id of ['zepp', 'integrations', 'themes', 'apple-health', 'health-connect']) expect(pageVisible(id, { ...ctx, ios: true, mobile: true, android: true }), id).toBe(false)
  })

  it('hides the Coach, Integrations and Seasonal modules from the list but keeps the others', () => {
    BRAND.leanSettings = true
    expect(leanHides('modules', 'coach')).toBe(true)
    expect(leanHides('modules', 'integrations')).toBe(true)
    expect(leanHides('modules', 'seasonal')).toBe(true)
    expect(leanHides('modules', 'motivation')).toBe(false)
  })

  it('the search does not offer them either', () => {
    BRAND.leanSettings = true
    expect(hit('zepp')).not.toContain('Zepp OS watch')
    expect(hit('webhook')).toEqual([])
    expect(hit('seasonal')).toEqual([])
    expect(hit('halloween')).toEqual([])
    expect(hit('coach')).not.toContain('AI Coach')
    expect(hit('drawings')).toEqual([])
    expect(hit('animations')).toEqual([])
    expect(hit('rest timer')).toContain('Rest timer')
  })
})

describe('leanSettings off (upstream, self-host)', () => {
  it('shows everything again', () => {
    BRAND.leanSettings = false
    expect(rootPages()).toEqual(expect.arrayContaining(['zepp', 'integrations']))
    expect(pageVisible('themes', ctx)).toBe(true)
    expect(leanHides('modules', 'coach')).toBe(false)
    expect(hit('zepp')).toContain(PAGES.zepp.title)
    expect(hit('drawings')).toContain('Exercise drawings')
    expect(hit('animations')).toContain('Exercise animations')
    expect(hit('halloween').length).toBeGreaterThan(0)
  })
})
