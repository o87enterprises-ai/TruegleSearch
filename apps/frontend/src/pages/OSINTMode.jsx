import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Globe,
  Mail,
  Phone,
  MapPin,
  Shield,
  Eye,
  Database,
  ArrowLeft,
  FileText,
  Link,
  BarChart,
  TrendingUp,
  Users,
  Lock,
  AtSign,
  Bot,
  Send,
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DeepSeaEnhanced from '../components/backgrounds/DeepSeaEnhanced';
import LightRays from '../components/backgrounds/LightRays';
import TruegleLogo from '../components/ui/TruegleLogo';

export default function OSINTMode() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('social');
  const [searchValue, setSearchValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [usageCount, setUsageCount] = useState(() => {
    const saved = localStorage.getItem('osint_usage_global');
    return saved ? parseInt(saved) : 0;
  });
  const [showAdModal, setShowAdModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [adCountdown, setAdCountdown] = useState(30);

  // AI Assistant State
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Bubble Animation State
  const [bubbles, setBubbles] = useState([]);

  // Countdown timer for ad modal
  useEffect(() => {
    if (showAdModal && adCountdown > 0) {
      const timer = setTimeout(() => {
        setAdCountdown(adCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showAdModal, adCountdown]);

  const tools = [
    // Top Tools - Most Used
    {
      id: 'social',
      name: 'Social Monitoring',
      icon: Users,
      placeholder: 'Enter username or handle',
    },
    {
      id: 'phone',
      name: 'Phone Lookup',
      icon: Phone,
      placeholder: 'Enter phone number (e.g., +1 555-123-4567)',
    },
    {
      id: 'email-investigate',
      name: 'Email Investigation',
      icon: AtSign,
      placeholder: 'Enter email address to investigate',
    },
    // Domain Intelligence
    {
      id: 'domain',
      name: 'Domain Analysis',
      icon: Globe,
      placeholder: 'Enter domain (e.g., example.com)',
    },
    {
      id: 'whois',
      name: 'WHOIS Lookup',
      icon: FileText,
      placeholder: 'Enter domain for WHOIS',
    },
    {
      id: 'dns',
      name: 'DNS Records',
      icon: Search,
      placeholder: 'Enter domain for DNS lookup',
    },
    {
      id: 'ssl',
      name: 'SSL Certificate',
      icon: Shield,
      placeholder: 'Enter domain to check SSL',
    },
    // SEO Analytics
    {
      id: 'keyword',
      name: 'Keyword Research',
      icon: Search,
      placeholder: 'Enter keyword to research',
    },
    {
      id: 'backlink',
      name: 'Backlink Checker',
      icon: Link,
      placeholder: 'Enter domain for backlinks',
    },
    {
      id: 'competitor',
      name: 'Competitor Analysis',
      icon: BarChart,
      placeholder: 'Enter competitor domain',
    },
    {
      id: 'audit',
      name: 'Site Audit',
      icon: FileText,
      placeholder: 'Enter domain to audit',
    },
    {
      id: 'serp',
      name: 'SERP Tracker',
      icon: TrendingUp,
      placeholder: 'Enter keyword to track',
    },
    // Social & Email (remaining)
    {
      id: 'email',
      name: 'Email Finder',
      icon: Mail,
      placeholder: 'Enter domain to find emails',
    },
    {
      id: 'username',
      name: 'Username Search',
      icon: Users,
      placeholder: 'Enter username',
    },
    // Security
    {
      id: 'ip',
      name: 'IP Lookup',
      icon: MapPin,
      placeholder: 'Enter IP address (e.g., 8.8.8.8)',
    },
    {
      id: 'port',
      name: 'Port Scanner',
      icon: Shield,
      placeholder: 'Enter IP or domain',
    },
    {
      id: 'vuln',
      name: 'Vulnerability Check',
      icon: Lock,
      placeholder: 'Enter domain to scan',
    },
  ];
  const activeTool = tools.find((t) => t.id === activeTab);

  // Tool-specific step guides
  const toolGuides = {
    'Domain Analysis': {
      description: 'Comprehensive domain intelligence gathering',
      steps: [
        { title: 'Enter Target Domain', instruction: 'Input the domain you want to analyze (e.g., example.com)', action: 'input' },
        { title: 'Fetch Domain Info', instruction: 'Retrieving registration date, registrar, and ownership details', action: 'auto' },
        { title: 'Analyze DNS Configuration', instruction: 'Checking A, AAAA, MX, TXT, and NS records', action: 'auto' },
        { title: 'Check Domain History', instruction: 'Looking up historical WHOIS data and ownership changes', action: 'auto' },
        { title: 'Generate Report', instruction: 'Compiling findings into actionable intelligence', action: 'auto' },
      ]
    },
    'WHOIS Lookup': {
      description: 'Domain registration and ownership information',
      steps: [
        { title: 'Enter Domain', instruction: 'Input the domain to lookup (e.g., example.com)', action: 'input' },
        { title: 'Query WHOIS Database', instruction: 'Connecting to regional WHOIS servers', action: 'auto' },
        { title: 'Parse Registration Data', instruction: 'Extracting registrant, admin, and tech contacts', action: 'auto' },
        { title: 'Check Privacy Protection', instruction: 'Identifying if WHOIS privacy is enabled', action: 'auto' },
        { title: 'Display Results', instruction: 'Presenting formatted registration details', action: 'auto' },
      ]
    },
    'DNS Records': {
      description: 'Complete DNS record enumeration',
      steps: [
        { title: 'Enter Domain', instruction: 'Input the domain to query', action: 'input' },
        { title: 'Query A/AAAA Records', instruction: 'Finding IPv4 and IPv6 addresses', action: 'auto' },
        { title: 'Query MX Records', instruction: 'Identifying mail servers and priorities', action: 'auto' },
        { title: 'Query TXT Records', instruction: 'Checking SPF, DKIM, and DMARC configurations', action: 'auto' },
        { title: 'Query NS Records', instruction: 'Listing authoritative nameservers', action: 'auto' },
      ]
    },
    'SSL Certificate': {
      description: 'SSL/TLS certificate analysis',
      steps: [
        { title: 'Enter Domain', instruction: 'Input the domain to check SSL for', action: 'input' },
        { title: 'Connect to Server', instruction: 'Establishing secure connection on port 443', action: 'auto' },
        { title: 'Retrieve Certificate', instruction: 'Downloading the SSL certificate chain', action: 'auto' },
        { title: 'Validate Certificate', instruction: 'Checking expiration, issuer, and trust chain', action: 'auto' },
        { title: 'Security Assessment', instruction: 'Analyzing cipher suites and vulnerabilities', action: 'auto' },
      ]
    },
    'Keyword Research': {
      description: 'SEO keyword discovery and analysis',
      steps: [
        { title: 'Enter Seed Keyword', instruction: 'Input your primary keyword or topic', action: 'input' },
        { title: 'Generate Variations', instruction: 'Finding related keywords and long-tail variations', action: 'auto' },
        { title: 'Analyze Search Volume', instruction: 'Checking monthly search volume and trends', action: 'auto' },
        { title: 'Assess Competition', instruction: 'Evaluating keyword difficulty and competition', action: 'auto' },
        { title: 'Rank Opportunities', instruction: 'Identifying high-value, low-competition keywords', action: 'auto' },
      ]
    },
    'Backlink Checker': {
      description: 'Analyze inbound link profiles',
      steps: [
        { title: 'Enter Domain/URL', instruction: 'Input the domain or page to analyze', action: 'input' },
        { title: 'Crawl Backlink Index', instruction: 'Querying backlink databases for referring domains', action: 'auto' },
        { title: 'Analyze Link Quality', instruction: 'Evaluating domain authority and trust scores', action: 'auto' },
        { title: 'Check Anchor Text', instruction: 'Analyzing anchor text distribution', action: 'auto' },
        { title: 'Identify Toxic Links', instruction: 'Flagging potentially harmful backlinks', action: 'auto' },
      ]
    },
    'Competitor Analysis': {
      description: 'Compare SEO metrics against competitors',
      steps: [
        { title: 'Enter Your Domain', instruction: 'Input your website domain', action: 'input' },
        { title: 'Identify Competitors', instruction: 'Finding top competing domains in your niche', action: 'auto' },
        { title: 'Compare Traffic', instruction: 'Analyzing estimated traffic and growth trends', action: 'auto' },
        { title: 'Keyword Gap Analysis', instruction: 'Finding keywords competitors rank for that you don\'t', action: 'auto' },
        { title: 'Generate Insights', instruction: 'Creating actionable competitive intelligence report', action: 'auto' },
      ]
    },
    'Site Audit': {
      description: 'Technical SEO health check',
      steps: [
        { title: 'Enter Website URL', instruction: 'Input the website to audit', action: 'input' },
        { title: 'Crawl Website', instruction: 'Scanning pages for technical issues', action: 'auto' },
        { title: 'Check Core Web Vitals', instruction: 'Measuring LCP, FID, and CLS scores', action: 'auto' },
        { title: 'Analyze On-Page SEO', instruction: 'Reviewing meta tags, headings, and content', action: 'auto' },
        { title: 'Generate Audit Report', instruction: 'Prioritizing issues by impact and effort', action: 'auto' },
      ]
    },
    'SERP Tracker': {
      description: 'Monitor search engine rankings',
      steps: [
        { title: 'Enter Keywords', instruction: 'Input keywords to track (comma separated)', action: 'input' },
        { title: 'Set Target Domain', instruction: 'Specify the domain to monitor rankings for', action: 'input' },
        { title: 'Check Current Rankings', instruction: 'Querying search engines for current positions', action: 'auto' },
        { title: 'Analyze SERP Features', instruction: 'Identifying featured snippets, PAA, and more', action: 'auto' },
        { title: 'Track Changes', instruction: 'Setting up ongoing rank monitoring', action: 'auto' },
      ]
    },
    'Social Monitoring': {
      description: 'Track social media mentions and sentiment',
      steps: [
        { title: 'Enter Brand/Keyword', instruction: 'Input the brand or topic to monitor', action: 'input' },
        { title: 'Scan Social Platforms', instruction: 'Searching Twitter, Reddit, Facebook, etc.', action: 'auto' },
        { title: 'Analyze Sentiment', instruction: 'Classifying mentions as positive, negative, or neutral', action: 'auto' },
        { title: 'Identify Influencers', instruction: 'Finding key voices discussing your topic', action: 'auto' },
        { title: 'Generate Alerts', instruction: 'Setting up real-time mention notifications', action: 'auto' },
      ]
    },
    'Email Finder': {
      description: 'Discover email addresses for domains',
      steps: [
        { title: 'Enter Domain', instruction: 'Input the company domain to search', action: 'input' },
        { title: 'Search Public Sources', instruction: 'Scanning websites, social profiles, and databases', action: 'auto' },
        { title: 'Pattern Detection', instruction: 'Identifying common email formats (first.last@, etc.)', action: 'auto' },
        { title: 'Verify Emails', instruction: 'Checking if discovered emails are deliverable', action: 'auto' },
        { title: 'Export Results', instruction: 'Compiling verified email list', action: 'auto' },
      ]
    },
    'Email Investigation': {
      description: 'Reverse email lookup and breach checking',
      steps: [
        { title: 'Enter Email Address', instruction: 'Input the email address to investigate', action: 'input' },
        { title: 'Validate Email', instruction: 'Checking email format and deliverability', action: 'auto' },
        { title: 'Search Data Breaches', instruction: 'Checking Have I Been Pwned and breach databases', action: 'auto' },
        { title: 'Find Associated Accounts', instruction: 'Discovering linked social media and online accounts', action: 'auto' },
        { title: 'Check Reputation', instruction: 'Analyzing spam reports and domain reputation', action: 'auto' },
        { title: 'Generate Report', instruction: 'Compiling findings into intelligence report', action: 'auto' },
      ]
    },
    'Phone Lookup': {
      description: 'Reverse phone number intelligence',
      steps: [
        { title: 'Enter Phone Number', instruction: 'Input the phone number with country code (e.g., +1 555-123-4567)', action: 'input' },
        { title: 'Identify Carrier', instruction: 'Determining mobile carrier and line type (mobile/landline/VoIP)', action: 'auto' },
        { title: 'Geolocate Number', instruction: 'Finding registered location and area information', action: 'auto' },
        { title: 'Search Public Records', instruction: 'Checking public directories and databases', action: 'auto' },
        { title: 'Find Linked Accounts', instruction: 'Discovering associated social media and messaging apps', action: 'auto' },
        { title: 'Check Spam Reports', instruction: 'Analyzing caller ID databases and spam reports', action: 'auto' },
        { title: 'Generate Report', instruction: 'Compiling phone intelligence summary', action: 'auto' },
      ]
    },
    'Username Search': {
      description: 'Find accounts across platforms',
      steps: [
        { title: 'Enter Username', instruction: 'Input the username to search for', action: 'input' },
        { title: 'Scan Platforms', instruction: 'Checking 200+ social networks and websites', action: 'auto' },
        { title: 'Verify Accounts', instruction: 'Confirming account existence and activity', action: 'auto' },
        { title: 'Gather Profile Data', instruction: 'Extracting bios, profile pics, and metadata', action: 'auto' },
        { title: 'Cross-Reference', instruction: 'Finding connections between accounts', action: 'auto' },
      ]
    },
    'IP Lookup': {
      description: 'Geolocation and ISP information',
      steps: [
        { title: 'Enter IP Address', instruction: 'Input the IP address to lookup', action: 'input' },
        { title: 'Geolocate IP', instruction: 'Determining country, city, and coordinates', action: 'auto' },
        { title: 'Identify ISP', instruction: 'Finding the internet service provider and ASN', action: 'auto' },
        { title: 'Check Blacklists', instruction: 'Scanning spam and threat databases', action: 'auto' },
        { title: 'Reverse DNS', instruction: 'Looking up associated hostnames', action: 'auto' },
      ]
    },
    'Port Scanner': {
      description: 'Check open ports and services',
      steps: [
        { title: 'Enter Target', instruction: 'Input IP address or hostname to scan', action: 'input' },
        { title: 'Select Port Range', instruction: 'Choose common ports or custom range', action: 'input' },
        { title: 'Scan Ports', instruction: 'Probing for open, closed, and filtered ports', action: 'auto' },
        { title: 'Service Detection', instruction: 'Identifying services running on open ports', action: 'auto' },
        { title: 'Security Assessment', instruction: 'Flagging potentially risky exposed services', action: 'auto' },
      ]
    },
    'Vulnerability Check': {
      description: 'Scan for security vulnerabilities',
      steps: [
        { title: 'Enter Target', instruction: 'Input domain or IP to scan', action: 'input' },
        { title: 'Fingerprint Technologies', instruction: 'Identifying web servers, CMS, and frameworks', action: 'auto' },
        { title: 'Check CVE Database', instruction: 'Matching detected versions against known vulnerabilities', action: 'auto' },
        { title: 'Test Common Exploits', instruction: 'Checking for misconfigurations and weaknesses', action: 'auto' },
        { title: 'Generate Report', instruction: 'Creating prioritized vulnerability report', action: 'auto' },
      ]
    },
  };

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;

    // If a tool is selected, start the expanded guided flow
    if (selectedTool && toolGuides[selectedTool]) {
      setIsExpanded(true);
      setCurrentStep(0);
      setCompletedSteps([]);
      runGuidedFlow();
    } else {
      // Regular AI response
      setIsAiLoading(true);
      setTimeout(() => {
        setAiResponse(`Here's what I found for "${aiQuery}":\n\nThis is a simulated response. Connect to your AI backend to get real OSINT/SEO analysis and recommendations.`);
        setIsAiLoading(false);
      }, 1500);
    }
  };

  const runGuidedFlow = () => {
    setIsAiLoading(true);
    // Simulate step-by-step progression
    let step = 0;
    const guide = toolGuides[selectedTool];

    const progressStep = () => {
      if (step < guide.steps.length) {
        setCurrentStep(step);
        setTimeout(() => {
          setCompletedSteps(prev => [...prev, step]);
          step++;
          if (step < guide.steps.length) {
            progressStep();
          } else {
            setIsAiLoading(false);
            setAiResponse(`Analysis complete for "${aiQuery}" using ${selectedTool}. All steps finished successfully.`);
          }
        }, 1200);
      }
    };

    setTimeout(progressStep, 500);
  };

  const handleToolSelect = (toolTitle) => {
    setSelectedTool(toolTitle);
    setAiQuery('');
    setIsExpanded(false);
    setCurrentStep(0);
    setCompletedSteps([]);
    setAiResponse('');
  };

  const closeExpanded = () => {
    setIsExpanded(false);
    setCurrentStep(0);
    setCompletedSteps([]);
    setAiResponse('');
  };

  // Bubble Animation Functions
  const createBubble = (x, y) => {
    const newBubble = {
      id: Date.now() + Math.random(),
      x,
      y,
      size: Math.random() * 60 + 20, // Random size between 20-80px
      speed: Math.random() * 2 + 1, // Random speed between 1-3
      drift: (Math.random() - 0.5) * 2, // Random horizontal drift
      opacity: 1,
    };
    setBubbles(prev => [...prev, newBubble]);

    // Remove bubble after animation completes (approximate time based on screen height)
    setTimeout(() => {
      setBubbles(prev => prev.filter(bubble => bubble.id !== newBubble.id));
    }, 5000); // 5 seconds to rise off screen
  };

  const handleScreenClick = (e) => {
    // Create bubble at click position
    createBubble(e.clientX, window.innerHeight - 50); // Start from near bottom
  };

  // Animation loop for bubbles
  useEffect(() => {
    const animateBubbles = () => {
      setBubbles(prev =>
        prev.map(bubble => ({
          ...bubble,
          y: bubble.y - bubble.speed,
          x: bubble.x + bubble.drift,
          opacity: bubble.y < window.innerHeight * 0.2 ? bubble.opacity * 0.97 : bubble.opacity // Fade out near top
        })).filter(bubble => bubble.y > -100) // Remove bubbles that go off screen
      );
    };

    const interval = setInterval(animateBubbles, 16); // ~60fps
    return () => clearInterval(interval);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();

    // Check usage limit (3 free uses)
    if (usageCount >= 3) {
      setShowAdModal(true);
      return;
    }

    setIsSearching(true);

    // Increment usage count
    const newCount = usageCount + 1;
    setUsageCount(newCount);
    localStorage.setItem('osint_usage_global', newCount.toString());

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // Map tool tabs to OSINT proxy endpoints
    const osintEndpoints = {
      phone: { url: '/api/osint-tools/analyze/phone', body: { phone: searchValue } },
      social: { url: '/api/osint-tools/analyze/username', body: { username: searchValue } },
      username: { url: '/api/osint-tools/analyze/username', body: { username: searchValue } },
      'email-investigate': { url: '/api/osint-tools/analyze/text', body: { text: searchValue } },
    };

    const endpoint = osintEndpoints[activeTab];

    if (endpoint && token) {
      try {
        const response = await fetch(`${backendUrl}${endpoint.url}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(endpoint.body),
        });
        const data = await response.json();
        if (data.success) {
          setResults({ query: searchValue, type: activeTab, data: data.data?.results || data.data || {} });
        } else {
          setResults({ query: searchValue, type: activeTab, data: { error: data.error || 'Analysis failed' } });
        }
      } catch (error) {
        setResults({ query: searchValue, type: activeTab, data: { error: 'OSINT service unavailable. Showing demo data.', ...getMockResults(activeTab, searchValue) } });
      }
    } else {
      // Fallback to mock data for tools without OSINT backend or unauthenticated users
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setResults({ query: searchValue, type: activeTab, data: getMockResults(activeTab, searchValue) });
    }

    setIsSearching(false);
  };

  const getMockResults = (type, query) => {
    switch (type) {
      case 'ip':
        return {
          location: 'Mountain View, California, US',
          isp: 'Google LLC',
          asn: 'AS15169',
          threat_score: 'Low',
          vpn: false,
          proxy: false,
        };
      case 'domain':
        return {
          registrar: 'GoDaddy',
          created: '2023-01-15',
          ssl: 'Valid',
          dns_records: ['A', 'AAAA', 'MX', 'TXT'],
          risk_score: 'Low',
        };
      case 'email':
        return {
          emails_found: 12,
          pattern_detected: 'first.last@domain.com',
          confidence: 'High',
          verified_count: 8,
        };
      case 'email-investigate':
        return {
          valid: true,
          disposable: false,
          domain_reputation: 'Good',
          breaches_found: 2,
          breach_names: 'LinkedIn (2021), Adobe (2013)',
          associated_accounts: 'Twitter, GitHub, LinkedIn',
          spam_reports: 0,
          first_seen: '2015-03-22',
        };
      case 'phone':
        return {
          carrier: 'AT&T Mobility',
          line_type: 'Mobile',
          country: 'United States',
          region: 'California',
          valid: true,
          spam_score: 'Low',
          linked_apps: 'WhatsApp, Telegram',
          registered_name: 'J*** D***',
        };
      case 'social':
        return {
          platforms_found: 8,
          platforms: 'Twitter, Instagram, LinkedIn, GitHub, Reddit',
          total_followers: '12.4K',
          engagement_rate: '3.2%',
          sentiment: 'Mostly Positive',
          recent_activity: '2 hours ago',
          verified_accounts: 2,
        };
      default:
        return {};
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-y-auto bg-gradient-to-br from-[#000010] via-[#001030] to-[#000510]"
      onClick={handleScreenClick}
    >
      {/* Deep Sea Background */}
      <div className="fixed inset-0 z-0">
        <DeepSeaEnhanced />
      </div>
      {/* Light Rays Overlay */}
      <div className="fixed inset-0 z-[1]">
        <LightRays
          raysOrigin="top-center"
          raysColor="#1983FF"
          raysSpeed={0.6}
          lightSpread={1.5}
          rayLength={3}
          fadeDistance={2}
          saturation={1.5}
          mouseInfluence={0.5}
          noiseAmount={0}
          distortion={0}
          pulsating
        />
      </div>

      {/* Rising Bubbles */}
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className="fixed rounded-full pointer-events-none z-[2]"
          style={{
            left: `${bubble.x}px`,
            top: `${bubble.y}px`,
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            background: `radial-gradient(circle at 30% 30%, rgba(25, 131, 255, ${bubble.opacity}), rgba(0, 80, 255, ${bubble.opacity * 0.7}))`,
            boxShadow: `0 0 ${bubble.size/3}px rgba(25, 131, 255, ${bubble.opacity * 0.5})`,
            transform: 'translate(-50%, -50%)',
            opacity: bubble.opacity,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 min-h-screen p-6">
        {/* Top Navigation Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto mb-6 flex items-center justify-between"
        >
          <button
            onClick={() => navigate('/search-results')}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Search</span>
          </button>

          <button
            onClick={() => navigate('/osint/tools')}
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20"
          >
            <span>Back to OSINT & SEO Tools</span>
            <ArrowLeft size={20} className="rotate-180" />
          </button>
        </motion.div>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-6"
        >
          <button onClick={() => navigate('/')} className="inline-block">
            <TruegleLogo size="large" animated={true} />
          </button>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="max-w-6xl mx-auto mb-8"
        >
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/50">
              <Eye size={32} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-4xl font-display font-bold text-white mb-2">
                OSINT Mode
              </h1>
              <p className="text-cyan-400">
                Deep dive into digital intelligence
              </p>
            </div>
          </div>
        </motion.div>

        {/* Ad Banner - Below OSINT Mode Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="max-w-6xl mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.5),0_0_50px_rgba(255,193,7,0.3)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.375] hover:to-[#FFC107]/[0.375]"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-yellow-200 mb-1">Sponsored</div>
              <div className="text-sm font-semibold text-white">
                OSINT Pro Tools Suite
              </div>
              <div className="text-xs text-white/90">
                Advanced investigation tools for professionals
              </div>
            </div>
            <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/25">
              Learn More
            </button>
          </div>
        </motion.div>


        {/* Search Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-6xl mx-auto mb-8"
        >
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 border-cyan-500/50 hover:border-[3px] hover:border-cyan-400 transition-all duration-300 hover:shadow-[0_0_40px_rgba(6,182,212,0.6),0_0_80px_rgba(6,182,212,0.3)]">
            <form onSubmit={handleSearch}>
              <div className="flex items-center gap-3 mb-4">
                {activeTool && (
                  <activeTool.icon className="text-cyan-400" size={24} />
                )}
                <h2 className="text-xl font-display font-bold text-white">
                  {activeTool?.name}
                </h2>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-white/60">
                  Free uses remaining:{' '}
                  <span
                    className={`font-bold ${usageCount >= 3 ? 'text-red-400' : 'text-cyan-400'}`}
                  >
                    {Math.max(0, 3 - usageCount)}/3
                  </span>
                </div>
                {usageCount >= 3 && (
                  <button
                    type="button"
                    onClick={() => setShowPremiumModal(true)}
                    className="text-sm px-3 py-1 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-400 hover:to-red-400 transition-all"
                  >
                    Upgrade for Unlimited
                  </button>
                )}
              </div>

              <div className="relative group mb-4">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur opacity-20 group-hover:opacity-30 group-focus-within:opacity-40 transition duration-300"></div>

                <div className="relative bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-1">
                  <div className="flex items-center gap-2 p-2">
                    <Search className="text-cyan-400 ml-2" size={20} />
                    <input
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder={activeTool?.placeholder}
                      className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm font-body outline-none px-2"
                    />
                    <button
                      type="submit"
                      disabled={!searchValue || isSearching}
                      className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-lg shadow-cyan-500/20"
                    >
                      {isSearching ? 'Searching...' : 'Investigate'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-cyan-400/60">
                <Shield size={14} />
                <span>All lookups are anonymous and encrypted</span>
              </div>
            </form>
          </div>
        </motion.div>

        {/* Ad Banner - Below Tool Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="max-w-6xl mx-auto mb-8 p-4 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.5),0_0_50px_rgba(255,193,7,0.3)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.375] hover:to-[#FFC107]/[0.375]"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-yellow-200 mb-1">Sponsored</div>
              <div className="text-sm font-semibold text-white">
                Digital Security Training
              </div>
              <div className="text-xs text-white/90">
                Learn professional OSINT techniques
              </div>
            </div>
            <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/25">
              Start Free
            </button>
          </div>
        </motion.div>

        {/* OSINT/SEO AI Assistant */}
        <div className="max-w-6xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            layout
            className="bg-gradient-to-br from-[#0a1628]/95 to-[#0d2137]/95 border-2 border-cyan-500/50 rounded-2xl p-6 backdrop-blur-xl shadow-lg shadow-cyan-500/20"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <Bot size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">OSINT/SEO AI Assistant</h3>
                  <p className="text-sm text-cyan-400/80">
                    {selectedTool ? toolGuides[selectedTool]?.description : 'Select a tool or ask anything'}
                  </p>
                </div>
              </div>
              {isExpanded && (
                <button
                  onClick={closeExpanded}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              )}
            </div>

            {/* Selected Tool Badge */}
            {selectedTool && !isExpanded && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-2"
              >
                <span className="text-xs text-gray-400">Selected tool:</span>
                <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 text-sm font-medium flex items-center gap-2">
                  {tools.find(t => t.name === selectedTool)?.icon && (
                    React.createElement(tools.find(t => t.name === selectedTool).icon, { size: 14 })
                  )}
                  {selectedTool}
                  <button
                    onClick={() => setSelectedTool(null)}
                    className="ml-1 hover:text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              </motion.div>
            )}

            {/* Input Form */}
            {!isExpanded && (
              <form onSubmit={handleAiSubmit} className="mb-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder={selectedTool
                      ? `Enter target for ${selectedTool}...`
                      : "e.g., Analyze SEO for example.com, Find backlinks, WHOIS lookup..."}
                    className="flex-1 bg-black/40 border border-cyan-500/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isAiLoading || !aiQuery.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl text-white font-semibold hover:from-cyan-400 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-cyan-500/25"
                  >
                    {selectedTool ? <ArrowRight size={20} /> : <Send size={20} />}
                  </button>
                </div>
              </form>
            )}

            {/* Expanded Step-by-Step Interface */}
            {isExpanded && selectedTool && toolGuides[selectedTool] && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4"
              >
                {/* Progress Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded-lg">
                      <span className="text-cyan-300 text-sm font-medium">{selectedTool}</span>
                    </div>
                    <ArrowRight size={16} className="text-gray-500" />
                    <span className="text-white font-medium">{aiQuery}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {completedSteps.length}/{toolGuides[selectedTool].steps.length} steps
                  </div>
                </div>

                {/* Steps List */}
                <div className="space-y-3">
                  {toolGuides[selectedTool].steps.map((step, index) => {
                    const isCompleted = completedSteps.includes(index);
                    const isCurrent = currentStep === index && !isCompleted;
                    const isPending = index > currentStep && !isCompleted;

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-xl border transition-all ${
                          isCompleted
                            ? 'bg-green-500/10 border-green-500/30'
                            : isCurrent
                            ? 'bg-cyan-500/20 border-cyan-400 shadow-lg shadow-cyan-500/20'
                            : 'bg-black/20 border-gray-700/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Step Icon */}
                          <div className={`mt-0.5 ${
                            isCompleted ? 'text-green-400' : isCurrent ? 'text-cyan-400' : 'text-gray-500'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle2 size={20} />
                            ) : isCurrent ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              >
                                <Sparkles size={20} />
                              </motion.div>
                            ) : (
                              <Circle size={20} />
                            )}
                          </div>

                          {/* Step Content */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isCompleted
                                  ? 'bg-green-500/20 text-green-400'
                                  : isCurrent
                                  ? 'bg-cyan-500/20 text-cyan-400'
                                  : 'bg-gray-700/50 text-gray-500'
                              }`}>
                                Step {index + 1}
                              </span>
                              {step.action === 'input' && (
                                <span className="text-xs text-yellow-400/70">User Input</span>
                              )}
                            </div>
                            <h4 className={`font-semibold mb-1 ${
                              isCompleted ? 'text-green-300' : isCurrent ? 'text-white' : 'text-gray-400'
                            }`}>
                              {step.title}
                            </h4>
                            <p className={`text-sm ${
                              isCompleted ? 'text-green-400/70' : isCurrent ? 'text-cyan-400/80' : 'text-gray-500'
                            }`}>
                              {step.instruction}
                            </p>

                            {/* Progress bar for current step */}
                            {isCurrent && (
                              <div className="mt-3 h-1 bg-gray-700 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                                  initial={{ width: '0%' }}
                                  animate={{ width: '100%' }}
                                  transition={{ duration: 1.2, ease: 'linear' }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Completion Message */}
                {!isAiLoading && completedSteps.length === toolGuides[selectedTool].steps.length && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-gradient-to-r from-green-500/20 to-cyan-500/20 border border-green-500/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle2 size={24} className="text-green-400" />
                      <span className="text-lg font-bold text-white">Analysis Complete</span>
                    </div>
                    <p className="text-sm text-gray-300">{aiResponse}</p>
                    <button
                      onClick={closeExpanded}
                      className="mt-4 px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-300 text-sm hover:bg-cyan-500/30 transition-all"
                    >
                      Start New Analysis
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Tool Selector - Scrollable */}
            {!isExpanded && (
              <div className="overflow-x-auto scrollbar-hide -mx-2 px-2">
                <div className="flex gap-2 pb-2" style={{ minWidth: 'max-content' }}>
                  {tools.map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => handleToolSelect(tool.name)}
                      className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl border transition-all whitespace-nowrap ${
                        selectedTool === tool.name
                          ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300'
                          : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400'
                      }`}
                    >
                      <tool.icon size={14} />
                      {tool.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Simple AI Response (when no tool selected) */}
            {!isExpanded && (aiResponse || isAiLoading) && !selectedTool && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 pt-4 border-t border-cyan-500/20"
              >
                {isAiLoading ? (
                  <div className="flex items-center gap-3 text-cyan-400">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Sparkles size={20} />
                    </motion.div>
                    <span>Analyzing...</span>
                  </div>
                ) : (
                  <div className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                    {aiResponse}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Results */}
        <AnimatePresence>
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto"
            >
              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 border-cyan-500/50 shadow-[0_0_40px_rgba(6,182,212,0.3)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Database size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold text-white">
                      Investigation Results
                    </h3>
                    <p className="text-sm text-cyan-400">
                      Query: {results.query}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(results.data).map(([key, value]) => (
                    <div
                      key={key}
                      className="p-4 rounded-xl bg-black/30 border border-cyan-500/20"
                    >
                      <div className="text-xs text-cyan-400/60 uppercase tracking-wider mb-1">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-white font-semibold">
                        {typeof value === 'boolean'
                          ? value
                            ? '✓ Yes'
                            : '✗ No'
                          : value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <p className="text-sm text-cyan-400">
                    ℹ️ This is a demo with simulated data. In production, this
                    would connect to real OSINT APIs like VirusTotal, IPinfo,
                    Hunter.io, etc.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Watch Ad Modal */}
      <AnimatePresence>
        {showAdModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAdModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-md w-full p-6 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="text-yellow-200 text-sm mb-2">
                  Free Uses Exhausted
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Watch an Ad
                </h3>
                <p className="text-white/90">
                  Get 3 more free uses by watching a 30-second ad
                </p>
              </div>

              <div className="bg-black/30 rounded-xl p-8 mb-6 text-center">
                <div className="text-6xl font-bold text-white mb-2">
                  {adCountdown}
                </div>
                <div className="text-white/80">seconds remaining</div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all"
                >
                  Skip - Go Premium
                </button>
                <button
                  onClick={() => {
                    setShowAdModal(false);
                    // Reset usage count
                    setUsageCount(0);
                    localStorage.setItem('osint_usage_global', '0');
                    setAdCountdown(30); // Reset for next time
                  }}
                  disabled={adCountdown > 0}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                    adCountdown > 0
                      ? 'bg-gray-500/50 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-400 hover:to-red-400'
                  }`}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Modal */}
      <AnimatePresence>
        {showPremiumModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPremiumModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-md w-full p-6 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="text-yellow-200 text-sm mb-2">Upgrade Now</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Truegle Premium
                </h3>
                <p className="text-white/90 mb-4">
                  Unlimited OSINT tool access
                </p>
                <div className="text-4xl font-bold text-white">
                  $9.99<span className="text-lg text-white/70">/month</span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-sm">
                    ✓
                  </div>
                  <span>Unlimited tool uses</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-sm">
                    ✓
                  </div>
                  <span>Ad-free experience</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-sm">
                    ✓
                  </div>
                  <span>Priority support</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-sm">
                    ✓
                  </div>
                  <span>Advanced filters</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPremiumModal(false);
                    setShowAdModal(true);
                    setAdCountdown(30); // Reset countdown
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all"
                >
                  Watch Ad for 3 Uses
                </button>
                <button
                  onClick={() => alert('Premium checkout coming soon!')}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold hover:from-orange-400 hover:to-red-400 transition-all"
                >
                  Upgrade Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
