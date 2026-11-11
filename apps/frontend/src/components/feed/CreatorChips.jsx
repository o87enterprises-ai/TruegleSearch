import { CREATORS } from '../../content/creators';

// One-creator isolate for the Creators feed: All + every roster creator.
// Shared by /feed's opened Creators category and the Creators pill tab.
// All · Videos · Shorts. Applied server-side before paging, so it also scopes
// Stream (stream only the long videos, or only the Shorts).
export const KINDS = [{ id: 'all', label: 'All' }, { id: 'video', label: 'Videos' }, { id: 'short', label: 'Shorts' }];

export default function CreatorChips({ value, onChange, kind = 'all', onKind }) {
  return (
    <>
      {onKind && (
        <div className="max-w-4xl mx-auto mb-2 flex gap-1.5" data-kind-pills="" role="group" aria-label="Shorts or videos">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              data-kind-pill={k.id}
              aria-pressed={kind === k.id}
              onClick={() => onKind(k.id)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${kind === k.id ? 'border-yellow-300/70 text-yellow-200 bg-yellow-300/10' : 'border-white/15 text-white/60 hover:text-white hover:border-white/30'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
    <div className="max-w-4xl mx-auto mb-3 flex gap-1.5 overflow-x-auto pb-1" data-creator-chips="" role="group" aria-label="Show one creator">
      {[{ slug: '', name: 'All' }, ...CREATORS].map((c) => (
        <button
          key={c.slug || 'all'}
          type="button"
          data-creator-chip={c.slug || 'all'}
          aria-pressed={value === c.slug}
          onClick={() => onChange(c.slug)}
          className={`shrink-0 px-2.5 py-1 text-xs rounded-full border transition-colors ${value === c.slug ? 'border-white/60 text-white bg-white/10' : 'border-white/15 text-white/60 hover:text-white hover:border-white/30'}`}
        >
          {c.name}
        </button>
      ))}
    </div>
    </>
  );
}
