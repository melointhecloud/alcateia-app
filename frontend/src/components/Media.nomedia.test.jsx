// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import Media, { Thumb } from './Media.jsx'
import { EXIDX } from '../lib/exercises.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const roots = []
afterEach(() => { act(() => { roots.splice(0).forEach(r => r.unmount()) }); document.body.innerHTML = '' })
const mount = el => {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host); roots.push(root); act(() => root.render(el)); return host
}
const ex = EXIDX['0001'] || Object.values(EXIDX).find(e => !e.custom)

describe('sem mídia nativa', () => {
  it('o exercício de teste vem do catálogo e tem mídia declarada', () => {
    expect(ex).toBeTruthy()
    expect(ex.gif || ex.img).toBeTruthy()
  })
  it('Media não pede arquivo de exercise-media/', () => {
    const host = mount(<Media ex={ex} />)
    expect(host.querySelectorAll('img[src*="exercise-media"], video[src*="exercise-media"], source[src*="exercise-media"]').length).toBe(0)
    expect(host.querySelectorAll('img, video, source').length).toBe(0)
  })
  it('Thumb não pede arquivo de exercise-media/', () => {
    const host = mount(<Thumb ex={ex} />)
    expect(host.querySelectorAll('img[src*="exercise-media"], video[src*="exercise-media"]').length).toBe(0)
    expect(host.querySelectorAll('img, video').length).toBe(0)
  })
  it('Thumb mostra o bloco neutro com ícone', () => {
    const host = mount(<Thumb ex={ex} />)
    const tile = host.querySelector('.thumb.thumb-x')
    expect(tile).toBeTruthy()
    expect(tile.querySelector('svg')).toBeTruthy()
  })
})
