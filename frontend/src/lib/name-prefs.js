// Whether a translated exercise name shows the English original in parentheses. A profile's own
// choice (S.enParens, per language) always wins; with none, Portuguese shows the translation alone
// (the buyers of this app read it in Portuguese, and "Flexão de Braços (Push-Up)" is noise) and every
// other language keeps the English name next to it, as upstream does.
import { baseLang } from './i18n-core.js'

const OFF_BY_DEFAULT = ['pt', 'pt-BR']

export const enParensOn = (S, lang) => {
  const base = baseLang(lang)
  const chosen = S?.enParens?.[base]
  return typeof chosen === 'boolean' ? chosen : !OFF_BY_DEFAULT.includes(base)
}
