import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DeepSeaEnhanced from '../components/backgrounds/DeepSeaEnhanced';
import LightRays from '../components/backgrounds/LightRays';
import ShareForPremiumButton from '../components/ui/ShareForPremiumButton';
import { motion } from 'framer-motion';
import {
  Globe,
  Link,
  Search,
  BarChart,
  FileText,
  TrendingUp,
  Users,
  Mail,
  MapPin,
  Shield,
  Lock,
  Zap,
  Sparkles,
  Send,
  Bot,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  X,
  Phone,
  AtSign,
} from 'lucide-react';
import TruegleLogo from '../components/ui/TruegleLogo';
import ToolCard from '../components/ui/ToolCard';
import NeonButton from '../components/ui/NeonButton';
import { useToast } from '../components/ui/ToastProvider';

export default function OSINTTools() {
  const navigate = useNavigate();
  const toast = useToast();
  const [usesRemaining, setUsesRemaining] = useState(3);
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Show welcome modal on first visit
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('truegle_osint_welcome_seen');
    if (!hasSeenWelcome && !isPremium) {
      setShowWelcomeModal(true);
    }
  }, [isPremium]);

  const handleSkipWelcome = () => {
    setShowWelcomeModal(false);
    localStorage.setItem('truegle_osint_welcome_seen', 'true');
  };

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
        setAiResponse(`Here's what I found for "${aiQuery}":\n\nThis is a simulated response. Connect to the Truegle Smart backend to get real OSINT/SEO analysis and recommendations.`);
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
    toast.info('Tool Selected', `${toolTitle} tool is ready to use`, { pageTheme: 'osint' });
  };

  const closeExpanded = () => {
    setIsExpanded(false);
    setCurrentStep(0);
    setCompletedSteps([]);
    setAiResponse('');
  };

  const handleToolUse = (toolName) => {
    if (isPremium) {
      toast.success('Tool Activated', `${toolName} is now active (Premium Unlimited)`, { pageTheme: 'osint' });
      console.log(`Using ${toolName} (Premium - Unlimited)`);
      return;
    }

    if (usesRemaining > 0) {
      setUsesRemaining(usesRemaining - 1);
      toast.success('Tool Used', `${toolName} completed. ${usesRemaining - 1} uses remaining.`, { pageTheme: 'osint' });
      console.log(`Using ${toolName}. ${usesRemaining - 1} uses remaining.`);
    } else {
      toast.warning('No Uses Remaining', 'Upgrade to continue using tools', { pageTheme: 'osint' });
      setShowUpgradeModal(true);
    }
  };

  const tools = [
    {
      category: 'Top Tools',
      items: [
        {
          title: 'Social Monitoring',
          description: 'Track social mentions',
          icon: Users,
        },
        {
          title: 'Phone Lookup',
          description: 'Reverse phone number search',
          icon: Phone,
        },
        {
          title: 'Email Investigation',
          description: 'Reverse email lookup & breach check',
          icon: AtSign,
        },
      ],
    },
    {
      category: 'Social & Email',
      items: [
        {
          title: 'Email Finder',
          description: 'Discover email addresses',
          icon: Mail,
        },
        {
          title: 'Username Search',
          description: 'Find accounts across platforms',
          icon: Users,
        },
      ],
    },
    {
      category: 'SEO Analytics',
      items: [
        {
          title: 'Keyword Research',
          description: 'Find high-value keywords',
          icon: Search,
        },
        {
          title: 'Backlink Checker',
          description: 'Analyze backlink profiles',
          icon: Link,
        },
        {
          title: 'Competitor Analysis',
          description: 'Compare against competitors',
          icon: BarChart,
        },
        {
          title: 'Site Audit',
          description: 'SEO health check',
          icon: FileText,
        },
        {
          title: 'SERP Tracker',
          description: 'Monitor rankings',
          icon: TrendingUp,
        },
      ],
    },
    {
      category: 'Domain Intelligence',
      items: [
        {
          title: 'Domain Analysis',
          description: 'Deep dive into domain history and metrics',
          icon: Globe,
        },
        {
          title: 'WHOIS Lookup',
          description: 'Get registration information',
          icon: FileText,
        },
        {
          title: 'DNS Records',
          description: 'View all DNS records',
          icon: Search,
        },
        {
          title: 'SSL Certificate',
          description: 'Check certificate details',
          icon: Shield,
        },
      ],
    },
    {
      category: 'Security',
      items: [
        {
          title: 'IP Lookup',
          description: 'Geolocation and ISP info',
          icon: MapPin,
        },
        {
          title: 'Port Scanner',
          description: 'Check open ports',
          icon: Shield,
        },
        {
          title: 'Vulnerability Check',
          description: 'Scan for security issues',
          icon: Lock,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4 md:p-8">
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
      {/* Dark overlay for readability */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[2]" />
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Back to Search Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/search-results')}
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors mb-6 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Search</span>
        </motion.button>

        <div className="flex justify-center mb-8">
          <button onClick={() => navigate('/')} className="inline-block">
            <TruegleLogo size="large" animated={true} />
          </button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400">
              OSINT & SEO Tools
            </span>
          </h1>
          <p className="text-xl text-gray-400">
            Professional research and analysis tools
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-8">
          {isPremium ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border-2 border-purple-500 rounded-xl p-4 backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="text-purple-400" size={28} />
                  <div>
                    <p className="text-purple-400 font-bold text-lg">
                      Premium Member
                    </p>
                    <p className="text-gray-400 text-sm">
                      Unlimited usage + VPN included
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-yellow-500/10 border-2 border-yellow-500 rounded-xl p-4 backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-400 font-bold text-lg">
                    {usesRemaining}/3 Free Uses Remaining
                  </p>
                  <p className="text-gray-400 text-sm">
                    Watch an ad for 3 more uses, or upgrade for unlimited
                  </p>
                </div>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  Upgrade
                </NeonButton>
              </div>
            </motion.div>
          )}
        </div>

        {/* OSINT/SEO AI Assistant */}
        <div className="max-w-2xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
                  <h3 className="text-xl font-bold text-white">OSINT/SEO Smart Assistant</h3>
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
                  {tools.flatMap(c => c.items).find(t => t.title === selectedTool)?.icon && (
                    React.createElement(tools.flatMap(c => c.items).find(t => t.title === selectedTool).icon, { size: 14 })
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
                  {tools.flatMap((category) =>
                    category.items.map((tool) => (
                      <button
                        key={tool.title}
                        onClick={() => handleToolSelect(tool.title)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl border transition-all whitespace-nowrap ${
                          selectedTool === tool.title
                            ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300'
                            : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400'
                        }`}
                      >
                        <tool.icon size={14} />
                        {tool.title}
                      </button>
                    ))
                  )}
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

        {tools.map((category, catIndex) => (
          <div key={catIndex}>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-cyan-400 mb-6">
                {category.category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.items.map((tool, toolIndex) => (
                  <ToolCard
                    key={toolIndex}
                    title={tool.title}
                    description={tool.description}
                    icon={<tool.icon size={24} className="text-white" />}
                    onClick={() => navigate('/osint')}
                    usesRemaining={isPremium ? null : usesRemaining}
                    isPremium={isPremium}
                  />
                ))}
              </div>
            </div>

            {/* Ad Container - Only show for freemium users, not after last category */}
            {!isPremium && catIndex < tools.length - 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-12 p-5 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.15] to-[#FFC107]/[0.15] backdrop-blur-xl border-2 border-yellow-400/40 shadow-lg shadow-yellow-400/20 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.4),0_0_50px_rgba(255,193,7,0.2)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.25] hover:to-[#FFC107]/[0.25]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-xs text-yellow-200/80 mb-1">Sponsored</div>
                    <div className="text-base font-semibold text-white mb-1">
                      {catIndex === 0 && 'Upgrade to Premium - Remove All Ads'}
                      {catIndex === 1 && 'Professional OSINT Training Course'}
                      {catIndex === 2 && 'Enterprise SEO Analytics Suite'}
                      {catIndex === 3 && 'Advanced Security Monitoring Tools'}
                    </div>
                    <div className="text-sm text-white/70">
                      {catIndex === 0 && 'Get unlimited tool access and an ad-free experience'}
                      {catIndex === 1 && 'Learn advanced intelligence gathering techniques'}
                      {catIndex === 2 && 'Track rankings, backlinks, and competitors at scale'}
                      {catIndex === 3 && 'Real-time threat detection and vulnerability scanning'}
                    </div>
                  </div>
                  <button className="ml-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/25">
                    {catIndex === 0 ? 'Upgrade Now' : 'Learn More'}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        ))}

        {/* Welcome Modal - First Visit */}
        {showWelcomeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-gradient-to-br from-[#0a1628] to-[#0d2137] border-2 border-cyan-500 rounded-2xl p-8 max-w-lg w-full shadow-2xl shadow-cyan-500/30"
            >
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/40">
                  <Zap size={40} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  OSINT & SEO Tools
                </h2>
                <div className="inline-block px-4 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-full">
                  <span className="text-yellow-400 text-sm font-semibold">Premium Feature</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-300 text-center mb-6 leading-relaxed">
                Access professional-grade intelligence gathering and SEO analysis tools.
                This is a premium feature, but you start with <span className="text-cyan-400 font-semibold">3 free tool uses</span>.
              </p>

              {/* All Tools List */}
              <div className="mb-6 max-h-48 overflow-y-auto scrollbar-hide">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {tools.flatMap((category) =>
                    category.items.map((tool) => (
                      <div key={tool.title} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-cyan-500/10 transition-colors">
                        <tool.icon size={14} className="text-cyan-400 flex-shrink-0" />
                        <span className="text-sm text-gray-300 truncate">{tool.title}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowWelcomeModal(false);
                    setIsPremium(true);
                    localStorage.setItem('truegle_osint_welcome_seen', 'true');
                  }}
                  className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl text-white font-bold text-lg hover:from-yellow-400 hover:to-orange-400 transition-all shadow-lg shadow-yellow-500/25"
                >
                  Upgrade to Premium - Unlimited Access
                </button>
              </div>

              {/* Skip Option */}
              <button
                onClick={handleSkipWelcome}
                className="w-full mt-4 text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                Maybe later - just browsing
              </button>
            </motion.div>
          </motion.div>
        )}

        {showUpgradeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowUpgradeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border-2 border-cyan-500 rounded-2xl p-8 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-white mb-4">
                {usesRemaining === 0 ? 'Out of Free Uses' : 'Unlock More Tools'}
              </h3>

              {usesRemaining === 0 ? (
                <>
                  <p className="text-gray-400 mb-6">
                    Choose an option to continue:
                  </p>

                  {/* Share for Premium Day Button */}
                  <div className="mb-4">
                    <ShareForPremiumButton
                      variant="compact"
                      onPremiumGranted={() => {
                        setIsPremium(true);
                        setShowUpgradeModal(false);
                        setUsesRemaining(null);
                      }}
                    />
                  </div>

                  {/* Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setIsPremium(true);
                        setShowUpgradeModal(false);
                      }}
                      className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-semibold py-4 rounded-xl hover:shadow-lg transition-all"
                    >
                      Upgrade to Premium
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-400 mb-6">
                    Get unlimited access to all tools
                  </p>
                  <NeonButton
                    variant="primary"
                    className="w-full"
                    onClick={() => {
                      setIsPremium(true);
                      setShowUpgradeModal(false);
                    }}
                  >
                    Upgrade Now
                  </NeonButton>
                </>
              )}
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full mt-4 text-gray-400 hover:text-white"
              >
                Maybe Later
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
