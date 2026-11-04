import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import SupportLine from '../components/SupportLine.jsx'
import { Button } from '../components/ui.jsx'

// Paid access (ACCESS_MODE=subscription): what a profile sees, in place of the app, when its
// subscription is not active (the session says `access.active === false`, or a save came back
// 402). The data is not touched: it stays on the server and on this device, and comes back as
// soon as the subscription does. Only a link the server configured and that is http(s) is
// offered; with none, the support address is the way to ask.
const safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : '')

export default function Blocked() {
  const config = useStore(s => s.config)
  const loadConfig = useStore(s => s.loadConfig)
  const [checking, setChecking] = useState(false)
  const [still, setStill] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // Boot already asked; only if that failed does the renew link have to be asked for again.
  useEffect(() => { loadConfig?.() }, [loadConfig])
  const renew = safeUrl(config?.renew_url)

  const check = async () => {
    if (checking) return
    setChecking(true); setStill(false)
    try { const ok = await useStore.getState().recheckAccess(); if (!ok) setStill(true) }
    finally { setChecking(false) }
  }
  // Forced: the push cannot land while blocked, so what is owed is kept aside on this device and
  // comes back when the same account signs in again, instead of the sign-out refusing to go.
  const leave = async () => {
    if (leaving) return
    setLeaving(true)
    try { await useStore.getState().signOut({ force: true }) } finally { setLeaving(false) }
  }

  return (
    <div className="narrow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }}>
      <h1 className="t-large" style={{ fontWeight: 700, margin: '0 0 10px' }}>{t('Subscription inactive')}</h1>
      <div className="muted" style={{ marginBottom: 26 }}>
        {t('Your subscription is not active, so the app is paused. Your data is saved and comes back as soon as you renew.')}
      </div>
      {renew
        ? <a className="btn primary" href={renew} target="_blank" rel="noopener noreferrer">{t('Renew my subscription')}</a>
        : <div className="card small muted" style={{ textAlign: 'start' }}>
          <SupportLine />
        </div>}
      <div style={{ height: 10 }} />
      <Button onClick={check} disabled={checking}>{t('I already renewed, check again')}</Button>
      {still && <div className="small muted" role="status" style={{ marginTop: 10 }}>{t('Still not active. If you just paid, it can take a few minutes.')}</div>}
      <div style={{ height: 10 }} />
      <Button variant="ghost" className="dim" onClick={leave} disabled={leaving}>{t('Sign out')}</Button>
      {renew && <div className="dim small" style={{ marginTop: 18 }}>
        <SupportLine />
      </div>}
    </div>
  )
}
