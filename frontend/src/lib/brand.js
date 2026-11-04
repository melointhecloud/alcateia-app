// A marca num lugar só. repoUrl é o link de código-fonte exigido pela AGPL (§13).
export const BRAND = {
  name: 'Alcateia',
  short: 'Alcateia App',
  tagline: 'Seu plano de treino personalizado',
  repoUrl: 'https://github.com/melointhecloud/alcateia-app',
  upstreamName: 'openGym',
  upstreamUrl: 'https://github.com/DuarteSantos8/openGym',
  supportEmail: 'suporte@alcateiademonstros.com.br', // o mesmo support_email do quiz
  // Neste deploy as Configurações escondem o que não faz sentido para a compradora (relógio Zepp OS,
  // Integrações, Temas da época, Treinador IA na lista de módulos, Desenhos e Animações dos exercícios,
  // que sem mídia nativa não têm efeito). Só esconde, nada é apagado. false = o upstream / self-host.
  leanSettings: true,
}

// O que leanSettings esconde. Páginas das Configurações (settings-pages.js) e módulos (lib/modules.js).
export const LEAN_HIDDEN = {
  pages: ['zepp', 'integrations', 'themes', 'apple-health', 'health-connect'],
  modules: ['coach', 'integrations', 'seasonal'],
}
export const leanHides = (kind, id) => !!BRAND.leanSettings && LEAN_HIDDEN[kind].includes(id)
