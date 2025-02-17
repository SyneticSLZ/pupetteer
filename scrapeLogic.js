const puppeteer = require("puppeteer");
require("dotenv").config();

const PHONE_REGEX = /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Enhanced industry and feature keywords
const BUSINESS_CATEGORIES = {
  industries: {
    saas: ['software', 'saas', 'cloud', 'platform', 'automation', 'api'],
    martech: ['email', 'marketing', 'automation', 'outreach', 'campaign', 'leads'],
    sales: ['sales', 'outreach', 'leads', 'crm', 'pipeline', 'conversion'],
    productivity: ['workflow', 'automation', 'efficiency', 'productivity', 'time-saving'],
    communication: ['email', 'messaging', 'communication', 'outreach', 'engagement']
  },
  features: {
    automation: ['automated', 'automation', 'workflow', 'streamline'],
    integration: ['integration', 'api', 'connect', 'seamless', 'sync'],
    analytics: ['analytics', 'tracking', 'metrics', 'dashboard', 'reports'],
    customization: ['personalization', 'customize', 'tailored', 'flexible'],
    security: ['security', 'encryption', 'compliance', 'protection']
  }
};

const scrapeWebsite = async (url, res) => {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Extract comprehensive page data
    const pageData = await page.evaluate((categories) => {
      const getTextContent = (selector) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements)
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0);
      };

      const getMeta = (name) => {
        const element = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return element ? element.getAttribute('content') : null;
      };

      // Get all text content
      const allText = document.body.innerText.toLowerCase();
      const paragraphs = getTextContent('p');
      
      // Extract feature lists
      const featureLists = Array.from(document.querySelectorAll('ul, ol'))
        .map(list => Array.from(list.querySelectorAll('li'))
          .map(li => li.textContent.trim())
          .filter(text => text.length > 0 && text.length < 200))
        .filter(list => list.length > 0);

      // Extract pricing information
      const getPricingInfo = () => {
        const pricingText = allText;
        const hasFreeTrialMatch = pricingText.match(/free trial|try for free|days? free/gi) || [];
        const priceMatch = pricingText.match(/\$\d+(?:\.\d{2})?(?:\s*\/\s*(?:month|mo|year|yr|annual))?/gi) || [];
        
        return {
          hasFreeTrial: hasFreeTrialMatch.length > 0,
          prices: [...new Set(priceMatch)],
          pricingType: pricingText.includes('custom pricing') ? 'Custom' :
                      pricingText.includes('enterprise') ? 'Enterprise' :
                      priceMatch.length > 0 ? 'Fixed' : 'Not specified'
        };
      };

      // Detect categories and features
      const detectCategories = (text, categories) => {
        const found = {};
        Object.entries(categories).forEach(([category, terms]) => {
          const matches = terms.filter(term => text.includes(term.toLowerCase()));
          if (matches.length > 0) {
            found[category] = matches;
          }
        });
        return found;
      };

      // Extract benefits and features
      const extractBenefits = () => {
        const benefitKeywords = ['benefit', 'why', 'features', 'capabilities'];
        const benefits = [];

        document.querySelectorAll('h1, h2, h3, h4, h5').forEach(heading => {
          if (benefitKeywords.some(keyword => heading.textContent.toLowerCase().includes(keyword))) {
            let element = heading.nextElementSibling;
            while (element && !['H1', 'H2', 'H3', 'H4', 'H5'].includes(element.tagName)) {
              if (element.tagName === 'P' || element.tagName === 'LI') {
                const text = element.textContent.trim();
                if (text.length > 0 && text.length < 200) {
                  benefits.push(text);
                }
              }
              element = element.nextElementSibling;
            }
          }
        });

        return benefits;
      };

      // Get user testimonials or social proof
      const extractTestimonials = () => {
        const testimonials = [];
        const testimonialSelectors = [
          '[class*="testimonial"]',
          '[class*="review"]',
          '[class*="quote"]',
          '[data-testimonial]'
        ];

        testimonialSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(element => {
            const text = element.textContent.trim();
            if (text.length > 0 && text.length < 500) {
              testimonials.push(text);
            }
          });
        });

        return testimonials;
      };

      return {
        // Basic information
        title: document.title,
        description: getMeta('description') || getMeta('og:description'),
        keywords: getMeta('keywords'),
        
        // Business categorization
        categories: {
          industries: detectCategories(allText, categories.industries),
          features: detectCategories(allText, categories.features)
        },

        // Product information
        productDetails: {
          benefits: extractBenefits(),
          features: featureLists,
          pricing: getPricingInfo(),
          integrations: getTextContent('[class*="integration"]'),
          testimonials: extractTestimonials()
        },

        // Content structure
        content: {
          headings: {
            h1: getTextContent('h1'),
            h2: getTextContent('h2'),
            h3: getTextContent('h3')
          },
          mainParagraphs: paragraphs.filter(p => p.length > 50)
        },

        // Contact and social proof
        contactInfo: {
          email: getTextContent('a[href^="mailto:"]'),
          socialLinks: {
            linkedin: Array.from(document.querySelectorAll('a[href*="linkedin.com"]')).map(a => a.href),
            twitter: Array.from(document.querySelectorAll('a[href*="twitter.com"]')).map(a => a.href),
            facebook: Array.from(document.querySelectorAll('a[href*="facebook.com"]')).map(a => a.href)
          }
        },

        // Technical indicators
        technicalFeatures: {
          hasAPI: allText.includes('api') || allText.includes('integration'),
          hasDashboard: allText.includes('dashboard') || allText.includes('analytics'),
          hasAutomation: allText.includes('automation') || allText.includes('automated'),
          hasCustomization: allText.includes('customize') || allText.includes('personalize'),
          hasAnalytics: allText.includes('analytics') || allText.includes('reporting')
        },

        // Business indicators
        businessIndicators: {
          hasEnterpriseFeatures: allText.includes('enterprise') || allText.includes('custom plan'),
          hasFreeTrialOrPlan: allText.includes('free trial') || allText.includes('free plan'),
          targetMarket: allText.includes('enterprise') ? 'Enterprise' :
                       allText.includes('agency') ? 'Agency' :
                       allText.includes('small business') ? 'Small Business' : 'Mid-Market'
        }
      };
    }, BUSINESS_CATEGORIES);

    // Post-process data
    pageData.painPoints = analyzePainPoints(pageData);
    pageData.recommendations = generateRecommendations(pageData);

    await browser.close();
    browser = null;

    if (res) {
      res.status(200).send({
        status: 'success',
        data: pageData
      });
    }
    
    return pageData;

  } catch (error) {
    console.error('Scraping error:', error.message);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Error closing browser:', e.message);
      }
    }

    if (res) {
      res.status(500).send({
        status: 'error',
        message: error.message
      });
    } else {
      throw error;
    }
  }
};

function analyzePainPoints(data) {
  const painPoints = [];
  
  // Analyze product features and gaps
  if (!data.technicalFeatures.hasAPI) {
    painPoints.push('Limited integration capabilities');
  }
  if (!data.technicalFeatures.hasAnalytics) {
    painPoints.push('Lacks advanced analytics and reporting');
  }
  if (data.productDetails.pricing.pricingType === 'Not specified') {
    painPoints.push('Pricing transparency issues');
  }
  if (!data.productDetails.testimonials.length) {
    painPoints.push('Limited social proof');
  }
  if (!data.technicalFeatures.hasCustomization) {
    painPoints.push('Limited customization options');
  }

  return painPoints;
}

function generateRecommendations(data) {
  const recommendations = [];

  // Product-based recommendations
  if (data.categories.industries.saas) {
    recommendations.push('Focus on integration capabilities and API documentation');
  }
  if (data.categories.industries.martech) {
    recommendations.push('Emphasize email deliverability and automation features');
  }
  if (data.businessIndicators.targetMarket === 'Enterprise') {
    recommendations.push('Highlight security features and compliance capabilities');
  }
  if (data.technicalFeatures.hasAutomation) {
    recommendations.push('Showcase time-saving and efficiency metrics');
  }

  return recommendations;
}


// Simple Express route handler
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

module.exports = {
  scrapeWebsite,
  handleScrapeRequest
};