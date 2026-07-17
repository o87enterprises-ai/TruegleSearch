import { motion } from 'framer-motion';
import { Globe, Mail, Phone, AtSign, User, Server } from 'lucide-react';

// OSINT investigation-class row — the one exception to the uniform search-bar
// layout (docs/UI-REDESIGN-SPEC.md, "OSINT page"). On the ocean/OSINT search
// page it REPLACES the scrollable content categories with a scrollable,
// MULTI-SELECTABLE row of investigation classes. Selecting classes tags the
// query with the matching entity type (domain/email/phone/username/person/ip),
// which the backend entity detector + OSINT-framed AI summary key on.
export const OSINT_CLASSES = [
  { id: 'domain', label: 'Domain', icon: Globe, hint: 'domain' },
  { id: 'email', label: 'Email', icon: Mail, hint: 'email' },
  { id: 'phone', label: 'Phone', icon: Phone, hint: 'phone number' },
  { id: 'username', label: 'Username', icon: AtSign, hint: 'username' },
  { id: 'person', label: 'Person', icon: User, hint: 'person background' },
  { id: 'ip', label: 'IP', icon: Server, hint: 'ip address' },
];

const ACCENT = '#14b8a6'; // ocean/teal — matches MODE_COLORS.ocean

// Build the query hint prefix for the currently-selected classes (empty when
// none selected). Prepended to the search query on the ocean page.
export function osintHintPrefix(selected) {
  if (!selected || selected.length === 0) return '';
  const hints = OSINT_CLASSES.filter((c) => selected.includes(c.id)).map((c) => c.hint);
  return hints.join(' ');
}

export default function OsintClassRow({ selected = [], onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="flex items-center gap-1.5 mb-2 text-[11px] uppercase tracking-widest text-cyan-300/50 font-semibold">
        Investigation classes
      </div>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {OSINT_CLASSES.map(({ id, label, icon: Icon }) => {
          const active = selected.includes(id);
          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              aria-pressed={active}
              title={active ? `${label} — tap to remove` : `Investigate as ${label}`}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                active ? 'text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-cyan-400/30'
              }`}
              style={active ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
            >
              <Icon size={13} />
              {label}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
