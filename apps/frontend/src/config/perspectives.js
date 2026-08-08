/**
 * The perspective vocabulary — ONE list, shared.
 *
 * It used to exist three times: hard-coded in PerspectiveSelector.jsx, again
 * in BiasedResults.jsx (with a comment saying "MATCHES BiasedResults.jsx",
 * which is the honest admission that nothing enforced it), and a fourth time
 * as the id→bias map inside the backend's SearchService. Four copies of a list
 * that has to agree, kept in agreement by hand.
 *
 * Folding Perspectives into the Rabbit Hole made that untenable: the fold
 * needs the same ids the backend filters on, or a lens the user picks quietly
 * matches nothing. So the list lives here.
 *
 * PERSPECTIVE_BIAS mirrors SearchService.mapPerspectivesToBias EXACTLY. It has
 * to: the reread runs this map in the browser over results the backend already
 * labelled, and the rerun sends the same ids back for the backend to map with
 * its own copy. If the two drift, a reread and a rerun on the same lens
 * disagree — which reads as the feature being broken rather than as a mapping
 * bug. Change one, change the other.
 */

export const PERSPECTIVE_CATEGORIES = [
  { id: 'all', label: 'All Perspectives' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'political', label: 'Political' },
  { id: 'faith', label: 'Faith' },
  { id: 'societal', label: 'Societal' },
  { id: 'economic', label: 'Economic' },
];

export const PERSPECTIVES = [
  { id: 'neutral', label: 'Neutral', emoji: '⚪', categories: ['all', 'neutral'] },

  { id: 'conservative', label: 'Conservative', emoji: '🔴', categories: ['all', 'political'] },
  { id: 'liberal', label: 'Liberal', emoji: '🔵', categories: ['all', 'political'] },
  { id: 'bipartisan', label: 'Bipartisan', emoji: '🤝', categories: ['all', 'political'] },
  { id: 'libertarian', label: 'Libertarian', emoji: '🗽', categories: ['all', 'political'] },
  { id: 'progressive', label: 'Progressive', emoji: '⚡', categories: ['all', 'political'] },
  { id: 'centrist', label: 'Centrist', emoji: '⚖️', categories: ['all', 'political'] },

  { id: 'religious', label: 'Religious', emoji: '✝️', categories: ['all', 'faith'] },
  { id: 'atheist', label: 'Atheist', emoji: '⚛️', categories: ['all', 'faith'] },
  { id: 'new_world', label: 'New World / Illumination', emoji: '🔺', categories: ['all', 'faith'] },
  { id: 'old_world', label: 'Old World / Pagan', emoji: '🌙', categories: ['all', 'faith'] },
  { id: 'spiritual', label: 'Spiritual', emoji: '🕉️', categories: ['all', 'faith'] },
  { id: 'secular', label: 'Secular', emoji: '🔬', categories: ['all', 'faith'] },
  { id: 'universal', label: 'Universal', emoji: '🌍', categories: ['all', 'faith'] },

  { id: 'mainstream', label: 'Mainstream', emoji: '📰', categories: ['all', 'societal'] },
  { id: 'alternative', label: 'Alternative', emoji: '🔍', categories: ['all', 'societal'] },
  { id: 'conspiracy', label: 'Conspiracy', emoji: '👁️', categories: ['all', 'societal'] },
  { id: 'skeptical', label: 'Skeptical', emoji: '🤔', categories: ['all', 'societal'] },
  { id: 'traditional', label: 'Traditional', emoji: '📜', categories: ['all', 'societal'] },
  { id: 'scientific', label: 'Scientific / Academic', emoji: '🎓', categories: ['all', 'societal'] },
  { id: 'government', label: 'Government', emoji: '🏛️', categories: ['all', 'societal'] },
  { id: 'community', label: 'Community', emoji: '👥', categories: ['all', 'societal'] },

  { id: 'local_economy', label: 'Local Economy', emoji: '💰', categories: ['all', 'economic'] },
  { id: 'global_economics', label: 'Global Economics', emoji: '🌐', categories: ['all', 'economic'] },
  { id: 'investors', label: 'Investors', emoji: '📈', categories: ['all', 'economic'] },
  { id: 'consumers', label: 'Consumers', emoji: '🛒', categories: ['all', 'economic'] },
  { id: 'small_business', label: 'Small Business', emoji: '🏪', categories: ['all', 'economic'] },
  { id: 'corporate', label: 'Corporate', emoji: '🏢', categories: ['all', 'economic'] },
];

// KEEP IN SYNC with SearchService.mapPerspectivesToBias (see file header).
export const PERSPECTIVE_BIAS = {
  conservative: 'right',
  libertarian: 'right',
  liberal: 'left',
  progressive: 'left',
  centrist: 'center',
  bipartisan: 'center',
  religious: 'right',
  secular: 'center',
  scientific: 'unbiased',
  skeptical: 'unbiased',
  mainstream: 'mainstream',
  alternative: 'alternative',
  conspiracy: 'conspiracy',
  independent: 'independent',
  neutral: 'neutral',
  spiritual: 'alternative',
  new_world: 'conspiracy',
  old_world: 'alternative',
  universal: 'center',
  atheist: 'unbiased',
  government: 'mainstream',
  community: 'neutral',
  traditional: 'right',
  local_economy: 'alternative',
  global_economics: 'mainstream',
  investors: 'center',
  consumers: 'neutral',
  small_business: 'alternative',
  corporate: 'mainstream',
};

/** The bias tiers a set of perspective ids maps onto. Deduped, order-stable. */
export const perspectiveBiases = (ids = []) =>
  [...new Set(ids.map((id) => PERSPECTIVE_BIAS[id] || 'neutral'))];

export const perspectiveById = (id) => PERSPECTIVES.find((p) => p.id === id);

export const perspectiveLabel = (id) => perspectiveById(id)?.label || id;
