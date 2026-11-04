import { getLang, exerciseNameFor } from './i18n.js'
import { youtubeSearchUrl } from './youtube.js'

// The "Ver como fazer" address of an exercise (lib/youtube.js). In Portuguese the search uses the
// name the app shows plus "exercício execução correta"; in any other language it stays the English
// catalogue name plus "form", as the app always searched. Null when there is nothing to search for.
export function howToUrl(ex) {
  const pt = /^pt(-|$)/i.test(getLang())
  return youtubeSearchUrl(ex, pt ? exerciseNameFor(ex) : undefined)
}
