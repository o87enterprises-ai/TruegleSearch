import { MapPin, Phone, Globe, Clock, Star, ExternalLink, User, ChevronRight, Cloud, Droplets, Wind, Calculator } from 'lucide-react';

/**
 * QuickResultCard — instant answer panel shown above search results.
 * Mirrors Google's Knowledge Panel for business, person, and social queries.
 *
 * Props:
 *   instantAnswer: object from backend buildInstantAnswer()
 *   onDirections: () => void  — called when user clicks Directions (opens maps category)
 */
export default function QuickResultCard({ instantAnswer, onDirections }) {
  if (!instantAnswer) return null;

  const { type } = instantAnswer;

  if (type === 'local_business') return <BusinessCard data={instantAnswer} onDirections={onDirections} />;
  if (type === 'social_profile') return <SocialProfileCard data={instantAnswer} />;
  if (type === 'person') return <PersonCard data={instantAnswer} />;
  if (type === 'weather') return <WeatherCard data={instantAnswer} />;
  if (type === 'calculation') return <CalculationCard data={instantAnswer} />;

  return null;
}

// ── Weather Card ──────────────────────────────────────────────────────────────

function WeatherCard({ data }) {
  const { location, temperature, feelsLike, description, icon, humidity, windSpeed } = data;
  const iconUrl = icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : null;
  const tempF = typeof temperature === 'number' ? Math.round(temperature * 9 / 5 + 32) : null;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#1a2a3e]/90 to-[#16213e]/90 border border-sky-500/30 backdrop-blur-xl overflow-hidden shadow-lg shadow-sky-500/10 p-5">
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <img src={iconUrl} alt={description} className="w-16 h-16 flex-shrink-0" />
        ) : (
          <Cloud size={40} className="text-sky-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-sky-400 flex-shrink-0" />
            <h3 className="text-base font-semibold text-white truncate">{location}</h3>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-white">{temperature}°C</span>
            {tempF !== null && <span className="text-sm text-white/50">{tempF}°F</span>}
          </div>
          <p className="text-sm text-sky-200/80 capitalize">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/10 text-sm text-white/60">
        {typeof feelsLike === 'number' && (
          <span className="flex items-center gap-1.5"><Cloud size={13} />Feels {feelsLike}°C</span>
        )}
        {typeof humidity === 'number' && (
          <span className="flex items-center gap-1.5"><Droplets size={13} />{humidity}% humidity</span>
        )}
        {typeof windSpeed === 'number' && (
          <span className="flex items-center gap-1.5"><Wind size={13} />{windSpeed} m/s wind</span>
        )}
      </div>
    </div>
  );
}

// ── Calculation Card ──────────────────────────────────────────────────────────

function CalculationCard({ data }) {
  const { expression, result } = data;
  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/90 to-[#16213e]/90 border border-emerald-500/30 backdrop-blur-xl overflow-hidden shadow-lg shadow-emerald-500/10 p-5">
      <div className="flex items-center gap-2 mb-2 text-emerald-400/70 text-xs font-medium">
        <Calculator size={13} />
        Calculator
      </div>
      <div className="text-white/50 text-lg">{expression} =</div>
      <div className="text-white text-4xl font-bold tracking-tight">{result.toLocaleString()}</div>
    </div>
  );
}

// ── Business Card ─────────────────────────────────────────────────────────────

function BusinessCard({ data, onDirections }) {
  const { name, phone, address, hours, rating, website, image } = data;

  const stars = rating ? parseFloat(rating) : null;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/90 to-[#16213e]/90 border border-blue-500/30 backdrop-blur-xl overflow-hidden shadow-lg shadow-blue-500/10">
      <div className="flex gap-4 p-5">
        {/* Business image */}
        {image && (
          <img
            src={image}
            alt={name}
            className="w-24 h-24 rounded-xl object-cover flex-shrink-0 border border-white/10"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        {!image && (
          <div className="w-24 h-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <MapPin size={32} className="text-white/30" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-white truncate">{name}</h3>

          {stars !== null && (
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={14}
                  className={s <= Math.round(stars) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}
                />
              ))}
              <span className="text-xs text-white/50 ml-1">{stars.toFixed(1)}</span>
            </div>
          )}

          <div className="mt-2 space-y-1">
            {phone && (
              <a
                href={`tel:${phone.replace(/\D/g, '')}`}
                className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 transition-colors"
              >
                <Phone size={13} className="flex-shrink-0" />
                {phone}
              </a>
            )}
            {address && (
              <div className="flex items-start gap-2 text-sm text-white/60">
                <MapPin size={13} className="flex-shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
            )}
            {hours && (
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Clock size={13} className="flex-shrink-0" />
                <span>{hours}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-2 px-5 pb-4">
        <button
          onClick={onDirections}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors shadow-md shadow-blue-500/25"
        >
          <MapPin size={15} />
          Directions
        </button>
        {website && (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-semibold transition-colors border border-white/10"
          >
            <Globe size={15} />
            Website
          </a>
        )}
      </div>
    </div>
  );
}

// ── Social Profile Card ───────────────────────────────────────────────────────

const PLATFORM_COLORS = {
  Facebook: 'bg-blue-600',
  Instagram: 'bg-gradient-to-br from-purple-500 to-pink-500',
  'X / Twitter': 'bg-black border border-white/20',
  LinkedIn: 'bg-blue-700',
  TikTok: 'bg-black border border-white/20',
  YouTube: 'bg-red-600',
  GitHub: 'bg-gray-700',
  Reddit: 'bg-orange-600',
};

function SocialProfileCard({ data }) {
  const { query, profiles } = data;
  if (!profiles || profiles.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/90 to-[#16213e]/90 border border-purple-500/30 backdrop-blur-xl overflow-hidden shadow-lg shadow-purple-500/10 p-5">
      <div className="flex items-center gap-2 mb-4">
        <User size={16} className="text-purple-400" />
        <h3 className="text-base font-semibold text-white">Social profiles for <span className="text-purple-300">{query}</span></h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {profiles.map((profile, i) => (
          <a
            key={i}
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${PLATFORM_COLORS[profile.platform] || 'bg-gray-600'}`}>
              {profile.platform?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white/80 group-hover:text-white truncate">{profile.platform}</div>
              <div className="text-xs text-white/40 truncate">{profile.name}</div>
            </div>
            <ExternalLink size={12} className="text-white/20 group-hover:text-white/50 flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Person Card ───────────────────────────────────────────────────────────────

function PersonCard({ data }) {
  const { name, description, image, title, url, profiles } = data;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/90 to-[#16213e]/90 border border-cyan-500/30 backdrop-blur-xl overflow-hidden shadow-lg shadow-cyan-500/10">
      <div className="flex gap-4 p-5">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-20 h-20 rounded-full object-cover flex-shrink-0 border-2 border-cyan-500/40"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center flex-shrink-0">
            <User size={28} className="text-white/30" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-white">{name}</h3>
          {title && <p className="text-sm text-cyan-400 mt-0.5">{title}</p>}
          {description && (
            <p className="text-sm text-white/60 mt-2 line-clamp-3">{description}</p>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Globe size={11} />
              {new URL(url).hostname.replace('www.', '')}
            </a>
          )}
        </div>
      </div>

      {profiles && profiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          {profiles.map((p, i) => (
            <a
              key={i}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:brightness-110 transition-all ${PLATFORM_COLORS[p.platform] || 'bg-gray-600'}`}
            >
              {p.platform}
              <ChevronRight size={11} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
