import { Globe2, MapPin } from 'lucide-react';
import { deviceLang, useLangMode } from '../../utils/contentLang';
import { useSettings } from '../../context/SettingsContext';

// Local (this device's language only) / Global (everything, yours first).
// Shared by the Feed and Tube; see utils/contentLang.js.
export default function LangModeToggle({ className = '' }) {
  const [mode, setMode] = useLangMode();
  const { settings } = useSettings();
  const code = deviceLang(settings?.language).toUpperCase();
  const btn = (on) => `flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border transition-colors ${
    on ? 'border-cyan-400/60 text-cyan-200 bg-cyan-400/10' : 'border-white/10 text-white/55 hover:text-white'}`;
  return (
    <div role="group" aria-label="Language" data-lang-toggle="" className={`flex items-center gap-1 ${className}`}>
      <button type="button" data-lang-mode="local" aria-pressed={mode === 'local'} onClick={() => setMode('local')}
        title={`Only posts in your language (${code}), from your device's language setting`} className={btn(mode === 'local')}>
        <MapPin size={11} /> Local · {code}
      </button>
      <button type="button" data-lang-mode="global" aria-pressed={mode === 'global'} onClick={() => setMode('global')}
        title={`Everything, posts in your language (${code}) first`} className={btn(mode === 'global')}>
        <Globe2 size={11} /> Global
      </button>
    </div>
  );
}
