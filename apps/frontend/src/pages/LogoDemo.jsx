import { useState } from 'react';
import { TruegleLogo, CategoryBar, SearchBar } from '../components/ui';

export default function LogoDemo() {
  const [activeCategory, setActiveCategory] = useState('pics');
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = () => console.log('Searching:', searchValue);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-8">
      <div className="space-y-16 text-center">
        <div>
          <h2 className="text-cyan-400 text-xl mb-4">XLarge (Landing Hero)</h2>
          <TruegleLogo size="xlarge" animated={true} />
        </div>

        <div>
          <h2 className="text-cyan-400 text-xl mb-4">Large (Search Portal)</h2>
          <TruegleLogo size="large" animated={true} />
        </div>

        <div>
          <h2 className="text-cyan-400 text-xl mb-4">Medium (Cards)</h2>
          <TruegleLogo size="medium" animated={false} />
        </div>

        <div>
          <h2 className="text-cyan-400 text-xl mb-4">Small (Navbar)</h2>
          <TruegleLogo size="small" animated={false} />
        </div>

        <div>
          <h2 className="text-cyan-400 text-xl mb-4">Category Bar Demo</h2>
          <CategoryBar
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
          />
          <p className="text-white/70 mt-4">
            Active category: {activeCategory}
          </p>
        </div>

        <div>
          <h2 className="text-cyan-400 text-2xl mb-4">Search Bar Demo</h2>
          <div className="flex flex-col gap-8 max-w-2xl mx-auto">
            <SearchBar
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onSearch={handleSearch}
              size="large"
              showPillToggle={true}
            />
            <SearchBar
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onSearch={handleSearch}
              size="medium"
              showPillToggle={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
