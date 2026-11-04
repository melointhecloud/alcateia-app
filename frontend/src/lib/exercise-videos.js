// Exercício do catálogo -> id do vídeo no YouTube (11 caracteres). Só ids, nunca URLs.
// Curadoria: docs/curadoria-videos.csv (Task C3, aprovada pelo dono do produto). Conferido por
// scripts/videos/verify.mjs (oEmbed). Para usar um vídeo próprio, troque o id aqui.
// Este módulo não importa nada: o script de verificação o lê direto no Node.
export const EXERCISE_VIDEOS = {
  '0085': 'QdNf6K1fbaQ', // Levantamento terra romeno com barra
  '0198': '7cCiQUdIXWw', // Puxada na polia alta
  '0274': 'ALrzwZoLYyI', // Abdominal crunch no solo
  '0276': 'cejjzAHd4B8', // Dead bug
  '0289': 'Spbmm66NsuY', // Supino reto com halteres
  '0292': 'LhLDYH-ExbE', // Remada unilateral com halter (serrote)
  '0293': 'T0cMo0KJXvs', // Remada curvada com halteres
  '0294': 'c__3LAiXYOk', // Rosca direta com halteres
  '0334': 'fWSKF_jDk0M', // Elevação lateral com halteres
  '0336': 'LCXGqMBlKHs', // Avanço com halteres
  '0380': '-riiVfD9Qw4', // Crucifixo inverso com halteres
  '0405': 'V7rw4dRMw2M', // Desenvolvimento sentado com halteres
  '0426': '3ZwwrTtnGJo', // Desenvolvimento em pé com halteres
  '0431': 'OXvpztvY2Sc', // Subida no banco com halteres
  '0576': '97BGDU2NtzU', // Supino na máquina
  '0585': 'xnSb4yxm7I4', // Cadeira extensora
  '0586': '8Nat6GRiEoc', // Mesa flexora
  '0594': 'Bx6elAOgxMI', // Panturrilha sentado na máquina
  '0603': 'Q7K6DI9R-A8', // Desenvolvimento de ombros na máquina
  '0612': 'xLaKue8vfGY', // Afundo com o peso do corpo
  '0630': 'DTVVwQs-zoM', // Mountain climber (escalador)
  '0662': 'pjWhC44qWqE', // Flexão de braço
  '0770': '2XaW-WQ2LBY', // Agachamento no smith
  '0801': 'BGtG8a-wAsc', // Subida no banco
  '0861': '2YebbYuuBJQ', // Remada baixa na polia
  '0871': 'PaW-N43kjSQ', // Abdominal tuck crunch (joelhos ao peito)
  '0930': 'kjc7U5eMaB0', // Remada em pé com elástico
  '1034': '50qHGus1TZk', // Cadeira abdutora
  '1060': 'vvIc6wdDyTc', // Elevação pélvica com barra (hip thrust)
  '1160': 'ApxlA_sn2yc', // Burpee
  '1197': 'umv7w9BgZbo', // Agachamento livre
  '1350': 'T8quDTCpQtk', // Remada sentada na máquina
  '1459': '601YoPL6y6E', // Stiff com halteres
  '1760': 'DF9sXArkDUw', // Agachamento goblet
  '2072': 'pY9qYxyCO_c', // Elevação pélvica (hip thrust) com o peso do corpo
  '2188': 'osZmauwdWqk', // Tríceps francês sentado com halter
  '2267': 'waAxlYvtCcI', // Leg press
  '2398': 'N0IZvDhsOjI', // Flexão de braço fechada com joelhos apoiados
  '2960': 'mKRq_p3hQr4', // Afundo com halteres (split squat)
  '3013': 'X8kD4NISxO4', // Ponte de glúteo no chão
  '3018': '-QprU_c3MkY', // Panturrilha em pé
  '3048': 'Qk0X4x03hR0', // Abdução de quadril na polia
  '3094': 'KZ2IASfrOFw', // Polichinelo
  '3896': 'EXGHDE58f4s', // Remada sentada com elástico
  '4031': 'KPVqSIidJTQ', // Abdução de quadril com elástico
  '4604': 'g6l1pIVhsYo', // Good morning (bom dia) com cabo
  '4742': 'ECbv51lHtq4', // Elevação pélvica com halter
  '5120': 'S2_Rsx-Ud2w', // Coice na polia (glúteo)
  '5121': 'u_TTcv8FvOk', // Agachamento sumô com halter
}

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
