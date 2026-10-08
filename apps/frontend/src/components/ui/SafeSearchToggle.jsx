import { Shield, Eye, EyeOff, Lock } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

// One Safe Search control for every page that searches — Tube, Reels and Feed
// beside the search page's own (owner, 2026-10-08). Same setting everywhere:
// Safe (strict, the default) → Blur (moderate) → Off. Off needs a signed-in
// adult: SettingsContext refuses it otherwise and opens the sign-in prompt.
const STATES = {
  safe: { Icon: Shield, label: 'Safe', cls: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
  blur: { Icon: Eye, label: 'Blur', cls: 'text-yellow-300 border-yellow-500/40 bg-yellow-500/10' },
  off: { Icon: EyeOff, label: 'Off', cls: 'text-red-300 border-red-500/40 bg-red-500/10' },
};
const NEXT = { safe: 'blur', blur: 'off', off: 'safe' };

export default function SafeSearchToggle({ className = '', compact = false }) {
  const { settings, updateSetting, canDisableSafeSearch } = useSettings();
  const now = STATES[settings.safeSearch] ? settings.safeSearch : 'safe';
  const { Icon, label, cls } = STATES[now];
  const next = NEXT[now];
  const locked = next === 'off' && !canDisableSafeSearch;
  return (
    <button
      type="button"
      data-safesearch-toggle={now}
      onClick={(e) => { e.stopPropagation(); updateSetting('safeSearch', next); }}
      title={`Safe Search: ${label} — tap for ${STATES[next].label}${locked ? ' (sign in, 18+)' : ''}`}
      aria-label={`Safe Search ${label}. Tap to change.`}
      className={`inline-flex shrink-0 items-center gap-1 ${compact ? 'p-1.5' : 'px-2 py-1'} rounded-full text-[11px] font-semibold border transition-colors hover:brightness-125 ${cls} ${className}`}
    >
      <Icon size={compact ? 14 : 12} />
      {/* Compact (the Reels top bar, where width is the search box's): the
          icon and its colour say the state; the title says the rest. */}
      {!compact && <span>Safe Search: {label}</span>}
      {locked && !compact && <Lock size={10} className="opacity-70" />}
    </button>
  );
}
