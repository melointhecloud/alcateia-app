// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// This fork has no catalogue stills: a catalogue exercise's thumbnail is the neutral tile an
// exercise without media has, never an <img> (so no broken-image glyph, no request).
vi.mock('../store/useStore.js', () => ({ useStore: () => null }))
const { Thumb } = await import('./Media.jsx')

const mounted = []
function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(el))
  return { host, root }
}
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('Thumb', () => {
  it('a catalogue exercise shows the neutral tile, never an image', () => {
    const { host } = mount(<Thumb ex={{ id: 'a', img: 'a.jpg' }} />)
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('.thumb.thumb-x')).toBeTruthy()
  })

  it('another exercise in the same place gets the tile too', () => {
    const { host, root } = mount(<Thumb ex={{ id: 'a', img: 'a.jpg' }} />)
    act(() => root.render(<Thumb ex={{ id: 'b', img: 'b.jpg' }} />))
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('.thumb.thumb-x')).toBeTruthy()
  })

  it('an exercise without media has the tile from the start', () => {
    const { host } = mount(<Thumb ex={{ id: 'c' }} />)
    expect(host.querySelector('.thumb-x')).toBeTruthy()
  })
})
