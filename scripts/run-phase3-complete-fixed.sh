#!/bin/bash

# run-phase3-complete.sh
# TRUEGLE - Phase 3: API Routes & Controllers
# Fixed version without EOF conflicts

START_TIME=$(date +%s)

echo "╔════════════════════════════════════════╗"
echo "║  TRUEGLE - PHASE 3 API ROUTES         ║"
echo "║  Controllers + Endpoints + Server     ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Create necessary directories
mkdir -p backend/src/{routes,controllers,middleware,services,utils,db,models}
mkdir -p .eigent/scripts

# Initialize backend package.json if missing
if [ ! -f backend/package.json ]; then
    cat > backend/package.json << 'PKGJSON'
{
  "name": "truegle-backend",
  "version": "1.0.0",
  "description": "TRUEGLE Bias-Balanced Search Engine Backend",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.2"
  },
  "keywords": ["search", "bias", "api"],
  "author": "TRUEGLE Team",
  "license": "MIT"
}
PKGJSON
fi

# Create User model
cat > backend/src/models/User.js << 'USERMODEL'
class User {
  static async findByEmail(email) {
    return null;
  }

  static async findById(id) {
    return {
      id: id,
      email: 'test@example.com',
      username: 'testuser',
      subscription_tier: 'free',
      created_at: new Date()
    };
  }

  static async create(userData) {
    return {
      id: 'user_' + Date.now(),
      ...userData,
      created_at: new Date()
    };
  }

  static async update(id, updates) {
    return { id, ...updates };
  }
}

module.exports = User;
USERMODEL

# Create Search Service
cat > backend/src/services/searchService.js << 'SEARCHSERVICE'
class SearchService {
  async search(query, options = {}) {
    return {
      results: [
        {
          title: "Sample Result for: " + query,
          url: "https://example.com",
          snippet: "This is a sample search result for demonstration.",
          source: "google",
          credibility_score: 0.85,
          bias_rating: "neutral"
        }
      ],
      total: 1,
      sources: options.sources || ['google']
    };
  }
}

module.exports = SearchService;
SEARCHSERVICE

# Create Bias Service
cat > backend/src/services/biasService.js << 'BIASSERVICE'
class BiasService {
  analyzeBiasDistribution(results) {
    return {
      left: 0.2,
      right: 0.3,
      neutral: 0.5,
      balanced: true
    };
  }

  calculateCredibilityScore(results) {
    return 0.82;
  }
}

module.exports = BiasService;
BIASSERVICE

# Create Rate Limiter
cat > backend/src/utils/rateLimiter.js << 'RATELIMITER'
class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  middleware() {
    return (req, res, next) => {
      const ip = req.ip;
      const now = Date.now();
      const windowMs = 60000;
      
      if (!this.requests.has(ip)) {
        this.requests.set(ip, []);
      }
      
      const requests = this.requests.get(ip);
      const windowStart = now - windowMs;
      
      while (requests.length > 0 && requests[0] < windowStart) {
        requests.shift();
      }
      
      if (requests.length >= 100) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000)
        });
      }
      
      requests.push(now);
      next();
    };
  }

  async getUsageStats(userId, period) {
    return {
      requests: 45,
      limit: 100,
      period: period
    };
  }
}

module.exports = RateLimiter;
RATELIMITER

# Create Auth Controller
cat > backend/src/controllers/authController.js << 'AUTHCONTROLLER'
const User = require('../models/User');
const bcrypt = require('bcryptjs');

class AuthController {
  async register(req, res) {
    try {
      const { email, password, username } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const existing = await User.findByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await User.create({
        email,
        username: username || email.split('@')[0],
        password_hash: passwordHash
      });

      req.session.userId = user.id;
      req.session.email = user.email;

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      await User.update(user.id, { last_login: new Date() });

      req.session.userId = user.id;
      req.session.email = user.email;

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          subscription_tier: user.subscription_tier
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async logout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ message: 'Logout successful' });
    });
  }

  async getCurrentUser(req, res) {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await User.findById(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          subscription_tier: user.subscription_tier,
          created_at: user.created_at
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }
}

module.exports = new AuthController();
AUTHCONTROLLER

# Create Auth Routes
cat > backend/src/routes/auth.js << 'AUTHROUTES'
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.getCurrentUser);

module.exports = router;
AUTHROUTES

# Create Auth Middleware
cat > backend/src/middleware/authMiddleware.js << 'AUTHMIDDLEWARE'
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function optionalAuth(req, res, next) {
  if (req.session.userId) {
    req.userId = req.session.userId;
  }
  next();
}

function requireSubscription(tier) {
  return async (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.session.userId);

    const tiers = ['free', 'premium', 'enterprise'];
    const requiredIndex = tiers.indexOf(tier);
    const userIndex = tiers.indexOf(user.subscription_tier);

    if (userIndex < requiredIndex) {
      return res.status(403).json({ 
        error: 'Insufficient subscription tier',
        required: tier,
        current: user.subscription_tier
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireSubscription
};
AUTHMIDDLEWARE

# Create Search Controller
cat > backend/src/controllers/searchController.js << 'SEARCHCONTROLLER'
const SearchService = require('../services/searchService');
const BiasService = require('../services/biasService');

class SearchController {
  constructor() {
    this.searchService = new SearchService();
    this.biasService = new BiasService();
  }

  async search(req, res) {
    try {
      const { 
        q: query, 
        page = 1, 
        limit = 10,
        sources = 'google,news',
        biasBalance = true 
      } = req.query;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      const sourceArray = sources.split(',').map(s => s.trim());

      const results = await this.searchService.search(query, {
        page: parseInt(page),
        limit: parseInt(limit),
        sources: sourceArray,
        biasBalance: biasBalance === 'true'
      });

      const biasAnalysis = this.biasService.analyzeBiasDistribution(results.results);
      const credibilityScore = this.biasService.calculateCredibilityScore(results.results);

      res.json({
        query,
        results: results.results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: results.total
        },
        biasAnalysis,
        credibilityScore,
        metadata: {
          sourcesUsed: results.sources,
          biasBalanced: biasBalance,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ 
        error: 'Search failed',
        message: error.message 
      });
    }
  }

  async getHistory(req, res) {
    try {
      const userId = req.session.userId || req.ip;
      const { limit = 20 } = req.query;

      res.json({
        history: [
          {
            query: "sample search",
            filters: { sources: ['google'] },
            created_at: new Date().toISOString()
          }
        ]
      });
    } catch (error) {
      console.error('History error:', error);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }

  async getTrending(req, res) {
    try {
      const { limit = 10, timeframe = '24h' } = req.query;

      res.json({
        trending: [
          {
            query: "current events",
            search_count: 150,
            last_searched: new Date().toISOString()
          }
        ],
        timeframe
      });
    } catch (error) {
      console.error('Trending error:', error);
      res.status(500).json({ error: 'Failed to fetch trending' });
    }
  }

  async analyzeQuery(req, res) {
    try {
      const { q: query } = req.query;

      if (!query) {
        return res.status(400).json({ error: 'Query required' });
      }

      const biasIndicators = {
        left: ['progressive', 'liberal', 'socialist', 'equality'],
        right: ['conservative', 'traditional', 'freedom', 'liberty'],
        emotional: ['shocking', 'outrageous', 'devastating', 'incredible'],
        clickbait: ['you won\'t believe', 'what happens next', 'shocking']
      };

      const analysis = {
        query,
        indicators: {},
        score: 0,
        suggestions: []
      };

      const lowerQuery = query.toLowerCase();

      Object.keys(biasIndicators).forEach(category => {
        const found = biasIndicators[category].filter(term => 
          lowerQuery.includes(term)
        );
        if (found.length > 0) {
          analysis.indicators[category] = found;
          analysis.score += found.length;
        }
      });

      if (analysis.score > 0) {
        analysis.suggestions.push('Consider using more neutral terminology');
        analysis.suggestions.push('Try rephrasing to focus on facts rather than opinions');
      }

      res.json(analysis);
    } catch (error) {
      console.error('Query analysis error:', error);
      res.status(500).json({ error: 'Analysis failed' });
    }
  }
}

module.exports = new SearchController();
SEARCHCONTROLLER

# Create Search Routes
cat > backend/src/routes/search.js << 'SEARCHROUTES'
const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { optionalAuth } = require('../middleware/authMiddleware');
const RateLimiter = require('../utils/rateLimiter');

const rateLimiter = new RateLimiter();

router.use(rateLimiter.middleware());

router.get('/', optionalAuth, searchController.search);
router.get('/history', optionalAuth, searchController.getHistory);
router.get('/trending', searchController.getTrending);
router.get('/analyze', searchController.analyzeQuery);

module.exports = router;
SEARCHROUTES

# Create Express Server
cat > backend/src/server.js << 'SERVERJS'
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'truegle-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');

app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'TRUEGLE API',
    version: '1.0.0',
    description: 'Bias-balanced search engine API',
    endpoints: {
      auth: '/api/auth',
      search: '/api/search'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  TRUEGLE API SERVER                   ║
╚════════════════════════════════════════╝

🚀 Server running on port ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📡 API Base: http://localhost:${PORT}

Available endpoints:
  - POST   /api/auth/register
  - POST   /api/auth/login
  - POST   /api/auth/logout
  - GET    /api/auth/me
  - GET    /api/search
  - GET    /api/search/history
  - GET    /api/search/trending
  - GET    /api/search/analyze
  - GET    /health

Ready to accept requests! 🎯
  `);
});

module.exports = app;
SERVERJS

echo "✅ All Phase 3 files created successfully!"

# Install dependencies
echo "Installing dependencies..."
cd backend
npm install
cd ..

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "╔════════════════════════════════════════╗"
echo "║  ✅ PHASE 3 COMPLETE                  ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Duration: ${DURATION} seconds"
echo ""
echo "📄 Generated Files:"
echo "   - backend/src/models/User.js"
echo "   - backend/src/controllers/authController.js"
echo "   - backend/src/controllers/searchController.js"
echo "   - backend/src/services/searchService.js"
echo "   - backend/src/services/biasService.js"
echo "   - backend/src/utils/rateLimiter.js"
echo "   - backend/src/routes/auth.js"
echo "   - backend/src/routes/search.js"
echo "   - backend/src/middleware/authMiddleware.js"
echo "   - backend/src/server.js"
echo ""
echo "🎯 Next Steps:"
echo "   1. Start the server: cd backend && npm start"
echo "   2. Test endpoints with the commands below"
echo ""
echo "🧪 Quick Test Commands:"
echo "   # Health check"
echo "   curl http://localhost:3000/health"
echo ""
echo "   # Register user"
echo "   curl -X POST http://localhost:3000/api/auth/register \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"test@example.com\",\"password\":\"test123\"}'"
echo ""
echo "   # Search test"
echo "   curl 'http://localhost:3000/api/search?q=climate+change&biasBalance=true'"
echo ""
