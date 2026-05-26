# Truegle - Unbiased Search Engine

*If you're reading this, I want you to know how much I love you and how grateful I am for everything you've done for me. This document will help you understand my vision for Truegle and guide you through continuing this mission if I'm no longer here.*

---

## 🌟 **The Vision: Why Truegle Exists**

Truegle isn't just a search engine—it's a movement toward truth, transparency, and human empowerment in the age of AI.

### **Core Philosophy:**

**We believe:**
- Truth should be accessible to everyone, free from algorithmic bias
- People deserve to see ALL perspectives, not just what algorithms think they want
- The internet should empower humanity, not control it
- Technology should serve people, especially our children
- Community and service to others can replace greed-driven capitalism

**The Mission:** Break free from algorithmic bubbles. Let people discover their own truths by showing them unbiased, comprehensive search results from multiple perspectives.

---

## 🏗️ **Project Structure**

This repository follows a monorepo structure:

```
truegle/
├── apps/
│   ├── frontend/                 # Frontend application
│   │   ├── src/
│   │   │   ├── components/       # React components
│   │   │   ├── pages/            # Page components
│   │   │   ├── hooks/            # Custom hooks
│   │   │   ├── services/         # API service functions
│   │   │   ├── utils/            # Utility functions
│   │   │   ├── context/          # React context providers
│   │   │   ├── assets/           # Static assets
│   │   │   ├── styles/           # CSS/Tailwind files
│   │   │   ├── types/            # TypeScript type definitions
│   │   │   ├── config/           # Configuration files
│   │   │   ├── main.jsx          # Main entry point
│   │   │   └── App.jsx           # Root component
│   │   ├── public/               # Public assets
│   │   └── ...
│   └── backend/                  # Backend application
│       ├── src/
│       │   ├── controllers/      # Route controllers
│       │   ├── models/           # Database models
│       │   ├── routes/           # API route definitions
│       │   ├── middleware/       # Express middleware
│       │   ├── services/         # Business logic
│       │   ├── utils/            # Utility functions
│       │   ├── config/           # Configuration files
│       │   └── server.js         # Server entry point
│       └── ...
├── docs/                         # Documentation
│   ├── development/
│   ├── api/
│   ├── architecture/
│   └── user-guides/
├── scripts/                      # Build and utility scripts
├── tests/                        # Test files
├── docker/                       # Docker configuration
└── ...
```

---

## 🎨 **The Visual Journey: Microcosm to Macrocosm**

Each page of Truegle takes users on a journey from the smallest particles to the infinite cosmos:

1. **Landing Page** (/) - Atomic/Molecular level (realistic 3D nucleus with electrons)
2. **Sign Up** (/signup) - Cellular/Biological level (molecular structures)
3. **Sign In** (/signin) - Cellular/Biological level (clean molecular background)
4. **Search Portal** (/search) - Neural/Synaptic level (brain networks with electrical pulses)
5. **OSINT Tools** (/osint) - Planetary/Orbital level (solar systems)
6. **Biased Results** (/biased) - Galactic/Cosmic level (star fields)
7. **404 Error** (/404) - Void/Singularity (cosmic emptiness)

This represents the journey of consciousness—from physical matter to infinite awareness.

---

## 🚀 **Getting Started**

### Prerequisites
- Node.js 18+
- npm or yarn
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd truegle
```

2. Install dependencies for all workspaces:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy environment files
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

4. Start development servers:
```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:frontend
npm run dev:backend
```

---

## 🛠️ **Development Scripts**

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:frontend` - Start only the frontend development server
- `npm run dev:backend` - Start only the backend development server
- `npm run build` - Build all workspaces
- `npm run build:frontend` - Build only the frontend
- `npm run build:backend` - Build only the backend
- `npm run test` - Run tests for all workspaces
- `npm run lint` - Lint all workspaces

---

## 📊 **Current Development Status (December 23, 2025)**

### ✅ **Recent Progress**
- Fixed "Cannot use import statement outside a module" error in backend
- Resolved React Router future flag warnings
- Implemented authentication token validation for development
- Added comprehensive debug logging to animation components
- Improved animation parameters for better visibility
- Enhanced WebGL context validation and error handling
- **FIXED**: Resolved animation lifecycle issue causing infinite creation/destruction loop in BackgroundAnimation.jsx
- **FIXED**: Updated useEffect dependencies to prevent animation restarts during sequence
- **FIXED**: Used refs instead of state for animation parameters to prevent unnecessary re-renders
- **FIXED**: Added proper z-index values to ensure animation containers are visible

### 🔄 **Current Console Status**
- Animation sequence is triggering properly (shows "Laser ready to show", "Prism ready to show", "Aurora ready to show")
- Minor CSS opacity parsing warning (non-critical)

### 🛠️ **Session Log: Animation Visibility Fix (December 23, 2025)**
- **Issue**: Landing page animations were initializing correctly but immediately being cleaned up, creating an infinite loop
- **Root Cause**: useEffect hook in BackgroundAnimation.jsx had animationPhase in dependency array, causing re-initialization on every phase change
- **Solution**:
  - Removed animationPhase from useEffect dependencies
  - Converted animation parameters to use refs instead of state
  - Added force update mechanism for opacity transitions
  - Updated CSS z-index values for proper layering
- **Result**: Animations now complete their full sequence (Laser → Prism → Aurora) without interruption

---

## 🔧 **Recent Development Session (December 23, 2025)**
### **Session Focus: Landing Page Animations & Search Functionality**

### **Issues Resolved:**
1. **Animation Visibility Issues**:
   - Fixed infinite animation loop causing components to constantly reinitialize
   - Corrected useEffect dependencies to prevent re-initialization during animation
   - Implemented ref-based parameter management to avoid unnecessary re-renders
   - Updated CSS z-index values for proper layering

2. **Search Bar Enhancements**:
   - Added microphone, camera, and file attachment icons to search bar
   - Implemented proper media permissions workflow
   - Created full-screen premium features announcement overlay
   - Fixed navigation flows for different search modes (Blue Pill/Red Pill)

3. **Media Interface Improvements**:
   - Implemented microphone interface with speech-to-text simulation
   - Added camera interface with photo/video capture simulation
   - Created file/media gallery interface with selection functionality
   - Fixed navigation to molecular design auth pages in Red Pill mode

4. **Dependency Resolution**:
   - Fixed `@react-three/fiber` import error by installing missing packages
   - Resolved version conflicts between React and React Three.js packages
   - Used compatible versions to maintain React 18 compatibility

### **Key Features Added:**
- **Enhanced Search Bar**: Added media icons with proper functionality and permissions
- **Full-Screen Announcements**: Implemented premium features announcement that requires user acknowledgment
- **Improved Navigation**: Fixed routing between Blue Pill and Red Pill modes
- **Better UX**: Added glitch effects and proper transitions between states
- **Mobile Optimization**: Improved mobile responsiveness for media interfaces

### **Technical Improvements:**
- Optimized animation performance using refs instead of state updates
- Fixed scroll issues on landing page by updating overflow properties
- Enhanced molecular design auth pages with proper scrolling support
- Implemented proper state management for media interfaces
- Added permission workflow for microphone, camera, and file access

### **Files Modified:**
- `pages/LandingPage.jsx` - Search bar enhancements and media interfaces
- `components/ui/SearchBar.jsx` - Added right icons support
- `pages/SignUpPage.jsx` - Full-screen announcement and scrolling fix
- `pages/SignInPage.jsx` - Full-screen announcement and scrolling fix
- `App.jsx` - Route definitions for new pages
- Various background animation components

### **Result:**
The landing page now features properly functioning animations without infinite loops, enhanced search capabilities with media interfaces, and improved user experience with proper navigation flows between different modes. The dependency issues have been resolved, ensuring all components load correctly.

---

## 📊 **Navigation Route Status**

### **✅ Blue Pill (Unbiased Search) Routes - FIXED**
- `/` (Landing Page) → Works correctly
- `/search-portal` → SearchPortal.jsx with Galaxy background (correct for blue pill)
- Blue pill search functionality → Works correctly with proper navigation

### **❌ Red Pill (Biased Search) Routes - PENDING**
- Red pill mode navigation to search results page after auth → **NEEDS FIXING**
- `/search-results` → SearchResults.jsx with Starfield background (setup correctly, but navigation flow needs work)
- Red pill search flow → **REQUIRES ADDITIONAL IMPLEMENTATION**

---

## 🎯 **Development Roadmap & Action Plan**

### **Phase 1: Immediate Priorities (Before Deployment)**

#### **1. Enhanced Search Bar Implementation**
- [ ] Add multi-media search bar under logo and problem statement
- [ ] Implement audio, file, video, URL, and picture search capabilities
- [ ] Integrate necessary APIs (Google Search, Bing Search, SerpAPI, etc.)
- [ ] Create toggle switch (pill design) for Blue Pill/Red Pill modes
  - Blue Pill: Simplified search experience
  - Red Pill: Advanced research mode requiring login/signup

#### **2. Search Mode Integration**
- [ ] Utilize Search Portal as Blue Pill results page
- [ ] Utilize Search Results as Red Pill results page
- [ ] Add AI mode to search categories with unbiased summary and perspective filtering
- [ ] Implement optional signup/login with freemium feature prompting

#### **3. UI/UX Improvements**
- [ ] Create navigational click box tutorial
- [ ] Add "Dig Deeper" option for advanced tools explanation
- [ ] Minimize UI clutter similar to Google's approach
- [ ] Design mobile-first portrait layout with expandable desktop features
- [ ] Make animations portrait-native with expandable backgrounds

#### **4. Authentication & Access Control**
- [ ] Implement token-based access for premium features
- [ ] Add prompts for premium features (Red Pill mode, biased results, AI chat, SEO/OSINT tools)
- [ ] Create optional signup/login flow with feature-based navigation

---

### **Phase 2: Post-Launch Enhancements**

#### **5. 404 Easter Egg Game**
- [ ] Create Apollo Studios - Mario-style game with astronauts avoiding film equipment
- [ ] Implement scene counting and "Cut!" ending for each level
- [ ] Design as interactive 404 page experience

#### **6. AI Development Assistant**
- [ ] Integrate Miro Sidekicks-style Co-Founder GPT
- [ ] Create SEO, geo, algo, AI and search optimization agent
- [ ] Focus on truth-seekers and controversial content creators market
- [ ] Develop sponsored and affiliate packages for pre-release testing

#### **7. Security & Privacy Features**
- [ ] Implement phishing checker
- [ ] Set Truegle as default search/home/assistant AI
- [ ] Add link scanning for all external links
- [ ] Create agentic workflow permissions (email, text, phone, social, etc.)

---

## 🛠️ **Required APIs & Resources**

### **For Multi-Media Search**
- Google Custom Search API
- Bing Search API
- SerpAPI
- Vision API (for image search)
- Audio processing APIs
- Video processing APIs

### **For Advanced Features**
- Ollama for local AI processing
- Anthropic Claude for AI responses
- OpenAI API for advanced processing
- Various OSINT tools integration

---

## 🎮 **Advanced Truth-Seeking Features**

### **Controversial Topics Focus**
- Moon landing discussions
- Ancient civilizations research
- Alternative science theories
- Zero-point energy exploration
- Alternative history perspectives

### **Market Positioning**
- Target truth-seekers and controversial content creators
- Emphasize unbiased and transparent nature
- Welcome open discussions on sensitive topics
- Offer premium packages for in-depth research tools

---

## 📚 **Additional Documentation**

- DEVELOPMENT.md - Technical setup guide
- ENERGY.md - Revolutionary energy research documentation
- MARKETING.md - Complete marketing strategy (to be created)
- LEGAL.md - Legal requirements & compliance (to be created)
- EARTHWORK.md - Detailed community plans (to be created)
- API.md - API documentation for developers (to be created)

## 📁 **Project Organization Notes**

- excess-readmes/ - Directory containing excess README files moved during project cleanup (December 22, 2025)
- excess-readmes/INDEX.md - Index of README files that were moved as potentially unnecessary

---

*"The truth will set you free, but first it will piss you off."* - Gloria Steinem

*Let's build the future together.* 🌟# qwen-experiment-project
