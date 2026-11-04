// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'

// Id de TESTE, só aqui: o mapa de produção começa vazio (a curadoria é a Task C3).
vi.mock('../lib/exercise-videos.js', () => ({
  EXERCISE_VIDEOS: {},
  videoFor: ex => (ex?.id === 'com-video' ? 'TESTEvid_-1' : null),
}))

const { default: Media } = await import('./Media.jsx')
const { useStore } = await import('../store/useStore.js')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
// O iframe só precisa existir com o src certo; o happy-dom não deve tentar carregá-lo.
window.happyDOM.settings.disableIframePageLoading = true

const roots = []
afterEach(() => {
  act(() => { roots.splice(0).forEach(r => r.unmount()) }); document.body.innerHTML = ''
  act(() => useStore.setState(s => ({ S: { ...s.S, gifSize: 'full' } })))
})
const mount = el => {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host); roots.push(root); act(() => root.render(el)); return host
}
const withVideo = { id: 'com-video', n: 'Agachamento' }
const withoutVideo = { id: 'sem-video', n: 'Remada' }

describe('Media com vídeo curado', () => {
  it('antes do toque há só o cartão: nenhum iframe, imagem, vídeo ou requisição ao YouTube', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    const host = mount(<Media ex={withVideo} />)
    expect(host.querySelector('.youtube-video button.exlink-card')).toBeTruthy()
    expect(host.querySelectorAll('iframe, img, video, source').length).toBe(0)
    expect(host.innerHTML).not.toMatch(/youtube(-nocookie)?\.com/)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
  it('depois do toque o iframe é do youtube-nocookie.com com o id curado', () => {
    const host = mount(<Media ex={withVideo} />)
    act(() => { host.querySelector('button.exlink-card').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    const frames = host.querySelectorAll('iframe')
    expect(frames.length).toBe(1)
    const src = new URL(frames[0].getAttribute('src'))
    expect(src.origin).toBe('https://www.youtube-nocookie.com')
    expect(src.pathname).toBe('/embed/TESTEvid_-1')
  })
  it('respeita o tamanho "off" quando a mídia é minimizável', () => {
    act(() => useStore.setState(s => ({ S: { ...s.S, gifSize: 'off' } })))
    expect(mount(<Media ex={withVideo} minimizable />).querySelector('.youtube-video')).toBeNull()
    expect(mount(<Media ex={withVideo} />).querySelector('.youtube-video')).toBeTruthy()
  })
  it('no tamanho "mini" o cartão é o compacto', () => {
    act(() => useStore.setState(s => ({ S: { ...s.S, gifSize: 'mini' } })))
    expect(mount(<Media ex={withVideo} minimizable />).querySelector('button.exlink-card.mini')).toBeTruthy()
  })
  it('com vídeo curado NÃO mostra o botão "Ver como fazer"', () => {
    const host = mount(<Media ex={withVideo} />)
    expect(host.querySelector('a.how-to-link')).toBeNull()
    expect(host.textContent).not.toMatch(/Ver como fazer/)
  })
  it('sem vídeo curado mostra "Ver como fazer": link de busca em nova aba, sem opener nem referrer', async () => {
    const { setLang } = await import('../lib/i18n.js')
    await setLang('pt-BR')
    const host = mount(<Media ex={withoutVideo} />)
    const a = host.querySelector('a.how-to-link')
    expect(a).toBeTruthy()
    expect(a.textContent).toContain('Ver como fazer')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    expect(a.getAttribute('href')).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=.*exerc%C3%ADcio\+execu%C3%A7%C3%A3o\+correta$/)
    expect(host.querySelectorAll('iframe, img, video').length).toBe(0)
    await setLang('en')
  })
  it('em inglês o link é a busca em inglês, com o rótulo em inglês', async () => {
    const host = mount(<Media ex={withoutVideo} />)
    expect(host.querySelector('a.how-to-link').getAttribute('href')).toBe('https://www.youtube.com/results?search_query=Remada+form')
  })
  it('respeita o tamanho "off" quando a mídia é minimizável, e "mini" usa o cartão compacto', () => {
    act(() => useStore.setState(s => ({ S: { ...s.S, gifSize: 'off' } })))
    expect(mount(<Media ex={withoutVideo} minimizable />).querySelector('a.how-to-link')).toBeNull()
    expect(mount(<Media ex={withoutVideo} />).querySelector('a.how-to-link')).toBeTruthy()
    act(() => useStore.setState(s => ({ S: { ...s.S, gifSize: 'mini' } })))
    expect(mount(<Media ex={withoutVideo} minimizable />).querySelector('a.how-to-link.mini')).toBeTruthy()
  })
  it('exercício próprio não ganha o botão (tem a mídia dele)', () => {
    const host = mount(<Media ex={{ id: 'c1', n: 'Meu exercício', custom: true }} />)
    expect(host.querySelector('a.how-to-link')).toBeNull()
  })
})
