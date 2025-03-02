const puppeteer = require('puppeteer');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCompanyInfo(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await delay(2000);

        // Get all text content for email extraction
        const pageText = await page.evaluate(() => document.body.innerText);
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
        const emails = [...new Set(pageText.match(emailRegex) || [])];

        // Get all links
        const links = await page.evaluate(() => {
            return Array.from(document.getElementsByTagName('a'))
                .map(a => a.href)
                .filter(Boolean);
        });

        // Extract social media profiles
        const socialProfiles = {
            linkedin: links.filter(link => link.includes('linkedin.com')).map(link => {
                const parts = link.split('/');
                return parts[parts.length - 1].replace(/\?.*$/, '');
            }),
            twitter: links.filter(link => link.includes('twitter.com')).map(link => {
                const parts = link.split('/');
                return parts[parts.length - 1].replace(/\?.*$/, '');
            }),
            github: links.filter(link => link.includes('github.com')).map(link => {
                const parts = link.split('/');
                return parts[parts.length - 1].replace(/\?.*$/, '');
            }),
            crunchbase: links.filter(link => link.includes('crunchbase.com')).map(link => {
                const parts = link.split('/');
                return parts[parts.length - 1].replace(/\?.*$/, '');
            })
        };

        // Get company website
        const website = links.find(link => 
            !link.includes('ycombinator.com') && 
            !link.includes('linkedin.com') && 
            !link.includes('twitter.com') &&
            !link.includes('github.com') &&
            !link.includes('crunchbase.com')
        );

        return {
            url,
            emails,
            website,
            socialProfiles,
            scrapedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return null;
    }
}

async function getRecentYCStartups(limit = 10) {
    let browser;
    
    try {
        // Launch browser in headless mode
        browser = await puppeteer.launch({ 
            headless: true, // Set to true for server environment
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-dev-shm-usage', // Recommended for Docker/serverless
                '--disable-gpu', // Not needed in headless mode
                '--disable-features=IsolateOrigins,site-per-process', // Helps with some navigation issues
            ]
        });
        
        const page = await browser.newPage();
        
        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        console.log('Navigating to YCombinator companies page...');
        
        await page.goto('https://www.ycombinator.com/companies', {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        await delay(5000); // Give page time to fully load

        // Sort by launch date
        console.log('Setting sort order to Launch Date...');
        await page.waitForSelector('select');
        await page.select('select', 'YCCompany_By_Launch_Date_production');
        await delay(5000); // Wait for sort to take effect

        // Get initial company data
        console.log('Getting company list...');
        const companies = await page.evaluate(() => {
            const companyElements = Array.from(document.querySelectorAll('a[href^="/companies/"]'))
                .filter(el => el.href.includes('/companies/') && !el.href.endsWith('/companies/'));

            return companyElements.map(element => {
                const container = element.closest('div');
                if (!container) return null;

                const name = element.textContent.trim();
                const href = element.href;

                // Get description
                const descElement = container.querySelector('span[class*="Description"]');
                const description = descElement ? descElement.textContent.trim() : '';

                // Get location
                const locationElement = container.querySelector('span[class*="Location"]');
                const location = locationElement ? locationElement.textContent.trim() : '';

                // Get batch info
                const batchElement = container.querySelector('span.pill');
                const batch = batchElement ? batchElement.textContent.trim() : '';

                // Get industry tags
                const tagElements = Array.from(container.querySelectorAll('span.pill'))
                    .slice(1) // Skip the first pill (batch)
                    .map(tag => tag.textContent.trim());

                return {
                    name,
                    description,
                    location,
                    batch,
                    industries: tagElements,
                    url: href
                };
            }).filter(Boolean); // Remove any null entries
        });

        if (!companies.length) {
            throw new Error('No companies found on page');
        }

        const limitedCompanies = companies.slice(0, limit);
        console.log(`Found ${limitedCompanies.length} companies. Getting detailed information...`);

        // Get detailed information for each company
        const detailedCompanies = [];
        for (const company of limitedCompanies) {
            console.log(`\nScraping detailed info for ${company.name}...`);
            const details = await getCompanyInfo(page, company.url);
            
            detailedCompanies.push({
                ...company,
                ...(details || {}),
            });

            await delay(2000); // Polite delay
        }

        // Close the browser
        await browser.close();

        // Return the data directly
        return detailedCompanies;

    } catch (error) {
        console.error('Error during scraping:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Export the functions for use in your server routes
module.exports = {
    getRecentYCStartups,
    getCompanyInfo
};

// Run the script
// (async () => {
//     try {
//      console.log( await getRecentYCStartups(5))
    
//     } catch (error) {
//         console.error('Script failed:', error);
//         process.exit(1);
//     }
// })();