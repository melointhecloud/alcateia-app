import { describe, it, expect } from 'vitest'
import { youtubeId, youtubeLinks, youtubeSearchUrl } from './youtube.js'

describe('YouTube exercise links', () => {
  it('accepts only known hosts and complete video IDs', () => {
    for (const url of ['https://youtu.be/99QhMQoxmOk', 'youtube.com/watch?v=99QhMQoxmOk', 'https://m.youtube.com/shorts/99QhMQoxmOk', 'https://www.youtube-nocookie.com/embed/99QhMQoxmOk']) {
      expect(youtubeId(url)).toBe('99QhMQoxmOk')
    }
    for (const url of ['https://youtube.com.evil.test/watch?v=99QhMQoxmOk', 'javascript:alert(1)', 'https://user@youtube.com/watch?v=99QhMQoxmOk', 'https://youtube.com:8443/watch?v=99QhMQoxmOk', 'https://youtube.com/playlist?list=99QhMQoxmOk', 'https://youtu.be/x', null]) expect(youtubeId(url)).toBeNull()
  })
  it('extracts and deduplicates video references without treating other links as embeds', () => {
    expect(youtubeLinks('Squat: https://www.youtube.com/watch?v=99QhMQoxmOk; same: https://youtu.be/99QhMQoxmOk\nOther: https://example.org')).toEqual(['https://youtu.be/99QhMQoxmOk'])
  })

  it('com o nome traduzido a busca é em português: nome + exercício execução correta', () => {
    expect(youtubeSearchUrl({ id: '1', n: 'squat' }, 'Agachamento'))
      .toBe('https://www.youtube.com/results?search_query=Agachamento+exerc%C3%ADcio+execu%C3%A7%C3%A3o+correta')
  })
  it('tira o original em inglês entre parênteses que o nome do app pode trazer', () => {
    const ex = { id: '1', n: 'barbell bench press' }
    const base = youtubeSearchUrl(ex, 'supino reto com barra')
    expect(youtubeSearchUrl(ex, 'supino reto com barra (barbell bench press)')).toBe(base)
    expect(youtubeSearchUrl(ex, 'supino reto com barra \u2068(barbell bench press)\u2069')).toBe(base)
    // um parêntese que faz parte do nome de verdade fica
    expect(youtubeSearchUrl({ id: '2', n: 'row' }, 'remada (pegada neutra)')).toContain('remada+(pegada+neutra)')
  })
  it('sem nome traduzido mantém o comportamento de sempre (nome em inglês + form)', () => {
    expect(youtubeSearchUrl({ id: '1', n: 'barbell bench press' })).toBe('https://www.youtube.com/results?search_query=barbell+bench+press+form')
    expect(youtubeSearchUrl({ id: '1', n: 'barbell bench press' }, '  ')).toBe('https://www.youtube.com/results?search_query=barbell+bench+press+form')
    expect(youtubeSearchUrl(null, 'Agachamento')).toBeNull()
    expect(youtubeSearchUrl({ id: 'x', n: 'x', missing: true }, 'Agachamento')).toBeNull()
  })
})
