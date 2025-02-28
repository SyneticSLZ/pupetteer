

const puppeteer = require("puppeteer");
require("dotenv").config();

// Enhanced regex patterns - stored as strings to pass through evaluate()
const PATTERNS = {
  // Enhanced phone pattern to catch more formats including international
  phone: '(?:\\+?\\d{1,4}[-. ]?)?(?:\\(?([0-9]{3})\\)?[-. ]?)?([0-9]{3})[-. ]?([0-9]{4})|(?:\\+?\\d{1,4}[-. ]?)?\\d{2,4}[-. ]?\\d{2,4}[-. ]?\\d{2,4}',
  email: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
  numbers: '(?:\\$\\s*)?(\\d+(?:,\\d{3})*(?:\\.\\d+)?)\\s*(?:thousand|million|billion|k|m|b)?(?:\\s*\\+)?',
  percentages: '(\\d+(?:\\.\\d+)?)\\s*%',
  employeeCount: '(\\d+(?:\\+|\\s*-\\s*\\d+)?)\\s*(?:employees|team members|people|staff)',
  customerCount: '(\\d+(?:\\+|\\s*-\\s*\\d+)?)\\s*(?:customers|clients|users|businesses)',
  revenue: '(?:revenue|arr|mrr).{0,30}?\\$?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:k|m|b|million|billion)?',
  yearFounded: '(?:founded|established|since)\\s*(?:in)?\\s*(\\d{4})',
  companyAge: '(\\d+)\\+?\\s*(?:years|yrs)(?:\\s*of\\s*experience|\\s*in\\s*business)'
};


const CONTACT_PATTERNS = {
  // Phone patterns for different formats
  phones: {
    international: /\+\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    us: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    extension: /(?:ext|x|extension)\.?\s*\d{1,5}/gi,
    uk: /(?:\+?44|0)[-.\s]?\d{2,5}[-.\s]?\d{6,8}/g,
    generic: /\b\d{8,14}\b/g
  },
  
  // Email patterns
  emails: {
    standard: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    generic: /(?:[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    obfuscated: /\b[a-zA-Z0-9._%+-]+\s*(?:\[at\]|\(at\)|\[@\]|@)\s*[a-zA-Z0-9.-]+\s*(?:\[dot\]|\(dot\)|\.)\s*[a-zA-Z]{2,}\b/gi
  },

  // Social media patterns
  social: {
    linkedin: /(?:linkedin\.com\/(?:company\/|in\/|profile\/)?[a-zA-Z0-9-]+)/gi,
    twitter: /(?:twitter\.com\/[a-zA-Z0-9_]+)/gi,
    facebook: /(?:facebook\.com\/(?:pages\/)?[a-zA-Z0-9.-]+)/gi,
    instagram: /(?:instagram\.com\/[a-zA-Z0-9_]+)/gi
  },

  // Address patterns
  address: {
    poBox: /P\.?O\.?\s*Box\s+\d+/gi,
    zipCode: /\b\d{5}(?:-\d{4})?\b/g,
    street: /\d+\s+[a-zA-Z0-9\s,]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|circle|cir|way|parkway|pkwy)\b/gi
  }
};

// Contact information validator and formatter
const ContactValidator = {
  cleanPhone: (phone) => {
    return phone.replace(/[^\d+]/g, '')
      .replace(/^00/, '+')
      .replace(/^(\d{1,3})(\d{3})(\d{3})(\d{4})$/, '+$1 $2 $3 $4');
  },

  isValidPhone: (phone) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  },

  cleanEmail: (email) => {
    return email.toLowerCase()
      .replace(/\s*\[at\]\s*|\s*\(at\)\s*/i, '@')
      .replace(/\s*\[dot\]\s*|\s*\(dot\)\s*/i, '.');
  },

  isValidEmail: (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  formatAddress: (address) => {
    return address.replace(/\s+/g, ' ').trim();
  }
};

// Enhanced business categories
const BUSINESS_CATEGORIES = {
  industries: {
    saas: ['software', 'saas', 'cloud', 'platform', 'automation', 'api'],
    martech: ['email marketing', 'marketing automation', 'campaign', 'leads', 'crm'],
    fintech: ['payment', 'banking', 'financial', 'crypto', 'blockchain', 'trading'],
    ecommerce: ['shop', 'store', 'retail', 'commerce', 'marketplace'],
    healthcare: ['health', 'medical', 'wellness', 'patient', 'clinical'],
    education: ['learning', 'education', 'training', 'course', 'teach'],
    manufacturing: ['manufacturing', 'factory', 'production', 'industrial'],
    logistics: ['shipping', 'delivery', 'logistics', 'supply chain', 'warehouse']
  },
  businessModel: {
    b2b: ['business to business', 'b2b', 'enterprise', 'corporate'],
    b2c: ['consumer', 'b2c', 'retail', 'personal'],
    marketplace: ['marketplace', 'platform', 'connect buyers sellers'],
    subscription: ['subscription', 'monthly', 'yearly', 'recurring'],
    transactional: ['pay per use', 'commission', 'transaction fee']
  },
  features: {
    automation: ['automated', 'automation', 'workflow', 'streamline', 'no-code'],
    integration: ['integration', 'api', 'connect', 'seamless', 'sync'],
    analytics: ['analytics', 'tracking', 'metrics', 'dashboard', 'reports'],
    customization: ['personalization', 'customize', 'tailored', 'flexible'],
    security: ['security', 'encryption', 'compliance', 'protection'],
    collaboration: ['team', 'sharing', 'collaborate', 'real-time'],
    ai: ['ai', 'machine learning', 'predictive', 'intelligent', 'neural']
  }
};

// Enhanced pain point indicators
const PAIN_POINT_INDICATORS = {
  technical: {
    performance: ['slow', 'crashes', 'bugs', 'downtime', 'latency'],
    integration: ['difficult to integrate', 'complex setup', 'technical issues'],
    usability: ['complicated', 'confusing', 'hard to use', 'steep learning curve']
  },
  business: {
    cost: ['expensive', 'costly', 'price', 'budget', 'roi'],
    support: ['poor support', 'unresponsive', 'limited help'],
    scaling: ['scaling issues', 'growing pains', 'limitations']
  },
  market: {
    competition: ['competitive', 'market leader', 'alternative to'],
    regulation: ['compliant', 'gdpr', 'hipaa', 'regulatory'],
    adoption: ['adoption challenges', 'change management', 'user adoption']
  }
};

const handleScrapeRequest = async (req, res) => {
  const url = req.query.url || req.body.url;
  
  if (!url) {
    return res.status(400).send({
      status: 'error',
      message: 'URL is required'
    });
  }

  await scrapeWebsite(url, res);
};


const scrapeWebsite = async (url, res) => {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 30000 
    });

        // Extract contact information
        const contactInfo = await extractContactInfo(page);

        // Clean and validate contact information
        const cleanedData = {
          phones: contactInfo.phones
            .map(phone => ContactValidator.cleanPhone(phone))
            .filter(phone => ContactValidator.isValidPhone(phone)),
          
          emails: contactInfo.emails
            .map(email => ContactValidator.cleanEmail(email))
            .filter(email => ContactValidator.isValidEmail(email)),
          
          social: contactInfo.social,
          
          addresses: contactInfo.addresses
            .map(addr => ContactValidator.formatAddress(addr))
            .filter(addr => addr.length > 10),
          
          structured: contactInfo.structured
        };
    
        // Deduplicate data
        cleanedData.phones = [...new Set(cleanedData.phones)];
        cleanedData.emails = [...new Set(cleanedData.emails)];
        cleanedData.addresses = [...new Set(cleanedData.addresses)];

        

    // Extract comprehensive page data
    const pageData = await page.evaluate((config) => {
      const { PATTERNS, BUSINESS_CATEGORIES, PAIN_POINT_INDICATORS } = config;
      
      // Helper functions
      const extractText = () => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        let text = '';
        let node;
        while (node = walker.nextNode()) {
          text += node.nodeValue + ' ';
        }
        return text.toLowerCase();
      };

      const findMatches = (text, patternStr) => {
        const pattern = new RegExp(patternStr, 'gi');
        const matches = [];
        let match;
        
        // Handle different text elements
        const textElements = [
          text,
          ...Array.from(document.querySelectorAll('a[href^="tel:"]')).map(a => a.href.replace('tel:', '')),
          ...Array.from(document.querySelectorAll('*')).map(el => el.textContent)
        ];

        textElements.forEach(textElement => {
          if (typeof textElement === 'string') {
            while ((match = pattern.exec(textElement)) !== null) {
              const foundMatch = match[0].trim();
              // Deduplicate and validate
              if (!matches.includes(foundMatch) && foundMatch.length >= 6) {
                matches.push(foundMatch);
              }
            }
          }
        });

        return [...new Set(matches)]; // Remove duplicates
      };

      const getStructuredContent = () => {
        const content = {
          headers: {},
          lists: [],
          paragraphs: [],
          tables: []
        };

        // Extract headers
        ['h1', 'h2', 'h3', 'h4'].forEach(tag => {
          content.headers[tag] = Array.from(document.querySelectorAll(tag))
            .map(el => el.textContent.trim())
            .filter(text => text.length > 0);
        });

        // Extract lists
        document.querySelectorAll('ul, ol').forEach(list => {
          const items = Array.from(list.querySelectorAll('li'))
            .map(li => li.textContent.trim())
            .filter(text => text.length > 0);
          if (items.length > 0) {
            content.lists.push(items);
          }
        });

        // Extract paragraphs
        document.querySelectorAll('p').forEach(p => {
          const text = p.textContent.trim();
          if (text.length > 30) { // Filter out short paragraphs
            content.paragraphs.push(text);
          }
        });

        // Extract tables
        document.querySelectorAll('table').forEach(table => {
          const tableData = {
            headers: [],
            rows: []
          };

          // Get headers
          table.querySelectorAll('th').forEach(th => {
            tableData.headers.push(th.textContent.trim());
          });

          // Get rows
          table.querySelectorAll('tr').forEach(tr => {
            const row = [];
            tr.querySelectorAll('td').forEach(td => {
              row.push(td.textContent.trim());
            });
            if (row.length > 0) {
              tableData.rows.push(row);
            }
          });

          if (tableData.rows.length > 0) {
            content.tables.push(tableData);
          }
        });

        return content;
      };

      const extractPricing = () => {
        const pricingData = {
          plans: [],
          hasFreeTrial: false,
          hasFreePlan: false,
          pricePoints: [],
          billingPeriods: new Set(),
          enterpriseOffering: false
        };

        const text = extractText();
        
        // Detect pricing plans
        document.querySelectorAll('[class*="pricing"], [class*="plan"], [id*="pricing"]').forEach(el => {
          const planText = el.textContent.toLowerCase();
          const prices = findMatches(planText, PATTERNS.numbers);
          const features = Array.from(el.querySelectorAll('li')).map(li => li.textContent.trim());
          
          if (prices.length > 0 || features.length > 0) {
            pricingData.plans.push({
              name: el.querySelector('h2, h3, h4')?.textContent.trim() || 'Unnamed Plan',
              prices,
              features
            });
          }
        });

        // Detect free trial/plan
        pricingData.hasFreeTrial = /free trial|try for free/i.test(text);
        pricingData.hasFreePlan = /free plan|free tier|free forever/i.test(text);
        
        // Extract all price points
        const priceMatches = text.match(/\$\d+(?:\.\d{2})?/g) || [];
        pricingData.pricePoints = [...new Set(priceMatches)];

        // Detect billing periods
        ['monthly', 'annual', 'yearly', 'quarter'].forEach(period => {
          if (text.includes(period)) {
            pricingData.billingPeriods.add(period);
          }
        });

        // Check for enterprise offering
        pricingData.enterpriseOffering = /enterprise|custom pricing|contact sales/i.test(text);

        return pricingData;
      };

      const extractMetrics = () => {
        const text = extractText();
        return {
          numbers: findMatches(text, PATTERNS.numbers),
          percentages: findMatches(text, PATTERNS.percentages),
          employeeCount: text.match(PATTERNS.employeeCount)?.[1],
          customerCount: text.match(PATTERNS.customerCount)?.[1],
          revenue: text.match(PATTERNS.revenue)?.[1],
          yearFounded: text.match(PATTERNS.yearFounded)?.[1],
          companyAge: text.match(PATTERNS.companyAge)?.[1]
        };
      };

      const detectTechnology = () => {
        const technologies = {
          frontend: new Set(),
          analytics: new Set(),
          marketing: new Set(),
          payments: new Set()
        };

        // Check scripts
        document.querySelectorAll('script').forEach(script => {
          const src = script.src.toLowerCase();
          if (src.includes('react')) technologies.frontend.add('React');
          if (src.includes('vue')) technologies.frontend.add('Vue');
          if (src.includes('angular')) technologies.frontend.add('Angular');
          if (src.includes('google-analytics') || src.includes('gtag')) technologies.analytics.add('Google Analytics');
          if (src.includes('segment')) technologies.analytics.add('Segment');
          if (src.includes('mixpanel')) technologies.analytics.add('Mixpanel');
          if (src.includes('stripe')) technologies.payments.add('Stripe');
          if (src.includes('paypal')) technologies.payments.add('PayPal');
          if (src.includes('hubspot')) technologies.marketing.add('HubSpot');
          if (src.includes('marketo')) technologies.marketing.add('Marketo');
        });

        return Object.fromEntries(
          Object.entries(technologies).map(([key, value]) => [key, Array.from(value)])
        );
      };

      const extractCompetitors = () => {
        const text = extractText();
        const competitors = new Set();
        
        // Common comparison phrases
        const comparisonPhrases = [
          'alternative to',
          'compared to',
          'vs',
          'versus',
          'similar to',
          'better than',
          'switch from'
        ];

        comparisonPhrases.forEach(phrase => {
          const regex = new RegExp(`${phrase}\\s+([\\w\\s]+)`, 'gi');
          const matches = text.match(regex);
          if (matches) {
            matches.forEach(match => {
              const competitor = match.split(phrase)[1].trim();
              if (competitor.length > 2 && competitor.length < 30) {
                competitors.add(competitor);
              }
            });
          }
        });

        return Array.from(competitors);
      };

      // Main data extraction
      const allText = extractText();
      const structuredContent = getStructuredContent();

      return {
        basics: {
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content,
          domain: window.location.hostname,
          language: document.documentElement.lang
        },

        structure: structuredContent,
        
        business: {
          categories: Object.entries(BUSINESS_CATEGORIES).reduce((acc, [category, subcategories]) => {
            acc[category] = Object.entries(subcategories).reduce((subAcc, [subcat, keywords]) => {
              const matches = keywords.filter(keyword => allText.includes(keyword.toLowerCase()));
              if (matches.length > 0) subAcc[subcat] = matches;
              return subAcc;
            }, {});
            return acc;
          }, {}),
          
          metrics: extractMetrics(),
          pricing: extractPricing(),
          competitors: extractCompetitors()
        },

        technical: {
          stack: detectTechnology(),
          features: Object.entries(BUSINESS_CATEGORIES.features).reduce((acc, [feature, keywords]) => {
            acc[feature] = keywords.some(keyword => allText.includes(keyword.toLowerCase()));
            return acc;
          }, {}),
          integrations: Array.from(document.querySelectorAll('img[alt*="integration"], [class*="integration"]')).map(el => el.alt || el.textContent.trim())
        },

        marketing: {
          valueProps: structuredContent.headers.h2
            .filter(h => h.toLowerCase().includes('why') || h.toLowerCase().includes('benefit'))
            .slice(0, 5),
          socialProof: {
            testimonials: Array.from(document.querySelectorAll('[class*="testimonial"], [class*="review"]'))
              .map(el => ({
                text: el.textContent.trim(),
                author: el.querySelector('[class*="author"], [class*="name"]')?.textContent.trim()
              }))
              .filter(t => t.text.length > 0),
            logos: Array.from(document.querySelectorAll('[class*="customer"] img, [class*="client"] img'))
              .map(img => img.alt)
              .filter(alt => alt && alt.length > 0)
          }
        },

        painPoints: Object.entries(PAIN_POINT_INDICATORS).reduce((acc, [category, indicators]) => {
          acc[category] = Object.entries(indicators).reduce((subAcc, [type, keywords]) => {
            const matches = keywords.filter(keyword => allText.includes(keyword.toLowerCase()));
            if (matches.length > 0) subAcc[ type] = matches;
            return subAcc;
          }, {});
          return acc;
        }, {})
      };
    }, { PATTERNS, BUSINESS_CATEGORIES, PAIN_POINT_INDICATORS });

    // Post-processing and analysis
    pageData.analysis = await analyzeData(pageData, page);
    pageData.people = cleanedData

    await browser.close();
    browser = null;

    if (res) {
      res.status(200).json({
        status: 'success',
        data: pageData
      });
    }
    
    return pageData;

  } catch (error) {
    console.error('Scraping error:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Error closing browser:', e);
      }
    }

    if (res) {
      res.status(500).json({
        status: 'error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      throw error;
    }
  }
};

async function analyzeData(data, page) {
  // Competitive Analysis
  const competitiveAnalysis = {
    marketPosition: determineMarketPosition(data),
    strengthsAndWeaknesses: analyzeStrengthsWeaknesses(data),
    opportunities: identifyOpportunities(data),
    threats: identifyThreats(data)
  };

  // Business Model Analysis
  const businessModelAnalysis = {
    type: determineBusinessModel(data),
    revenueStreams: identifyRevenueStreams(data),
    customerSegments: analyzeCustomerSegments(data),
    scalability: assessScalability(data)
  };

  // Technical Analysis
  const technicalAnalysis = {
    stackMaturity: analyzeStackMaturity(data),
    infrastructureNeeds: assessInfrastructureNeeds(data),
    securityProfile: evaluateSecurityProfile(data),
    technicalDebt: identifyTechnicalDebtIndicators(data)
  };

  // Growth Analysis
  const growthAnalysis = {
    stage: determineGrowthStage(data),
    metrics: extractGrowthMetrics(data),
    bottlenecks: identifyGrowthBottlenecks(data),
    opportunities: findGrowthOpportunities(data)
  };

  return {
    competitive: competitiveAnalysis,
    businessModel: businessModelAnalysis,
    technical: technicalAnalysis,
    growth: growthAnalysis,
    recommendations: generateStrategicRecommendations(data)
  };
}

function determineMarketPosition(data) {
  const position = {
    segment: 'undefined',
    differentiators: [],
    competitiveAdvantages: []
  };

  // Determine market segment based on pricing and features
  if (data.business.pricing.enterpriseOffering) {
    position.segment = 'enterprise';
  } else if (data.business.pricing.pricePoints.length > 0) {
    const avgPrice = calculateAveragePrice(data.business.pricing.pricePoints);
    position.segment = avgPrice > 100 ? 'premium' : avgPrice > 20 ? 'mid-market' : 'economy';
  }

  // Identify differentiators from value props and features
  const uniqueFeatures = new Set();
  data.marketing.valueProps.forEach(prop => {
    if (prop.toLowerCase().includes('only') || prop.toLowerCase().includes('unique')) {
      uniqueFeatures.add(prop);
    }
  });
  position.differentiators = Array.from(uniqueFeatures);

  // Analyze competitive advantages
  if (data.technical.features.ai) position.competitiveAdvantages.push('AI/ML Capabilities');
  if (data.technical.features.automation) position.competitiveAdvantages.push('Advanced Automation');
  if (data.business.metrics.customerCount) position.competitiveAdvantages.push('Large Customer Base');

  return position;
}

function analyzeStrengthsWeaknesses(data) {
  return {
    strengths: identifyStrengths(data),
    weaknesses: identifyWeaknesses(data),
    uniqueSellingPoints: extractUSPs(data)
  };
}

function identifyOpportunities(data) {
  const opportunities = [];

  // Market expansion opportunities
  if (!data.business.categories.businessModel.b2c) {
    opportunities.push('Potential for B2C market expansion');
  }

  // Technical opportunities
  if (!data.technical.features.ai) {
    opportunities.push('AI/ML integration potential');
  }

  // Integration opportunities
  if (data.technical.features.integration) {
    opportunities.push('Ecosystem expansion through partnerships');
  }

  return opportunities;
}

function identifyThreats(data) {
  const threats = [];

  // Competitive threats
  if (data.business.competitors.length > 0) {
    threats.push('Active competition in space');
  }

  // Technical threats
  if (!data.technical.features.security) {
    threats.push('Potential security vulnerabilities');
  }

  // Market threats
  if (data.business.pricing.pricePoints.length === 1) {
    threats.push('Limited pricing flexibility');
  }

  return threats;
}

// Analysis helper functions
function identifyRevenueStreams(data) {
  const streams = [];

  // Check subscription revenue
  if (data.business.pricing.plans.length > 0) {
    streams.push({
      type: 'Subscription',
      details: data.business.pricing.plans.map(plan => plan.name),
      recurring: true
    });
  }

  // Check for one-time purchases
  if (data.business.categories.businessModel.transactional) {
    streams.push({
      type: 'Transactional',
      details: ['One-time purchases'],
      recurring: false
    });
  }

  // Check for enterprise revenue
  if (data.business.pricing.enterpriseOffering) {
    streams.push({
      type: 'Enterprise',
      details: ['Custom enterprise solutions'],
      recurring: true
    });
  }

  // Check for API/usage based revenue
  if (data.technical.features.api) {
    streams.push({
      type: 'API/Usage',
      details: ['API access fees'],
      recurring: true
    });
  }

  return streams;
}

function analyzeCustomerSegments(data) {
  const segments = {
    primary: [],
    secondary: [],
    potential: []
  };

  // Analyze primary segments
  if (data.business.categories.businessModel.b2b) {
    segments.primary.push('B2B');
  }
  if (data.business.categories.businessModel.b2c) {
    segments.primary.push('B2C');
  }

  // Analyze by industry focus
  Object.entries(data.business.categories.industries).forEach(([industry, matches]) => {
    if (Object.keys(matches).length > 0) {
      segments.primary.push(industry.charAt(0).toUpperCase() + industry.slice(1));
    }
  });

  // Identify secondary segments
  if (data.business.pricing.enterpriseOffering) {
    segments.secondary.push('Enterprise');
  }
  if (data.business.pricing.hasFreePlan) {
    segments.secondary.push('SMB/Startup');
  }

  // Identify potential segments
  if (!segments.primary.includes('B2C') && data.technical.features.customization) {
    segments.potential.push('B2C Market');
  }
  if (!segments.primary.includes('Enterprise') && data.technical.features.security) {
    segments.potential.push('Enterprise Market');
  }

  return segments;
}

async function extractContactInfo(page) {
  return await page.evaluate((patterns) => {
    const results = {
      phones: new Set(),
      emails: new Set(),
      social: {},
      addresses: new Set(),
      structured: []
    };

    // Helper function to extract text from elements
    const extractText = (selector) => {
      return Array.from(document.querySelectorAll(selector))
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0);
    };

    // Extract from specific contact-related elements
    const contactSelectors = [
      '.contact',
      '#contact',
      '[class*="contact"]',
      '[id*="contact"]',
      'footer',
      'header',
      '[class*="footer"]',
      '[class*="header"]'
    ];

    // Process each contact section
    contactSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = element.textContent;

        // Extract phones
        Object.values(patterns.phones).forEach(pattern => {
          const matches = text.match(pattern) || [];
          matches.forEach(match => results.phones.add(match.trim()));
        });

        // Extract emails
        Object.values(patterns.emails).forEach(pattern => {
          const matches = text.match(pattern) || [];
          matches.forEach(match => results.emails.add(match.trim()));
        });

        // Extract addresses
        Object.values(patterns.address).forEach(pattern => {
          const matches = text.match(pattern) || [];
          matches.forEach(match => results.addresses.add(match.trim()));
        });
      });
    });

    // Extract from specific link elements
    const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
    phoneLinks.forEach(link => {
      const phone = link.href.replace('tel:', '');
      results.phones.add(phone.trim());
    });

    const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
    emailLinks.forEach(link => {
      const email = link.href.replace('mailto:', '').split('?')[0];
      results.emails.add(email.trim());
    });

    // Extract social media links
    Object.entries(patterns.social).forEach(([platform, pattern]) => {
      results.social[platform] = [];
      const links = document.querySelectorAll(`a[href*="${platform}"]`);
      links.forEach(link => {
        const matches = link.href.match(pattern);
        if (matches) {
          results.social[platform].push(matches[0]);
        }
      });
    });

    // Extract from structured data
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        if (data?.contactPoint || data?.address || data?.telephone || data?.email) {
          results.structured.push(data);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Convert Sets to Arrays for JSON serialization
    return {
      phones: Array.from(results.phones),
      emails: Array.from(results.emails),
      social: results.social,
      addresses: Array.from(results.addresses),
      structured: results.structured
    };
  }, CONTACT_PATTERNS);
}

function assessScalability(data) {
  const assessment = {
    score: 0, // 0-10
    factors: {
      positive: [],
      negative: []
    },
    bottlenecks: []
  };

  // Analyze positive scalability factors
  if (data.technical.features.automation) {
    assessment.factors.positive.push('Automated processes');
    assessment.score += 2;
  }
  if (data.technical.features.api) {
    assessment.factors.positive.push('API-first architecture');
    assessment.score += 2;
  }
  if (data.business.pricing.hasFreeTrial) {
    assessment.factors.positive.push('Self-service onboarding');
    assessment.score += 1;
  }

  // Analyze negative factors
  if (!data.technical.features.automation) {
    assessment.factors.negative.push('Manual processes');
    assessment.bottlenecks.push('Process automation needed');
  }
  if (Object.keys(data.painPoints).length > 2) {
    assessment.factors.negative.push('Multiple pain points');
    assessment.score -= 1;
  }

  // Cap the score between 0 and 10
  assessment.score = Math.min(Math.max(assessment.score, 0), 10);

  return assessment;
}

function analyzeStackMaturity(data) {
  const analysis = {
    maturityScore: 0,
    strengths: [],
    gaps: [],
    recommendations: []
  };

  // Analyze technical stack
  if (data.technical.stack.frontend.length > 0) {
    analysis.strengths.push('Modern frontend framework');
    analysis.maturityScore += 2;
  }
  if (data.technical.stack.analytics.length > 0) {
    analysis.strengths.push('Analytics integration');
    analysis.maturityScore += 1;
  }

  // Identify gaps
  if (!data.technical.features.security) {
    analysis.gaps.push('Security features');
    analysis.recommendations.push('Implement security best practices');
  }
  if (!data.technical.features.api) {
    analysis.gaps.push('API architecture');
    analysis.recommendations.push('Develop API-first approach');
  }

  return analysis;
}

function assessInfrastructureNeeds(data) {
  return {
    current: identifyCurrentInfrastructure(data),
    required: determineRequiredInfrastructure(data),
    gaps: findInfrastructureGaps(data)
  };
}

function evaluateSecurityProfile(data) {
  return {
    status: data.technical.features.security ? 'Strong' : 'Needs Improvement',
    measures: identifySecurityMeasures(data),
    risks: identifySecurityRisks(data)
  };
}

function identifyTechnicalDebtIndicators(data) {
  const indicators = [];
  
  if (!data.technical.features.automation) {
    indicators.push('Manual processes that could be automated');
  }
  if (!data.technical.features.api) {
    indicators.push('Lack of API architecture');
  }
  if (Object.keys(data.painPoints.technical || {}).length > 0) {
    indicators.push('Existing technical pain points');
  }

  return indicators;
}

function determineGrowthStage(data) {
  // Default to early stage
  let stage = 'Early Stage';
  
  // Use metrics to determine stage
  if (data.business.metrics.customerCount) {
    const customerCount = parseInt(data.business.metrics.customerCount);
    if (customerCount > 1000) stage = 'Growth';
    if (customerCount > 10000) stage = 'Scale';
    if (customerCount > 100000) stage = 'Enterprise';
  }

  return {
    stage,
    indicators: identifyGrowthIndicators(data),
    nextMilestones: determineNextMilestones(data)
  };
}

function extractGrowthMetrics(data) {
  return {
    customers: data.business.metrics.customerCount,
    revenue: data.business.metrics.revenue,
    employees: data.business.metrics.employeeCount,
    age: data.business.metrics.companyAge
  };
}

function identifyGrowthBottlenecks(data) {
  const bottlenecks = [];

  // Technical bottlenecks
  if (!data.technical.features.automation) {
    bottlenecks.push({
      type: 'Technical',
      issue: 'Manual processes limiting scale',
      impact: 'High'
    });
  }

  // Business bottlenecks
  if (!data.business.pricing.enterpriseOffering) {
    bottlenecks.push({
      type: 'Business',
      issue: 'Limited enterprise readiness',
      impact: 'Medium'
    });
  }

  return bottlenecks;
}

function findGrowthOpportunities(data) {
  const opportunities = [];

  // Market opportunities
  if (!data.business.categories.businessModel.b2c) {
    opportunities.push({
      type: 'Market Expansion',
      description: 'B2C market entry potential',
      effort: 'High',
      impact: 'High'
    });
  }

  // Product opportunities
  if (!data.technical.features.ai) {
    opportunities.push({
      type: 'Product Development',
      description: 'AI/ML feature integration',
      effort: 'High',
      impact: 'Medium'
    });
  }

  return opportunities;
}

// Additional helper functions
function identifyCurrentInfrastructure(data) {
  const infrastructure = [];
  
  // Identify current infrastructure components
  if (data.technical.stack.frontend.length > 0) {
    infrastructure.push('Frontend Framework');
  }
  if (data.technical.stack.analytics.length > 0) {
    infrastructure.push('Analytics Platform');
  }
  
  return infrastructure;
}

function determineRequiredInfrastructure(data) {
  const required = new Set();
  
  // Determine required infrastructure based on business needs
  if (data.business.categories.industries.saas) {
    required.add('Cloud Infrastructure');
    required.add('API Gateway');
  }
  if (data.technical.features.security) {
    required.add('Security Infrastructure');
  }
  
  return Array.from(required);
}

function findInfrastructureGaps(data) {
  const current = new Set(identifyCurrentInfrastructure(data));
  const required = new Set(determineRequiredInfrastructure(data));
  
  return Array.from(required).filter(item => !current.has(item));
}

function identifySecurityMeasures(data) {
  const measures = [];
  
  if (data.technical.features.security) {
    measures.push('Security Features Present');
  }
  if (data.business.categories.industries.fintech) {
    measures.push('Financial Security Requirements');
  }
  
  return measures;
}

function identifySecurityRisks(data) {
  const risks = [];
  
  if (!data.technical.features.security) {
    risks.push('Lack of Security Features');
  }
  if (data.business.categories.industries.fintech && !data.technical.features.security) {
    risks.push('Missing Financial Security Requirements');
  }
  
  return risks;
}

function identifyGrowthIndicators(data) {
  const indicators = [];
  
  if (data.business.metrics.customerCount) {
    indicators.push('Growing Customer Base');
  }
  if (data.technical.features.automation) {
    indicators.push('Scalable Architecture');
  }
  
  return indicators;
}

function determineNextMilestones(data) {
  const milestones = [];
  
  if (!data.technical.features.api) {
    milestones.push('API Development');
  }
  if (!data.technical.features.automation) {
    milestones.push('Process Automation');
  }
  
  return milestones;
}

function determineBusinessModel(data) {
  const model = {
    primary: '',
    secondary: [],
    monetization: []
  };

  // Determine primary business model
  if (data.business.categories.businessModel.subscription) {
    model.primary = 'Subscription';
  } else if (data.business.categories.businessModel.marketplace) {
    model.primary = 'Marketplace';
  } else if (data.business.categories.businessModel.transactional) {
    model.primary = 'Transactional';
  }

  // Identify secondary models
  if (data.business.pricing.enterpriseOffering) {
    model.secondary.push('Enterprise Sales');
  }
  if (data.technical.features.api) {
    model.secondary.push('API-as-a-Service');
  }

  // Analyze monetization strategies
  data.business.pricing.plans.forEach(plan => {
    if (plan.prices.length > 0) {
      model.monetization.push(`${plan.name} Plan Revenue`);
    }
  });

  return model;
}

function generateStrategicRecommendations(data) {
  const recommendations = [];

  // Product Development Recommendations
  if (!data.technical.features.ai && data.business.categories.industries.saas) {
    recommendations.push({
      category: 'Product Development',
      recommendation: 'Consider AI/ML integration for enhanced functionality',
      priority: 'High',
      impact: 'Competitive advantage in SaaS space'
    });
  }

  // Market Expansion Recommendations
  if (data.business.metrics.customerCount && !data.business.categories.businessModel.b2c) {
    recommendations.push({
      category: 'Market Expansion',
      recommendation: 'Evaluate B2C market entry potential',
      priority: 'Medium',
      impact: 'Revenue stream diversification'
    });
  }

  // Technical Infrastructure Recommendations
  if (!data.technical.features.security && data.business.categories.industries.fintech) {
    recommendations.push({
      category: 'Infrastructure',
      recommendation: 'Enhance security features and compliance measures',
      priority: 'Critical',
      impact: 'Risk mitigation and market trust'
    });
  }

  return recommendations;
}

// Helper functions for analysis
function calculateAveragePrice(pricePoints) {
  const prices = pricePoints.map(price => {
    const match = price.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  });
  return prices.length > 0 ? prices.reduce((a, b) => a + b) / prices.length : 0;
}

function identifyStrengths(data) {
  const strengths = [];
  
  if (data.technical.features.automation) strengths.push('Strong automation capabilities');
  if (data.business.metrics.customerCount) strengths.push('Established customer base');
  if (data.technical.stack.analytics.length > 0) strengths.push('Advanced analytics capabilities');
  
  return strengths;
}

function identifyWeaknesses(data) {
  const weaknesses = [];
  
  if (!data.technical.features.security) weaknesses.push('Limited security features');
  if (!data.marketing.socialProof.testimonials.length) weaknesses.push('Limited social proof');
  if (!data.technical.features.integration) weaknesses.push('Limited integration capabilities');
  
  return weaknesses;
}

function extractUSPs(data) {
  return data.marketing.valueProps
    .filter(prop => prop.toLowerCase().includes('only') || 
                   prop.toLowerCase().includes('first') || 
                   prop.toLowerCase().includes('leading'))
    .map(prop => ({
      proposition: prop,
      category: categorizeUSP(prop)
    }));
}

function categorizeUSP(prop) {
  const lowerProp = prop.toLowerCase();
  if (lowerProp.includes('technolog') || lowerProp.includes('platform')) return 'Technical';
  if (lowerProp.includes('price') || lowerProp.includes('cost')) return 'Price';
  if (lowerProp.includes('service') || lowerProp.includes('support')) return 'Service';
  return 'Other';
}

module.exports = {
  scrapeWebsite,
  handleScrapeRequest,
  analyzeData
};
// const puppeteer = require("puppeteer");
// require("dotenv").config();

// const PHONE_REGEX = /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?/g;
// const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// // Enhanced industry and feature keywords
// const BUSINESS_CATEGORIES = {
//   industries: {
//     saas: ['software', 'saas', 'cloud', 'platform', 'automation', 'api'],
//     martech: ['email', 'marketing', 'automation', 'outreach', 'campaign', 'leads'],
//     sales: ['sales', 'outreach', 'leads', 'crm', 'pipeline', 'conversion'],
//     productivity: ['workflow', 'automation', 'efficiency', 'productivity', 'time-saving'],
//     communication: ['email', 'messaging', 'communication', 'outreach', 'engagement']
//   },
//   features: {
//     automation: ['automated', 'automation', 'workflow', 'streamline'],
//     integration: ['integration', 'api', 'connect', 'seamless', 'sync'],
//     analytics: ['analytics', 'tracking', 'metrics', 'dashboard', 'reports'],
//     customization: ['personalization', 'customize', 'tailored', 'flexible'],
//     security: ['security', 'encryption', 'compliance', 'protection']
//   }
// };

// const scrapeWebsite = async (url, res) => {
//   let browser = null;

//   try {
//     browser = await puppeteer.launch({
//       headless: true,
//       args: ['--no-sandbox'],
//       executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
//     });

//     const page = await browser.newPage();
//     await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

//     // Extract comprehensive page data
//     const pageData = await page.evaluate((categories) => {
//       const getTextContent = (selector) => {
//         const elements = document.querySelectorAll(selector);
//         return Array.from(elements)
//           .map(el => el.textContent.trim())
//           .filter(text => text.length > 0);
//       };

//       const getMeta = (name) => {
//         const element = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
//         return element ? element.getAttribute('content') : null;
//       };

//       // Get all text content
//       const allText = document.body.innerText.toLowerCase();
//       const paragraphs = getTextContent('p');
      
//       // Extract feature lists
//       const featureLists = Array.from(document.querySelectorAll('ul, ol'))
//         .map(list => Array.from(list.querySelectorAll('li'))
//           .map(li => li.textContent.trim())
//           .filter(text => text.length > 0 && text.length < 200))
//         .filter(list => list.length > 0);

//       // Extract pricing information
//       const getPricingInfo = () => {
//         const pricingText = allText;
//         const hasFreeTrialMatch = pricingText.match(/free trial|try for free|days? free/gi) || [];
//         const priceMatch = pricingText.match(/\$\d+(?:\.\d{2})?(?:\s*\/\s*(?:month|mo|year|yr|annual))?/gi) || [];
        
//         return {
//           hasFreeTrial: hasFreeTrialMatch.length > 0,
//           prices: [...new Set(priceMatch)],
//           pricingType: pricingText.includes('custom pricing') ? 'Custom' :
//                       pricingText.includes('enterprise') ? 'Enterprise' :
//                       priceMatch.length > 0 ? 'Fixed' : 'Not specified'
//         };
//       };

//       // Detect categories and features
//       const detectCategories = (text, categories) => {
//         const found = {};
//         Object.entries(categories).forEach(([category, terms]) => {
//           const matches = terms.filter(term => text.includes(term.toLowerCase()));
//           if (matches.length > 0) {
//             found[category] = matches;
//           }
//         });
//         return found;
//       };

//       // Extract benefits and features
//       const extractBenefits = () => {
//         const benefitKeywords = ['benefit', 'why', 'features', 'capabilities'];
//         const benefits = [];

//         document.querySelectorAll('h1, h2, h3, h4, h5').forEach(heading => {
//           if (benefitKeywords.some(keyword => heading.textContent.toLowerCase().includes(keyword))) {
//             let element = heading.nextElementSibling;
//             while (element && !['H1', 'H2', 'H3', 'H4', 'H5'].includes(element.tagName)) {
//               if (element.tagName === 'P' || element.tagName === 'LI') {
//                 const text = element.textContent.trim();
//                 if (text.length > 0 && text.length < 200) {
//                   benefits.push(text);
//                 }
//               }
//               element = element.nextElementSibling;
//             }
//           }
//         });

//         return benefits;
//       };

//       // Get user testimonials or social proof
//       const extractTestimonials = () => {
//         const testimonials = [];
//         const testimonialSelectors = [
//           '[class*="testimonial"]',
//           '[class*="review"]',
//           '[class*="quote"]',
//           '[data-testimonial]'
//         ];

//         testimonialSelectors.forEach(selector => {
//           document.querySelectorAll(selector).forEach(element => {
//             const text = element.textContent.trim();
//             if (text.length > 0 && text.length < 500) {
//               testimonials.push(text);
//             }
//           });
//         });

//         return testimonials;
//       };

//       return {
//         // Basic information
//         title: document.title,
//         description: getMeta('description') || getMeta('og:description'),
//         keywords: getMeta('keywords'),
        
//         // Business categorization
//         categories: {
//           industries: detectCategories(allText, categories.industries),
//           features: detectCategories(allText, categories.features)
//         },

//         // Product information
//         productDetails: {
//           benefits: extractBenefits(),
//           features: featureLists,
//           pricing: getPricingInfo(),
//           integrations: getTextContent('[class*="integration"]'),
//           testimonials: extractTestimonials()
//         },

//         // Content structure
//         content: {
//           headings: {
//             h1: getTextContent('h1'),
//             h2: getTextContent('h2'),
//             h3: getTextContent('h3')
//           },
//           mainParagraphs: paragraphs.filter(p => p.length > 50)
//         },

//         // Contact and social proof
//         contactInfo: {
//           email: getTextContent('a[href^="mailto:"]'),
//           socialLinks: {
//             linkedin: Array.from(document.querySelectorAll('a[href*="linkedin.com"]')).map(a => a.href),
//             twitter: Array.from(document.querySelectorAll('a[href*="twitter.com"]')).map(a => a.href),
//             facebook: Array.from(document.querySelectorAll('a[href*="facebook.com"]')).map(a => a.href)
//           }
//         },

//         // Technical indicators
//         technicalFeatures: {
//           hasAPI: allText.includes('api') || allText.includes('integration'),
//           hasDashboard: allText.includes('dashboard') || allText.includes('analytics'),
//           hasAutomation: allText.includes('automation') || allText.includes('automated'),
//           hasCustomization: allText.includes('customize') || allText.includes('personalize'),
//           hasAnalytics: allText.includes('analytics') || allText.includes('reporting')
//         },

//         // Business indicators
//         businessIndicators: {
//           hasEnterpriseFeatures: allText.includes('enterprise') || allText.includes('custom plan'),
//           hasFreeTrialOrPlan: allText.includes('free trial') || allText.includes('free plan'),
//           targetMarket: allText.includes('enterprise') ? 'Enterprise' :
//                        allText.includes('agency') ? 'Agency' :
//                        allText.includes('small business') ? 'Small Business' : 'Mid-Market'
//         }
//       };
//     }, BUSINESS_CATEGORIES);

//     // Post-process data
//     pageData.painPoints = analyzePainPoints(pageData);
//     pageData.recommendations = generateRecommendations(pageData);

//     await browser.close();
//     browser = null;

//     if (res) {
//       res.status(200).send({
//         status: 'success',
//         data: pageData
//       });
//     }
    
//     return pageData;

//   } catch (error) {
//     console.error('Scraping error:', error.message);
//     if (browser) {
//       try {
//         await browser.close();
//       } catch (e) {
//         console.error('Error closing browser:', e.message);
//       }
//     }

//     if (res) {
//       res.status(500).send({
//         status: 'error',
//         message: error.message
//       });
//     } else {
//       throw error;
//     }
//   }
// };

// function analyzePainPoints(data) {
//   const painPoints = [];
  
//   // Analyze product features and gaps
//   if (!data.technicalFeatures.hasAPI) {
//     painPoints.push('Limited integration capabilities');
//   }
//   if (!data.technicalFeatures.hasAnalytics) {
//     painPoints.push('Lacks advanced analytics and reporting');
//   }
//   if (data.productDetails.pricing.pricingType === 'Not specified') {
//     painPoints.push('Pricing transparency issues');
//   }
//   if (!data.productDetails.testimonials.length) {
//     painPoints.push('Limited social proof');
//   }
//   if (!data.technicalFeatures.hasCustomization) {
//     painPoints.push('Limited customization options');
//   }

//   return painPoints;
// }

// function generateRecommendations(data) {
//   const recommendations = [];

//   // Product-based recommendations
//   if (data.categories.industries.saas) {
//     recommendations.push('Focus on integration capabilities and API documentation');
//   }
//   if (data.categories.industries.martech) {
//     recommendations.push('Emphasize email deliverability and automation features');
//   }
//   if (data.businessIndicators.targetMarket === 'Enterprise') {
//     recommendations.push('Highlight security features and compliance capabilities');
//   }
//   if (data.technicalFeatures.hasAutomation) {
//     recommendations.push('Showcase time-saving and efficiency metrics');
//   }

//   return recommendations;
// }


// // Simple Express route handler


// module.exports = {
//   scrapeWebsite,
//   handleScrapeRequest
// };