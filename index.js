const express = require('express');
const { handleScrapeRequest } = require('./scrapeLogic');
const { getRecentYCStartups } = require('./y-combinator')
const puppeteer = require("puppeteer");
const cors = require('cors');



const app = express();
const PORT = 4000;

app.use(cors({
  origin: ['http://localhost:3000', 'https://syneticslz.github.io', 'http://127.0.0.1:5501'],
  credentials: true
}));;
app.use(express.json())


app.get('/scrape', handleScrapeRequest);


app.get('/scrape/pbm', async (req, res) => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://www.express-scripts.com/formulary', { waitUntil: 'networkidle2' });
  const data = await page.evaluate(() => {
    const drugs = [];
    document.querySelectorAll('.drug-item').forEach(item => {
      drugs.push({
        name: item.querySelector('.name')?.textContent || 'Unknown',
        cost: parseFloat(item.querySelector('.cost')?.textContent?.replace('$', '')) || 0,
      });
    });
    return drugs;
  });
  await browser.close();
  res.json(data);
});


async function scrapeProductHunt(url) {
  let data = null; // Define data variable in the outer scope
  try {
    // Launch browser in headless mode with more options for server environment
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    // Create new page
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to the page with increased timeout
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // Less strict wait condition
      timeout: 60000 // Increase timeout to 60 seconds
    });

    // Try multiple selectors for the visit button
    const visitButtonSelectors = [
      'button:has(svg[data-sentry-element="ExternalIcon"])',
      'a[data-test="visit-button"]',
      '.styles_visitButton__h9cjL',
      'a:contains("Visit")',
      'button:contains("Visit")'
    ];
    
    let visitButtonFound = false;
    for (const selector of visitButtonSelectors) {
      try {
        const exists = await page.waitForSelector(selector, { timeout: 5000 });
        if (exists) {
          console.log(`Found visit button with selector: ${selector}`);
          visitButtonFound = true;
          break;
        }
      } catch (e) {
        console.log(`Selector not found: ${selector}`);
      }
    }
    
    if (!visitButtonFound) {
      console.log('No visit button found with any selector, continuing anyway');
    }

    // Get initial page data
    data = await page.evaluate(() => {
      // Take a more flexible approach to finding elements
      const productName = document.querySelector('h1')?.innerText || 
                          document.querySelector('.styles_name__8te6L')?.innerText ||
                          document.querySelector('[data-test="product-name"]')?.innerText;
                            
      // Try multiple selectors for description
      const description = document.querySelector('.styles_htmlText__eYPgj')?.innerText || 
                          document.querySelector('[data-test="tagline"]')?.innerText ||
                          document.querySelector('meta[name="description"]')?.content;

      // For makers, try multiple approaches
      let makers = [];
      try {
        const makerElements = document.querySelectorAll('a[data-sentry-component="TeamUser"]');
        if (makerElements && makerElements.length > 0) {
          makers = Array.from(makerElements).map(maker => ({
            name: maker.querySelector('img')?.alt,
            profile: maker.href
          }));
        } else {
          // Alternative selector for makers
          const altMakerElements = document.querySelectorAll('.styles_maker__R5Qs4') || 
                                document.querySelectorAll('[data-test="maker-card"]');
          if (altMakerElements && altMakerElements.length > 0) {
            makers = Array.from(altMakerElements).map(maker => {
              const nameEl = maker.querySelector('div[title]') || maker.querySelector('img');
              const linkEl = maker.closest('a');
              return {
                name: nameEl?.getAttribute('title') || nameEl?.getAttribute('alt'),
                profile: linkEl?.href
              };
            });
          }
        }
      } catch (e) {
        console.error('Error extracting makers:', e);
      }

      // For topics, be more flexible
      const topicsSet = new Set();
      let topics = [];
      try {
        const topicSelectors = [
          'a[href^="/topics/"]',
          '.styles_topics__g56Fi a',
          '[data-test="topic-chip"]'
        ];
        
        for (const selector of topicSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements && elements.length > 0) {
            topics = Array.from(elements)
              .map(topic => ({
                name: topic.innerText,
                url: topic.href
              }))
              .filter(topic => {
                if (!topic.name || !topic.url) return false;
                const key = `${topic.name}-${topic.url}`;
                if (topicsSet.has(key)) return false;
                topicsSet.add(key);
                return true;
              });
            if (topics.length > 0) break;
          }
        }
      } catch (e) {
        console.error('Error extracting topics:', e);
      }

      // Try multiple selectors for upvotes and comments
      const upvotesSelectors = [
        'button[data-test="vote-button"] div:last-child',
        '.styles_voteButton__pHY29',
        '[data-test="vote-count"]'
      ];
      
      let upvotes = '0';
      for (const selector of upvotesSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          upvotes = element.innerText;
          if (upvotes.includes('Upvote')) {
            upvotes = upvotes.replace('Upvote ', '');
          }
          break;
        }
      }
      
      const commentsSelectors = [
        'div[data-test="post-Comments-section"]',
        '.styles_comments__lT8Sx',
        '[data-test="comment-count"]'
      ];
      
      let comments = 'N/A';
      for (const selector of commentsSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          comments = element.innerText;
          break;
        }
      }

      return {
        productName,
        description,
        makers,
        topics,
        stats: {
          upvotes: upvotes?.replace('Upvote ', '') || '0',
          comments: comments || 'N/A'
        }
      };
    });

    // Enhanced website URL extraction
    try {
      // First, check if there's a clear "Website" section visible on the page
      const websiteSection = await page.evaluate(() => {
        // Look for Website field in the sidebar info
        const labels = document.querySelectorAll('div');
        for (const label of labels) {
          if (label.textContent === 'Website') {
            const nextElement = label.nextElementSibling;
            if (nextElement && nextElement.textContent) {
              return nextElement.textContent.trim();
            }
          }
        }
        return null;
      });
      
      if (websiteSection) {
        console.log('Found website in info section:', websiteSection);
        // Clean the URL if needed
        const cleanUrl = websiteSection.startsWith('http') ? 
                        websiteSection : 
                        `https://${websiteSection}`;
        data.websiteUrl = cleanUrl;
      } else {
        // Try direct extraction first
        const directUrl = await page.evaluate(() => {
          // Focus on finding the primary "Visit" button
          // Method 1: Look for the specific visit button with external icon
          const visitButton = document.querySelector('button:has(svg[data-sentry-element="ExternalIcon"])');
          if (visitButton && visitButton.closest('a')) {
            return visitButton.closest('a').href;
          }
          
          // Method 2: Look for elements that specifically say "Visit" with link
          const visitElements = Array.from(document.querySelectorAll('a'));
          for (const el of visitElements) {
            if ((el.textContent && el.textContent.trim() === 'Visit') && el.href) {
              // Filter out social media URLs
              if (!el.href.includes('linkedin.com') && 
                  !el.href.includes('instagram.com') && 
                  !el.href.includes('twitter.com') && 
                  !el.href.includes('facebook.com') && 
                  !el.href.includes('producthunt.com')) {
                return el.href;
              }
            }
          }
          
          // Method 3: Look for the Visit button by class or other attributes
          const visitByClass = document.querySelector('.styles_visitButton__h9cjL') || 
                              document.querySelector('[data-test="visit-button"]');
          if (visitByClass && visitByClass.href) {
            return visitByClass.href;
          }
          
          // Method 4: Look for Visit button in the main header actions
          // First, find the header area where the main product actions are
          const productHeader = document.querySelector('header') || 
                               document.querySelector('.styles_header__AJUdH');
          if (productHeader) {
            const headerButtons = productHeader.querySelectorAll('a');
            for (const btn of headerButtons) {
              // Check for visit button in header
              if (btn.textContent && btn.textContent.includes('Visit') && btn.href) {
                return btn.href;
              }
            }
          }
          
          // Method 5: Look at the screenshot you provided - for the specific case
          // where the button is near the product logo
          const productLogo = document.querySelector('.styles_logo__tzsVI') || 
                             document.querySelector('img.rounded-xl');
          if (productLogo) {
            const nearbyButtons = Array.from(productLogo.parentElement.querySelectorAll('a, button'));
            for (const btn of nearbyButtons) {
              if (btn.textContent && btn.textContent.includes('Visit') && btn.href) {
                return btn.href;
              }
            }
          }
          
          // Try product details section using standard DOM methods
          const allDivs = document.querySelectorAll('div');
          let learnMoreSection = null;
          for (const div of allDivs) {
            if (div.textContent && div.textContent.includes('Learn More')) {
              learnMoreSection = div;
              break;
            }
          }
          
          if (learnMoreSection) {
            const websiteLinks = Array.from(learnMoreSection.querySelectorAll('a'));
            for (const link of websiteLinks) {
              if (link.href && !link.href.includes('instagram.com') && !link.href.includes('producthunt.com')) {
                return link.href;
              }
            }
          }
          
          // Fallback to any external links, but filter out common social media
          const allExternalLinks = Array.from(document.querySelectorAll('a[target="_blank"][rel="noopener"]'));
          for (const link of allExternalLinks) {
            if (link.href && 
                !link.href.includes('producthunt.com') && 
                !link.href.includes('instagram.com') && 
                !link.href.includes('twitter.com') && 
                !link.href.includes('x.com') && 
                !link.href.includes('facebook.com') &&
                !link.href.includes('linkedin.com') &&
                !link.href.includes('github.com') &&
                !link.href.includes('youtube.com') &&
                !link.href.includes('medium.com')) {
              return link.href;
            }
          }
          
          return null;
        });
        
        if (directUrl) {
          console.log('Found direct URL:', directUrl);
          data.websiteUrl = directUrl;
        } else {
          // Clicking the visit button approach - this is the most reliable way
          // Set up a listener for new pages
          const newPagePromise = new Promise(resolve => {
            browser.once('targetcreated', async target => {
              const newPage = await target.page();
              resolve(newPage);
            });
          });
          
          // Click the visit button
          let buttonClicked = false;
          for (const selector of visitButtonSelectors) {
            try {
              if (await page.$(selector)) {
                await page.click(selector);
                console.log(`Clicked visit button with selector: ${selector}`);
                buttonClicked = true;
                break;
              }
            } catch (e) {
              console.log(`Error clicking selector ${selector}:`, e.message);
            }
          }
          
          if (!buttonClicked) {
            console.log('Could not click any visit button');
            
            // Last resort - try to extract the URL from the button's onclick or href
            const extractedUrl = await page.evaluate(() => {
              // Try to find button with JavaScript events
              const possibleButtons = document.querySelectorAll('button, a');
              for (const btn of possibleButtons) {
                if (btn.textContent && btn.textContent.toLowerCase().includes('visit')) {
                  // Check for href
                  if (btn.href) return btn.href;
                  // Check if parent is anchor
                  if (btn.parentElement && btn.parentElement.tagName === 'A' && btn.parentElement.href) {
                    return btn.parentElement.href;
                  }
                }
              }
              return null;
            });
            
            if (extractedUrl) {
              console.log('Found URL from button attributes:', extractedUrl);
              data.websiteUrl = extractedUrl;
            }
          } else {
            // Wait for the new page to open (with timeout)
            try {
              const newPage = await Promise.race([
                newPagePromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for new page')), 5000))
              ]);
              
              // Wait a bit for any redirects
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Get the final URL (after any redirects)
              const finalUrl = await newPage.evaluate(() => window.location.href);
              console.log('Visit button led to URL:', finalUrl);
              
              // Make sure we're not getting a social media URL
              if (!finalUrl.includes('linkedin.com') && 
                  !finalUrl.includes('instagram.com') && 
                  !finalUrl.includes('twitter.com') && 
                  !finalUrl.includes('facebook.com')) {
                data.websiteUrl = finalUrl;
              } else {
                console.log('Visit button led to social media, trying alternative method');
                // If we got a social media URL, try one more approach - look for specific "Website" text
                const websiteUrl = await page.evaluate(() => {
                  // Special handling for "Website" section 
                  // Look for the section with Website label
                  const sections = document.querySelectorAll('div');
                  for (const section of sections) {
                    if (section.textContent && section.textContent.trim() === 'Website') {
                      // Get the actual website value which might be in the next element
                      const websiteValueElement = section.nextElementSibling || 
                                               section.parentElement.nextElementSibling;
                      
                      if (websiteValueElement) {
                        // It might be just text or a link
                        const link = websiteValueElement.querySelector('a');
                        if (link && link.href) {
                          return link.href;
                        } else if (websiteValueElement.textContent) {
                          const text = websiteValueElement.textContent.trim();
                          // Basic check to see if it looks like a URL
                          if (text.includes('.') && !text.includes(' ')) {
                            // Add https if missing
                            return text.startsWith('http') ? text : `https://${text}`;
                          }
                        }
                      }
                    }
                  }
                  return null;
                });
                
                if (websiteUrl) {
                  console.log('Found website URL from Website section:', websiteUrl);
                  data.websiteUrl = websiteUrl;
                }
              }
              
              // Close the new page
              await newPage.close();
            } catch (e) {
              console.log('Error after clicking visit button:', e.message);
            }
          }
        }
      }
    } catch (innerError) {
      console.log('Error getting website URL:', innerError.message);
    }

    // Close the browser
    await browser.close();
    return data || { error: 'Failed to extract data' };
  } catch (error) {
    console.error('Error scraping Product Hunt:', error);
    
    // If we got a timeout error but the data was collected, return what we have
    if (data) {
      console.log('Error occurred but partial data was collected. Returning partial data...');
      return data;
    }
    
    return { error: error.message };
  }
}
  


  app.post('/producthuntwebsite', async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      console.log(url)
  
      const data = await scrapeProductHunt(url);
      
      if (data.error) {
        console.log('Scraping encountered an error:', data.error);
        return res.status(500).json({ 
          error: 'Failed to scrape data', 
          details: data.error,
          partial: data 
        });
      }
      
      console.log('Scraped Data:', JSON.stringify(data, null, 2));
      res.json({ 
        website: data.websiteUrl || null,
        makers: data.makers,
        productName: data.productName,
        description: data.description?.substring(0, 100) + '...' // Including some product data as fallback
      });
    } catch (error) {
      console.error('Failed to scrape:', error);
      res.status(500).json({ error: 'Failed to scrape data' });
    }
  });
  

  async function getLatestProductHuntPosts() {
    
  const API_TOKEN = "fqthilF8Q-5yXTMJGW1x1CdYnvdcJM_cdeSbEh-BBdk"; // Replace with your API token

  const query = `


  query {
      posts(first: 10) {
        edges {
          node {
            id
            name
            tagline
            description
            url
            votesCount
            commentsCount
            reviewsCount
            reviewsRating
            thumbnail {
              url
            }
            topics {
              edges {
                node {
                  id
                  name
                  slug
                  followersCount
                }
              }
            }
          }
        }
      }
    }`;
  
    const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });
  
    const data = await response.json();
    console.log(data.data.posts.edges)
    return data.data.posts.edges
  }
  
  
  
  async function getEnhancedProductHuntData() {
    try {
      // Step 1: Get the base product data
      const baseData = await getLatestProductHuntPosts();
      console.log(`Successfully retrieved ${baseData.length} products`);
      
      // Step 2: Enhance each product with additional data
      const enhancedData = [];
      
      for(let i = 0; i < baseData.length; i++) {
        const product = baseData[i];
        const node = product.node;
        
        if (!node || !node.url) {
          console.warn(`Missing URL for product at index ${i}, skipping`);
          continue;
        }
        
        try {
          console.log(node.url)
          console.log(`Fetching additional data for ${node.name} (${i+1}/${baseData.length})`);
          
          // Call the existing function to get makers and website URL
          const additionalData = await scrapeProductHunt(node.url);
          
          // Combine the data
          const enhancedProduct = {
            id: node.id,
            name: node.name,
            tagline: node.tagline,
            description: node.description,
            productHuntUrl: node.url,
            thumbnail: node.thumbnail,
            websiteUrl: additionalData.websiteUrl || 'N/A',
            makers: additionalData.makers || [],
            stats: {
              votesCount: node.votesCount,
              commentsCount: node.commentsCount,
              reviewsCount: node.reviewsCount,
              reviewsRating: node.reviewsRating
            },
            topics: node.topics
          };
          
          enhancedData.push(enhancedProduct);
          
          // Optional: Add a small delay to avoid overloading the server
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`Error enhancing data for ${node.name}:`, error);
          // Still include the product with base data only
          enhancedData.push({
            id: node.id,
            name: node.name,
            tagline: node.tagline,
            description: node.description,
            productHuntUrl: node.url,
            websiteUrl: 'N/A',
            makers: [],
            stats: {
              votesCount: node.votesCount,
              commentsCount: node.commentsCount,
              reviewsCount: node.reviewsCount,
              reviewsRating: node.reviewsRating
            },
            topics: node.topics
          });
        }
      }
      
      console.log(`Enhanced data fetching complete for ${enhancedData.length} products`);
      return enhancedData;
      
    } catch (error) {
      console.error('Failed to fetch enhanced product data:', error);
      throw error;
    }
  }


  app.post('/y-combinator', async (req, res) => {
    try {
      const { num } = req.body;
      
      amount = num || 5
      console.log(amount)
  
      const data = await getRecentYCStartups(amount);
      
      if (data.error) {
        console.log('Scraping encountered an error:', data.error);
        return res.status(500).json({ 
          error: 'Failed to scrape data', 
          details: data.error,
          partial: data 
        });
      }
      
      console.log('Scraped Data:', JSON.stringify(data, null, 2));
      res.json({ 
        data: data
      });
    } catch (error) {
      console.error('Failed to scrape:', error);
      res.status(500).json({ error: 'Failed to scrape data' });
    }
  });


  app.get('/health', (req, res) => {
    res.status(200).send('Service is up and running');
  });
  



app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
// producthunt individual
  // url = 'https://www.producthunt.com/posts/flare-6?utm_campaign=producthunt-api&utm_medium=api-v2&utm_source=Application%3A+test++%28ID%3A+169128%29'
  // const data = await scrapeProductHunt(url);
      
  // if (data.error) {
  //   console.log('Scraping encountered an error:', data.error);
  // }
  
  // console.log('Scraped Data:', JSON.stringify(data, null, 2));


    //  console.log( getLatestProductHuntPosts())
     await getEnhancedProductHuntData()
    .then(async data => {
        await require('fs').promises.writeFile(
        'company.json', 
        JSON.stringify(data, null, 2)
    );
        console.log('Operation completed successfully');
        console.log('Response data:', data);
    })
    .catch(error => {
        console.error('Operation failed:', error);
    });
});