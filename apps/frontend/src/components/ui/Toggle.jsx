import { cn } from '../../utils/cn';

// Shared boolean switch — matches design-system.json's toggle token spec
// (w-11 h-6 track, w-5 h-5 thumb, translate-x-5/0) and the app's emerald
// accent, so every settings toggle reads as the same control instead of
// each one being a differently-colored hand-rolled switch.
export default function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? 'bg-emerald-500' : 'bg-neutral-700'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}
