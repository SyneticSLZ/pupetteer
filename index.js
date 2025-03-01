const express = require('express');
const { handleScrapeRequest } = require('./scrapeLogic');
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


// async function scrapeProductHunt(url) {
//   try {
//     // Launch browser in headless mode
//     const browser = await puppeteer.launch({
//       headless: "new",
//       args: ['--no-sandbox', '--disable-setuid-sandbox']
//     });

//     // Create new page
//     const page = await browser.newPage();

//     // Set viewport
//     await page.setViewport({ width: 1280, height: 800 });

//     // Navigate to the page
//     await page.goto(url, {
//       waitUntil: 'networkidle0',
//       timeout: 30000
//     });

//     // Wait for the Visit button to be visible
//     await page.waitForSelector('button:has(svg[data-sentry-element="ExternalIcon"])', {
//       timeout: 5000
//     });

//     // Get initial page data
//     const data = await page.evaluate(() => {
//       const productName = document.querySelector('h1')?.innerText;
//       const description = document.querySelector('.styles_htmlText__eYPgj')?.innerText;

//       const makers = Array.from(document.querySelectorAll('a[data-sentry-component="TeamUser"]')).map(maker => ({
//         name: maker.querySelector('img')?.alt,
//         profile: maker.href
//       }));

//       const topicsSet = new Set();
//       const topics = Array.from(document.querySelectorAll('a[href^="/topics/"]'))
//         .map(topic => ({
//           name: topic.innerText,
//           url: topic.href
//         }))
//         .filter(topic => {
//           const key = `${topic.name}-${topic.url}`;
//           if (topicsSet.has(key)) return false;
//           topicsSet.add(key);
//           return true;
//         });

//       const upvotes = document.querySelector('button[data-test="vote-button"] div:last-child')?.innerText;
//       const comments = document.querySelector('div[data-test="post-Comments-section"]')?.innerText;

//       return {
//         productName,
//         description,
//         makers,
//         topics,
//         stats: {
//           upvotes: upvotes?.replace('Upvote ', '') || '0',
//           comments: comments || 'N/A'
//         }
//       };
//     });

//     // Setup listener for new pages
//     const pagePromise = new Promise(resolve => browser.once('targetcreated', target => resolve(target.page())));
    
//     // Click the Visit button
//     await page.click('button:has(svg[data-sentry-element="ExternalIcon"])');
    
//     // Wait for the new page
//     const newPage = await pagePromise;
    
//     // Wait a short time for any redirects
//     await new Promise(resolve => setTimeout(resolve, 2000));
    
//     // Get the final URL
//     const finalUrl = await newPage.evaluate(() => window.location.href);
    
//     // Add the URL to our data
//     data.websiteUrl = finalUrl;

//     // Close pages
//     await newPage.close();
//     await page.close();

//     // Close browser
//     await browser.close();

//     return data;
//   } catch (error) {
//     console.error('Error scraping Product Hunt:', error);
    
//     // If we got a timeout error but the data was collected, return what we have
//     if (error.name === 'TimeoutError' && data) {
//       console.log('Timeout occurred but data was collected. Returning partial data...');
//       return data;
//     }
    
//     throw error;
//   }
// }


// // Usage example
// const productHuntUrl = 'https://www.producthunt.com/posts/firsthr-2-0-with-hr-copilot?utm_campaign=producthunt-api&utm_medium=api-v2&utm_source=Application%3A+test++%28ID%3A+169128%29';

// scrapeProductHunt(productHuntUrl)
//   .then(data => {
//     console.log('Scraped Data:', JSON.stringify(data, null, 2));
//   })
//   .catch(error => {
//     console.error('Failed to scrape:', error);
//   });

  // app.post('/producthuntwebsite', async (req, res) => {
  //   try {
  //     const { url } = req.body;
  //   const data = await scrapeProductHunt(url).then(data => {
  //     console.log('Scraped Data:', JSON.stringify(data, null, 2));
  //     res.json({ website: data.websiteUrl });
  //   })
  //   .catch(error => {
  //     console.error('Failed to scrape:', error);
  //     res.json({ website: null });
  //   });
  
      
  //   } catch (error) {
  //     res.status(500).json({ error: 'Failed to scrape data' });
  //   }
  // });


  // app.post('/producthuntwebsite', async (req, res) => {
  //   try {
  //     const { url } = req.body;
      
  //     if (!url) {
  //       return res.status(400).json({ error: 'URL is required' });
  //     }
  
  //     const data = await scrapeProductHunt(url);
  //     console.log('Scraped Data:', JSON.stringify(data, null, 2));
  //     res.json({ website: data.websiteUrl });
  //   } catch (error) {
  //     console.error('Failed to scrape:', error);
  //     res.status(500).json({ error: 'Failed to scrape data' });
  //   }
  // });


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
        'a[target="_blank"][rel="noopener"]',
        'a[href*="firsthr.app"]',
        'a.styles_button__S63G_',
        'button.styles_button__S63G_'
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
  
      // Try to get the website URL
      try {
        // First attempt to extract the URL directly from the page
        const directUrl = await page.evaluate(() => {
          // Try different methods to find the URL
          const externalLink = document.querySelector('a[target="_blank"][rel="noopener"]');
          const visitButton = document.querySelector('button:has(svg[data-sentry-element="ExternalIcon"])');
          const anyExternalLink = document.querySelector('a[href*="firsthr.app"]');
          
          if (externalLink && externalLink.href) return externalLink.href;
          if (visitButton && visitButton.parentElement && visitButton.parentElement.href) return visitButton.parentElement.href;
          if (anyExternalLink && anyExternalLink.href) return anyExternalLink.href;
          
          // Search for any button or link that might contain the URL
          const allLinks = Array.from(document.querySelectorAll('a[href*="http"]'));
          for (const link of allLinks) {
            if (link.href && !link.href.includes('producthunt.com')) {
              return link.href;
            }
          }
          
          return null;
        });
        
        if (directUrl) {
          console.log('Found URL directly:', directUrl);
          data.websiteUrl = directUrl;
        } else {
          // If direct extraction fails, try clicking approach
          // Setup listener for new pages with timeout
          const pagePromiseTimeout = 5000;
          const pagePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for new page'));
            }, pagePromiseTimeout);
            
            browser.once('targetcreated', (target) => {
              clearTimeout(timeout);
              resolve(target.page());
            });
          });
          
          // Try clicking various potential visit buttons
          let clicked = false;
          for (const selector of visitButtonSelectors) {
            try {
              if (await page.$(selector)) {
                await page.click(selector);
                console.log(`Clicked visit button with selector: ${selector}`);
                clicked = true;
                break;
              }
            } catch (e) {
              console.log(`Error clicking selector ${selector}:`, e.message);
            }
          }
          
          if (!clicked) {
            console.log('Could not click any visit button');
          }
        
        // Wait for the new page with timeout
        const newPage = await pagePromise.catch(e => {
          console.log('Error getting new page:', e.message);
          return null;
        });
        
        if (newPage) {
          // Wait a short time for any redirects
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Get the final URL
          const finalUrl = await newPage.evaluate(() => window.location.href).catch(() => null);
          
          // Add the URL to our data
          if (finalUrl) {
            data.websiteUrl = finalUrl;
          }
  
          // Close new page
          await newPage.close().catch(() => {});
        }
      }
      } catch (innerError) {
        console.log('Error getting website URL:', innerError.message);
        // Continue with the rest of the function
      }
  
      // Close page and browser
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
  
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
  
// Note: You'll need to install puppeteer first:
// npm install puppeteer


app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // url = 'https://www.producthunt.com/posts/firsthr-2-0-with-hr-copilot?utm_campaign=producthunt-api&utm_medium=api-v2&utm_source=Application%3A+test++%28ID%3A+169128%29'
  // const data = await scrapeProductHunt(url);
      
  // if (data.error) {
  //   console.log('Scraping encountered an error:', data.error);
  // }
  
  // console.log('Scraped Data:', JSON.stringify(data, null, 2));
});