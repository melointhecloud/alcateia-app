import { isCustomEx } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import Icon from './Icon.jsx'
import CustomMedia, { CustomThumb, LinkCard } from './CustomMedia.jsx'
import { youtubeId, youtubeLinks } from '../lib/youtube.js'
import { videoFor } from '../lib/exercise-videos.js'
import YouTubeVideo from './YouTubeVideo.jsx'
import { howToUrl } from '../lib/how-to.js'
import { t } from '../lib/i18n.js'

// An exercise's picture, wherever one shows. A custom exercise goes to CustomMedia.jsx — its own
// photo, GIF, video or link, from the local media store. A catalogue exercise has no media of its
// own in this fork (see below). The split is by component, not by branch, so each side keeps
// its own hooks in order.
export default function Media(p) {
  const size = useStore(s => s.S.gifSize)
  const custom = isCustomEx(p.ex)
  const links = youtubeLinks(p.notes).filter(url => !custom || youtubeId(url) !== youtubeId(p.ex?.url))
  return <>
    {custom ? <CustomMedia {...p} /> : <BuiltinMedia {...p} />}
    {(!p.minimizable || size !== 'off') && links.map(url => <LinkCard key={url} url={url} compact={p.compact} mini={p.minimizable && size === 'mini'} />)}
  </>
}

// Sem mídia nativa neste fork (licença da Gym visual não cobre uso comercial; docs/FORK-NOTAS.md):
// nenhum exercício do catálogo tem arquivo local. Se o exercício tem um vídeo curado
// (lib/exercise-videos.js), mostra o cartão do YouTube: sem iframe nem requisição ao YouTube até o
// toque. Sem vídeo, mostra "Ver como fazer": um link para a busca no YouTube (lib/how-to.js), em
// nova aba, que só é aberto no toque.
function BuiltinMedia({ ex, compact, minimizable }) {
  const gifSize = useStore(s => s.S.gifSize)
  const vid = videoFor(ex)
  if (minimizable && gifSize === 'off') return null
  if (vid) return <YouTubeVideo videoId={vid} compact={compact} mini={minimizable && gifSize === 'mini'} />
  const href = howToUrl(ex)
  if (!href) return null
  const mini = minimizable && gifSize === 'mini'
  return <a className={'exlink-card how-to-link' + (compact ? ' compact' : '') + (mini ? ' mini' : '')}
    href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
    <span className="exlink-icon"><Icon name="play" /></span>
    <span className="exlink-meta"><span className="exlink-title">{t('See how to do it')}</span>
      {!mini && <span className="exlink-sub">{t('Opens a search for good form')}</span>}</span>
    <Icon name="chevronRight" className="exlink-arr" />
  </a>
}

// The thumbnail of an exercise: a custom one shows its own photo (CustomThumb); a catalogue one
// is the neutral tile with the dumbbell, the same tile an exercise without media always had.
export function Thumb(p) {
  return isCustomEx(p.ex) ? <CustomThumb {...p} /> : <div className="thumb thumb-x" aria-hidden="true"><Icon name="dumbbell" /></div>
}
