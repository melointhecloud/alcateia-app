// Exercício do catálogo -> id do vídeo no YouTube (11 caracteres). Só ids, nunca URLs.
// Curadoria: docs/curadoria-videos.csv (Task C3, aprovada pela dona do produto). Conferido por
// scripts/videos/verify.mjs (oEmbed). Para usar um vídeo próprio, troque o id aqui.
// Este módulo não importa nada: o script de verificação o lê direto no Node.
export const EXERCISE_VIDEOS = {}

const YT_ID = /^[A-Za-z0-9_-]{11}$/

// O id do vídeo curado do exercício, ou null. Exercício próprio do usuário (custom) nunca usa o
// mapa: ele tem a sua própria mídia (CustomMedia.jsx). Um id mal formado no mapa vale como "sem vídeo",
// para que um erro de digitação nunca vire um iframe quebrado.
export function videoFor(ex) {
  if (!ex || typeof ex !== 'object' || ex.custom === true) return null
  if (!Object.hasOwn(EXERCISE_VIDEOS, ex.id)) return null
  const vid = EXERCISE_VIDEOS[ex.id]
  return typeof vid === 'string' && YT_ID.test(vid) ? vid : null
}
