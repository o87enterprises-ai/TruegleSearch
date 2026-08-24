import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Zap, BarChart3, Globe, Shield } from 'lucide-react';
import {
  NeonButton,
  NeonInput,
  GlassCard,
  SearchBar,
  TruegleLogo,
  PerspectiveCard,
  ToolCard,
} from '../components/ui';
import { useToast } from '../hooks/useToast';

const ComponentShowcase = () => {
  const [inputValue, setInputValue] = useState('');
  const [searchValue1, setSearchValue1] = useState('');
  const [searchValue2, setSearchValue2] = useState('');
  const [activePerspective, setActivePerspective] = useState('neutral');
  const toast = useToast();

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <TruegleLogo size="large" animated={true} className="mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-neon-red via-neon-orange via-neon-yellow via-neon-green via-neon-cyan to-neon-blue bg-clip-text text-transparent">
            Truegle Design System
          </h1>
          <p className="text-white/60">Neon/Futuristic Components Showcase</p>
        </motion.div>

        {/* Search Bar */}
        <GlassCard>
          <h2 className="text-2xl font-bold mb-4 text-neon-cyan">Search Bar</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-white/60 mb-2">Large Size</p>
              <SearchBar
                value={searchValue1}
                onChange={(e) => setSearchValue1(e.target.value)}
                onSearch={(query) => {
                  console.log('Search (large):', query);
                  alert(`Searching for: ${query}`);
                }}
                placeholder="Search without bias..."
                size="large"
                showPillToggle={true}
              />
            </div>
            <div>
              <p className="text-sm text-white/60 mb-2">Medium Size</p>
              <SearchBar
                value={searchValue2}
                onChange={(e) => setSearchValue2(e.target.value)}
                onSearch={(query) => {
                  console.log('Search (medium):', query);
                  alert(`Searching for: ${query}`);
                }}
                placeholder="Search without bias..."
                size="medium"
                showPillToggle={true}
              />
            </div>
          </div>
        </GlassCard>

        {/* Perspective Cards */}
        <GlassCard>
          <h2 className="text-2xl font-bold mb-4 text-neon-cyan">
            Perspective Cards
          </h2>
          <div className="flex flex-wrap gap-4">
            <PerspectiveCard
              perspective="left"
              isActive={activePerspective === 'left'}
              onClick={() => setActivePerspective('left')}
              resultCount={145}
            />
            <PerspectiveCard
              perspective="center"
              isActive={activePerspective === 'center'}
              onClick={() => setActivePerspective('center')}
              resultCount={89}
            />
            <PerspectiveCard
              perspective="right"
              isActive={activePerspective === 'right'}
              onClick={() => setActivePerspective('right')}
              resultCount={132}
            />
            <PerspectiveCard
              perspective="neutral"
              isActive={activePerspective === 'neutral'}
              onClick={() => setActivePerspective('neutral')}
              resultCount={234}
            />
            <PerspectiveCard
              perspective="custom"
              isActive={activePerspective === 'custom'}
              onClick={() => setActivePerspective('custom')}
              resultCount={12}
            />
          </div>
          <p className="text-white/70 mt-4">Active: {activePerspective}</p>
        </GlassCard>

        {/* Buttons */}
        <GlassCard>
          <h2 className="text-2xl font-bold mb-4 text-neon-cyan">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <NeonButton variant="primary" size="md">
              Primary Button
            </NeonButton>
            <NeonButton variant="secondary" size="md">
              Secondary Button
            </NeonButton>
            <NeonButton variant="ghost" size="md">
              Ghost Button
            </NeonButton>
            <NeonButton variant="primary" size="sm">
              Small
            </NeonButton>
            <NeonButton variant="primary" size="lg">
              Large
            </NeonButton>
            <NeonButton variant="primary" disabled>
              Disabled
            </NeonButton>
          </div>
        </GlassCard>

        {/* Inputs */}
        <GlassCard>
          <h2 className="text-2xl font-bold mb-4 text-neon-cyan">Inputs</h2>
          <div className="space-y-4">
            <NeonInput
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter text here..."
              size="md"
            />
            <NeonInput placeholder="Small input" size="sm" />
            <NeonInput placeholder="Large input" size="lg" />
            <NeonInput placeholder="Disabled input" disabled />
          </div>
        </GlassCard>

        {/* Glass Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard hover>
            <h3 className="text-xl font-bold mb-2 text-neon-cyan">
              Hoverable Card
            </h3>
            <p className="text-white/80">
              This card has hover effects. Move your mouse over it!
            </p>
          </GlassCard>
          <GlassCard>
            <h3 className="text-xl font-bold mb-2 text-neon-cyan">
              Static Card
            </h3>
            <p className="text-white/80">
              This is a standard glassmorphism card with neon borders.
            </p>
          </GlassCard>
        </div>

        {/* Color Palette */}
        <GlassCard>
          <h2 className="text-2xl font-bold mb-4 text-neon-cyan">
            Neon Color Palette
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { name: 'Red', hex: '#FF0000' },
              { name: 'Orange', hex: '#FF6B00' },
              { name: 'Yellow', hex: '#FFD700' },
              { name: 'Green', hex: '#00FF00' },
              { name: 'Cyan', hex: '#00E5FF' },
              { name: 'Purple', hex: '#8B5CF6' },
            ].map(({ name, hex }) => (
              <div key={name} className="text-center">
                <div
                  className="w-full h-20 rounded-lg mb-2 shadow-glow-cyan"
                  style={{ backgroundColor: hex }}
                />
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-white/60">{hex}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Rainbow Gradient Example */}
        <GlassCard>
          <h2 className="text-2xl font-bold mb-4 text-neon-cyan">
            Rainbow Gradient
          </h2>
          <div className="h-32 rounded-xl bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-cyan-500 to-purple-500 mb-4"></div>
          <p className="text-white/80 text-sm">
            This gradient uses all 6 neon colors: red → orange → yellow → green
            → cyan → purple
          </p>
        </GlassCard>

        {/* Ad Cards - Commented out to avoid import issues */}
        {/* <GlassCard>
          <h2 className="text-2xl font-bold mb-4 text-neon-cyan">Ad Cards</h2>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-white/60 mb-2">Banner (728x90)</p>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-2">Leaderboard (728x90)</p>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-sm text-white/60 mb-2">Sidebar (300x250)</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-white/60 mb-2">Square (250x250)</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-2">With Ad Data</p>
            </div>
          </div>
        </GlassCard> */}

        {/* Tool Cards */}
        <GlassCard>
          <h2 className="text-2xl font-bold mb-4 text-neon-cyan">Tool Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ToolCard
              title="SEO Analyzer"
              description="Analyze website SEO metrics and get detailed insights for optimization."
              icon={<Search size={24} className="text-white" />}
              onClick={() => console.log('SEO Analyzer clicked')}
              usesRemaining={2}
            />
            <ToolCard
              title="Domain Research"
              description="Comprehensive domain analysis with historical data and ownership details."
              icon={<Globe size={24} className="text-white" />}
              onClick={() => console.log('Domain Research clicked')}
              usesRemaining={null}
              isPremium={true}
            />
            <ToolCard
              title="Backlink Checker"
              description="Discover all backlinks pointing to any domain with detailed metrics."
              icon={<BarChart3 size={24} className="text-white" />}
              onClick={() => console.log('Backlink Checker clicked')}
              usesRemaining={1}
            />
            <ToolCard
              title="Security Scanner"
              description="Scan websites for security vulnerabilities and potential threats."
              icon={<Shield size={24} className="text-white" />}
              onClick={() => console.log('Security Scanner clicked')}
              usesRemaining={0}
            />
            <ToolCard
              title="Speed Test"
              description="Test website loading speed and performance metrics across global locations."
              icon={<Zap size={24} className="text-white" />}
              onClick={() => console.log('Speed Test clicked')}
              usesRemaining={null}
            />
            <ToolCard
              title="Keyword Research"
              description="Find high-value keywords with search volume and competition data."
              icon={<Search size={24} className="text-white" />}
              onClick={() => console.log('Keyword Research clicked')}
              usesRemaining={3}
              isPremium={true}
            />
          </div>
        </GlassCard>

        {/* Toast Notifications - Page-Specific Colors */}
        <GlassCard>
          <h2 className="text-2xl font-bold mb-4 text-neon-cyan">Toast Notifications - Page Theme Colors</h2>
          <p className="text-sm text-white/60 mb-6">
            Toast colors adapt based on which page they appear on. Error toasts always stay red.
          </p>

          <div className="space-y-6">
            {/* Landing Page Theme (Green) */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-green-400">Landing Page (Green)</h3>
              <div className="flex flex-wrap gap-3">
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.success('Success!', 'Changes saved successfully', { pageTheme: 'landing' })}
                >
                  Success Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.error('Error!', 'Something went wrong', { pageTheme: 'landing' })}
                >
                  Error Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.warning('Warning!', 'Please review your settings', { pageTheme: 'landing' })}
                >
                  Warning Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.info('Info', 'New features available', { pageTheme: 'landing' })}
                >
                  Info Toast
                </NeonButton>
              </div>
            </div>

            {/* Search Portal Theme (Blue) */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-blue-400">Search Portal (Blue Pill)</h3>
              <div className="flex flex-wrap gap-3">
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.success('Success!', 'Search completed', { pageTheme: 'search-portal' })}
                >
                  Success Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.error('Error!', 'Search failed', { pageTheme: 'search-portal' })}
                >
                  Error Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.warning('Warning!', 'Limited results', { pageTheme: 'search-portal' })}
                >
                  Warning Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.info('Info', 'AI analysis ready', { pageTheme: 'search-portal' })}
                >
                  Info Toast
                </NeonButton>
              </div>
            </div>

            {/* Search Results Theme (Red) */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-red-400">Search Results (Red Pill)</h3>
              <div className="flex flex-wrap gap-3">
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.success('Success!', 'Results updated', { pageTheme: 'search-results' })}
                >
                  Success Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.error('Error!', 'Failed to load', { pageTheme: 'search-results' })}
                >
                  Error Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.warning('Warning!', 'Check filters', { pageTheme: 'search-results' })}
                >
                  Warning Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.info('Info', 'New perspective added', { pageTheme: 'search-results' })}
                >
                  Info Toast
                </NeonButton>
              </div>
            </div>

            {/* Biased Theme (Purple) */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-purple-400">Biased Page (Purple)</h3>
              <div className="flex flex-wrap gap-3">
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.success('Success!', 'Perspective saved', { pageTheme: 'biased' })}
                >
                  Success Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.error('Error!', 'Analysis failed', { pageTheme: 'biased' })}
                >
                  Error Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.warning('Warning!', 'Bias detected', { pageTheme: 'biased' })}
                >
                  Warning Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.info('Info', 'Filter applied', { pageTheme: 'biased' })}
                >
                  Info Toast
                </NeonButton>
              </div>
            </div>

            {/* OSINT Theme (Deep Ocean Blue) */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-cyan-500">OSINT Pages (Deep Ocean Blue)</h3>
              <div className="flex flex-wrap gap-3">
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.success('Success!', 'Investigation complete', { pageTheme: 'osint' })}
                >
                  Success Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.error('Error!', 'Tool unavailable', { pageTheme: 'osint' })}
                >
                  Error Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.warning('Warning!', 'Rate limit approaching', { pageTheme: 'osint' })}
                >
                  Warning Toast
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => toast.info('Info', 'Data retrieved', { pageTheme: 'osint' })}
                >
                  Info Toast
                </NeonButton>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default ComponentShowcase;
