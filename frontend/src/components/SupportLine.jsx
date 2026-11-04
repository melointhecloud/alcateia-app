import { t } from '../lib/i18n.js'
import { BRAND } from '../lib/brand.js'

// "Need help? Write to <address>." in the UI language, the address as a mailto link. Used where a
// person who paid (or thinks they did) is stuck: the sign-up refusal and the inactive-subscription screen.
export default function SupportLine() {
  const parts = t('Need help? Write to {0}.', BRAND.supportEmail).split(BRAND.supportEmail)
  return <>{parts.flatMap((part, i) => i < parts.length - 1
    ? [part, <a key={i} href={'mailto:' + BRAND.supportEmail}>{BRAND.supportEmail}</a>]
    : [part])}</>
}
