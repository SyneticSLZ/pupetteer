// Main application script
// ==============================================

// Utility variables and state
let currentFile = null;
let selectedLeads = new Set();
const userUuid = localStorage.getItem('userUuid') || generateUuid();
const API_BASE_URL = 'https://investmenttool.onrender.com'; // Change to your actual API URL
const PROCESSING_STATES = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed'
};
const TASKS = {
    EMAIL_GENERATION: 'Generating personalized email',
    DATA_ENRICHMENT: 'Enriching contact data',
    LINKEDIN_SCRAPING: 'Collecting LinkedIn information',
    EMAIL_VERIFICATION: 'Verifying email address',
    COMPANY_RESEARCH: 'Researching company details'
};
const leadData = new Map();

// Initialize the application
function init() {
    // Store UUID for this session
    localStorage.setItem('userUuid', userUuid);
    
    // Set up event listeners
    setupEventListeners();
    setupTabSwitching();
    
    // Initialize modules
    initializeLeadVerification();
    
    // Set default tab if none is active
    const currentTab = localStorage.getItem('currentTab') || 'campaigns';
    document.querySelector(`[data-tab="${currentTab}"]`)?.click();
}

// Set up all event listeners
function setupEventListeners() {
    // File upload & drag/drop handling
    setupFileHandlingEvents();
    
    // Tab switching
    setupTabSwitching();
    
    // Theme toggle
    setupThemeToggle();
    
    // Sidebar toggle for mobile
    setupSidebarToggle();
}

// File upload and drag/drop event handlers
function setupFileHandlingEvents() {
    const dropZone = document.querySelector('label[for="excel-upload"]');
    const fileInput = document.getElementById('excel-upload');
    
    if (!dropZone || !fileInput) return;
    
    // File drag events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-gray-600');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-gray-600');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-gray-600');
        
        if (e.dataTransfer.files.length) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileSelection(e.target.files[0]);
        }
    });
}

// Tab switching functionality
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Hide all tab contents
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });
            
            // Show selected tab content
            document.getElementById(tabId)?.classList.remove('hidden');
            
            // Update active state of tab buttons
            tabButtons.forEach(btn => {
                btn.classList.remove('bg-gray-100', 'dark:bg-gray-700');
            });
            button.classList.add('bg-gray-100', 'dark:bg-gray-700');
            
            // Save current tab to localStorage
            localStorage.setItem('currentTab', tabId);
            
            // Initialize modules on tab switch
            if (tabId === 'gmail') {
                gmailIntegration.init();
            } else if (tabId === 'campaigns-manager') {
                campaignManager.init();
            }
        });
    });
}

// Theme toggle functionality
function setupThemeToggle() {
    const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
    const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');
    const themeToggleBtn = document.getElementById('theme-toggle');

    if (!themeToggleBtn || !themeToggleDarkIcon || !themeToggleLightIcon) return;

    // Set initial state
    if (localStorage.getItem('color-theme') === 'dark' || 
        (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        themeToggleLightIcon.classList.remove('hidden');
        document.documentElement.classList.add('dark');
    } else {
        themeToggleDarkIcon.classList.remove('hidden');
        document.documentElement.classList.remove('dark');
    }

    // Toggle theme
    themeToggleBtn.addEventListener('click', function() {
        // Toggle icons
        themeToggleDarkIcon.classList.toggle('hidden');
        themeToggleLightIcon.classList.toggle('hidden');

        // Toggle theme
        if (localStorage.getItem('color-theme')) {
            if (localStorage.getItem('color-theme') === 'light') {
                document.documentElement.classList.add('dark');
                localStorage.setItem('color-theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('color-theme', 'light');
            }
        } else {
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('color-theme', 'light');
            } else {
                document.documentElement.classList.add('dark');
                localStorage.setItem('color-theme', 'dark');
            }
        }
    });
}

// Sidebar toggle for mobile
function setupSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (!sidebarToggle || !sidebar) return;

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('-translate-x-full');
    });
}

// File Handling Functions
// ==============================================

// Handle file selection
function handleFileSelection(file) {
    if (!isValidExcelFile(file)) {
        showError('Please upload a valid Excel file (XLSX or XLS)');
        resetFileInput();
        return;
    }

    currentFile = file;
    updateUIForFileSelection(file);
    processExcelFile(file);
}

// Check if file is valid Excel
function isValidExcelFile(file) {
    const validExtensions = ['xlsx', 'xls', 'csv'];
    const extension = file.name.split('.').pop().toLowerCase();
    return validExtensions.includes(extension);
}

// Update UI after file selection
function updateUIForFileSelection(file) {
    const fileNameDisplay = document.getElementById('file-name');
    const dropZone = document.querySelector('label[for="excel-upload"]');
    
    if (!fileNameDisplay || !dropZone) return;
    
    // Update file name display
    fileNameDisplay.textContent = file.name;
    fileNameDisplay.classList.remove('hidden');

    // Update drop zone appearance
    dropZone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-gray-600');
    const uploadText = dropZone.querySelector('p');
    if (uploadText) {
        uploadText.textContent = `File selected: ${file.name}`;
    }

    // Reset UI after animation
    setTimeout(() => {
        dropZone.classList.remove('border-green-500', 'bg-green-50', 'dark:bg-gray-600');
    }, 2000);
}

// Reset file input
function resetFileInput() {
    const fileInput = document.getElementById('excel-upload');
    const fileNameDisplay = document.getElementById('file-name');
    const leadsSkeleton = document.getElementById('leads-skeleton');
    const leadsTable = document.getElementById('leads-table');
    const campaignActions = document.getElementById('campaign-actions');
    const campaignPreview = document.getElementById('campaign-preview');
    
    if (fileInput) fileInput.value = '';
    if (fileNameDisplay) fileNameDisplay.classList.add('hidden');
    
    currentFile = null;
    
    // Reset UI elements
    if (leadsSkeleton) leadsSkeleton.classList.add('hidden');
    if (leadsTable) leadsTable.classList.add('hidden');
    if (campaignActions) campaignActions.classList.add('hidden');
    if (campaignPreview) campaignPreview.classList.add('hidden');
    
    selectedLeads.clear();
    leadData.clear();
}

// Process Excel file
async function processExcelFile(file) {
    const leadsSkeleton = document.getElementById('leads-skeleton');
    const leadsTable = document.getElementById('leads-table');
    if (leadsSkeleton) leadsSkeleton.classList.remove('hidden');
    if (leadsTable) leadsTable.classList.add('hidden');
    try {
        const data = await handleExcelFile(file);
        if (data && data.length > 0) {
            createLeadsTable(data);
        } else {
            throw new Error('No valid data found in file');
        }
    } catch (error) {
        console.error('Error processing Excel file:', error);
        showError('Error processing Excel file: ' + error.message);
        resetFileInput();
    } finally {
        if (leadsSkeleton) leadsSkeleton.classList.add('hidden');
    }
}

// Parse Excel data
async function handleExcelFile(file) {
    try {
        console.log('Starting Excel file processing:', file.name);
        const arrayBuffer = await file.arrayBuffer();
        
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
            type: 'array',
            cellDates: true,
            cellNF: false,
            cellText: false,
            raw: true
        });

        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON with row array format
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            blankrows: false
        });

        // Process each row
        const processedData = [];
        for (let i = 1; i < jsonData.length; i++) { // Skip header row
            const row = jsonData[i];
            
            // Skip empty rows
            if (!row || !row.some(cell => cell && cell.toString().trim() !== '')) {
                continue;
            }

            const rowData = {
                company: row[0] || '',
                first_name: row[1] || '',
                last_name: row[2] || '',
                title: row[3] || '',
                email_1: row[4] || '',
                email_2: row[5] || '',
                revenue: row[6] ? formatRevenue(row[6]) : '',
                website: row[7] || '',
                linkedin: row[8] || '',
                industry: row[10] || '',
                employees: row[11] || '',
                city: row[12] || '',
                state: row[13] || ''
            };

            // Validate the row has at least some required fields
            if (rowData.company || rowData.first_name || rowData.email_1) {
                processedData.push(rowData);
            }
        }

        return processedData;
    } catch (error) {
        console.error('Error processing Excel file:', error);
        throw error;
    }
}

// Format revenue values
function formatRevenue(value) {
    try {
        const num = parseFloat(value.toString().replace(/[^0-9.]/g, ''));
        if (isNaN(num)) return value;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    } catch (error) {
        console.error('Error formatting revenue:', error);
        return value;
    }
}

// Create and display leads table
function createLeadsTable(data) {
    try {
        if (!data || data.length === 0) {
            throw new Error('No valid data to display');
        }

        const leadsSkeleton = document.getElementById('leads-skeleton');
        const leadsTable = document.getElementById('leads-table');
        const campaignActions = document.getElementById('campaign-actions');
        
        // Show table and hide skeleton
        if (leadsSkeleton) leadsSkeleton.classList.add('hidden');
        if (leadsTable) leadsTable.classList.remove('hidden');
        if (campaignActions) campaignActions.classList.remove('hidden');

        if (!leadsTable) {
            throw new Error('Table container not found');
        }

        // Create campaign summary
        const campaignControls = document.createElement('div');
        campaignControls.className = 'mb-6 p-4 bg-slate-800 rounded-lg';
        campaignControls.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <div class="text-sm text-gray-300">
                        <span class="font-medium">Total Leads:</span>
                        <span class="ml-1">${data.length}</span>
                    </div>
                    <div class="text-sm text-gray-300">
                        <span class="font-medium">Estimated Time:</span>
                        <span class="ml-1">${Math.ceil(data.length * 1.5)} minutes</span>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button id="verify-leads-button" 
                            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                                   transition-colors flex items-center">
                        <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Verify & Create Campaign</span>
                    </button>
                    <button id="start-campaign" 
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                   transition-colors flex items-center">
                        <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                        <span>Process Leads</span>
                    </button>
                </div>
            </div>
        `;

        // Create table structure
        const columns = [
            { key: 'company', label: 'COMPANY' },
            { key: 'first_name', label: 'FIRST NAME' },
            { key: 'last_name', label: 'LAST NAME' },
            { key: 'title', label: 'TITLE' },
            { key: 'email_1', label: 'PRIMARY EMAIL' },
            { key: 'revenue', label: 'REVENUE' },
            { key: 'employees', label: 'EMPLOYEES' },
            { key: 'city', label: 'CITY' },
            { key: 'state', label: 'STATE' },
            { key: 'status', label: 'STATUS' }
        ];

        const table = document.createElement('div');
        table.className = 'overflow-x-auto';
        table.innerHTML = `
            <table class="min-w-full">
                <thead>
                    <tr class="bg-slate-700">
                        ${columns.map(col => `
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                ${col.label}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody class="bg-slate-800 divide-y divide-slate-700">
                    ${data.map((row, index) => `
                        <tr class="${index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-750'}">
                            ${columns.map(col => {
                                if (col.key === 'status') {
                                    return `
                                        <td class="px-6 py-4 whitespace-nowrap status-cell">
                                            <span class="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-800">
                                                Pending
                                            </span>
                                        </td>
                                    `;
                                }
                                return `
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        ${row[col.key] || ''}
                                    </td>
                                `;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Update the container
        leadsTable.innerHTML = '';
        leadsTable.appendChild(campaignControls);
        leadsTable.appendChild(table);

        // Add event listeners for buttons
        // document.getElementById('start-campaign')?.addEventListener('click', function() {
        //     this.disabled = true;
        //     this.innerHTML = `
        //         <div class="flex items-center space-x-2">
        //             <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        //             <span>Processing...</span>
        //         </div>
        //     `;
        //     this.className += ' opacity-75 cursor-not-allowed';
        //     startCampaign(data);
        // });

        document.getElementById('start-campaign')?.addEventListener('click', function() {
            this.disabled = true;
            this.innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Processing...</span>
                </div>
            `;
            this.className += ' opacity-75 cursor-not-allowed';
            createAndStartCampaign(data); // Use centralized function
        });

        document.getElementById('verify-leads-button')?.addEventListener('click', function() {
            verifyAndPrepareLeads(data);
        });

    } catch (error) {
        console.error('Error creating table:', error);
        showError(error.message);
    }
}



async function createAndStartCampaign(leadsData, source = 'upload') {
    if (!leadsData || !leadsData.length) {
        showError('No leads data provided');
        return;
    }

    let mailboxId;
    try {
        const response = await fetch(`${API_BASE_URL}/mailboxes/${userUuid}`);
        const data = await response.json();
        if (!data.mailboxes || data.mailboxes.length === 0) {
            showError('No Gmail accounts connected. Please connect an account first.');
            return;
        }
        mailboxId = data.mailboxes[0];
    } catch (error) {
        console.error('Error fetching mailboxes:', error);
        showError('Failed to fetch Gmail accounts');
        return;
    }

    const campaignName = `Medical Device Sale Campaign - ${new Date().toISOString().slice(0, 10)}`;
    const emails = [];
    const followUps = [
        { waitDuration: 3, waitUnit: 'days', sequenceNumber: 1 },
        { waitDuration: 7, waitUnit: 'days', sequenceNumber: 2 },
        { waitDuration: 14, waitUnit: 'days', sequenceNumber: 3 }
    ];

    for (const [index, lead] of leadsData.entries()) {
        try {
            const row = findRowByLeadData(document.querySelector('#leads-table table'), lead);
            if (!row) continue;

            updateRowStatus(row, PROCESSING_STATES.IN_PROGRESS, TASKS.EMAIL_GENERATION);

            const enrichedData = await processLead(lead, row);
            leadData.set(index, enrichedData);

            emails.push({
                to: lead.email_1,
                subject: enrichedData.emailData.subject,
                body: enrichedData.emailData.body,
                metadata: enrichedData.metadata
            });

            updateRowStatus(row, PROCESSING_STATES.COMPLETED, 'Complete');
            addViewButton(row, index);
        } catch (error) {
            console.error('Error processing lead:', error);
            const row = findRowByLeadData(document.querySelector('#leads-table table'), lead);
            if (row) updateRowStatus(row, PROCESSING_STATES.FAILED, 'Processing failed');
        }
    }

    // Schedule campaign
    try {


        const response = await fetch(`${API_BASE_URL}/campaign/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uuid: userUuid,
                mailboxId,
                leads: emails,
                campaignName,
                sendInterval: 60,
                startDate: new Date().toISOString(),
                settings: { trackOpens: true, trackClicks: true, stopOnReply: true, stopOnClick: false },
                followUps: followUps.map(f => ({
                    subject: generateFollowUpEmail(emails[0].metadata, f.sequenceNumber).subject,
                    body: generateFollowUpEmail(emails[0].metadata, f.sequenceNumber).body,
                    waitDuration: f.waitDuration,
                    waitUnit: f.waitUnit
                }))
            })
        });
    
        const result = await response.json();
        if (result.success) {
            const campaignId = result.campaignId;
            const campaign = {
                id: campaignId,
                name: campaignName,
                sendingAccount: mailboxId,
                initialEmail: { subject: emails[0].subject, body: emails[0].body },
                followUpEmails: followUps.map(f => generateFollowUpEmail(emails[0].metadata, f.sequenceNumber)),
                leadCount: emails.length,
                sentCount: 0,
                status: 'Scheduled',
                createdAt: new Date().toISOString(),
                nextFollowUp: new Date().toISOString()
            };
            campaignManager.campaigns.push(campaign);
            localStorage.setItem('campaigns', JSON.stringify(campaignManager.campaigns));
            campaignManager.renderCampaignsList();
            showToast(`Campaign "${campaignName}" scheduled successfully!`, 'success');
    
            // Trigger initial send with campaignId
            await fetch(`${API_BASE_URL}/campaign/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'campaign-id': campaignId },
                body: JSON.stringify({
                    uuid: userUuid,
                    mailboxId,
                    emails,
                    campaignName,
                    sendInterval: 60
                })
            });
            startCampaignStatusPolling(campaignId);
        } else {
            throw new Error(result.error);
        }



    } catch (error) {
        console.error('Error scheduling campaign:', error);
        showError('Failed to schedule campaign: ' + error.message);
    }

    showCompletionModal(leadsData.length);
}

// New function to poll campaign status
function startCampaignStatusPolling(campaignId) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/campaigns/${userUuid}/${campaignId}`);
            const data = await response.json();
            if (data.success) {
                const campaign = campaignManager.campaigns.find(c => c.id === campaignId);
                if (campaign) {
                    campaign.sentCount = data.campaigns[0].sentCount || 0;
                    campaign.status = data.campaigns[0].status || 'Scheduled';
                    localStorage.setItem('campaigns', JSON.stringify(campaignManager.campaigns));
                    campaignManager.renderCampaignsList();
                }
            }
        } catch (error) {
            console.error('Error polling campaign status:', error);
            clearInterval(interval); // Stop polling on error
        }
    }, 30000); // Poll every 30 seconds
}

// Process leads for campaign
async function startCampaign(leadsData) {
    if (!leadsData || !leadsData.length) {
        showError('No leads data provided');
        return;
    }

    const table = document.querySelector('#leads-table table');
    if (!table) {
        showError('Table not found');
        return;
    }

    // Fetch connected Gmail accounts
    let mailboxId;
    try {
        const response = await fetch(`${API_BASE_URL}/mailboxes/${userUuid}`);
        const data = await response.json();
        if (!data.mailboxes || data.mailboxes.length === 0) {
            showError('No Gmail accounts connected. Please connect an account first.');
            return;
        }
        mailboxId = data.mailboxes[0]; // Use the first connected account
    } catch (error) {
        console.error('Error fetching mailboxes:', error);
        showError('Failed to fetch Gmail accounts');
        return;
    }

    // Prepare campaign data
    const campaignName = `Medical Device Sale Campaign - ${new Date().toISOString().slice(0, 10)}`;
    const emails = [];
    const followUps = [
        { waitDuration: 3, waitUnit: 'days', sequenceNumber: 1 },
        { waitDuration: 7, waitUnit: 'days', sequenceNumber: 2 },
        { waitDuration: 14, waitUnit: 'days', sequenceNumber: 3 }
    ];

    for (const [index, lead] of leadsData.entries()) {
        try {
            const row = findRowByLeadData(table, lead);
            if (!row) continue;

            updateRowStatus(row, PROCESSING_STATES.IN_PROGRESS, TASKS.EMAIL_GENERATION);

            const enrichedData = await processLead(lead, row);
            leadData.set(index, enrichedData);

            // Initial email
            emails.push({
                to: lead.email_1,
                subject: enrichedData.emailData.subject,
                body: enrichedData.emailData.body,
                metadata: enrichedData.metadata
            });

            updateRowStatus(row, PROCESSING_STATES.COMPLETED, 'Complete');
            addViewButton(row, index);
        } catch (error) {
            console.error('Error processing lead:', error);
            const row = findRowByLeadData(table, lead);
            if (row) updateRowStatus(row, PROCESSING_STATES.FAILED, 'Processing failed');
        }
    }

    // Schedule campaign with follow-ups
    try {
        const response = await fetch(`${API_BASE_URL}/campaign/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uuid: userUuid,
                mailboxId,
                leads: emails,
                campaignName,
                sendInterval: 60, // 1 minute between emails
                startDate: new Date().toISOString(),
                settings: {
                    trackOpens: true,
                    trackClicks: true,
                    stopOnReply: true,
                    stopOnClick: false
                },
                followUps: followUps.map(f => ({
                    subject: generateFollowUpEmail(emails[0].metadata, f.sequenceNumber).subject,
                    body: generateFollowUpEmail(emails[0].metadata, f.sequenceNumber).body,
                    waitDuration: f.waitDuration,
                    waitUnit: f.waitUnit
                }))
            })
        });

        const result = await response.json();
        if (result.success) {
            showToast(`Campaign "${campaignName}" scheduled successfully!`, 'success');
            campaignManager.campaigns.push({
                id: result.campaignId,
                name: campaignName,
                sendingAccount: mailboxId,
                initialEmail: { subject: emails[0].subject, body: emails[0].body },
                followUpEmails: followUps.map(f => generateFollowUpEmail(emails[0].metadata, f.sequenceNumber)),
                leadCount: emails.length,
                sentCount: 0,
                status: 'Scheduled',
                createdAt: new Date().toISOString(),
                nextFollowUp: new Date().toISOString()
            });
            campaignManager.renderCampaignsList();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error scheduling campaign:', error);
        showError('Failed to schedule campaign: ' + error.message);
    }

    showCompletionModal(leadsData.length);
}

const EMAIL_SIGNATURE = `
    <br><br>
    <table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; font-size: 12px; color: #333;">
        <tr>
            <td style="padding-right: 15px; vertical-align: top;">
                <img src="https://syneticslz.github.io/pupetteer/logo.png" alt="EntelMedLifeLine Logo" width="100" height="50" style="display: block;">
            </td>
            <td style="vertical-align: top;">
                <strong>Sapna Ravula</strong><br>
                Cebron Group<br>
                Investment Banking - Healthcare M&A<br>
                Phone: +1-123-456-7890<br>
                Email: sapna.ravula@cebrongroup.com<br>
                Website: <a href="https://www.cebrongroup.com" style="color: #007BFF; text-decoration: none;">www.cebrongroup.com</a>
            </td>
        </tr>
    </table>
`;

async function processLead(lead, row) {
    try {
        const metadata = {
            company: {
                name: lead.company || '',
                revenue: lead.revenue || '',
                employees: lead.employees || '',
                location: `${lead.city || ''}, ${lead.state || ''}`,
                industry: lead.industry || 'Medical Device Manufacturing',
                website: lead.website || ''
            },
            contact: {
                firstName: lead.first_name || '',
                lastName: lead.last_name || '',
                title: lead.title || '',
                email: lead.email_1 || '',
                email2: lead.email_2 || '',
                linkedin: lead.linkedin || ''
            }
        };

        let websiteData = null;
        let emailValidation = null;

        if (lead.website) {
            updateRowStatus(row, PROCESSING_STATES.IN_PROGRESS, 'Scraping website data');
            websiteData = await processWebsiteData(lead.website);
        }

        if (lead.email_1) {
            updateRowStatus(row, PROCESSING_STATES.IN_PROGRESS, TASKS.EMAIL_VERIFICATION);
            emailValidation = await validateEmail(lead.email_1);
        }

        updateRowStatus(row, PROCESSING_STATES.IN_PROGRESS, 'Generating email');
        const emailData = generateBasicEmail(metadata, websiteData);

        return {
            lead,
            emailData,
            websiteData: websiteData || { data: { business: { categories: { industries: ['Medical Device Manufacturing'] } } } },
            emailValidation: emailValidation || { isValid: true, confidence: 70, details: { info: 'Basic validation only' } },
            metadata
        };
    } catch (error) {
        console.error('Error in processLead:', error);
        return {
            lead,
            emailData: generateBasicEmail({ company: { name: lead.company }, contact: { firstName: lead.first_name, lastName: lead.last_name, title: lead.title, email: lead.email_1 } }),
            metadata: { company: { name: lead.company }, contact: { firstName: lead.first_name, lastName: lead.last_name } }
        };
    }
}

// async function startCampaign(leadsData) {
//     if (!leadsData || !leadsData.length) {
//         showError('No leads data provided');
//         return;
//     }

//     const table = document.querySelector('#leads-table table');
//     if (!table) {
//         showError('Table not found');
//         return;
//     }

//     // Process each lead
//     for (const [index, lead] of leadsData.entries()) {
//         try {
//             const row = findRowByLeadData(table, lead);
//             if (!row) {
//                 console.warn('Row not found for lead:', lead);
//                 continue;
//             }

//             // Update status to processing
//             updateRowStatus(row, PROCESSING_STATES.IN_PROGRESS, TASKS.EMAIL_GENERATION);
            
//             // Process the lead
//             const enrichedData = await processLead(lead, row);
//             leadData.set(index, enrichedData);
            
//             // Update UI
//             updateRowStatus(row, PROCESSING_STATES.COMPLETED, 'Complete');
//             addViewButton(row, index);
//         } catch (error) {
//             console.error('Error processing lead:', error);
//             const row = findRowByLeadData(table, lead);
//             if (row) {
//                 updateRowStatus(row, PROCESSING_STATES.FAILED, 'Processing failed');
//             }
//         }
//     }

//     showCompletionModal(leadsData.length);
// }

// Process individual lead
// async function processLead(lead, row) {
//     try {
//         // Base metadata that will always work
//         const metadata = {
//             company: {
//                 name: lead.company || '',
//                 revenue: lead.revenue || '',
//                 employees: lead.employees || '',
//                 location: `${lead.city || ''}, ${lead.state || ''}`,
//                 industry: lead.industry || 'Medical Device Manufacturing',
//                 website: lead.website || ''
//             },
//             contact: {
//                 firstName: lead.first_name || '',
//                 lastName: lead.last_name || '',
//                 title: lead.title || '',
//                 email: lead.email_1 || '',
//                 email2: lead.email_2 || '',
//                 linkedin: lead.linkedin || ''
//             }
//         };

//         // Try to get enhanced data but don't fail if it doesn't work
//         let websiteData = null;
//         let emailValidation = null;

//         if (lead.website) {
//             try {
//                 updateRowStatus(row, PROCESSING_STATES.IN_PROGRESS, 'Scraping website data');
//                 websiteData = await processWebsiteData(lead.website);
//             } catch (error) {
//                 console.warn('Website scraping failed:', error);
//                 // Continue without website data
//             }
//         }

//         if (lead.email_1) {
//             try {
//                 updateRowStatus(row, PROCESSING_STATES.IN_PROGRESS, TASKS.EMAIL_VERIFICATION);
//                 emailValidation = await validateEmail(lead.email_1);
//             } catch (error) {
//                 console.warn('Email validation failed:', error);
//                 // Continue without email validation
//             }
//         }

//         // Generate email content with available data
//         updateRowStatus(row, PROCESSING_STATES.IN_PROGRESS, 'Generating email');
//         const emailData = generateBasicEmail(metadata, websiteData);

//         // Always return data object with fallbacks
//         return {
//             lead,
//             emailData,
//             websiteData: websiteData || {
//                 data: {
//                     business: {
//                         categories: { industries: ['Medical Device Manufacturing'] }
//                     }
//                 }
//             },
//             emailValidation: emailValidation || {
//                 isValid: true,
//                 confidence: 70,
//                 details: { info: 'Basic validation only' }
//             },
//             metadata
//         };
//     } catch (error) {
//         console.error('Error in processLead:', error);
//         // Return basic data even if something fails
//         return {
//             lead,
//             emailData: generateBasicEmail({
//                 company: { name: lead.company },
//                 contact: { 
//                     firstName: lead.first_name,
//                     lastName: lead.last_name,
//                     title: lead.title,
//                     email: lead.email_1
//                 }
//             }),
//             metadata: {
//                 company: { name: lead.company },
//                 contact: { 
//                     firstName: lead.first_name,
//                     lastName: lead.last_name
//                 }
//             }
//         };
//     }
// }

// Process website data
async function processWebsiteData(url) {
    // Simulate website processing
    // In a real application, this would call your API
    await simulateDelay();
    
    // Return mock data
    return {
        data: {
            business: {
                categories: { 
                    industries: ['Medical Device Manufacturing'] 
                },
                metrics: {
                    companyAge: Math.floor(Math.random() * 20) + 1
                }
            },
            people: {
                phones: ['+1 (555) ' + Math.floor(Math.random() * 900 + 100) + '-' + Math.floor(Math.random() * 9000 + 1000)]
            }
        }
    };
}

// Validate email
async function validateEmail(email) {
    try {
        // In a real app, you would call your API that uses Hunter.io
        const response = await fetch(`${API_BASE_URL}/verify-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        if (!response.ok) {
            throw new Error('Email validation failed');
        }
        
        const data = await response.json();
        return data.result;
    } catch (error) {
        console.error('Email validation API error:', error);
        
        // Fallback to simulation if API fails
        await simulateDelay();
        
        // Generate random validation result
        const score = Math.random();
        return {
            isValid: score > 0.3,
            confidence: Math.round(score * 100),
            details: {
                score: score,
                regexp: true,
                gibberish: false,
                disposable: false,
                webmail: email.includes('gmail') || email.includes('yahoo') || email.includes('hotmail'),
                mx_records: true,
                smtp_server: true,
                smtp_check: true,
                accepted_email: true,
                block: false,
                sources: []
            }
        };
    }
}

// Generate email content
// function generateBasicEmail(metadata, websiteData = null) {
//     const { company, contact } = metadata;
    
//     // Generate subject line using company details
//     const subject = `Strategic Medical Device Manufacturing Partnership - ${company.name}`;

//     // Build personalized intro based on available data
//     const intro = `Dear ${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''},

// I hope this email finds you well. I noticed ${company.name}'s impressive work in the medical device manufacturing industry${
//     company.revenue ? ` with annual revenue of ${company.revenue}` : ''
// }${company.location ? `, based in ${company.location}` : ''}.`;

//     // Build value proposition based on company size
//     const valueProposition = company.employees && parseInt(company.employees) > 0 ? 
//         `\n\nWith your team of ${company.employees} employees, I understand the complexity of managing large-scale medical device manufacturing operations.` :
//         `\n\nAs a growing medical device manufacturer, I understand the challenges of scaling operations while maintaining quality and compliance.`;

//     // Add specific details from website scraping if available
//     const websiteInsights = websiteData?.data?.business?.categories?.industries ? 
//         `\n\nYour focus on ${websiteData.data.business.categories.industries.join(', ')} aligns perfectly with our expertise.` : '';

//     // Build the complete email body
//     const body = `${intro}${valueProposition}${websiteInsights}

// Our team specializes in helping medical device manufacturers:
// - Optimize manufacturing processes while maintaining FDA compliance
// - Reduce time-to-market for new devices
// - Implement quality management systems that exceed industry standards
// - Scale operations efficiently while maintaining margins

// Would you be open to a brief call to discuss how we could support ${company.name}'s continued growth and success in the medical device market?

// Best regards,
// [Sender Name]${contact.linkedin ? `\n\nP.S. I'd welcome connecting on LinkedIn as well: ${contact.linkedin}` : ''}`;

//     return {
//         subject,
//         body,
//         metadata,
//         confidence: calculateBasicConfidence(metadata)
//     };
// }


function generateBasicEmail(metadata, websiteData = null) {
    const { company, contact } = metadata;

    const subject = `Strategic Support for Selling Your Medical Device Business`;

    const body = `Hello ${contact.firstName || '[Name]'},

I would like to introduce our firm, Cebron Group. We are an investment banking firm specializing in healthcare M&A, with a focus on medical devices, medical device distribution and manufacturing, and medical equipment. We offer comprehensive advisory services tailored to maximize value for our clients during the sale process.

Our approach includes:
- Extensive Market Access: We leverage our network of strategic buyers, private equity firms, and industry investors to ensure your business is presented to a broad range of qualified buyers.
- In-Depth Valuation and Strategic Positioning: We conduct a detailed analysis to determine your business's optimal valuation and position it to attract competitive offers. This includes assessing growth potential, market position, and operational efficiencies${company.revenue ? `, especially considering your impressive revenue of ${company.revenue}` : ''}.
- End-to-End Transaction Support: We manage every step of the transaction, from initial preparation to buyer identification, due diligence, and negotiation. Our team is experienced in structuring complex deals to achieve favorable terms for sellers.
- Confidential and Efficient Process: We prioritize discretion and efficiency, ensuring that your business operations remain unaffected during the sale process while expediting timelines to closure.

If you are considering selling your business${company.name ? `, ${company.name}` : ''}, I would be glad to discuss how Cebron can deliver value and secure the best outcome for you. Please let me know if you are available for a 10-minute call.

${EMAIL_SIGNATURE}`;

    return {
        subject,
        body,
        metadata,
        confidence: calculateBasicConfidence(metadata)
    };
}

// Calculate email confidence score
function calculateBasicConfidence(metadata) {
    let score = 50; // Start with base score
    
    // Add points for available data
    if (metadata.company.name) score += 10;
    if (metadata.contact.firstName) score += 10;
    if (metadata.contact.lastName) score += 10;
    if (metadata.contact.email) score += 10;
    if (metadata.company.revenue) score += 5;
    if (metadata.company.employees) score += 5;
    
    return Math.min(score, 100);
}

function generateFollowUpEmail(metadata, sequenceNumber) {
    const { company, contact } = metadata;
    let subject, body;

    switch (sequenceNumber) {
        case 1:
            subject = `Strategic Insights for Selling Your Medical Device Business`;
            body = `Hello ${contact.firstName || '[Name]'},

Following up on my previous message, I want to provide more clarity on how Cebron Group can drive value during the sale process of your ${company.name ? `${company.name}` : 'home medical device'} business.

We specialize in designing tailored strategies based on your company's unique strengths, market trends, and competitive positioning${company.industry ? ` within the ${company.industry} sector` : ''}. Our expertise in the healthcare sector allows us to identify high-value opportunities that align with seller demands, ensuring optimal pricing and terms.

If you’re interested in exploring this further, I’d be happy to discuss a more detailed plan during a brief call.

${EMAIL_SIGNATURE}`;
            break;

        case 2:
            subject = `Ensuring Transaction Readiness for Your Medical Device Business`;
            body = `Hello ${contact.firstName || '[Name]'},

I am following up to emphasize one of Cebron Group’s core capabilities: preparing businesses for a transaction-ready state. We conduct a comprehensive analysis to identify potential issues affecting valuation or deal success${company.revenue ? `, such as optimizing your ${company.revenue} revenue stream` : ''}, allowing us to address these proactively.

By preparing your business${company.name ? `, ${company.name},` : ''} thoroughly before engaging buyers, we ensure a smoother negotiation process and maximize competitive tension among potential acquirers.

If you would like to explore this process in more depth, please let me know when you’re available for a 10-minute call.

${EMAIL_SIGNATURE}`;
            break;

        case 3:
            subject = `Using Cebron Group's M&A Expertise for Your Sale Process`;
            body = `Hello ${contact.firstName || '[Name]'},

As a follow-up to our previous emails, I’d like to emphasize what differentiates Cebron in managing M&A transactions for medical device businesses${company.name ? ` like ${company.name}` : ''}.

Our team combines sector-specific insights with financial expertise, providing clients with a clear understanding of deal structures and valuation drivers. We secure offers and enhance terms that deliver higher seller value—whether through cash consideration, earnouts, or equity rollovers, depending on your strategic goals${company.employees ? ` and the scale of your ${company.employees}-employee operation` : ''}.

If you are interested in discussing our approach and how it can benefit your business, please let me know your availability for a brief call.

${EMAIL_SIGNATURE}`;
            break;

        default:
            subject = `Follow-Up: Exploring Opportunities with ${company.name || 'Your Business'}`;
            body = `Hello ${contact.firstName || '[Name]'},

Just checking in regarding our previous discussions about supporting ${company.name || 'your business'} through the sale process. Please let me know if you’d like to connect for a quick call.

${EMAIL_SIGNATURE}`;
    }

    return {
        subject,
        body,
        metadata,
        confidence: calculateBasicConfidence(metadata)
    };
}

// Update row status in table
function updateRowStatus(row, state, task) {
    if (!row) {
        console.error('No row provided for status update');
        return;
    }

    const statusCell = row.querySelector('.status-cell');
    if (!statusCell) {
        console.error('No status cell found in row');
        return;
    }

    const statusClasses = {
        [PROCESSING_STATES.PENDING]: 'bg-gray-100 text-gray-600',
        [PROCESSING_STATES.IN_PROGRESS]: 'bg-blue-100 text-blue-600',
        [PROCESSING_STATES.COMPLETED]: 'bg-green-100 text-green-600',
        [PROCESSING_STATES.FAILED]: 'bg-red-100 text-red-600'
    };

    statusCell.innerHTML = `
        <div class="flex items-center space-x-2 px-4 py-2 rounded-full ${statusClasses[state]}">
            ${state === PROCESSING_STATES.IN_PROGRESS ? 
                '<div class="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>' : 
                ''
            }
            <span>${task}</span>
        </div>
    `;
}

// Add view button to row
function addViewButton(row, index) {
    // Remove existing view button if any
    const existingButton = row.querySelector('.view-button');
    if (existingButton) {
        existingButton.remove();
    }

    const actionsCell = document.createElement('td');
    actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';
    actionsCell.innerHTML = `
        <button onclick="showLeadModal(${index})" 
                class="view-button text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
            View Details
        </button>
    `;
    row.appendChild(actionsCell);
}

// Show lead details modal
function showLeadModal(index) {
    const data = leadData.get(index);
    if (!data) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="relative w-11/12 max-w-5xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
                <div class="flex items-center space-x-4">
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                        ${data.emailData.metadata.company.name}
                    </h3>
                    <div class="flex space-x-2">
                        ${data.emailValidation ? `
                            <span class="px-3 py-1 text-sm rounded-full ${
                                data.emailValidation.confidence >= 80 ? 'bg-green-100 text-green-800' :
                                data.emailValidation.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'// Continuation of the code...

                            }">
                                Email Confidence: ${data.emailValidation.confidence}%
                            </span>
                        ` : ''}
                        <span class="px-3 py-1 text-sm rounded-full ${
                            data.emailData.confidence >= 80 ? 'bg-green-100 text-green-800' :
                            data.emailData.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                        }">
                            Lead Quality: ${data.emailData.confidence}%
                        </span>
                    </div>
                </div>
                <button onclick="this.closest('.fixed').remove()" 
                        class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Content -->
            <div class="overflow-y-auto p-6" style="max-height: calc(90vh - 130px);">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Left Column: Company & Contact Info -->
                    <div class="space-y-6">
                        <!-- Company Card -->
                        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <h4 class="font-medium mb-3 text-gray-900 dark:text-white flex items-center">
                                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                                </svg>
                                Company Details
                            </h4>
                            ${Object.entries(data.emailData.metadata.company)
                                .map(([key, value]) => value ? `
                                    <div class="text-sm mb-2">
                                        <span class="font-medium text-gray-700 dark:text-gray-300">${
                                            key.charAt(0).toUpperCase() + key.slice(1)
                                        }:</span> 
                                        <span class="text-gray-600 dark:text-gray-400">${value}</span>
                                    </div>
                                ` : '').join('')}
                        </div>

                        <!-- Contact Card -->
                        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <h4 class="font-medium mb-3 text-gray-900 dark:text-white flex items-center">
                                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                </svg>
                                Contact Information
                            </h4>
                            ${Object.entries(data.emailData.metadata.contact)
                                .filter(([key, value]) => value && key !== 'emailValidation' && key !== 'social')
                                .map(([key, value]) => `
                                    <div class="text-sm mb-2">
                                        <span class="font-medium text-gray-700 dark:text-gray-300">${
                                            key.charAt(0).toUpperCase() + key.slice(1)
                                        }:</span> 
                                        <span class="text-gray-600 dark:text-gray-400">${value}</span>
                                    </div>
                                `).join('')}
                        </div>

                        <!-- Website Data -->
                        ${data.websiteData ? `
                            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                <h4 class="font-medium mb-3 text-gray-900 dark:text-white flex items-center">
                                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                                    </svg>
                                    Website Analysis
                                </h4>
                                
                                ${data.websiteData.data.business ? `
                                    <div class="mb-4">
                                        <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Business Details
                                        </h5>
                                        <div class="grid grid-cols-2 gap-2 text-sm">
                                            ${data.websiteData.data.business.categories?.industries ? `
                                                <div>
                                                    <span class="font-medium">Industries:</span>
                                                    <span class="text-gray-600 dark:text-gray-400">
                                                        ${data.websiteData.data.business.categories.industries.join(', ')}
                                                    </span>
                                                </div>
                                            ` : ''}
                                            ${data.websiteData.data.business.metrics?.companyAge ? `
                                                <div>
                                                    <span class="font-medium">Company Age:</span>
                                                    <span class="text-gray-600 dark:text-gray-400">
                                                        ${data.websiteData.data.business.metrics.companyAge} years
                                                    </span>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${data.websiteData.data.people?.phones?.length ? `
                                    <div class="mb-4">
                                        <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Found Phone Numbers
                                        </h5>
                                        ${data.websiteData.data.people.phones.map(phone => `
                                            <div class="flex items-center justify-between text-sm mb-1">
                                                <span class="text-gray-600 dark:text-gray-400">${phone}</span>
                                                <button onclick="copyToClipboard('${phone}')" 
                                                        class="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                                                    Copy
                                                </button>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>

                    <!-- Right Column: Email Preview & Actions -->
                    <div class="md:col-span-2 space-y-6">
                        <!-- Email Preview -->
                        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <h4 class="font-medium mb-3 text-gray-900 dark:text-white flex items-center">
                                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                </svg>
                                Generated Email
                            </h4>
                            <div class="prose dark:prose-invert max-w-none">
                                <div class="text-sm space-y-3">
                                    <div class="font-medium text-gray-900 dark:text-white">
                                        Subject: ${data.emailData.subject}
                                    </div>
                                    <div class="whitespace-pre-line text-gray-600 dark:text-gray-400">
                                        ${data.emailData.body}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex flex-wrap gap-4">
                            <button onclick="sendEmail(${index}, '${data.emailData.metadata.contact.email}')"
                                    class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                           transition-colors flex items-center justify-center space-x-2 min-w-[120px]">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                </svg>
                                <span>Send Email</span>
                            </button>
                            <button onclick="copyEmailContent(${index})"
                                    class="flex-1 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 
                                           transition-colors flex items-center justify-center space-x-2 min-w-[120px]">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                                </svg>
                                <span>Copy Email</span>
                            </button>
                            <button onclick="exportLeadData(${index})"
                                    class="flex-1 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 
                                           transition-colors flex items-center justify-center space-x-2 min-w-[120px]">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                </svg>
                                <span>Export Data</span>
                            </button>
                        </div>

                        <!-- Email Validation Details -->
                        ${data.emailValidation ? `
                            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                <h4 class="font-medium mb-3 text-gray-900 dark:text-white flex items-center">
                                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    Email Validation Results
                                </h4>
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span class="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                                        <span class="ml-2 ${
                                            data.emailValidation.isValid ? 'text-green-600' : 'text-red-600'
                                        }">
                                            ${data.emailValidation.isValid ? 'Valid' : 'Invalid'}
                                        </span>
                                    </div>
                                    <div>
                                        <span class="font-medium text-gray-700 dark:text-gray-300">Confidence:</span>
                                        <span class="ml-2 text-gray-600 dark:text-gray-400">
                                            ${data.emailValidation.confidence}%
                                        </span>
                                    </div>
                                    ${data.emailValidation.details ? Object.entries(data.emailValidation.details)
                                        .filter(([key, value]) => key !== 'score' && value !== null)
                                        .map(([key, value]) => `
                                            <div class="col-span-2">
                                                <span class="font-medium text-gray-700 dark:text-gray-300">
                                                    ${key.charAt(0).toUpperCase() + key.slice(1)}:
                                                </span>
                                                <span class="ml-2 text-gray-600 dark:text-gray-400">
                                                    ${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                                                </span>
                                            </div>
                                        `).join('') : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);

    // Add event listener for closing modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Add event listener for closing modal with Escape key
    document.addEventListener('keydown', function closeModal(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeModal);
        }
    });
}

// Email actions
function sendEmail(index, email) {
    const data = leadData.get(index);
    if (!data) return;

    // Get Gmail accounts
    fetch(`${API_BASE_URL}/mailboxes/${userUuid}`)
    .then(response => response.json())
    .then(accounts => {
        if (!accounts.mailboxes || accounts.mailboxes.length === 0) {
            showError('No Gmail accounts connected. Please connect an account first.');
            return;
        }
        
        showEmailSendDialog(userUuid, accounts.mailboxes, data, email);
    })
    .catch(error => {
        console.error('Error loading accounts:', error);
        showError('Failed to load Gmail accounts');
    });
}

// Show email send dialog
function showEmailSendDialog(userUuid, accounts, data, recipientEmail) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 overflow-y-auto';
    modal.innerHTML = `
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 transition-opacity" aria-hidden="true">
                <div class="absolute inset-0 bg-black bg-opacity-50"></div>
            </div>
            
            <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full">
                <div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div class="sm:flex sm:items-start">
                        <div class="w-full">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-xl leading-6 font-medium text-gray-900 dark:text-white">
                                    Send Email
                                </h3>
                                <button class="close-modal text-gray-400 hover:text-gray-500">
                                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            
                            <form id="send-email-form" class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        From
                                    </label>
                                    <select id="email-from" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                        ${accounts.map(account => `<option value="${account}">${account}</option>`).join('')}
                                    </select>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        To
                                    </label>
                                    <input type="email" id="email-to" value="${recipientEmail}" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" readonly>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Subject
                                    </label>
                                    <input type="text" id="email-subject" value="${data.emailData.subject}" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Message
                                    </label>
                                    <textarea id="email-body" rows="8" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">${data.emailData.body}</textarea>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button type="button" id="send-email-btn" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                        Send Email
                    </button>
                    <button type="button" class="close-modal mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.remove();
        });
    });

    // Send email button
    modal.querySelector('#send-email-btn').addEventListener('click', () => {
        const mailboxId = modal.querySelector('#email-from').value;
        const to = modal.querySelector('#email-to').value;
        const subject = modal.querySelector('#email-subject').value;
        const body = modal.querySelector('#email-body').value;

        if (!mailboxId || !to || !subject || !body) {
            showError('Please fill out all fields');
            return;
        }

        // Show loading state
        const sendBtn = modal.querySelector('#send-email-btn');
        sendBtn.disabled = true;
        sendBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Sending...
        `;

        // Send email via Gmail API
        fetch(`${API_BASE_URL}/send-email-gmail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uuid: userUuid,
                mailboxId: mailboxId,
                to: to,
                subject: subject,
                body: body
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                // Show success message
                showToast('Email sent successfully!', 'success');
                modal.remove();
            } else {
                showError(`Failed to send email: ${data.error || 'Unknown error'}`);
                sendBtn.disabled = false;
                sendBtn.innerHTML = 'Send Email';
            }
        })
        .catch(error => {
            console.error('Error sending email:', error);
            showError(`Failed to send email: ${error.message || 'Network error'}`);
            sendBtn.disabled = false;
            sendBtn.innerHTML = 'Send Email';
        });
    });
}

// Copy email content to clipboard
function copyEmailContent(index) {
    const data = leadData.get(index);
    if (!data) return;

    const emailContent = `Subject: ${data.emailData.subject}\n\n${data.emailData.body}`;

    navigator.clipboard.writeText(emailContent)
    .then(() => showToast('Email copied to clipboard!', 'success'))
    .catch(() => showToast('Failed to copy email. Please try again.', 'error'));
}

// Export lead data
function exportLeadData(index) {
    const data = leadData.get(index);
    if (!data) return;

    // Create export data
    const exportData = {
        company: data.emailData.metadata.company,
        contact: data.emailData.metadata.contact,
        emailTemplate: {
            subject: data.emailData.subject,
            body: data.emailData.body
        },
        confidence: data.emailData.confidence,
        validation: data.emailValidation || null
    };

    // Convert to JSON
    const fileName = `${data.emailData.metadata.company.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lead_data.json`;
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(jsonString));
    downloadLink.setAttribute('download', fileName);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    showToast('Lead data exported!', 'success');
}

// Find row in table by lead data
function findRowByLeadData(table, lead) {
    const rows = table.querySelectorAll('tbody tr');
    console.log('Finding row for lead:', lead);
    
    for (const row of rows) {
        const cells = row.querySelectorAll('td');
        const rowTexts = Array.from(cells).map(cell => cell.textContent.trim());
        
        // Create a matching pattern based on available lead data
        const matchPattern = [
            lead.company,
            lead.first_name,
            lead.last_name,
            lead.title,
            lead.email_1
        ].map(val => val?.toString().trim() || '');

        // Log matching attempt
        console.log('Matching pattern:', matchPattern);
        console.log('Row texts:', rowTexts);

        // Check if the row matches the lead data
        const matches = matchPattern.every((pattern, index) => {
            if (!pattern) return true; // Skip empty patterns
            return rowTexts[index]?.includes(pattern);
        });

        if (matches) {
            console.log('Found matching row:', rowTexts);
            return row;
        }
    }
    
    console.log('No matching row found');
    return null;
}

// Show completion modal
function showCompletionModal(totalProcessed) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full';
    modal.innerHTML = `
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div class="mt-3 text-center">
                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                </div>
                <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-4">Campaign Processing Complete</h3>
                <div class="mt-2 px-7 py-3">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        Successfully processed ${totalProcessed} leads. Click "View Details" on any lead to see the complete data.
                    </p>
                </div>
                <div class="items-center px-4 py-3">
                    <button onclick="this.closest('.fixed').remove()"
                            class="px-4 py-2 bg-green-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300">
                        OK
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Utility Function: Show Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    
    // Define icon and background based on type
    const icons = {
        'success': '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
        'info': '<svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
        'warning': '<svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>'
    };
    
    const backgrounds = {
        'success': 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300',
        'error': 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300',
        'info': 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
        'warning': 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
    };
    
    // Create toast element
    toast.className = `fixed bottom-4 right-4 flex items-center p-4 rounded-lg border ${backgrounds[type]} shadow-lg transition-all duration-500 transform translate-y-0 opacity-100 z-50`;
    toast.innerHTML = `
        <div class="flex items-center">
            ${icons[type] || icons.info}
            <div class="ml-3 text-sm font-medium">${message}</div>
        </div>
        <button type="button" class="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 focus:outline-none">
            <span class="sr-only">Close</span>
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
        </button>
    `;
    
    // Add to document
    document.body.appendChild(toast);
    
    // Add event listener for close button
    toast.querySelector('button').addEventListener('click', () => {
        fadeOutAndRemove(toast);
    });
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        fadeOutAndRemove(toast);
    }, 3000);
}

// Fade out and remove element
function fadeOutAndRemove(element) {
    // Apply fade out animation
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    
    // Remove after animation completes
    setTimeout(() => {
        element.remove();
    }, 300);
}

// Utility Function: Copy to Clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => showToast('Copied to clipboard!', 'success'))
        .catch(err => {
            console.error('Error copying text: ', err);
            showError('Failed to copy text. Please try again.');
        });
}

// Utility Function: Show Error
function showError(message) {
    showToast(message, 'error');
}

// Utility Function: Simulate Delay
function simulateDelay(ms = 500) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility Function: Generate UUID
function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Verify and prepare leads
function verifyAndPrepareLeads(leads) {
    // Show verification modal
    const verificationTemplate = document.getElementById('verification-modal-template');
    if (!verificationTemplate) {
        console.error('Verification modal template not found');
        return;
    }
    
    // Clone and insert modal
    const modal = document.importNode(verificationTemplate.content, true).firstElementChild;
    document.body.appendChild(modal);
    
    // Start verification process
    processLeadsVerification(leads, modal)
        .then(verifiedLeads => {
            // Remove verification modal
            modal.remove();
            
            // Show verified campaign modal
            showVerifiedCampaignModal(verifiedLeads);
        })
        .catch(error => {
            console.error('Verification failed:', error);
            showError('Failed to verify leads: ' + error.message);
            modal.remove();
        });
}

// Process leads verification
async function processLeadsVerification(leads, modal) {
    const progressBar = modal.querySelector('.progress-bar');
    const progressText = modal.querySelector('.progress-text');
    
    const verifiedLeads = [];
    
    for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        
        // Update progress
        const progress = Math.round((i / leads.length) * 100);
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `Verifying email ${i + 1} of ${leads.length}`;
        
        try {
            // Verify email if available
            if (lead.email_1) {
                const emailValidation = await validateEmail(lead.email_1);
                lead.emailValidation = emailValidation;
            }
            
            // Add to verified leads
            verifiedLeads.push(lead);
            
            // Simulate delay for UI
            await simulateDelay(100);
        } catch (error) {
            console.warn(`Verification failed for lead ${i + 1}:`, error);
            // Still add to verified leads but mark as unverified
            lead.emailValidation = {
                isValid: false,
                confidence: 0,
                error: error.message
            };
            verifiedLeads.push(lead);
        }
    }
    
    // Complete progress
    progressBar.style.width = '100%';
    progressText.textContent = 'Verification complete!';
    
    // Return verified leads
    return verifiedLeads;
}

// Show verified campaign modal
function showVerifiedCampaignModal(verifiedLeads) {
    const template = document.getElementById('verified-campaign-template');
    if (!template) {
        console.error('Verified campaign template not found');
        return;
    }
    
    // Clone and insert modal
    const modal = document.importNode(template.content, true).firstElementChild;
    document.body.appendChild(modal);
    
    // Create campaign form content
    const form = modal.querySelector('#verified-campaign-form');
    form.innerHTML = createCampaignFormContent(verifiedLeads);
    
    // Add event listeners
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });
    
    // Create campaign button
    modal.querySelector('#create-verified-campaign').addEventListener('click', () => {
        createVerifiedCampaign(modal, verifiedLeads);
    });
}

// Create campaign form content
function createCampaignFormContent(verifiedLeads) {
    // Get valid leads count
    const validLeads = verifiedLeads.filter(lead => 
        lead.emailValidation?.isValid || !lead.emailValidation
    );
    
    // Get account options from Gmail integration
    let accountOptions = '<option value="">Select Gmail account</option>';
    
    // Fetch accounts and update later
    fetch(`${API_BASE_URL}/mailboxes/${userUuid}`)
        .then(response => response.json())
        .then(data => {
            const accounts = data.mailboxes || [];
            accountOptions = `
                <option value="">Select Gmail account</option>
                ${accounts.map(account => `<option value="${account}">${account}</option>`).join('')}
            `;
            document.getElementById('campaign-sending-account').innerHTML = accountOptions;
        })
        .catch(error => {
            console.error('Error fetching Gmail accounts:', error);
        });
    
    // Create HTML content
    return `
        <div class="space-y-6">
            <!-- Campaign Info -->
            <div>
                <h4 class="font-medium text-lg text-gray-900 dark:text-white mb-3">Campaign Information</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label for="campaign-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Campaign Name
                        </label>
                        <input type="text" id="campaign-name" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                               placeholder="Enter campaign name" value="Medical Device Outreach">
                    </div>
                    <div>
                        <label for="campaign-sending-account" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Sending Account
                        </label>
                        <select id="campaign-sending-account" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            ${accountOptions}
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Lead Summary -->
            <div>
                <h4 class="font-medium text-lg text-gray-900 dark:text-white mb-3">Lead Summary</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <div class="text-sm text-blue-800 dark:text-blue-200">Total Leads</div>
                        <div class="text-2xl font-bold text-blue-900 dark:text-blue-100">${verifiedLeads.length}</div>
                    </div>
                    <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <div class="text-sm text-green-800 dark:text-green-200">Valid Emails</div>
                        <div class="text-2xl font-bold text-green-900 dark:text-green-100">${validLeads.length}</div>
                    </div>
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                        <div class="text-sm text-yellow-800 dark:text-yellow-200">Estimated Send Time</div>
                        <div class="text-2xl font-bold text-yellow-900 dark:text-yellow-100">${Math.ceil(validLeads.length * 1.5)} min</div>
                    </div>
                </div>
            </div>
            
            <!-- Email Sequence -->
            <div>
                <h4 class="font-medium text-lg text-gray-900 dark:text-white mb-3">Email Sequence</h4>
                
                <!-- Initial Email -->
                <div class="border rounded-lg p-4 mb-4 dark:border-gray-600">
                    <h5 class="font-medium text-gray-900 dark:text-white mb-3">Initial Email</h5>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Subject Line Template
                            </label>
                            <input type="text" id="initial-subject" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                   value="Strategic Medical Device Manufacturing Partnership - {company}">
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Use {company}, {first_name}, etc. as placeholders
                            </p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Email Body Template
                            </label>
                            <textarea id="initial-body" rows="6" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">Dear {first_name},

I hope this email finds you well. I noticed {company}'s impressive work in the medical device manufacturing industry{revenue, based in {city}, {state}.

Our team specializes in helping medical device manufacturers:
• Optimize manufacturing processes while maintaining FDA compliance
• Reduce time-to-market for new devices
• Implement quality management systems that exceed industry standards
• Scale operations efficiently while maintaining margins

Would you be open to a brief call to discuss how we could support {company}'s continued growth and success in the medical device market?

Best regards,
[Sender Name]</textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Start Date
                                </label>
                                <input type="datetime-local" id="start-date" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Send Speed
                                </label>
                                <select id="send-speed" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option value="slow">Slow (1 email per 2 min)</option>
                                    <option value="medium" selected>Medium (1 email per min)</option>
                                    <option value="fast">Fast (3 emails per min)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Add Follow-up Button -->
                <button type="button" id="add-followup-btn" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center text-sm">
                    <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Add Follow-up Email
                </button>
                
                <!-- Follow-up Container -->
                <div id="followups-container" class="mt-3 space-y-3">
                    <!-- Follow-up emails will be added here -->
                </div>
            </div>
            
            <!-- Additional Settings -->
            <div>
                <h4 class="font-medium text-lg text-gray-900 dark:text-white mb-3">Additional Settings</h4>
                <div class="space-y-3">
                    <div class="flex items-center">
                        <input type="checkbox" id="track-opens" class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" checked>
                        <label for="track-opens" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                            Track email opens
                        </label>
                    </div>
                    <div class="flex items-center">
                        <input type="checkbox" id="track-clicks" class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" checked>
                        <label for="track-clicks" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                            Track link clicks
                        </label>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Stop follow-ups if:
                        </label>
                        <div class="ml-4 space-y-2">
                            <div class="flex items-center">
                                <input type="checkbox" id="stop-on-reply" class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" checked>
                                <label for="stop-on-reply" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                    Recipient replies
                                </label>
                            </div>
                            <div class="flex items-center">
                                <input type="checkbox" id="stop-on-click" class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                                <label for="stop-on-click" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                    Recipient clicks a link
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Create verified campaign
function createVerifiedCampaign(modal, verifiedLeads) {
    const campaignName = modal.querySelector('#campaign-name').value;
    const sendingAccount = modal.querySelector('#campaign-sending-account').value;
    const initialSubject = modal.querySelector('#initial-subject').value;
    const initialBody = modal.querySelector('#initial-body').value;
    const startDate = modal.querySelector('#start-date').value;
    const sendSpeed = modal.querySelector('#send-speed').value;
    const trackOpens = modal.querySelector('#track-opens').checked;
    const trackClicks = modal.querySelector('#track-clicks').checked;
    const stopOnReply = modal.querySelector('#stop-on-reply').checked;
    const stopOnClick = modal.querySelector('#stop-on-click').checked;
    
    // Validate required fields
    if (!campaignName || !sendingAccount || !initialSubject || !initialBody) {
        showError('Please fill in all required fields');
        return;
    }
    
    // Get valid leads
    const validLeads = verifiedLeads.filter(lead => 
        lead.emailValidation?.isValid || !lead.emailValidation
    );
    
    // Prepare campaign data
    const followUps = Array.from(modal.querySelectorAll('.followup-email')).map(followupEl => {
        return {
            subject: followupEl.querySelector('.followup-subject').value,
            body: followupEl.querySelector('.followup-body').value,
            waitDuration: parseInt(followupEl.querySelector('.followup-wait-duration').value) || 3,
            waitUnit: followupEl.querySelector('.followup-wait-unit').value
        };
    });
    
    // Show loading state
    const createBtn = modal.querySelector('#create-verified-campaign');
    createBtn.disabled = true;
    createBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Creating Campaign...
    `;
    
    // Format the emails data
    const emails = validLeads.map(lead => ({
        to: lead.email_1,
        subject: replacePlaceholders(initialSubject, lead),
        body: replacePlaceholders(initialBody, lead),
        metadata: {
            leadId: lead.id || Math.random().toString(36).substring(2, 15),
            company: lead.company,
            firstName: lead.first_name,
            lastName: lead.last_name
        }
    }));
    
    // Create campaign - here we're just simulating for the demo
    // In a real app, you would call your API
    setTimeout(() => {
        try {
            // Create campaign object for local storage
            const campaign = {
                id: Date.now().toString(),
                name: campaignName,
                sendingAccount: sendingAccount,
                initialEmail: {
                    subject: initialSubject,
                    body: initialBody,
                    sendDate: startDate || new Date().toISOString(),
                    sendSpeed: sendSpeed
                },
                followUpEmails: followUps,
                settings: {
                    trackOpens,
                    trackClicks,
                    stopOnReply,
                    stopOnClick
                },
                status: 'Active',
                leadCount: validLeads.length,
                sentCount: 0,
                openCount: 0,
                clickCount: 0,
                replyCount: 0,
                createdAt: new Date().toISOString(),
                nextFollowUp: startDate || new Date().toISOString()
            };
            
            // Save campaign to localStorage
            const existingCampaigns = JSON.parse(localStorage.getItem('campaigns') || '[]');
            existingCampaigns.push(campaign);
            localStorage.setItem('campaigns', JSON.stringify(existingCampaigns));
            
            // Update UI
            if (typeof campaignManager !== 'undefined') {
                campaignManager.loadCampaigns();
                
                // Switch to campaigns tab
                const campaignsTab = document.querySelector('[data-tab="campaigns-manager"]');
                if (campaignsTab) {
                    campaignsTab.click();
                }
            }
            
            // Show success message and close modal
            showToast('Campaign created successfully!', 'success');
            modal.remove();
        } catch (error) {
            console.error('Error creating campaign:', error);
            showError('Failed to create campaign: ' + error.message);
            
            // Reset button
            createBtn.disabled = false;
            createBtn.innerHTML = 'Create Campaign';
        }
    }, 1500);
}

// Replace placeholders in template
function replacePlaceholders(template, data) {
    return template
        .replace(/{company}/g, data.company || '')
        .replace(/{first_name}/g, data.first_name || '')
        .replace(/{last_name}/g, data.last_name || '')
        .replace(/{title}/g, data.title || '')
        .replace(/{email}/g, data.email_1 || '')
        .replace(/{city}/g, data.city || '')
        .replace(/{state}/g, data.state || '')
        .replace(/{revenue}/g, data.revenue ? ` with annual revenue of ${data.revenue}` : '')
        .replace(/{industry}/g, data.industry || 'medical device manufacturing');
}

// Initialize lead verification
function initializeLeadVerification() {
    // Add event listener to verified campaign modal for adding follow-ups
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'add-followup-btn') {
            addFollowupEmail();
        }
        
        // Remove follow-up
        if (e.target && e.target.classList.contains('remove-followup')) {
            e.target.closest('.followup-email').remove();
        }
    });
}

// Add follow-up email to campaign form
function addFollowupEmail() {
    const container = document.getElementById('followups-container');
    if (!container) return;
    
    const followupCount = container.children.length + 1;
    
    const followupEl = document.createElement('div');
    followupEl.className = 'followup-email border rounded-lg p-4 dark:border-gray-600';
    followupEl.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h5 class="font-medium text-gray-900 dark:text-white">Follow-up #${followupCount}</h5>
            <button type="button" class="remove-followup text-red-600 hover:text-red-800 dark:text-red-400">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject Line
                </label>
                <input type="text" class="followup-subject w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                       value="Follow-up: Strategic Partnership - {company}">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Body
                </label>
                <textarea class="followup-body w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows="5">Dear {first_name},

I wanted to follow up on my previous email regarding a potential partnership with {company}.

I understand you're likely busy, but I'd still love the opportunity to discuss how we could support your medical device manufacturing operations.

Would you have 15 minutes for a brief call this week?

Best regards,
[Sender Name]</textarea>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Wait Duration
                </label>
                <div class="grid grid-cols-2 gap-2">
                    <input type="number" class="followup-wait-duration w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" min="1" value="3">
                    <select class="followup-wait-unit w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        <option value="hours">Hours</option>
                        <option value="days" selected>Days</option>
                        <option value="weeks">Weeks</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(followupEl);
}

// Gmail Integration
// ==============================================

const gmailIntegration = {
    init: function() {
        // Initialize Gmail integration
        this.bindEvents();
        this.loadConnectedAccounts();
    },

    bindEvents: function() {
        // Connect Gmail button
        document.getElementById('connect-gmail')?.addEventListener('click', () => {
            this.connectGmail();
        });

        // Test connection button
        document.getElementById('test-connection')?.addEventListener('click', () => {
            this.testConnection();
        });
    },

    connectGmail: function() {
        // Request authorization URL from server
        fetch(`${API_BASE_URL}/auth?uuid=${userUuid}`)
            .then(response => response.json())
            .then(data => {
                // Open Gmail authorization in a new window
                const authWindow = window.open(data.url, 'GmailAuth', 'width=600,height=700');
                
                // Poll for window close
                const checkClosed = setInterval(() => {
                    if (authWindow.closed) {
                        clearInterval(checkClosed);
                        // Reload connected accounts after authorization
                        this.loadConnectedAccounts();
                    }
                }, 1000);
            })
            .catch(error => {
                console.error('Error getting auth URL:', error);
                showError('Failed to start Gmail authorization');
            });
    },

    loadConnectedAccounts: function() {
        // Fetch connected accounts from server
        fetch(`${API_BASE_URL}/mailboxes/${userUuid}`)
            .then(response => response.json())
            .then(data => {
                this.updateAccountsList(data.mailboxes);
            })
            .catch(error => {
                console.error('Error loading accounts:', error);
                showError('Failed to load connected accounts');
            });
    },

    updateAccountsList: function(accounts) {
        const accountsList = document.getElementById('accounts-list');
        const testEmailAccount = document.getElementById('test-email-account');
        const noAccountsMsg = document.getElementById('no-accounts-message');
        const testConnectionSection = document.getElementById('test-connection-section');
        
        if (!accountsList || !testEmailAccount) return;
        // Continuation of the Gmail Integration code

        // Update status display
        if (accounts && accounts.length > 0) {
            document.getElementById('no-accounts')?.classList.add('hidden');
            document.getElementById('accounts-connected')?.classList.remove('hidden');
            document.getElementById('accounts-count').textContent = accounts.length;
            noAccountsMsg?.classList.add('hidden');
            testConnectionSection?.classList.remove('hidden');
        } else {
            document.getElementById('no-accounts')?.classList.remove('hidden');
            document.getElementById('accounts-connected')?.classList.add('hidden');
            noAccountsMsg?.classList.remove('hidden');
            testConnectionSection?.classList.add('hidden');
        }
        
        // Clear existing accounts
        if (accountsList) {
            accountsList.innerHTML = accounts && accounts.length > 0 ? '' : (noAccountsMsg?.outerHTML || '');
        }
        
        if (testEmailAccount) {
            testEmailAccount.innerHTML = '';
        }
        
        // Add connected accounts to the list
        if (accounts && accounts.length > 0) {
            accounts.forEach(account => {
                // Add to accounts list
                if (accountsList) {
                    const accountItem = document.createElement('div');
                    accountItem.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg';
                    accountItem.innerHTML = `
                        <div class="flex items-center">
                            <svg class="w-5 h-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                            </svg>
                            <span class="font-medium text-gray-700 dark:text-gray-200">${account}</span>
                        </div>
                        <button data-email="${account}" class="remove-account px-2 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400">
                            Remove
                        </button>
                    `;
                    accountsList.appendChild(accountItem);
                    
                    // Add event listener for remove button
                    accountItem.querySelector('.remove-account')?.addEventListener('click', () => {
                        this.removeAccount(account);
                    });
                }
                
                // Add to select dropdown
                if (testEmailAccount) {
                    const option = document.createElement('option');
                    option.value = account;
                    option.textContent = account;
                    testEmailAccount.appendChild(option);
                }
            });
        }
        
        // Also update campaign form select
        this.updateCampaignFormSelect(accounts || []);
    },
    
    updateCampaignFormSelect: function(accounts) {
        // Update the sending account select in campaign form
        const sendingAccount = document.getElementById('sending-account');
        if (sendingAccount) {
            // Keep the first option
            const firstOption = sendingAccount.options[0];
            sendingAccount.innerHTML = '';
            sendingAccount.appendChild(firstOption);
            
            // Add accounts
            accounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account;
                option.textContent = account;
                sendingAccount.appendChild(option);
            });
        }
    },
    
    removeAccount: function(account) {
        // Send request to remove account
        fetch(`${API_BASE_URL}/remove-mailbox`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uuid: userUuid,
                mailboxId: account
            })
        })
        .then(response => response.json())
        .then(data => {
            showToast(`Removed account: ${account}`, 'success');
            this.loadConnectedAccounts();
        })
        .catch(error => {
            console.error('Error removing account:', error);
            showError('Failed to remove account');
        });
    },
    
    testConnection: function() {
        const accountSelect = document.getElementById('test-email-account');
        if (!accountSelect) return;
        
        const account = accountSelect.value;
        const testResult = document.getElementById('test-result');
        
        if (!account) {
            showError('Please select an account to test');
            return;
        }
        
        // Show loading state
        if (testResult) {
            testResult.innerHTML = `
                <div class="flex items-center text-blue-600 dark:text-blue-400">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing connection to ${account}...
                </div>
            `;
            testResult.classList.remove('hidden');
        }
        
        // Send test request
        fetch(`${API_BASE_URL}/test-gmail-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uuid: userUuid,
                mailboxId: account
            })
        })
        .then(response => response.json())
        .then(data => {
            if (!testResult) return;
            
            if (data.success) {
                testResult.innerHTML = `
                    <div class="text-green-600 dark:text-green-400">
                        <div class="font-medium">Connected successfully!</div>
                        <div class="text-sm">Email: ${data.email}</div>
                        <div class="text-sm">Total messages: ${data.messagesTotal}</div>
                    </div>
                `;
                testResult.className = 'mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg';
            } else {
                testResult.innerHTML = `
                    <div class="text-red-600 dark:text-red-400">
                        <div class="font-medium">Connection failed</div>
                        <div class="text-sm">${data.error || 'Unknown error'}</div>
                    </div>
                `;
                testResult.className = 'mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg';
            }
        })
        .catch(error => {
            console.error('Error testing connection:', error);
            if (testResult) {
                testResult.innerHTML = `
                    <div class="text-red-600 dark:text-red-400">
                        <div class="font-medium">Connection failed</div>
                        <div class="text-sm">${error.message || 'Network error'}</div>
                    </div>
                `;
                testResult.className = 'mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg';
            }
        });
    }
};

// Campaign Manager
// ==============================================

const campaignManager = {
    // Store local campaigns data
    campaigns: [],
    currentLeads: [],
    followUpCount: 0,
    
    init: function() {
        // Initialize campaign manager
        this.bindEvents();
        this.loadCampaigns();
        
        // Load current leads if available
        const leadsTable = document.querySelector('#leads-table table');
        if (leadsTable) {
            this.loadCurrentLeads(leadsTable);
        }
    },
    
    bindEvents: function() {
        // Create campaign button
        document.getElementById('create-campaign')?.addEventListener('click', () => {
            this.showCampaignModal();
        });
        
        // Close modal buttons
        document.getElementById('close-campaign-modal')?.addEventListener('click', () => {
            this.hideCampaignModal();
        });
        
        document.getElementById('cancel-campaign')?.addEventListener('click', () => {
            this.hideCampaignModal();
        });
        
        // Save campaign button
        document.getElementById('save-campaign')?.addEventListener('click', () => {
            this.createCampaign();
        });
        
        // Add follow-up email button
        document.getElementById('add-email-step')?.addEventListener('click', () => {
            this.addFollowUpEmail();
        });
        
        // Lead source change
        document.getElementById('lead-source')?.addEventListener('change', (e) => {
            const uploadContainer = document.getElementById('lead-upload-container');
            if (uploadContainer) {
                if (e.target.value === 'upload') {
                    uploadContainer.classList.remove('hidden');
                } else {
                    uploadContainer.classList.add('hidden');
                }
            }
        });
        
        // Modal background click to close
        document.getElementById('campaign-modal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('campaign-modal')) {
                this.hideCampaignModal();
            }
        });
        
        // Lead file change
        document.getElementById('lead-file')?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const fileName = e.target.files[0].name;
                const fileLabel = e.target.nextElementSibling.querySelector('p');
                if (fileLabel) {
                    fileLabel.textContent = `Selected file: ${fileName}`;
                }
                this.processLeadFile(e.target.files[0]);
            }
        });
    },
    
    showCampaignModal: function() {
        // Get the modal element
        const modal = document.getElementById('campaign-modal');
        if (!modal) return;
        
        // Reset form
        const form = document.getElementById('campaign-form');
        if (form) form.reset();
        
        const followUpContainer = document.getElementById('follow-up-container');
        if (followUpContainer) followUpContainer.innerHTML = '';
        
        this.followUpCount = 0;
        
        // Show modal
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    },
    
    hideCampaignModal: function() {
        const modal = document.getElementById('campaign-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }
    },
    
    loadCampaigns: function() {
        // Load campaigns from localStorage
        const savedCampaigns = localStorage.getItem('campaigns');
        if (savedCampaigns) {
            this.campaigns = JSON.parse(savedCampaigns);
            this.renderCampaignsList();
        }
        
        // In a real app, you would fetch campaigns from your backend
        // fetch(`${API_BASE_URL}/campaigns/${userUuid}`)
        //     .then(response => response.json())
        //     .then(data => {
        //         this.campaigns = data.campaigns;
        //         this.renderCampaignsList();
        //     })
        //     .catch(error => {
        //         console.error('Error loading campaigns:', error);
        //     });
    },
    
    loadCurrentLeads: function(table) {
        // Extract leads from the table
        const rows = table.querySelectorAll('tbody tr');
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => 
            th.textContent.trim().toLowerCase().replace(/\s+/g, '_')
        );
        
        this.currentLeads = [];
        
        rows.forEach(row => {
            const leadData = {};
            const cells = row.querySelectorAll('td');
            
            headers.forEach((header, index) => {
                if (cells[index]) {
                    leadData[header] = cells[index].textContent.trim();
                }
            });
            
            // Map common fields to standardized names
            const lead = {
                company: leadData.company || '',
                first_name: leadData.first_name || '',
                last_name: leadData.last_name || '',
                email: leadData.email_1 || leadData.email || '',
                title: leadData.title || leadData.job_title || '',
                industry: leadData.industry || '',
                city: leadData.city || '',
                state: leadData.state || '',
                revenue: leadData.revenue || leadData.annual_revenue || '',
                employees: leadData.employees || '',
                website: leadData.website || '',
                original_data: leadData // Keep original data
            };
            
            if (lead.company && lead.email) {
                this.currentLeads.push(lead);
            }
        });
        
        console.log(`Loaded ${this.currentLeads.length} leads from current table`);
    },
    
    processLeadFile: function(file) {
        // For this example, we'll use the Excel.js library that's already loaded
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first worksheet
                const worksheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[worksheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                // Map to standardized lead format
                this.uploadedLeads = jsonData.map(row => {
                    // Try to find keys case-insensitively
                    const getValueByKey = (keysToTry) => {
                        for (const key of keysToTry) {
                            for (const rowKey in row) {
                                if (rowKey.toLowerCase().includes(key.toLowerCase())) {
                                    return row[rowKey];
                                }
                            }
                        }
                        return '';
                    };
                    
                    return {
                        company: getValueByKey(['company', 'organization']),
                        first_name: getValueByKey(['first_name', 'firstname', 'first']),
                        last_name: getValueByKey(['last_name', 'lastname', 'last']),
                        email: getValueByKey(['email', 'email_1', 'email-1']),
                        title: getValueByKey(['title', 'job_title', 'position']),
                        industry: getValueByKey(['industry', 'sector']),
                        city: getValueByKey(['city']),
                        state: getValueByKey(['state', 'province']),
                        revenue: getValueByKey(['revenue', 'annual_revenue']),
                        employees: getValueByKey(['employees', 'employee_count']),
                        website: getValueByKey(['website', 'url']),
                        original_data: row // Keep original data
                    };
                }).filter(lead => lead.email && lead.company); // Only keep leads with email and company
                
                showToast(`Loaded ${this.uploadedLeads.length} leads from file`, 'success');
            } catch (error) {
                console.error('Error processing file:', error);
                showError('Failed to process lead file');
            }
        };
        
        reader.onerror = (e) => {
            console.error('Error reading file:', e);
            showError('Failed to read lead file');
        };
        
        reader.readAsArrayBuffer(file);
    },
    
    // renderCampaignsList: function() {
    //     const campaignsList = document.getElementById('campaigns-list');
    //     if (!campaignsList) return;
        
    //     if (this.campaigns.length === 0) {
    //         campaignsList.innerHTML = `
    //             <tr>
    //                 <td colspan="6" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
    //                     No campaigns created yet.
    //                 </td>
    //             </tr>
    //         `;
    //         return;
    //     }
        
    //     campaignsList.innerHTML = '';
        
    //     this.campaigns.forEach((campaign, index) => {
    //         const row = document.createElement('tr');
    //         row.innerHTML = `
    //             <td class="px-6 py-4 whitespace-nowrap">
    //                 <div class="font-medium text-gray-900 dark:text-white">${campaign.name}</div>
    //             </td>
    //             <td class="px-6 py-4 whitespace-nowrap">
    //                 <span class="px-2 py-1 text-xs rounded-full ${this.getStatusClass(campaign.status)}">
    //                     ${campaign.status}
    //                 </span>
    //             </td>
    //             <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
    //                 ${campaign.leadCount}
    //             </td>
    //             <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
    //                 ${campaign.sentCount} / ${campaign.leadCount}
    //             </td>
    //             <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
    //                 ${campaign.nextFollowUp ? new Date(campaign.nextFollowUp).toLocaleString() : 'N/A'}
    //             </td>
    //             <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
    //                 <button data-campaign-index="${index}" class="view-campaign text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3">
    //                     View
    //                 </button>
    //                 <button data-campaign-index="${index}" class="pause-campaign ${campaign.status === 'Paused' ? 'hidden' : ''} text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 mr-3">
    //                     Pause
    //                 </button>
    //                 <button data-campaign-index="${index}" class="resume-campaign ${campaign.status !== 'Paused' ? 'hidden' : ''} text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 mr-3">
    //                     Resume
    //                 </button>
    //                 <button data-campaign-index="${index}" class="delete-campaign text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
    //                     Delete
    //                 </button>
    //             </td>
    //         `;
            
    //         campaignsList.appendChild(row);
            
    //         // Add event listeners
    //         row.querySelector('.view-campaign')?.addEventListener('click', () => {
    //             this.viewCampaign(index);
    //         });
            
    //         row.querySelector('.pause-campaign')?.addEventListener('click', () => {
    //             this.pauseCampaign(index);
    //         });
            
    //         row.querySelector('.resume-campaign')?.addEventListener('click', () => {
    //             this.resumeCampaign(index);
    //         });
            
    //         row.querySelector('.delete-campaign')?.addEventListener('click', () => {
    //             this.deleteCampaign(index);
    //         });
    //     });
    // },
    renderCampaignsList: function() {
        const campaignsList = document.getElementById('campaigns-list');
        if (!campaignsList) return;
        if (this.campaigns.length === 0) {
            campaignsList.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No campaigns created yet.
                    </td>
                </tr>
            `;
            return;
        }
        campaignsList.innerHTML = this.campaigns.map((campaign, index) => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap"><div class="font-medium text-gray-900 dark:text-white">${campaign.name}</div></td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 py-1 text-xs rounded-full ${this.getStatusClass(campaign.status)}">${campaign.status}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">${campaign.leadCount}</td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">${campaign.sentCount} / ${campaign.leadCount}</td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">${campaign.nextFollowUp ? new Date(campaign.nextFollowUp).toLocaleString() : 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button data-campaign-index="${index}" class="view-campaign text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3">View</button>
                    <button data-campaign-index="${index}" class="pause-campaign ${campaign.status === 'Paused' ? 'hidden' : ''} text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 mr-3">Pause</button>
                    <button data-campaign-index="${index}" class="resume-campaign ${campaign.status !== 'Paused' ? 'hidden' : ''} text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 mr-3">Resume</button>
                    <button data-campaign-index="${index}" class="delete-campaign text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                </td>
            </tr>
        `).join('');
        // Add event listeners
        campaignsList.querySelectorAll('.view-campaign').forEach(btn => btn.addEventListener('click', () => this.viewCampaign(btn.dataset.campaignIndex)));
        campaignsList.querySelectorAll('.pause-campaign').forEach(btn => btn.addEventListener('click', () => this.pauseCampaign(btn.dataset.campaignIndex)));
        campaignsList.querySelectorAll('.resume-campaign').forEach(btn => btn.addEventListener('click', () => this.resumeCampaign(btn.dataset.campaignIndex)));
        campaignsList.querySelectorAll('.delete-campaign').forEach(btn => btn.addEventListener('click', () => this.deleteCampaign(btn.dataset.campaignIndex)));
    },
    
    getStatusClass: function(status) {
        switch (status) {
            case 'Active':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'Paused':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'Completed':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case 'Draft':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    },
    
    addFollowUpEmail: function() {
        this.followUpCount++;
        
        // Clone the template
        const template = document.getElementById('follow-up-template');
        if (!template) return;
        
        const clone = document.importNode(template.content, true);
        
        // Update the follow-up number
        const numberElement = clone.querySelector('.follow-up-number');
        if (numberElement) {
            numberElement.textContent = this.followUpCount;
        }
        
        // Add event listener to remove button
        const removeButton = clone.querySelector('.remove-follow-up');
        if (removeButton) {
            removeButton.addEventListener('click', (e) => {
                const followupEl = e.target.closest('.follow-up-email');
                if (followupEl) {
                    followupEl.remove();
                    this.updateFollowUpNumbers();
                }
            });
        }
        
        // Append to container
        const container = document.getElementById('follow-up-container');
        if (container) {
            container.appendChild(clone);
        }
    },
    
    updateFollowUpNumbers: function() {
        // Update follow-up email numbers
        const followUps = document.querySelectorAll('.follow-up-email');
        followUps.forEach((followUp, index) => {
            const numberElement = followUp.querySelector('.follow-up-number');
            if (numberElement) {
                numberElement.textContent = index + 1;
            }
        });
        this.followUpCount = followUps.length;
    },
    
    // createCampaign: function() {
    //     // Validate form
    //     const campaignName = document.getElementById('campaign-name')?.value;
    //     const sendingAccount = document.getElementById('sending-account')?.value;
        
    //     if (!campaignName) {
    //         showError('Please enter a campaign name');
    //         return;
    //     }
        
    //     if (!sendingAccount) {
    //         showError('Please select a sending account');
    //         return;
    //     }
        
    //     // Get leads
    //     const leadSource = document.getElementById('lead-source')?.value;
    //     let leads = [];
        
    //     if (leadSource === 'current') {
    //         if (this.currentLeads.length === 0) {
    //             showError('No leads available in the current table');
    //             return;
    //         }
    //         leads = this.currentLeads;
    //     } else if (leadSource === 'upload') {
    //         if (!this.uploadedLeads || this.uploadedLeads.length === 0) {
    //             showError('Please upload a leads file');
    //             return;
    //         }
    //         leads = this.uploadedLeads;
    //     }
        
    //     // Get email sequence
    //     const initialSubject = document.querySelector('.email-subject')?.value;
    //     const initialBody = document.querySelector('.email-body')?.value;
    //     const initialDate = document.querySelector('.email-date')?.value;
    //     const initialSpeed = document.querySelector('.email-speed')?.value;
        
    //     if (!initialSubject || !initialBody) {
    //         showError('Please enter subject and body for the initial email');
    //         return;
    //     }
        
    //     const initialEmail = {
    //         subject: initialSubject,
    //         body: initialBody,
    //         sendDate: initialDate || new Date().toISOString().slice(0, 16), // Set to now if empty
    //         sendSpeed: initialSpeed || 'medium'
    //     };
        
    //     // Get follow-up emails
    //     const followUpEmails = [];
    //     const followUpContainers = document.querySelectorAll('.follow-up-email');
        
    //     followUpContainers.forEach((container, index) => {
    //         const subject = container.querySelector('.email-subject')?.value;
    //         const body = container.querySelector('.email-body')?.value;
    //         const waitDuration = parseInt(container.querySelector('.wait-duration')?.value) || 1;
    //         const waitUnit = container.querySelector('.wait-unit')?.value;
            
    //         if (subject && body) {
    //             followUpEmails.push({
    //                 subject,
    //                 body,
    //                 waitDuration,
    //                 waitUnit
    //             });
    //         }
    //     });
        
    //     // Get additional settings
    //     const trackOpens = document.getElementById('track-opens')?.checked;
    //     const trackClicks = document.getElementById('track-clicks')?.checked;
    //     const stopOnReply = document.getElementById('stop-on-reply')?.checked;
    //     const stopOnClick = document.getElementById('stop-on-click')?.checked;
        
    //     // Create campaign object
    //     const campaign = {
    //         id: Date.now().toString(),
    //         name: campaignName,
    //         sendingAccount: sendingAccount,
    //         leads: leads,
    //         leadCount: leads.length,
    //         initialEmail: initialEmail,
    //         followUpEmails: followUpEmails,
    //         settings: {
    //             trackOpens: trackOpens || false,
    //             trackClicks: trackClicks || false,
    //             stopOnReply: stopOnReply || true,
    //             stopOnClick: stopOnClick || false
    //         },
    //         status: 'Active',
    //         sentCount: 0,
    //         openCount: 0,
    //         clickCount: 0,
    //         replyCount: 0,
    //         createdAt: new Date().toISOString(),
    //         nextFollowUp: initialEmail.sendDate
    //     };
        
    //     // Add to campaigns list
    //     this.campaigns.push(campaign);
        
    //     // Save to localStorage
    //     localStorage.setItem('campaigns', JSON.stringify(this.campaigns));
        
    //     // In a real app, you would send this to your backend
    //     // fetch(`${API_BASE_URL}/campaigns`, {
    //     //     method: 'POST',
    //     //     headers: {
    //     //         'Content-Type': 'application/json'
    //     //     },
    //     //     body: JSON.stringify({
    //     //         uuid: userUuid,
    //     //         campaign: campaign
    //     //     })
    //     // })
        
    //     // Hide modal and update UI
    //     this.hideCampaignModal();
    //     this.renderCampaignsList();
    //     showToast('Campaign created successfully', 'success');
        
    //     // In a real app, you would start the campaign here
    //     // this.startCampaign(campaign);
    // },

    createCampaign: function() {
        const campaignName = document.getElementById('campaign-name')?.value;
        const sendingAccount = document.getElementById('sending-account')?.value;
    
        if (!campaignName) {
            showError('Please enter a campaign name');
            return;
        }
        if (!sendingAccount) {
            showError('Please select a sending account');
            return;
        }
    
        let leads = [];
        const leadSource = document.getElementById('lead-source')?.value;
        if (leadSource === 'current' && this.currentLeads.length > 0) {
            leads = this.currentLeads;
        } else if (leadSource === 'upload' && this.uploadedLeads && this.uploadedLeads.length > 0) {
            leads = this.uploadedLeads;
        } else {
            showError('No leads available. Upload a file or use current leads.');
            return;
        }
    
        const initialSubject = document.querySelector('.email-subject')?.value || generateBasicEmail(leads[0]).subject;
        const initialBody = document.querySelector('.email-body')?.value || generateBasicEmail(leads[0]).body;
        const initialDate = document.querySelector('.email-date')?.value || new Date().toISOString().slice(0, 16);
        const initialSpeed = document.querySelector('.email-speed')?.value || 'medium';
    
        const emails = leads.map(lead => ({
            to: lead.email,
            subject: replacePlaceholders(initialSubject, lead),
            body: replacePlaceholders(initialBody, lead)
        }));
    
        createAndStartCampaign(leads, 'manager'); // Use centralized function
        this.hideCampaignModal();
    },
    
    viewCampaign: function(index) {
        const campaign = this.campaigns[index];
        if (!campaign) return;
        
        // Create and show campaign details modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 overflow-y-auto';
        modal.innerHTML = `
            <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div class="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div class="absolute inset-0 bg-black bg-opacity-50"></div>
                </div>
                
                <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl w-full">
                    <div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div class="sm:flex sm:items-start">
                            <div class="w-full">
                                <div class="flex justify-between items-center mb-4">
                                    <h3 class="text-xl leading-6 font-medium text-gray-900 dark:text-white">
                                        Campaign Details: ${campaign.name}
                                    </h3>
                                    <span class="px-2 py-1 text-xs rounded-full ${this.getStatusClass(campaign.status)}">
                                        ${campaign.status}
                                    </span>
                                </div>
                                
                                <div class="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                                    <!-- Campaign Stats -->
                                    <div class="py-4">
                                        <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Campaign Statistics</h4>
                                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                                                <div class="text-sm text-blue-800 dark:text-blue-200">Total Leads</div>
                                                <div class="text-2xl font-bold text-blue-900 dark:text-blue-100">${campaign.leadCount}</div>
                                            </div>
                                            <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                                                <div class="text-sm text-green-800 dark:text-green-200">Emails Sent</div>
                                                <div class="text-2xl font-bold text-green-900 dark:text-green-100">${campaign.sentCount}</div>
                                            </div>
                                            <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                                                <div class="text-sm text-yellow-800 dark:text-yellow-200">Opens</div>
                                                <div class="text-2xl font-bold text-yellow-900 dark:text-yellow-100">${campaign.openCount || 0}</div>
                                            </div>
                                            <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                                                <div class="text-sm text-purple-800 dark:text-purple-200">Replies</div>
                                                <div class="text-2xl font-bold text-purple-900 dark:text-purple-100">${campaign.replyCount || 0}</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Campaign Emails -->
                                    <div class="py-4">
                                        <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Email Sequence</h4>
                                        
                                        <!-- Initial Email -->
                                        <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mb-3">
                                        <div class="font-medium text-gray-900 dark:text-white mb-1">Initial Email</div>
                                            <div class="text-sm text-gray-800 dark:text-gray-200 mb-1">
                                                <span class="font-medium">Subject:</span> ${campaign.initialEmail.subject}
                                            </div>
                                            <div class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                                                ${campaign.initialEmail.body}
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                                Send date: ${new Date(campaign.initialEmail.sendDate).toLocaleString()}
                                            </div>
                                        </div>
                                        
                                        <!-- Follow-up Emails -->
                                        ${campaign.followUpEmails.map((email, i) => `
                                            <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mb-2">
                                                <div class="font-medium text-gray-900 dark:text-white mb-1">Follow-up Email ${i + 1}</div>
                                                <div class="text-sm text-gray-800 dark:text-gray-200 mb-1">
                                                    <span class="font-medium">Subject:</span> ${email.subject}
                                                </div>
                                                <div class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                                                    ${email.body}
                                                </div>
                                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                                    Wait: ${email.waitDuration} ${email.waitUnit}
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                    
                                    <!-- Campaign Settings -->
                                    <div class="py-4">
                                        <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Settings</h4>
                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="text-sm">
                                                <span class="font-medium text-gray-900 dark:text-white">Sending Account:</span>
                                                <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.sendingAccount}</span>
                                            </div>
                                            <div class="text-sm">
                                                <span class="font-medium text-gray-900 dark:text-white">Send Speed:</span>
                                                <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.initialEmail.sendSpeed}</span>
                                            </div>
                                            <div class="text-sm">
                                                <span class="font-medium text-gray-900 dark:text-white">Track Opens:</span>
                                                <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.settings.trackOpens ? 'Yes' : 'No'}</span>
                                            </div>
                                            <div class="text-sm">
                                                <span class="font-medium text-gray-900 dark:text-white">Track Clicks:</span>
                                                <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.settings.trackClicks ? 'Yes' : 'No'}</span>
                                            </div>
                                            <div class="text-sm">
                                                <span class="font-medium text-gray-900 dark:text-white">Stop on Reply:</span>
                                                <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.settings.stopOnReply ? 'Yes' : 'No'}</span>
                                            </div>
                                            <div class="text-sm">
                                                <span class="font-medium text-gray-900 dark:text-white">Stop on Click:</span>
                                                <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.settings.stopOnClick ? 'Yes' : 'No'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button type="button" class="close-modal w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener to close button
        modal.querySelector('.close-modal')?.addEventListener('click', () => {
            modal.remove();
        });
        
        // Close modal when clicking outside
        modal.querySelector('.fixed.inset-0')?.addEventListener('click', (e) => {
            if (e.target === modal.querySelector('.fixed.inset-0')) {
                modal.remove();
            }
        });
    },
    
    pauseCampaign: function(index) {
        // Update campaign status
        this.campaigns[index].status = 'Paused';
        
        // Save to localStorage
        localStorage.setItem('campaigns', JSON.stringify(this.campaigns));
        
        // Update UI
        this.renderCampaignsList();
        showToast(`Campaign "${this.campaigns[index].name}" paused`, 'success');
        
        // In a real app, you would call your backend API to pause the campaign
        // fetch(`${API_BASE_URL}/campaign/pause`, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({
        //         uuid: userUuid,
        //         campaignId: this.campaigns[index].id
        //     })
        // });
    },
    
    resumeCampaign: function(index) {
        // Update campaign status
        this.campaigns[index].status = 'Active';
        
        // Save to localStorage
        localStorage.setItem('campaigns', JSON.stringify(this.campaigns));
        
        // Update UI
        this.renderCampaignsList();
        showToast(`Campaign "${this.campaigns[index].name}" resumed`, 'success');
        
        // In a real app, you would call your backend API to resume the campaign
        // fetch(`${API_BASE_URL}/campaign/resume`, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({
        //         uuid: userUuid,
        //         campaignId: this.campaigns[index].id
        //     })
        // });
    },
    
    deleteCampaign: function(index) {
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete the campaign "${this.campaigns[index].name}"?`)) {
            return;
        }
        
        // Remove campaign
        const campaignName = this.campaigns[index].name;
        this.campaigns.splice(index, 1);
        
        // Save to localStorage
        localStorage.setItem('campaigns', JSON.stringify(this.campaigns));
        
        // Update UI
        this.renderCampaignsList();
        showToast(`Campaign "${campaignName}" deleted`, 'success');
        
        // In a real app, you would call your backend API to delete the campaign
        // fetch(`${API_BASE_URL}/campaign/delete`, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({
        //         uuid: userUuid,
        //         campaignId: campaignId
        //     })
        // });
    }
};

// Initialize the application on page load
document.addEventListener('DOMContentLoaded', function() {
    init();
});


       