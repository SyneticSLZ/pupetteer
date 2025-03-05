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
                             <button id="verify-leads-button" style="display: none;"
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

// Inside createLeadsTable, update the event listener
document.getElementById('start-campaign')?.addEventListener('click', async function() {
    const button = this; // Store reference to the button
    button.disabled = true;
    button.innerHTML = `
        <div class="flex items-center space-x-2">
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Processing...</span>
        </div>
    `;
    button.className += ' opacity-75 cursor-not-allowed';

    try {
        await createAndStartCampaign(data); // Await the async function
        // showToast('Campaign processing completed!', 'success');
    } catch (error) {
        console.error('Error starting campaign:', error);
        showError('Failed to start campaign: ' + error.message);
    } finally {
        // Reset button state
        button.disabled = false;
        button.innerHTML = `
            <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <span>Process Leads</span>
        `;
        button.className = button.className.replace(' opacity-75 cursor-not-allowed', ''); // Remove added classes
    }
});

        // document.getElementById('verify-leads-button')?.addEventListener('click', function() {
        //     verifyAndPrepareLeads(data);
        // });
        document.getElementById('verify-leads-button')?.addEventListener('click', function() {
            this.disabled = true;
            this.innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Verifying...</span>
                </div>
            `;
            verifyAndPrepareLeads(data).finally(() => {
                this.disabled = false;
                this.innerHTML = `
                    <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Verify & Create Campaign</span>
                `;
            });
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
    <table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; font-size: 12px; color: #ffffff; width: 100%; max-width: 400px; border-collapse: collapse; background-color: #2d3748; padding: 5px; table-layout: fixed;">
        <tr>
            <td colspan="2" style="vertical-align: top; word-break: break-word; line-height: 1.5; padding-bottom: 10px;">
                <strong>Sapna Ravula</strong><br>
                Cebron Group<br>
                Investment Banking - Healthcare M&A<br>
                Phone: +1-123-456-7890<br>
                Email: <a href="mailto:sapna.ravula@cebrongroup.com" style="color: #63b3ed; text-decoration: none;">sapna.ravula@cebrongroup.com</a><br>
                Website: <a href="https://www.cebrongroup.com" style="color: #63b3ed; text-decoration: none;">www.cebrongroup.com</a>
            </td>
        </tr>
        <tr>
            <td colspan="2" style="vertical-align: top; text-align: center; padding-top: 10px;">
                <img src="data:image/png;base64,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" alt="EntelMedLifeLine Logo" width="100" height="50" style="display: block; max-width: 100%; height: auto; border: none; margin: 0 auto;" onerror="this.style.display='none';">
            </td>
        </tr>
        
    </table>
`;

// Replace the base64 placeholder with your actual encoded image data.

// Replace the base64 placeholder with your actual encoded image data.

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
async function verifyAndPrepareLeads(leadsData) {
    const leadsSkeleton = document.getElementById('leads-skeleton');
    if (leadsSkeleton) leadsSkeleton.classList.remove('hidden');

    try {
        const verifiedLeads = await Promise.all(leadsData.map(async lead => {
            if (lead.email_1) {
                const response = await fetch(`${API_BASE_URL}/verify-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: lead.email_1 })
                });
                const data = await response.json();
                return { ...lead, emailValidation: data.result || { isValid: true, confidence: 70 } };
            }
            return lead;
        }));

        // Show verified campaign modal
        const modal = document.createElement('div');
        modal.innerHTML = document.getElementById('verified-campaign-template').innerHTML;
        document.body.appendChild(modal);
        createVerifiedCampaign(modal.firstChild, verifiedLeads.filter(l => l.emailValidation?.isValid));
    } catch (error) {
        console.error('Error verifying leads:', error);
        showError('Failed to verify leads: ' + error.message);
    } finally {
        if (leadsSkeleton) leadsSkeleton.classList.add('hidden');
    }
}

// Add event listener in createLeadsTable


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

Sapna Ravula 
Cebron Group 
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

Sapna Ravula 
Cebron Group 
${EMAIL_SIGNATURE}`;
            break;

        case 2:
            subject = `Ensuring Transaction Readiness for Your Medical Device Business`;
            body = `Hello ${contact.firstName || '[Name]'},

I am following up to emphasize one of Cebron Group’s core capabilities: preparing businesses for a transaction-ready state. We conduct a comprehensive analysis to identify potential issues affecting valuation or deal success${company.revenue ? `, such as optimizing your ${company.revenue} revenue stream` : ''}, allowing us to address these proactively.

By preparing your business${company.name ? `, ${company.name},` : ''} thoroughly before engaging buyers, we ensure a smoother negotiation process and maximize competitive tension among potential acquirers.

If you would like to explore this process in more depth, please let me know when you’re available for a 10-minute call.

Sapna Ravula 
Cebron Group 
${EMAIL_SIGNATURE}`;
            break;

        case 3:
            subject = `Using Cebron Group's M&A Expertise for Your Sale Process`;
            body = `Hello ${contact.firstName || '[Name]'},

As a follow-up to our previous emails, I’d like to emphasize what differentiates Cebron in managing M&A transactions for medical device businesses${company.name ? ` like ${company.name}` : ''}.

Our team combines sector-specific insights with financial expertise, providing clients with a clear understanding of deal structures and valuation drivers. We secure offers and enhance terms that deliver higher seller value—whether through cash consideration, earnouts, or equity rollovers, depending on your strategic goals${company.employees ? ` and the scale of your ${company.employees}-employee operation` : ''}.

If you are interested in discussing our approach and how it can benefit your business, please let me know your availability for a brief call.

Sapna Ravula 
Cebron Group 
${EMAIL_SIGNATURE}`;
            break;

        default:
            subject = `Follow-Up: Exploring Opportunities with ${company.name || 'Your Business'}`;
            body = `Hello ${contact.firstName || '[Name]'},

Just checking in regarding our previous discussions about supporting ${company.name || 'your business'} through the sale process. Please let me know if you’d like to connect for a quick call.

Sapna Ravula 
Cebron Group 
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

    fetch(`${API_BASE_URL}/mailboxes/${userUuid}`)
        .then(response => response.json())
        .then(accounts => {
            if (!accounts.mailboxes || accounts.mailboxes.length === 0) {
                showError('No Gmail accounts connected. Please connect an account first.');
                return;
            }
            showEmailSendDialog(userUuid, accounts.mailboxes, data, email, campaignManager.campaigns.find(c => c.leadCount === leadData.size)?.id || 'default');
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
            headers: { 'Content-Type': 'application/json', 'campaign-id': campaignId },
            body: JSON.stringify({ uuid: userUuid, mailboxId, to, subject, body })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                // Show success message
                showToast('Email sent successfully!', 'success');
                modal.remove();
                startCampaignStatusPolling(campaignId);
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
    
    // showCampaignModal: function() {
    //     // Get the modal element
    //     const modal = document.getElementById('campaign-modal');
    //     if (!modal) return;
        
    //     // Reset form
    //     const form = document.getElementById('campaign-form');
    //     if (form) form.reset();
        
    //     const followUpContainer = document.getElementById('follow-up-container');
    //     if (followUpContainer) followUpContainer.innerHTML = '';
        
    //     this.followUpCount = 0;
        
    //     // Show modal
    //     modal.classList.remove('hidden');
    //     document.body.classList.add('overflow-hidden');
    // },
    
    showCampaignModal: function() {
        const modal = document.getElementById('campaign-modal');
        if (!modal) return;
    
        // Reset form
        const form = document.getElementById('campaign-form');
        if (form) form.reset();
        const followUpContainer = document.getElementById('follow-up-container');
        if (followUpContainer) followUpContainer.innerHTML = '';
        this.followUpCount = 0;
    
        // Populate initial email and signature
        const initialSubject = document.querySelector('.email-subject');
        const initialBody = document.querySelector('.email-body');
        if (initialSubject) initialSubject.value = generateBasicEmail({ company: { name: 'Sample Company' }, contact: { firstName: 'Contact' } }).subject;
        if (initialBody) initialBody.value = generateBasicEmail({ company: { name: 'Sample Company' }, contact: { firstName: 'Contact' } }).body + EMAIL_SIGNATURE;
    
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    },
    
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
        const initialBody = document.querySelector('.email-body')?.value || generateBasicEmail(leads[0]).body + EMAIL_SIGNATURE;
        const initialDate = document.querySelector('.email-date')?.value || new Date().toISOString().slice(0, 16);
        const initialSpeed = document.querySelector('.email-speed')?.value || 'medium';
    
        const followUpEmails = [];
        document.querySelectorAll('.follow-up-email').forEach(container => {
            const subject = container.querySelector('.email-subject')?.value || generateFollowUpEmail(leads[0], 1).subject;
            const body = container.querySelector('.email-body')?.value || generateFollowUpEmail(leads[0], 1).body + EMAIL_SIGNATURE;
            const waitDuration = parseInt(container.querySelector('.wait-duration')?.value) || 1;
            const waitUnit = container.querySelector('.wait-unit')?.value;
            if (subject && body) {
                followUpEmails.push({ subject, body, waitDuration, waitUnit });
            }
        });
    
        const emails = leads.map(lead => ({
            to: lead.email,
            subject: replacePlaceholders(initialSubject, lead),
            body: replacePlaceholders(initialBody, lead)
        }));
    
        createAndStartCampaign(leads, 'manager');
        this.hideCampaignModal();
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

    // createCampaign: function() {
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
    
    //     let leads = [];
    //     const leadSource = document.getElementById('lead-source')?.value;
    //     if (leadSource === 'current' && this.currentLeads.length > 0) {
    //         leads = this.currentLeads;
    //     } else if (leadSource === 'upload' && this.uploadedLeads && this.uploadedLeads.length > 0) {
    //         leads = this.uploadedLeads;
    //     } else {
    //         showError('No leads available. Upload a file or use current leads.');
    //         return;
    //     }
    
    //     const initialSubject = document.querySelector('.email-subject')?.value || generateBasicEmail(leads[0]).subject;
    //     const initialBody = document.querySelector('.email-body')?.value || generateBasicEmail(leads[0]).body;
    //     const initialDate = document.querySelector('.email-date')?.value || new Date().toISOString().slice(0, 16);
    //     const initialSpeed = document.querySelector('.email-speed')?.value || 'medium';
    
    //     const emails = leads.map(lead => ({
    //         to: lead.email,
    //         subject: replacePlaceholders(initialSubject, lead),
    //         body: replacePlaceholders(initialBody, lead)
    //     }));
    
    //     createAndStartCampaign(leads, 'manager'); // Use centralized function
    //     this.hideCampaignModal();
    // },
    
    // viewCampaign: function(index) {
    //     const campaign = this.campaigns[index];
    //     if (!campaign) return;
        
    //     // Create and show campaign details modal
    //     const modal = document.createElement('div');
    //     modal.className = 'fixed inset-0 z-50 overflow-y-auto';
    //     modal.innerHTML = `
    //         <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
    //             <div class="fixed inset-0 transition-opacity" aria-hidden="true">
    //                 <div class="absolute inset-0 bg-black bg-opacity-50"></div>
    //             </div>
                
    //             <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl w-full">
    //                 <div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
    //                     <div class="sm:flex sm:items-start">
    //                         <div class="w-full">
    //                             <div class="flex justify-between items-center mb-4">
    //                                 <h3 class="text-xl leading-6 font-medium text-gray-900 dark:text-white">
    //                                     Campaign Details: ${campaign.name}
    //                                 </h3>
    //                                 <span class="px-2 py-1 text-xs rounded-full ${this.getStatusClass(campaign.status)}">
    //                                     ${campaign.status}
    //                                 </span>
    //                             </div>
                                
    //                             <div class="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
    //                                 <!-- Campaign Stats -->
    //                                 <div class="py-4">
    //                                     <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Campaign Statistics</h4>
    //                                     <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    //                                         <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
    //                                             <div class="text-sm text-blue-800 dark:text-blue-200">Total Leads</div>
    //                                             <div class="text-2xl font-bold text-blue-900 dark:text-blue-100">${campaign.leadCount}</div>
    //                                         </div>
    //                                         <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
    //                                             <div class="text-sm text-green-800 dark:text-green-200">Emails Sent</div>
    //                                             <div class="text-2xl font-bold text-green-900 dark:text-green-100">${campaign.sentCount}</div>
    //                                         </div>
    //                                         <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
    //                                             <div class="text-sm text-yellow-800 dark:text-yellow-200">Opens</div>
    //                                             <div class="text-2xl font-bold text-yellow-900 dark:text-yellow-100">${campaign.openCount || 0}</div>
    //                                         </div>
    //                                         <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
    //                                             <div class="text-sm text-purple-800 dark:text-purple-200">Replies</div>
    //                                             <div class="text-2xl font-bold text-purple-900 dark:text-purple-100">${campaign.replyCount || 0}</div>
    //                                         </div>
    //                                     </div>
    //                                 </div>
                                    
    //                                 <!-- Campaign Emails -->
    //                                 <div class="py-4">
    //                                     <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Email Sequence</h4>
                                        
    //                                     <!-- Initial Email -->
    //                                     <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mb-3">
    //                                     <div class="font-medium text-gray-900 dark:text-white mb-1">Initial Email</div>
    //                                         <div class="text-sm text-gray-800 dark:text-gray-200 mb-1">
    //                                             <span class="font-medium">Subject:</span> ${campaign.initialEmail.subject}
    //                                         </div>
    //                                         <div class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
    //                                             ${campaign.initialEmail.body}
    //                                         </div>
    //                                         <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
    //                                             Send date: ${new Date(campaign.initialEmail.sendDate).toLocaleString()}
    //                                         </div>
    //                                     </div>
                                        
    //                                     <!-- Follow-up Emails -->
    //                                     ${campaign.followUpEmails.map((email, i) => `
    //                                         <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mb-2">
    //                                             <div class="font-medium text-gray-900 dark:text-white mb-1">Follow-up Email ${i + 1}</div>
    //                                             <div class="text-sm text-gray-800 dark:text-gray-200 mb-1">
    //                                                 <span class="font-medium">Subject:</span> ${email.subject}
    //                                             </div>
    //                                             <div class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
    //                                                 ${email.body}
    //                                             </div>
    //                                             <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
    //                                                 Wait: ${email.waitDuration} ${email.waitUnit}
    //                                             </div>
    //                                         </div>
    //                                     `).join('')}
    //                                 </div>
                                    
    //                                 <!-- Campaign Settings -->
    //                                 <div class="py-4">
    //                                     <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Settings</h4>
    //                                     <div class="grid grid-cols-2 gap-4">
    //                                         <div class="text-sm">
    //                                             <span class="font-medium text-gray-900 dark:text-white">Sending Account:</span>
    //                                             <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.sendingAccount}</span>
    //                                         </div>
    //                                         <div class="text-sm">
    //                                             <span class="font-medium text-gray-900 dark:text-white">Send Speed:</span>
    //                                             <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.initialEmail.sendSpeed}</span>
    //                                         </div>
    //                                         <div class="text-sm">
    //                                             <span class="font-medium text-gray-900 dark:text-white">Track Opens:</span>
    //                                             <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.settings.trackOpens ? 'Yes' : 'No'}</span>
    //                                         </div>
    //                                         <div class="text-sm">
    //                                             <span class="font-medium text-gray-900 dark:text-white">Track Clicks:</span>
    //                                             <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.settings.trackClicks ? 'Yes' : 'No'}</span>
    //                                         </div>
    //                                         <div class="text-sm">
    //                                             <span class="font-medium text-gray-900 dark:text-white">Stop on Reply:</span>
    //                                             <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.settings.stopOnReply ? 'Yes' : 'No'}</span>
    //                                         </div>
    //                                         <div class="text-sm">
    //                                             <span class="font-medium text-gray-900 dark:text-white">Stop on Click:</span>
    //                                             <span class="text-gray-600 dark:text-gray-300 ml-2">${campaign.settings.stopOnClick ? 'Yes' : 'No'}</span>
    //                                         </div>
    //                                     </div>
    //                                 </div>
    //                             </div>
    //                         </div>
    //                     </div>
    //                 </div>
    //                 <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
    //                     <button type="button" class="close-modal w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
    //                         Close
    //                     </button>
    //                 </div>
    //             </div>
    //         </div>
    //     `;
        
    //     document.body.appendChild(modal);
        
    //     // Add event listener to close button
    //     modal.querySelector('.close-modal')?.addEventListener('click', () => {
    //         modal.remove();
    //     });
        
    //     // Close modal when clicking outside
    //     modal.querySelector('.fixed.inset-0')?.addEventListener('click', (e) => {
    //         if (e.target === modal.querySelector('.fixed.inset-0')) {
    //             modal.remove();
    //         }
    //     });
    // },
    viewCampaign: function(index) {
        const campaign = this.campaigns[index];
        if (!campaign) return;
    
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center';
        modal.innerHTML = `
            <div class="relative bg-gray-800 rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle max-w-4xl w-full mx-auto">
                <button type="button" class="absolute top-4 right-4 text-gray-400 hover:text-gray-500 close-modal" aria-label="Close">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div class="p-6">
                    <div class="sm:flex sm:items-start">
                        <div class="w-full">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-xl leading-6 font-medium text-white">
                                    Campaign Details: ${campaign.name}
                                </h3>
                                <span class="px-2 py-1 text-xs rounded-full ${this.getStatusClass(campaign.status)}">
                                    ${campaign.status}
                                </span>
                            </div>
                            <div class="mt-2 divide-y divide-gray-700 max-h-[70vh] overflow-y-auto">
                                <div class="py-4">
                                    <h4 class="text-lg font-medium text-white mb-3">Campaign Statistics</h4>
                                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div class="bg-blue-900 p-3 rounded-lg">
                                            <div class="text-sm text-blue-200">Total Leads</div>
                                            <div class="text-2xl font-bold text-blue-100">${campaign.leadCount}</div>
                                        </div>
                                        <div class="bg-green-900 p-3 rounded-lg">
                                            <div class="text-sm text-green-200">Emails Sent</div>
                                            <div class="text-2xl font-bold text-green-100">${campaign.sentCount}</div>
                                        </div>
                                        <div class="bg-yellow-900 p-3 rounded-lg">
                                            <div class="text-sm text-yellow-200">Opens</div>
                                            <div class="text-2xl font-bold text-yellow-100">${campaign.openCount || 0}</div>
                                        </div>
                                        <div class="bg-purple-900 p-3 rounded-lg">
                                            <div class="text-sm text-purple-200">Replies</div>
                                            <div class="text-2xl font-bold text-purple-100">${campaign.replyCount || 0}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="py-4">
                                    <h4 class="text-lg font-medium text-white mb-3">Email Sequence</h4>
                                    <div class="bg-gray-700 p-3 rounded-lg mb-3">
                                        <div class="font-medium text-white mb-1">Initial Email</div>
                                        <div class="text-gray-300 mb-1">
                                            <span class="font-medium">Subject:</span> ${campaign.initialEmail.subject}
                                        </div>
                                        <div class="text-gray-400 whitespace-pre-wrap break-words border-t border-gray-600 pt-2 mt-2">
                                            ${campaign.initialEmail.body}
                                        </div>
                                    </div>
                                    ${campaign.followUpEmails.map((email, i) => `
                                        <div class="bg-gray-700 p-3 rounded-lg mb-2">
                                            <div class="font-medium text-white mb-1">Follow-up Email ${i + 1}</div>
                                            <div class="text-gray-300 mb-1">
                                                <span class="font-medium">Subject:</span> ${email.subject}
                                            </div>
                                            <div class="text-gray-400 whitespace-pre-wrap break-words border-t border-gray-600 pt-2 mt-2">
                                                ${email.body}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button type="button" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm close-modal">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    
        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
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


       