import { MapPin, Phone, Globe, Clock, Star, ExternalLink, User, ChevronRight, Cloud, Droplets, Wind, Calculator, BookOpen, ArrowRightLeft, Volume2, AppWindow, Link2 } from 'lucide-react';

/**
 * QuickResultCard — instant answer panel shown above search results.
 * Mirrors Google's Knowledge Panel for simple, non-controversial factual
 * queries (weather, hours/location, time, conversions, apps, etc). Cards are
 * informational only — no in-app interactive actions; outbound links open
 * the relevant external site/map directly.
 *
 * Props:
 *   instantAnswer: object from backend buildInstantAnswer()
 */
export default function QuickResultCard({ instantAnswer }) {
  if (!instantAnswer) return null;

  const { type } = instantAnswer;

  if (type === 'navigational') return <NavigationalCard data={instantAnswer} />;
  if (type === 'local_business') return <BusinessCard data={instantAnswer} />;
  if (type === 'social_profile') return <SocialProfileCard data={instantAnswer} />;
  if (type === 'person') return <PersonCard data={instantAnswer} />;
  if (type === 'weather') return <WeatherCard data={instantAnswer} />;
  if (type === 'calculation') return <CalculationCard data={instantAnswer} />;
  if (type === 'conversion') return <ConversionCard data={instantAnswer} />;
  if (type === 'time') return <TimeCard data={instantAnswer} />;
  if (type === 'definition') return <DefinitionCard data={instantAnswer} />;
  if (type === 'app') return <AppCard data={instantAnswer} />;

  return null;
}

// ── Navigational / Official Site Card ────────────────────────────────────────

function NavigationalCard({ data }) {
  const { name, url, snippet, domain, favicon } = data;
  let displayDomain = domain;
  try { displayDomain = new URL(url).hostname.replace('www.', ''); } catch { /* use domain */ }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-6 flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br from-[#0d1f3c]/90 to-[#162040]/90 border border-blue-500/40 backdrop-blur-xl overflow-hidden shadow-lg shadow-blue-500/15 hover:border-blue-400/60 hover:shadow-blue-400/25 transition-all group block"
    >
      {favicon ? (
        <img
          src={favicon}
          alt=""
          className="w-10 h-10 rounded-lg object-contain flex-shrink-0 border border-white/10 bg-white/5 p-1"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <Link2 size={18} className="text-blue-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-blue-400/70 font-medium truncate">{displayDomain}</span>
          <span className="text-xs text-white/20 bg-white/10 px-1.5 py-0.5 rounded-full">Official site</span>
        </div>
        <h3 className="text-base font-bold text-white group-hover:text-blue-200 transition-colors truncate">{name}</h3>
        {snippet && (
          <p className="text-sm text-white/55 mt-1 line-clamp-2">{snippet}</p>
        )}
      </div>
      <ExternalLink size={16} className="text-white/20 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-1" />
    </a>
  );
}

// ── App / AI Model / Service Card ───────────────────────────────────────────

function AppCard({ data }) {
  const { name, description, image, url } = data;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/90 to-[#16213e]/90 border border-violet-500/30 backdrop-blur-xl overflow-hidden shadow-lg shadow-violet-500/10 p-5">
      <div className="flex gap-4">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-white/10"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <AppWindow size={26} className="text-violet-400/60" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white truncate">{name}</h3>
          {description && (
            <p className="text-sm text-white/60 mt-1 line-clamp-2">{description}</p>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-violet-300 hover:text-violet-200 transition-colors"
            >
              <Globe size={12} />
              {new URL(url).hostname.replace('www.', '')}
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Conversion Card ───────────────────────────────────────────────────────────

const CONVERSION_TITLE = {
  length: 'Length', mass: 'Weight', volume: 'Volume', speed: 'Speed',
  digital: 'Data', temperature: 'Temperature', currency: 'Currency',
};

function ConversionCard({ data }) {
  const { conversionType, inputValue, result, fromUnit, toUnit, fromLabel, toLabel, rate } = data;
  const from = fromLabel || fromUnit;
  const to = toLabel || toUnit;
  const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 6 });

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/90 to-[#16213e]/90 border border-teal-500/30 backdrop-blur-xl overflow-hidden shadow-lg shadow-teal-500/10 p-5">
      <div className="flex items-center gap-2 mb-3 text-teal-400/70 text-xs font-medium">
        <ArrowRightLeft size={13} />
        {CONVERSION_TITLE[conversionType] || 'Conversion'}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-white/60 text-xl">
          {fmt(inputValue)} <span className="text-white/40 text-base">{from}</span>
        </div>
        <ArrowRightLeft size={18} className="text-teal-400/60 flex-shrink-0" />
        <div className="text-white text-3xl font-bold tracking-tight">
          {fmt(result)} <span className="text-white/50 text-lg font-semibold">{to}</span>
        </div>
      </div>
      {conversionType === 'currency' && rate != null && (
        <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/40">
          1 {fromUnit} = {rate.toLocaleString()} {toUnit} · live rate
        </div>
      )}
    </div>
  );
}

// ── World Clock Card ──────────────────────────────────────────────────────────

function TimeCard({ data }) {
  const { location, time, date, timezone } = data;
  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/90 to-[#16213e]/90 border border-indigo-500/30 backdrop-blur-xl overflow-hidden shadow-lg shadow-indigo-500/10 p-5">
      <div className="flex items-center gap-2 mb-2 text-indigo-400/70 text-xs font-medium">
        <Clock size={13} />
        Time in {location}
      </div>
      <div className="text-white text-4xl font-bold tracking-tight tabular-nums">{time}</div>
      <div className="flex items-center gap-2 mt-1 text-sm text-white/50">
        <span>{date}</span>
        {timezone && <span className="text-white/30">· {timezone}</span>}
      </div>
    </div>
  );
}

// ── Definition Card ───────────────────────────────────────────────────────────

function DefinitionCard({ data }) {
  const { word, phonetic, audio, meanings } = data;
  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/90 to-[#16213e]/90 border border-amber-500/30 backdrop-blur-xl overflow-hidden shadow-lg shadow-amber-500/10 p-5">
      <div className="flex items-center gap-2 mb-3 text-amber-400/70 text-xs font-medium">
        <BookOpen size={13} />
        Definition
      </div>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-2xl font-bold text-white capitalize">{word}</h3>
        {phonetic && <span className="text-sm text-white/40">{phonetic}</span>}
        {audio && (
          <button
            onClick={() => { try { new Audio(audio).play(); } catch { /* ignore */ } }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300/80 hover:text-amber-200 transition-colors"
            aria-label="Play pronunciation"
          >
            <Volume2 size={14} />
          </button>
        )}
      </div>
      <div className="space-y-3">
        {meanings.map((m, i) => (
          <div key={i}>
            {m.partOfSpeech && (
              <span className="text-xs italic text-amber-300/60 mr-2">{m.partOfSpeech}</span>
            )}
            <span className="text-sm text-white/80">{m.definition}</span>
            {m.example && (
              <p className="text-xs text-white/40 mt-1 italic">“{m.example}”</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
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

function BusinessCard({ data }) {
  const { name, phone, address, hours, rating, website, image, mapsQuery } = data;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery || address || name)}`;

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
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors shadow-md shadow-blue-500/25"
        >
          <MapPin size={15} />
          Directions
        </a>
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
