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

async function scrapeProductHunt(url) {
  let data = null; // Define data variable in the outer scope
  try {
    // Launch browser in headless mode
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
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

    // Wait for the Visit button to be visible with increased timeout
    await page.waitForSelector('button:has(svg[data-sentry-element="ExternalIcon"])', {
      timeout: 10000 // Increase timeout to 10 seconds
    }).catch(() => console.log('Visit button not found, continuing anyway'));

    // Get initial page data
    data = await page.evaluate(() => {
      const productName = document.querySelector('h1')?.innerText;
      const description = document.querySelector('.styles_htmlText__eYPgj')?.innerText;

      const makers = Array.from(document.querySelectorAll('a[data-sentry-component="TeamUser"]') || []).map(maker => ({
        name: maker.querySelector('img')?.alt,
        profile: maker.href
      }));

      const topicsSet = new Set();
      const topics = Array.from(document.querySelectorAll('a[href^="/topics/"]') || [])
        .map(topic => ({
          name: topic.innerText,
          url: topic.href
        }))
        .filter(topic => {
          const key = `${topic.name}-${topic.url}`;
          if (topicsSet.has(key)) return false;
          topicsSet.add(key);
          return true;
        });

      const upvotes = document.querySelector('button[data-test="vote-button"] div:last-child')?.innerText;
      const comments = document.querySelector('div[data-test="post-Comments-section"]')?.innerText;

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
      
      // Click the Visit button
      await page.click('button:has(svg[data-sentry-element="ExternalIcon"])').catch(e => {
        console.log('Error clicking visit button:', e.message);
      });
      
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

  url = 'https://www.producthunt.com/posts/firsthr-2-0-with-hr-copilot?utm_campaign=producthunt-api&utm_medium=api-v2&utm_source=Application%3A+test++%28ID%3A+169128%29'
  const data = await scrapeProductHunt(url);
      
  if (data.error) {
    console.log('Scraping encountered an error:', data.error);
  }
  
  console.log('Scraped Data:', JSON.stringify(data, null, 2));
});