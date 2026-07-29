import React from 'react';

// Crawler-visible, localized landing content for the regions that actually send
// us traffic. Prerendered at build time (see prerender.mjs) to
// dist/{de,es,fr,nl,pt}/index.html with the right <html lang> and hreflang
// alternates, so search/answer engines index real localized text and serve
// Truegle to German- (DE/AT/CH — Tier-1 CPM), Spanish- (ES/LATAM), French-
// (FR/CA/BE/CH), Dutch- (Netherlands, a top-5 traffic source) and Brazilian-
// Portuguese-speaking (Brazil, top-3 traffic) audiences. The live SPA still
// repaints the full app over this on load. Parallel to HomeStaticContent.

// Copy mirrors the English meta/about text so it can't drift into claims the
// live site doesn't make. An optional `htmlLang` overrides the route key for the
// <html lang>/hreflang tag (e.g. route /pt → pt-BR, targeting Brazil).
export const TRANSLATIONS = {
  de: {
    label: 'Deutsch',
    title: 'Truegle — Unvoreingenommene, transparente & sichere Suche',
    description:
      'Die unvoreingenommene, transparente und sichere Suchmaschine. Mehrere Perspektiven zu jedem Thema — ohne algorithmische Verzerrung, ohne Tracking, ohne Zensur.',
    intro:
      'Suchen ohne Voreingenommenheit. Entdecke die Wahrheit aus mehreren Perspektiven. Kein Tracking, keine Cookies, keine versteckten Absichten.',
    whyHeading: 'Warum Truegle?',
    whyBody:
      'Truegle ist eine datenschutzfreundliche Suchmaschine mit einer einfachen Überzeugung: Du hast das Recht, das Web ohne Filterblase zu sehen. Jede Suche bündelt Ergebnisse mehrerer Anbieter — mit Quellenkennzeichnung, Verzerrungserkennung und voller Transparenz.',
    modesHeading: 'Suchmodi',
    modes: [
      { name: 'Blau', description: 'Standard-Relevanz über große Anbieter hinweg.' },
      { name: 'Grün', description: 'Dieselben Ergebnisse, ohne KI-generierte Quellen.' },
      { name: 'Rot', description: 'Hebt unabhängige und alternative Quellen hervor.' },
      { name: 'Violett', description: 'Filtert strikt auf die von dir gewählten Perspektiven.' },
      { name: 'Ozean', description: 'Ein Recherche-/OSINT-Werkzeugkasten für legale Ermittlungen.' },
    ],
    rewards:
      'Verdiene mit: Erhalte einen Anteil an echten Werbeeinnahmen, wenn du gesponserte Angebote abschließt — serverseitig bestätigt, ohne zusätzliches Tracking.',
    nav: { search: 'Suche starten', about: 'Über Truegle', privacy: 'Datenschutz', terms: 'Nutzungsbedingungen', advertise: 'Werben auf Truegle' },
  },
  es: {
    label: 'Español',
    title: 'Truegle — Búsqueda imparcial, transparente y segura',
    description:
      'El buscador imparcial, transparente y seguro. Obtén múltiples perspectivas sobre cualquier tema, sin sesgo algorítmico, sin rastreo y sin censura.',
    intro:
      'Busca sin sesgos. Descubre la verdad desde múltiples perspectivas. Sin rastreo, sin cookies, sin agendas ocultas.',
    whyHeading: '¿Por qué Truegle?',
    whyBody:
      'Truegle es un buscador centrado en la privacidad con una idea simple: mereces ver la web sin una burbuja de filtro que decida qué puedes encontrar. Cada búsqueda combina resultados de múltiples proveedores con identificación de fuentes, detección de sesgo y total transparencia.',
    modesHeading: 'Modos de búsqueda',
    modes: [
      { name: 'Azul', description: 'Relevancia estándar entre los principales proveedores.' },
      { name: 'Verde', description: 'Los mismos resultados, sin fuentes generadas por IA.' },
      { name: 'Rojo', description: 'Resalta fuentes independientes y alternativas.' },
      { name: 'Morado', description: 'Filtra estrictamente según las perspectivas que elijas.' },
      { name: 'Océano', description: 'Un conjunto de herramientas de investigación/OSINT legal.' },
    ],
    rewards:
      'Gana dinero: recibe una parte de los ingresos publicitarios reales al completar ofertas patrocinadas — confirmado del lado del servidor, sin rastreo adicional.',
    nav: { search: 'Empezar a buscar', about: 'Acerca de Truegle', privacy: 'Privacidad', terms: 'Términos del servicio', advertise: 'Anúnciate en Truegle' },
  },
  fr: {
    label: 'Français',
    title: 'Truegle — Recherche impartiale, transparente et sécurisée',
    description:
      'Le moteur de recherche impartial, transparent et sécurisé. Obtenez plusieurs perspectives sur n’importe quel sujet, sans biais algorithmique, sans pistage et sans censure.',
    intro:
      'Cherchez sans parti pris. Découvrez la vérité sous plusieurs angles. Aucun pistage, aucun cookie, aucun agenda caché.',
    whyHeading: 'Pourquoi Truegle ?',
    whyBody:
      'Truegle est un moteur de recherche axé sur la confidentialité, avec une conviction simple : vous méritez de voir le web sans bulle de filtre décidant de ce que vous pouvez trouver. Chaque recherche agrège les résultats de plusieurs fournisseurs, avec identification des sources, détection des biais et transparence totale.',
    modesHeading: 'Modes de recherche',
    modes: [
      { name: 'Bleu', description: 'Pertinence standard sur les principaux fournisseurs.' },
      { name: 'Vert', description: 'Les mêmes résultats, sans sources générées par IA.' },
      { name: 'Rouge', description: 'Met en avant les sources indépendantes et alternatives.' },
      { name: 'Violet', description: 'Filtre strictement selon les perspectives choisies.' },
      { name: 'Océan', description: 'Une boîte à outils de recherche/OSINT pour des enquêtes légales.' },
    ],
    rewards:
      'Gagnez de l’argent : recevez une part des revenus publicitaires réels lorsque vous complétez des offres sponsorisées — confirmé côté serveur, sans pistage supplémentaire.',
    nav: { search: 'Commencer la recherche', about: 'À propos de Truegle', privacy: 'Confidentialité', terms: 'Conditions d’utilisation', advertise: 'Annoncer sur Truegle' },
  },
  // Netherlands — a top-5 traffic source (Cloudflare 30d). Dutch (nl).
  nl: {
    label: 'Nederlands',
    title: 'Truegle — Onbevooroordeeld, transparant en veilig zoeken',
    description:
      'De onbevooroordeelde, transparante en veilige zoekmachine. Krijg meerdere perspectieven op elk onderwerp — zonder algoritmische vertekening, zonder tracking en zonder censuur.',
    intro:
      'Zoeken zonder vooroordelen. Ontdek de waarheid vanuit meerdere perspectieven. Geen tracking, geen cookies, geen verborgen agenda.',
    whyHeading: 'Waarom Truegle?',
    whyBody:
      'Truegle is een privacyvriendelijke zoekmachine met een eenvoudige overtuiging: je verdient het om het web te zien zonder een filterbubbel die bepaalt wat je mag vinden. Elke zoekopdracht bundelt resultaten van meerdere aanbieders — met bronvermelding, detectie van vertekening en volledige transparantie.',
    modesHeading: 'Zoekmodi',
    modes: [
      { name: 'Blauw', description: 'Standaardrelevantie over grote aanbieders heen.' },
      { name: 'Groen', description: 'Dezelfde resultaten, zonder door AI gegenereerde bronnen.' },
      { name: 'Rood', description: 'Licht onafhankelijke en alternatieve bronnen uit.' },
      { name: 'Paars', description: 'Filtert strikt op de perspectieven die je kiest.' },
      { name: 'Oceaan', description: 'Een onderzoeks-/OSINT-toolkit voor legaal opzoekwerk.' },
    ],
    rewards:
      'Verdien mee: ontvang een deel van echte advertentie-inkomsten wanneer je gesponsorde aanbiedingen voltooit — serverzijdig bevestigd, zonder extra tracking.',
    nav: { search: 'Begin met zoeken', about: 'Over Truegle', privacy: 'Privacy', terms: 'Gebruiksvoorwaarden', advertise: 'Adverteren op Truegle' },
  },
  // Brazil — a top-3 traffic source. Brazilian Portuguese; route /pt, tagged
  // hreflang/html-lang pt-BR so it targets Brazil specifically.
  pt: {
    label: 'Português (Brasil)',
    htmlLang: 'pt-BR',
    title: 'Truegle — Busca imparcial, transparente e segura',
    description:
      'O mecanismo de busca imparcial, transparente e seguro. Obtenha múltiplas perspectivas sobre qualquer assunto — sem viés algorítmico, sem rastreamento e sem censura.',
    intro:
      'Pesquise sem vieses. Descubra a verdade a partir de múltiplas perspectivas. Sem rastreamento, sem cookies, sem agendas ocultas.',
    whyHeading: 'Por que o Truegle?',
    whyBody:
      'O Truegle é um mecanismo de busca focado em privacidade com uma convicção simples: você merece ver a web sem uma bolha de filtro decidindo o que você pode encontrar. Cada busca reúne resultados de vários provedores — com identificação de fontes, detecção de viés e total transparência.',
    modesHeading: 'Modos de busca',
    modes: [
      { name: 'Azul', description: 'Relevância padrão entre os principais provedores.' },
      { name: 'Verde', description: 'Os mesmos resultados, sem fontes geradas por IA.' },
      { name: 'Vermelho', description: 'Destaca fontes independentes e alternativas.' },
      { name: 'Roxo', description: 'Filtra estritamente pelas perspectivas que você escolher.' },
      { name: 'Oceano', description: 'Um kit de ferramentas de pesquisa/OSINT para investigações legais.' },
    ],
    rewards:
      'Ganhe dinheiro: receba uma parte da receita real de anúncios ao concluir ofertas patrocinadas — confirmado no servidor, sem rastreamento adicional.',
    nav: { search: 'Começar a pesquisar', about: 'Sobre o Truegle', privacy: 'Privacidade', terms: 'Termos de serviço', advertise: 'Anuncie no Truegle' },
  },
};

export const LOCALES = Object.keys(TRANSLATIONS);

const LocalizedHomeContent = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  if (!t) throw new Error(`No translation for "${lang}"`);
  return (
    <div id="seo-home" lang={t.htmlLang || lang}>
      <div id="seo-stars" aria-hidden="true" />
      <img id="seo-logo" src="/truegle.png" alt="Truegle" />
      <h1>{t.title}</h1>
      <p>{t.intro}</p>
      <h2>{t.whyHeading}</h2>
      <p>{t.whyBody}</p>
      <h2>{t.modesHeading}</h2>
      <ul>
        {t.modes.map((mode) => (
          <li key={mode.name}>
            <strong>{mode.name}</strong> — {mode.description}
          </li>
        ))}
      </ul>
      <p>{t.rewards}</p>
      <nav>
        <a href="/search">{t.nav.search}</a>
        <a href="/about">{t.nav.about}</a>
        <a href="/privacy">{t.nav.privacy}</a>
        <a href="/terms">{t.nav.terms}</a>
        <a href="/advertise">{t.nav.advertise}</a>
      </nav>
    </div>
  );
};

export default LocalizedHomeContent;
