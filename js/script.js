// Dark Mode Toggle Functionality
(function() {
    const themeToggle = document.getElementById('themeToggle');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Get saved theme or use system preference
    function getPreferredTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            return savedTheme;
        }
        return prefersDarkScheme.matches ? 'dark' : 'light';
    }
    
    // Apply theme to document
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }
    
    // Initialize theme on page load
    applyTheme(getPreferredTheme());
    
    // Toggle theme on button click
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });
    
    // Listen for system theme changes
    prefersDarkScheme.addEventListener('change', function(e) {
        // Only auto-switch if user hasn't set a preference
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
})();

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Expandable quotes for long reviews
(function() {
    const TRUNCATE_LENGTH = 300; // Characters before truncating
    
    document.querySelectorAll('.quote').forEach(quote => {
        const text = quote.textContent;
        
        if (text.length > TRUNCATE_LENGTH) {
            quote.classList.add('truncated');
            
            // Create read more button
            const btn = document.createElement('button');
            btn.className = 'read-more-btn';
            btn.textContent = 'Leer más ↓';
            
            btn.addEventListener('click', function() {
                const isExpanded = quote.classList.contains('expanded');
                
                if (isExpanded) {
                    quote.classList.remove('expanded');
                    quote.classList.add('truncated');
                    btn.textContent = 'Leer más ↓';
                } else {
                    quote.classList.remove('truncated');
                    quote.classList.add('expanded');
                    btn.textContent = 'Leer menos ↑';
                }
            });
            
            // Insert button after the quote
            quote.parentNode.insertBefore(btn, quote.nextSibling);
        }
    });
})();

// Add active state to nav links based on scroll position
window.addEventListener('scroll', function() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        const sectionHeight = section.offsetHeight;
        
        if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.style.backgroundColor = '';
        if (link.getAttribute('href') === '#' + current) {
            link.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        }
    });
});

// Simple integration with homework submission API
(function() {
    const statusEl = document.getElementById('submissionApiStatus');
    const messageEl = document.getElementById('submissionApiMessage');
    const refreshBtn = document.getElementById('checkSubmissionApi');
    const API_URL = 'https://nlp-course-api.fly.dev/';

    if (!statusEl || !refreshBtn) {
        return;
    }

    async function checkApiStatus() {
        statusEl.textContent = 'Checking API status…';
        messageEl.textContent = '';

        try {
            const response = await fetch(API_URL, { method: 'GET' });
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            const data = await response.json();
            const status = data.status || 'unknown';

            if (status.toLowerCase() === 'running') {
                statusEl.textContent = 'API is running ✅';
                messageEl.textContent = 'You will soon be able to upload homework through this page.';
            } else {
                statusEl.textContent = 'API responded, but status is: ' + status;
                messageEl.textContent = 'If this persists, please contact the instructor.';
            }
        } catch (err) {
            statusEl.textContent = 'Cannot reach submission API ❌';
            messageEl.textContent = 'Error: ' + (err && err.message ? err.message : 'Unknown error');
        }
    }

    // Initial check and manual refresh
    checkApiStatus();
    refreshBtn.addEventListener('click', checkApiStatus);
})();

// Supabase authentication for submissions page
(function() {
    // Only run on pages that include auth forms
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const statusEl = document.getElementById('authMessage');

    if (!loginForm && !signupForm) {
        return;
    }

    if (!window.supabase) {
        if (statusEl) {
            statusEl.textContent = 'Auth library not loaded. Please contact the instructor.';
        }
        return;
    }

    const SUPABASE_URL = 'https://dhvnozwogprzpgwusjqv.supabase.com';
    const SUPABASE_KEY = 'sb_publishable_O-9_hPI2G889zB57o2pJRw_SAv-UT8k';

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    function setAuthMessage(message, isError = false) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#b00020' : '';
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('authEmailLogin').value.trim();
            const password = document.getElementById('authPasswordLogin').value;

            setAuthMessage('Logging in…');

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    console.error('Login error', error);
                    setAuthMessage('Login failed: ' + error.message, true);
                } else {
                    console.log('Logged in', data);
                    setAuthMessage('Logged in successfully.');
                }
            } catch (err) {
                console.error('Unexpected login error', err);
                setAuthMessage('Unexpected error during login.', true);
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('authEmailSignup').value.trim();
            const password = document.getElementById('authPasswordSignup').value;

            setAuthMessage('Creating account…');

            try {
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password
                });

                if (error) {
                    console.error('Signup error', error);
                    setAuthMessage('Signup failed: ' + error.message, true);
                } else {
                    console.log('Signup result', data);
                    setAuthMessage('Signup successful. Check your email to confirm your account.');
                }
            } catch (err) {
                console.error('Unexpected signup error', err);
                setAuthMessage('Unexpected error during signup.', true);
            }
        });
    }
})();
