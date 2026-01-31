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
