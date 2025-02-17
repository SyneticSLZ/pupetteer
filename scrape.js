// people
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractFounderInfo(page) {
    return await page.evaluate(() => {
        const getEmailFromText = (text) => {
            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
            const matches = text?.match(emailRegex);
            return matches ? matches[0] : null;
        };

        const founders = Array.from(document.querySelectorAll('[class*="founder"], [class*="team-member"]')).map(founder => {
            const nameEl = founder.querySelector('h3, h4, [class*="name"]');
            const roleEl = founder.querySelector('p, [class*="role"]');
            const linkedInLink = founder.querySelector('a[href*="linkedin.com"]');
            const twitterLink = founder.querySelector('a[href*="twitter.com"]');
            const githubLink = founder.querySelector('a[href*="github.com"]');
            const bioEl = founder.querySelector('[class*="bio"]');
            const email = getEmailFromText(founder.textContent);

            return {
                name: nameEl?.textContent.trim(),
                role: roleEl?.textContent.trim(),
                linkedin: linkedInLink?.href,
                twitter: twitterLink?.href,
                github: githubLink?.href,
                bio: bioEl?.textContent.trim(),
                email
            };
        });

        return founders;
    });
}

async function getCompanyContacts(page) {
    return await page.evaluate(() => {
        const contacts = {
            emails: [],
            phones: [],
            addresses: [],
            social: {}
        };

        // Extract emails
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
        const pageText = document.body.innerText;
        contacts.emails = [...new Set(pageText.match(emailRegex) || [])];

        // Extract phone numbers
        const phoneRegex = /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
        contacts.phones = [...new Set(pageText.match(phoneRegex) || [])];

        // Social media links
        const socialPatterns = {
            twitter: /twitter\.com\/([^\/\s"]+)/,
            linkedin: /linkedin\.com\/(?:company|in)\/([^\/\s"]+)/,
            github: /github\.com\/([^\/\s"]+)/,
            facebook: /facebook\.com\/([^\/\s"]+)/,
            instagram: /instagram\.com\/([^\/\s"]+)/,
            crunchbase: /crunchbase\.com\/(?:organization|person)\/([^\/\s"]+)/,
            angellist: /angel\.co\/company\/([^\/\s"]+)/
        };

        // Get all links
        const links = Array.from(document.getElementsByTagName('a')).map(a => a.href);
        
        // Extract social media handles
        for (const [platform, pattern] of Object.entries(socialPatterns)) {
            const matches = links
                .filter(link => link.match(pattern))
                .map(link => {
                    const match = link.match(pattern);
                    return match ? match[1] : null;
                })
                .filter(Boolean);
            
            if (matches.length > 0) {
                contacts.social[platform] = [...new Set(matches)];
            }
        }

        return contacts;
    });
}

async function scrapeCompanyDetails(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await delay(2000);

        const basicInfo = await page.evaluate(() => {
            const getTextContent = selector => {
                const el = document.querySelector(selector);
                return el ? el.textContent.trim() : null;
            };

            return {
                companyName: getTextContent('h1'),
                tagline: getTextContent('[class*="tagline"], [class*="headline"]'),
                description: getTextContent('[class*="description"], [class*="about"]'),
                founded: getTextContent('[class*="founded"]'),
                location: getTextContent('[class*="location"]'),
                teamSize: getTextContent('[class*="team-size"], [class*="employees"]'),
                website: document.querySelector('a[href*="http"]:not([href*="ycombinator.com"])')?.href,
                stage: getTextContent('[class*="stage"]'),
                markets: Array.from(document.querySelectorAll('[class*="market"], [class*="industry"]'))
                    .map(el => el.textContent.trim()),
                techStack: Array.from(document.querySelectorAll('[class*="tech-stack"] [class*="tag"]'))
                    .map(el => el.textContent.trim()),
                fundingAmount: getTextContent('[class*="funding"], [class*="raised"]'),
                metrics: {
                    revenue: getTextContent('[class*="revenue"]'),
                    growth: getTextContent('[class*="growth"]'),
                    users: getTextContent('[class*="users"], [class*="customers"]'),
                    arr: getTextContent('[class*="arr"]'),
                    mrr: getTextContent('[class*="mrr"]')
                }
            };
        });

        // Get founder information
        const founders = await extractFounderInfo(page);

        // Get contact information
        const contacts = await getCompanyContacts(page);

        // Get jobs
        const jobs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('[class*="job"], [class*="position"]')).map(job => {
                const title = job.querySelector('h3, [class*="title"]')?.textContent.trim();
                const location = job.querySelector('[class*="location"]')?.textContent.trim();
                const salary = job.querySelector('[class*="salary"], [class*="compensation"]')?.textContent.trim();
                const link = job.querySelector('a')?.href;
                
                return { title, location, salary, link };
            });
        });

        // Get funding information
        const funding = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('[class*="funding"], [class*="investment"]')).map(round => {
                const type = round.querySelector('[class*="round"], [class*="type"]')?.textContent.trim();
                const amount = round.querySelector('[class*="amount"]')?.textContent.trim();
                const date = round.querySelector('[class*="date"]')?.textContent.trim();
                const investors = Array.from(round.querySelectorAll('[class*="investor"]')).map(inv => inv.textContent.trim());
                
                return { type, amount, date, investors };
            });
        });

        return {
            ...basicInfo,
            founders,
            contacts,
            jobs,
            funding,
            scrapedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Error scraping details for ${url}:`, error.message);
        return null;
    }
}

async function getRecentYCStartups(limit = 10) {
    let browser;
    
    try {
        browser = await puppeteer.launch({ 
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set a more realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36');
        
        console.log('Navigating to YCombinator companies page...');
        await page.goto('https://www.ycombinator.com/companies', {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        console.log('Setting sort order to Launch Date...');
        await page.waitForSelector('select');
        await page.select('select', 'YCCompany_By_Launch_Date_production');
        await delay(3000);

        await page.waitForSelector('a[href^="/companies/"]');

        console.log('Extracting company URLs...');
        const companyUrls = await page.evaluate((maxCompanies) => {
            return Array.from(document.querySelectorAll('a[href^="/companies/"]'))
                .filter(el => el.href.split('/').length === 5)
                .slice(0, maxCompanies)
                .map(a => a.href);
        }, limit);

        console.log(`Found ${companyUrls.length} companies. Scraping detailed information...`);

        const companies = [];
        for (const url of companyUrls) {
            console.log(`Scraping ${url}...`);
            const details = await scrapeCompanyDetails(page, url);
            if (details) {
                companies.push(details);
            }
            await delay(2000); // Polite delay between requests
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = `yc-startups-detailed-${timestamp}.json`;
        
        await fs.writeFile(
            outputFile,
            JSON.stringify(companies, null, 2)
        );

        console.log(`Data saved to ${outputFile}`);
        
        // Display summary
        companies.forEach((company, index) => {
            console.log(`\n${index + 1}. ${company.companyName}`);
            console.log(`   Website: ${company.website || 'N/A'}`);
            console.log(`   Founders: ${company.founders.map(f => f.name).join(', ')}`);
            if (company.contacts.emails.length > 0) {
                console.log(`   Emails: ${company.contacts.emails.join(', ')}`);
            }
            if (Object.keys(company.contacts.social).length > 0) {
                console.log('   Social:');
                Object.entries(company.contacts.social).forEach(([platform, handles]) => {
                    console.log(`     ${platform}: ${handles.join(', ')}`);
                });
            }
        });

        // const output = `yc-founders-${timestamp}.json`;
        
        // await fs.writeFile(
        //     output,
        //     JSON.stringify(companies, null, 2)
        // );
        return companies;

    } catch (error) {
        console.error('Error during scraping:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the script
(async () => {
    try {
        await getRecentYCStartups(10);
    } catch (error) {
        console.error('Script failed:', error);
        process.exit(1);
    }
})();