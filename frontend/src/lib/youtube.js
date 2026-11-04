// Only a video ID crosses into the iframe URL; never embed an arbitrary exercise link.
export function youtubeId(value) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null
    const host = url.hostname.toLowerCase()
    const parts = url.pathname.split('/').filter(Boolean)
    const id = host === 'youtu.be' && parts.length === 1 ? parts[0]
      : ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host)
        ? url.pathname === '/watch' ? url.searchParams.get('v')
          : ['embed', 'shorts', 'live'].includes(parts[0]) && parts.length === 2 ? parts[1] : null
        : null
    return /^[\w-]{11}$/.test(id || '') ? id : null
  } catch { return null }
}

export function youtubeLinks(notes = '') {
  return [...new Map((String(notes).match(/https?:\/\/[^\s<>";]+/g) || [])
    .map(url => [youtubeId(url), url]).filter(([id]) => id)).values()]
}

// "Ver como fazer" / "Watch on YouTube" on every exercise: a plain search for the exercise's
// English catalogue name plus "form" (a custom exercise searches its own name). With `localName`
// (the name the app shows in the person's language) the search is in that language instead:
// "<name> exercício execução correta", the Portuguese words the app is used in. The English
// original that a translated name carries in brackets is dropped, so the search stays in one
// language. No API, no key, nothing embedded: the address is only built here, and only opened
// after a tap. Null when there is no name to search for.
const squash = v => String(v || '').replace(/\s+/g, ' ').trim()
const clean = v => squash(v).slice(0, 100)
export function youtubeSearchUrl(ex, localName) {
  if (!ex || ex.missing) return null
  const name = clean(ex?.n)
  if (!name) return null
  let local = squash(localName)
  // "supino (barbell bench press)": the brackets hold the English title, with or without the
  // direction isolates that right-to-left packs add (lib/i18n-core.js englishInParens).
  if (local && name) {
    const tail = '(' + name + ')'
    const cut = local.replace(/[\u2068\u2069]/g, '')
    if (cut.toLowerCase().endsWith(tail.toLowerCase()) && cut.length > tail.length) local = cut.slice(0, cut.length - tail.length).trim()
  }
  local = local.slice(0, 100).trim()
  const q = local ? local + ' exercício execução correta' : name + ' form'
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q).replace(/%20/g, '+')
}
