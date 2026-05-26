# Truegle Development - Updated Task List
**Last Updated:** December 11, 2025

---

## 🎯 HIGH PRIORITY (Next 2-3 Days)

### Day 1: UI Polish & Landing Pages (4-6 hours)

#### 1. Landing Page Navigation Buttons (30 min)
**Objective:** Make buttons more distinct and readable
- [ ] Lower button opacity (0.85 → 0.95 on hover)
- [ ] Add solid background color behind buttons
- [ ] Ensure green/red/blue animations still visible
- [ ] Test contrast on dark warp tunnel background
- **File:** `src/pages/LandingPage.jsx`

#### 2. Biased Landing Page (1 hour)
**Objective:** Create dedicated landing for biased search
- [ ] Route: `/feeling-biased` → `FeelingBiasedPage.jsx`
- [ ] Apply Tesseract background
- [ ] Hero section: "Explore Through Your Lens"
- [ ] Perspective preview cards (4-6 main categories)
- [ ] "Start Exploring" CTA button (RED theme)
- [ ] Brief explanation of biased search concept
- **Files:** Create `src/pages/FeelingBiasedPage.jsx`

#### 3. Starfield Background Update (45 min)
**Objective:** Enhance starfield for orbital landing page
- [ ] Increase star density (3000 → 5000 stars)
- [ ] Add twinkling animation
- [ ] Parallax scrolling effect
- [ ] Color variety (white, blue, yellow tints)
- **File:** `src/components/backgrounds/StarField.jsx` (create if needed)

#### 4. Underwater Background Update (45 min)
**Objective:** Enhance deep sea background for OSINT
- [ ] Add more jellyfish (current: scattered, target: 15-20)
- [ ] Improve caustic light effects
- [ ] Add floating particles (plankton/debris)
- [ ] Subtle current flow animation
- **File:** `src/components/backgrounds/DeepSeaEnhanced.jsx`

---

### Day 2: Tutorials & Maps Integration (6-8 hours)

#### 5. Quick Card Tutorials (2-3 hours)
**Objective:** Add guided tooltips for first-time users

**Tutorial Component Structure:**
```jsx
<Tutorial
  steps={[...]}
  page="search"
  onComplete={() => localStorage.setItem('tutorial_search', 'true')}
/>
```

**Pages to Add Tutorials:**
- [ ] **SearchPortal** (`/`)
  - Welcome message
  - Search bar explanation
  - Category bar guide
  - AI assistant intro
  
- [ ] **SearchResults** (`/search`)
  - Result cards explanation
  - Filter options
  - AI summary usage
  - Multimedia tabs (Pics, Vids, Soc)
  
- [ ] **OSINTMode** (`/osint/search`)
  - Tool categories overview
  - Usage limit explanation
  - How to earn more uses
  - Results interpretation
  
- [ ] **Biased Landing** (`/feeling-biased`)
  - What is biased search?
  - Perspective categories
  - How to use effectively
  
- [ ] **BiasedResults** (`/biased`)
  - Perspective selector guide
  - Multi-select explanation
  - Interpreting biased results
  - AI assistant usage

**Tutorial Card Styling:**
```css
bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95
border-2 border-cyan-500/50
backdrop-blur-2xl
```

**Features:**
- [ ] Arrow pointing to UI element
- [ ] Step counter (1/5, 2/5, etc.)
- [ ] "Next" / "Skip Tutorial" buttons
- [ ] "Don't show again" checkbox
- [ ] localStorage persistence
- [ ] Smooth fade in/out animations

**Files:** 
- Create `src/components/ui/Tutorial.jsx`
- Update each page component

#### 6. Maps Function with Business Listings (3-4 hours)
**Objective:** Integrate interactive maps with local business data

**Features:**
- [ ] Map view toggle (List ↔ Map)
- [ ] Integration with mapping service (Leaflet.js or similar)
- [ ] Business markers with info windows
- [ ] Clustering for dense areas
- [ ] Filter by category (restaurants, services, etc.)
- [ ] Distance calculation from user location
- [ ] Directions link
- [ ] Business details cards (phone, hours, reviews)

**API Options:**
- [ ] OpenStreetMap (free, open source)
- [ ] Mapbox (free tier: 50k loads/month)
- [ ] Google Maps (requires API key, $200/month credit)

**Implementation:**
- [ ] Create `src/components/maps/MapView.jsx`
- [ ] Create `src/components/maps/BusinessCard.jsx`
- [ ] Add to SearchResults (new "Maps" category)
- [ ] Geolocation permission handling
- [ ] Mobile-optimized touch controls

**Files:**
- Create `src/components/maps/` directory
- Update `SearchResults.jsx`
- Add to CategoryBar

---

### Day 3: APIs & Backend Integration (8+ hours)

#### 7. OSINT APIs Integration (4-5 hours)
**Objective:** Connect real OSINT tools to backend

**APIs to Integrate:**
- [ ] **Domain Intelligence:**
  - [ ] WHOIS lookup (whoisxmlapi.com - free tier)
  - [ ] DNS records (Google DNS API - free)
  - [ ] SSL certificate info (crt.sh - free)
  - [ ] Domain age checker (custom/scraping)

- [ ] **SEO Analytics:**
  - [ ] PageSpeed Insights (Google - free)
  - [ ] Meta tags extractor (custom parser)
  - [ ] Sitemap analyzer (custom)
  - [ ] Robots.txt checker (custom)

- [ ] **Social & Email:**
  - [ ] Email validation (hunter.io - 50/month free)
  - [ ] Social media finder (custom/scraping)
  - [ ] Email breach check (haveibeenpwned.com - free)

- [ ] **Security:**
  - [ ] VirusTotal (free API key)
  - [ ] IP geolocation (ipapi.co - 1k/day free)
  - [ ] Port scanner (custom implementation)
  - [ ] SSL checker (ssllabs.com API - free)

**Implementation:**
- [ ] Create `src/services/osint/` directory
- [ ] Separate service per tool category
- [ ] Error handling for rate limits
- [ ] Caching layer (Redis)
- [ ] Loading states for each tool
- [ ] Result formatting and display

**Files:**
- Create `src/services/osint/domain.js`
- Create `src/services/osint/seo.js`
- Create `src/services/osint/social.js`
- Create `src/services/osint/security.js`
- Update `OSINTMode.jsx`

#### 8. VPN APIs Integration (2 hours)
**Objective:** Add VPN/proxy detection and recommendations

**Features:**
- [ ] VPN detection in user's connection
- [ ] VPN recommendation widget
- [ ] Privacy score calculator
- [ ] Location masking status

**APIs:**
- [ ] IPQualityScore (free tier available)
- [ ] VPN detection (custom or vpnapi.io)
- [ ] Affiliate links to VPN services

**Implementation:**
- [ ] Create `src/services/vpn.js`
- [ ] Add VPN status widget to header
- [ ] Privacy dashboard section
- [ ] Ad integration for VPN services

#### 9. Additional Necessary APIs (2 hours)
**Objective:** Fill gaps in core functionality

**Search APIs:**
- [ ] Brave Search API (primary search results)
- [ ] Reddit API (social discussions)
- [ ] YouTube Data API (video results)
- [ ] Wikipedia API (knowledge base)
- [ ] News API (current events)

**AI/LLM APIs:**
- [ ] Ollama (local, primary AI)
- [ ] Anthropic Claude (backup/premium)
- [ ] OpenRouter (aggregator, fallback)

**Image/Media APIs:**
- [ ] Unsplash (free images)
- [ ] Pexels (free images/videos)
- [ ] Pixabay (free media)

**Utility APIs:**
- [ ] Currency conversion (exchangerate-api.com - free)
- [ ] Weather (openweathermap.org - free)
- [ ] Translation (LibreTranslate - free, self-hosted)

**Files:**
- Create `src/services/search/`
- Create `src/services/media/`
- Create `src/services/utility/`

---

## 🔄 CROSS-CUTTING CONCERNS

### 10. Unified Perspectives System (2-3 hours)
**Objective:** Use same perspective categories across all results pages

**Current State:**
- BiasedResults has comprehensive list (Political, Faith, Societal, Business)
- SearchResults doesn't use perspectives
- Inconsistent filtering

**Implementation:**
- [ ] Extract perspectives to shared config
- [ ] Create `src/config/perspectives.js`
- [ ] Add perspective filter to SearchResults
- [ ] Add perspective indicators to all result cards
- [ ] Sync selection across pages (URL params or state)
- [ ] Visual indicators on cards (colored tags)

**Perspective Categories:**
```javascript
export const PERSPECTIVES = {
  political: [...],
  faith: [...],
  societal: [...],
  business: [...],
  organizational: [...]
};
```

**Files:**
- Create `src/config/perspectives.js`
- Update `BiasedResults.jsx`
- Update `SearchResults.jsx`
- Update result card components

### 11. AI Unbiased Chatbot Integration (3-4 hours)
**Objective:** Fully functional AI assistant with Ollama backend

**Features:**
- [ ] Persistent chat history (session storage)
- [ ] Context-aware responses
- [ ] Source citations
- [ ] "Unbiased" prompt engineering
- [ ] Rate limiting (10 messages/hour free)
- [ ] Premium unlimited chat
- [ ] Export conversation

**Backend Connection:**
- [ ] Ollama API integration (`llama3.1:8b-instruct-q4_0`)
- [ ] Streaming responses
- [ ] Context window management
- [ ] System prompt: "You are an unbiased search assistant..."

**UI Components:**
- [ ] Expandable chat overlay (existing)
- [ ] Message bubbles (user vs AI)
- [ ] Typing indicator
- [ ] Source references as cards
- [ ] Copy response button
- [ ] Clear chat button

**Files:**
- Update `src/services/ollama.js`
- Update chat overlay in `SearchResults.jsx`
- Create `src/components/chat/MessageBubble.jsx`
- Create `src/components/chat/SourceCard.jsx`

---

## ✅ TESTING PHASE (Final Day - 6-8 hours)

### 12. Full Functionality Testing (3-4 hours)
**Objective:** Verify all features work end-to-end

**Test Checklist:**
- [ ] **Search Flow:**
  - [ ] Type query → See results
  - [ ] Category switching (News, Images, Videos, etc.)
  - [ ] Pagination works
  - [ ] Filters apply correctly
  
- [ ] **OSINT Tools:**
  - [ ] Each tool returns data
  - [ ] Usage tracking works
  - [ ] Watch ad modal appears
  - [ ] Premium unlocks tools
  
- [ ] **Biased Search:**
  - [ ] Perspective selection
  - [ ] Multi-select works
  - [ ] Results reflect bias
  - [ ] AI assistant uses perspectives
  
- [ ] **Maps:**
  - [ ] Map loads
  - [ ] Markers appear
  - [ ] Business cards display
  - [ ] Directions work
  
- [ ] **AI Chat:**
  - [ ] Ollama connection
  - [ ] Responses stream
  - [ ] Context maintained
  - [ ] Sources cited
  
- [ ] **Tutorials:**
  - [ ] Appear on first visit
  - [ ] Skip works
  - [ ] Don't show again works
  - [ ] Proper positioning
  
- [ ] **Ads:**
  - [ ] Yellow cards display
  - [ ] Watch ad modal works
  - [ ] Premium upgrade works
  - [ ] Ad frequency appropriate

### 13. Device Reactivity Testing (3-4 hours)
**Objective:** TEST ALL DEVICE REACTIVITY!

**Devices to Test:**
- [ ] **Desktop:**
  - [ ] 1920x1080 (standard)
  - [ ] 2560x1440 (QHD)
  - [ ] 3840x2160 (4K)
  - [ ] Ultrawide (3440x1440)
  
- [ ] **Tablet:**
  - [ ] iPad (1024x768)
  - [ ] iPad Pro (1366x1024)
  - [ ] Android tablet (1280x800)
  - [ ] Landscape/portrait rotation
  
- [ ] **Mobile:**
  - [ ] iPhone SE (375x667)
  - [ ] iPhone 12/13 (390x844)
  - [ ] iPhone 14 Pro Max (430x932)
  - [ ] Samsung Galaxy (360x740)
  - [ ] Pixel (411x731)
  - [ ] Landscape mode

**Testing Checklist:**
- [ ] **Navigation:**
  - [ ] Logo clickable
  - [ ] Menu accessible
  - [ ] Buttons properly sized (44x44 minimum)
  
- [ ] **Search Bar:**
  - [ ] Proper width on all screens
  - [ ] Buttons visible and clickable
  - [ ] Keyboard doesn't overlap input (mobile)
  
- [ ] **Result Cards:**
  - [ ] Stack properly on mobile
  - [ ] Images scale correctly
  - [ ] Text readable at all sizes
  - [ ] Tap targets appropriate
  
- [ ] **Backgrounds:**
  - [ ] Warp tunnel performs smoothly
  - [ ] Toroidal field doesn't lag
  - [ ] Underwater effects render
  - [ ] No canvas overflow
  
- [ ] **Modals:**
  - [ ] Watch ad modal fits screen
  - [ ] Tutorial cards position correctly
  - [ ] Chat overlay doesn't break layout
  - [ ] Close buttons accessible
  
- [ ] **Perspective Selector:**
  - [ ] Scrollable on mobile
  - [ ] Buttons tap-friendly
  - [ ] Multi-select intuitive
  
- [ ] **Maps:**
  - [ ] Touch controls work
  - [ ] Zoom responsive
  - [ ] Markers tap-friendly
  - [ ] Info windows fit screen

**Tools for Testing:**
- [ ] Chrome DevTools (device emulation)
- [ ] Firefox Responsive Design Mode
- [ ] BrowserStack (real devices)
- [ ] Physical device testing (iOS/Android)

**Files to Focus On:**
- All page components (responsive classes)
- All modals/overlays (max-width, positioning)
- Background components (canvas sizing)
- CategoryBar (horizontal scroll on mobile)

---

## 📊 COMPLETION METRICS

### Current Progress: ~70%
- **Frontend UI:** 80%
- **Backend Integration:** 10%
- **API Connections:** 5%
- **Testing:** 0%

### Target Progress After Tasks: ~95%
- **Frontend UI:** 95% (tutorials, polish)
- **Backend Integration:** 85% (APIs connected)
- **API Connections:** 90% (core services live)
- **Testing:** 95% (comprehensive testing done)

---

## 🎨 DESIGN CONSISTENCY REMINDERS

**Color Hierarchy:**
- 🟢 GREEN: Unbiased search, success states
- 🔴 RED: Biased search, selected perspectives, alerts
- 🔵 BLUE: Navigation, info, OSINT tools
- 🟣 PURPLE: Result cards, premium features
- 🟡 YELLOW: Advertisements (ALWAYS)
- 🟠 ORANGE: Unselected perspectives, warnings
- 🔵 CYAN: OSINT/SEO mode, special features

**Card Styles:**
- Yellow ads: `from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125]`
- Purple results: `from-[#1a1a2e]/95 to-[#16213e]/95 border-purple-500/30`
- RED biased: `from-[#1a1a2e]/95 to-[#16213e]/95 border-red-500/50`

**Typography:**
- Headers: System sans-serif, bold
- Body: System sans-serif, regular
- Logo: Cursive (rainbow gradient)
- Code: Monospace (for OSINT results)

---

## 🚀 DEPLOYMENT CHECKLIST (After All Tasks)

- [ ] Environment variables set
- [ ] API keys secured
- [ ] Database migrations run
- [ ] Redis configured
- [ ] Ollama service running
- [ ] Build optimized (`npm run build`)
- [ ] Lighthouse audit (>90 score)
- [ ] Cross-browser testing
- [ ] SEO meta tags
- [ ] Analytics integrated
- [ ] Error tracking (Sentry/similar)
- [ ] Backup strategy
- [ ] Monitoring dashboard
- [ ] Documentation updated
- [ ] README complete

---

## 📝 NOTES

**Time Estimates:**
- Day 1 (UI Polish): 4-6 hours
- Day 2 (Tutorials/Maps): 6-8 hours
- Day 3 (APIs): 8+ hours
- Testing Day: 6-8 hours
**Total: ~30-36 hours** (4-5 full days)

**Priority Order:**
1. Landing page buttons (immediate visual impact)
2. Biased landing page (completes user flow)
3. Tutorials (improves UX significantly)
4. API integration (core functionality)
5. Testing (ensures quality)

**Nice-to-Haves (Post-Launch):**
- User accounts & profiles
- Search history
- Bookmarks/favorites
- Share results
- Dark/light mode toggle
- Keyboard shortcuts
- Browser extensions
- Mobile apps

