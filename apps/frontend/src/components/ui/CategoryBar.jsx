import { motion } from 'framer-motion';
import {
  Image,
  Video,
  Users,
  DollarSign,
  Trophy,
  Zap,
  Music,
  ShoppingBag,
  Briefcase,
  BookOpen,
  Newspaper,
  Globe,
  Heart,
  Film,
  Mic,
  Code,
  Gamepad2,
  Utensils,
  Plane,
  Home,
  MapPin,
  Map,
} from 'lucide-react';

const categories = [
  { id: 'local', label: 'Local', icon: MapPin },
  { id: 'maps', label: 'Maps', icon: Map },
  { id: 'pics', label: 'Pics', icon: Image },
  { id: 'vids', label: 'Vids', icon: Video },
  { id: 'soc', label: 'Soc', icon: Users },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'ai', label: 'AI', icon: Zap },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'academic', label: 'Academic', icon: BookOpen },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'world', label: 'World', icon: Globe },
  { id: 'health', label: 'Health', icon: Heart },
  { id: 'entertainment', label: 'Entertainment', icon: Film },
  { id: 'podcasts', label: 'Podcasts', icon: Mic },
  { id: 'tech', label: 'Tech', icon: Code },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'travel', label: 'Travel', icon: Plane },
  { id: 'lifestyle', label: 'Lifestyle', icon: Home },
];

export default function CategoryBar({ activeCategory, onSelectCategory }) {
  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex gap-2 min-w-max px-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;

          return (
            <motion.button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
                transition-all backdrop-blur-xl whitespace-nowrap
                ${
                  isActive
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/25'
                    : 'bg-black/40 border-white/10 text-white/60 hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-black/60'
                }
                border
              `}
            >
              <Icon size={16} />
              <span>{cat.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
