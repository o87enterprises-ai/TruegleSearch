import { cn } from '../../utils/cn';

const PermissionToggle = ({
  checked,
  onChange,
  label,
  benefit,
  disabled = false
}) => {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'w-full p-4 rounded-xl border transition-all duration-200',
        'hover:border-white/20 hover:bg-white/5',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/10',
        checked
          ? 'bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border-cyan-500/30'
          : 'bg-white/5 border-white/10'
      )}
      role="switch"
      aria-checked={checked}
      aria-label={`${label} - ${benefit}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 text-left">
          <h4 className={cn(
            'text-sm font-semibold mb-1',
            checked ? 'text-cyan-400' : 'text-neutral-200'
          )}>
            {label}
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {benefit}
          </p>
        </div>

        <div className={cn(
          'relative w-11 h-6 rounded-full transition-colors duration-200',
          checked ? 'bg-cyan-500' : 'bg-neutral-700'
        )}>
          <div className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full',
            'transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0'
          )} />
        </div>
      </div>
    </button>
  );
};

export default PermissionToggle;