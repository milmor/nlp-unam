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
    const API_URL = 'https://nlp-course-api.onrender.com/';

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

    const SUPABASE_URL = 'https://dhvnozwogprzpgwusjqv.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_O-9_hPI2G889zB57o2pJRw_SAv-UT8k';

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    function setAuthMessage(message, isError = false) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#b00020' : '';
    }

    // Try to restore existing session on load
    supabaseClient.auth.getSession().then(({ data }) => {
        const user = data?.session?.user;
        if (user) {
            showDashboard(user);
        }
    });

    async function fetchUserRole(userId) {
        const { data } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        return data?.role || null;
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
                    await showDashboard(data.user);
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

    async function handleLogout() {
        const studentDashboard = document.getElementById('studentDashboard');
        const adminDashboard = document.getElementById('adminDashboard');
        const loginSectionEl = document.getElementById('loginSection');

        try {
            await supabaseClient.auth.signOut();
        } catch (err) {
            console.error('Logout error', err);
        }

        if (studentDashboard) studentDashboard.classList.add('hidden');
        if (adminDashboard) adminDashboard.classList.add('hidden');
        if (loginSectionEl) loginSectionEl.classList.remove('hidden');

        setAuthMessage('Logged out.');
    }

    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const adminLogoutBtn = document.getElementById('adminLogoutButton');
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', handleLogout);

    function setAdminDashboardMessage(msg, isError) {
        const el = document.getElementById('adminDashboardMessage');
        if (!el) return;
        el.textContent = msg;
        el.style.color = isError ? '#b00020' : '';
    }

    async function loadAdminData() {
        const assignmentsList = document.getElementById('adminAssignmentsList');
        const tbody = document.getElementById('adminSubmissionsBody');
        if (!tbody) return;

        setAdminDashboardMessage('Loading…');

        try {
            const [assignmentsRes, submissionsRes] = await Promise.all([
                supabaseClient.from('assignments').select('id, title, description').order('id'),
                supabaseClient
                    .from('submissions')
                    // Use FK constraint names to disambiguate embedding paths.
                    .select('id, notebook_url, score, feedback, created_at, student:profiles!fk_student(email, role, created_at), assignment:assignments!fk_assignment(title)')
                    .order('created_at', { ascending: false })
            ]);

            if (assignmentsRes.error) throw new Error(assignmentsRes.error.message || 'Failed to load assignments');
            if (submissionsRes.error) throw new Error(submissionsRes.error.message || 'Failed to load submissions');

            const assignments = assignmentsRes.data || [];
            const submissions = submissionsRes.data || [];

            if (assignmentsList) {
                assignmentsList.innerHTML = assignments.length === 0
                    ? '<li class="admin-list-empty">No assignments defined.</li>'
                    : assignments.map(a => `
                        <li class="admin-assignment-item">
                            <div class="admin-assignment-text">
                                <strong>${escapeHtml(a.title)}</strong>${a.description ? ': ' + escapeHtml(a.description) : ''}
                            </div>
                            <button type="button" class="btn-secondary btn-small admin-delete-assignment" data-id="${a.id}">
                                Delete
                            </button>
                        </li>
                    `).join('');
            }

            function escapeHtml(str) {
                if (str == null) return '';
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            }

            tbody.innerHTML = submissions.length === 0
                ? '<tr><td colspan="6" class="admin-table-empty">No submissions yet.</td></tr>'
                : submissions.map(sub => {
                    const studentEmail = sub.student?.email ?? '—';
                    const studentRole = sub.student?.role ? ` (${sub.student.role})` : '';
                    const studentLabel = `${studentEmail}${studentRole}`;
                    const assignmentTitle = sub.assignment?.title ?? '—';
                    const notebook = sub.notebook_url
                        ? `<a href="${escapeHtml(sub.notebook_url)}" target="_blank" rel="noopener">Open</a>`
                        : '—';
                    const score = sub.score != null ? sub.score : '';
                    const feedback = escapeHtml((sub.feedback || '').slice(0, 200)) + (sub.feedback && sub.feedback.length > 200 ? '…' : '');
                    const date = sub.created_at ? new Date(sub.created_at).toLocaleString() : '—';
                    return `<tr data-submission-id="${sub.id}">
                        <td>${escapeHtml(studentLabel)}</td>
                        <td>${escapeHtml(assignmentTitle)}</td>
                        <td>${notebook}</td>
                        <td><input type="number" min="0" max="100" step="0.5" class="admin-score-input" value="${score}" data-id="${sub.id}"></td>
                        <td><input type="text" class="admin-feedback-input" placeholder="Feedback" value="${escapeHtml(sub.feedback || '')}" data-id="${sub.id}"></td>
                        <td>${escapeHtml(date)}</td>
                    </tr>`;
                }).join('');

            // Save on blur for score/feedback
            tbody.querySelectorAll('.admin-score-input, .admin-feedback-input').forEach(input => {
                input.addEventListener('blur', debounce(saveSubmissionGrade, 400));
            });

            // Delete assignment buttons (admin only by RLS)
            if (assignmentsList) {
                assignmentsList.querySelectorAll('.admin-delete-assignment').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.dataset.id;
                        if (!id) return;
                        setAdminDashboardMessage('Deleting assignment…');
                        const { error } = await supabaseClient.from('assignments').delete().eq('id', id);
                        if (error) {
                            console.error('Delete assignment error', error);
                            setAdminDashboardMessage('Failed to delete: ' + error.message, true);
                            return;
                        }
                        setAdminDashboardMessage('');
                        loadAdminData();
                    });
                });
            }

            setAdminDashboardMessage('');
        } catch (err) {
            console.error('Admin data load error', err);
            setAdminDashboardMessage('Could not load data. Ensure RLS allows admins to read assignments, students, and submissions.', true);
            if (assignmentsList) assignmentsList.innerHTML = '';
            tbody.innerHTML = '<tr><td colspan="6" class="admin-table-empty">Error loading submissions.</td></tr>';
        }
    }

    function debounce(fn, ms) {
        let t;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    async function saveSubmissionGrade(e) {
        const input = e.target;
        const id = input.dataset.id;
        if (!id) return;
        const row = input.closest('tr');
        const scoreInput = row.querySelector('.admin-score-input');
        const feedbackInput = row.querySelector('.admin-feedback-input');
        const score = scoreInput.value === '' ? null : parseFloat(scoreInput.value);
        const feedback = (feedbackInput && feedbackInput.value) || null;

        try {
            const { error } = await supabaseClient
                .from('submissions')
                .update({ score, feedback })
                .eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error('Save grade error', err);
            setAdminDashboardMessage('Failed to save: ' + (err.message || 'unknown'), true);
        }
    }

    function escapeHtml(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    async function loadStudentData(userId) {
        const tbody = document.getElementById('dashboardSubmissionsBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';

        try {
            const [assignmentsRes, submissionsRes] = await Promise.all([
                supabaseClient.from('assignments').select('id, title').order('id'),
                supabaseClient
                    .from('submissions')
                    .select('id, assignment_id, score, created_at')
                    .eq('student_id', userId)
                    .order('created_at', { ascending: false })
            ]);

            if (assignmentsRes.error) throw new Error(assignmentsRes.error.message || 'Failed to load assignments');
            if (submissionsRes.error) throw new Error(submissionsRes.error.message || 'Failed to load submissions');

            const assignments = assignmentsRes.data || [];
            const submissions = submissionsRes.data || [];

            const latestByAssignment = new Map();
            for (const s of submissions) {
                if (!latestByAssignment.has(s.assignment_id)) {
                    latestByAssignment.set(s.assignment_id, s);
                }
            }

            if (assignments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No assignments yet.</td></tr>';
                return;
            }

            tbody.innerHTML = assignments.map(a => {
                const sub = latestByAssignment.get(a.id);
                const status = sub ? 'Submitted' : 'Not submitted';
                const grade = sub && sub.score != null ? sub.score : '–';
                const updated = sub && sub.created_at ? new Date(sub.created_at).toLocaleString() : '–';
                return `<tr>
                    <td>${escapeHtml(a.title)}</td>
                    <td>${escapeHtml(status)}</td>
                    <td>${escapeHtml(grade)}</td>
                    <td>${escapeHtml(updated)}</td>
                </tr>`;
            }).join('');
        } catch (err) {
            console.error('Student data load error', err);
            tbody.innerHTML = '<tr><td colspan="4">Error loading assignments/submissions.</td></tr>';
        }
    }

    // Admin: add assignment (INSERT protected by RLS)
    const adminAddAssignmentForm = document.getElementById('adminAddAssignmentForm');
    if (adminAddAssignmentForm) {
        adminAddAssignmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const titleEl = document.getElementById('adminAssignmentTitle');
            const descEl = document.getElementById('adminAssignmentDescription');
            const title = (titleEl?.value || '').trim();
            const description = (descEl?.value || '').trim();

            if (!title) return;

            setAdminDashboardMessage('Adding assignment…');
            const payload = description ? { title, description } : { title };
            const { error } = await supabaseClient.from('assignments').insert([payload]);
            if (error) {
                console.error('Insert assignment error', error);
                setAdminDashboardMessage('Failed to add: ' + error.message, true);
                return;
            }

            if (titleEl) titleEl.value = '';
            if (descEl) descEl.value = '';
            setAdminDashboardMessage('');
            loadAdminData();
        });
    }

    async function showDashboard(user) {
        const studentDashboard = document.getElementById('studentDashboard');
        const adminDashboard = document.getElementById('adminDashboard');
        const loginSectionEl = document.getElementById('loginSection');

        if (!studentDashboard && !adminDashboard) return;

        loginSectionEl && loginSectionEl.classList.add('hidden');
        setAuthMessage('');

        const emailSpan = document.getElementById('dashboardUserEmail');
        if (emailSpan && user && user.email) emailSpan.textContent = user.email;

        const adminEmailSpan = document.getElementById('adminDashboardUserEmail');
        if (adminEmailSpan && user && user.email) adminEmailSpan.textContent = user.email;

        let role = null;
        if (user && user.id) role = await fetchUserRole(user.id);

        const adminBadge = document.getElementById('dashboardAdminBadge');
        if (adminBadge) {
            adminBadge.classList.add('hidden');
            if (role === 'admin') adminBadge.classList.remove('hidden');
        }

        if (role === 'admin') {
            studentDashboard && studentDashboard.classList.add('hidden');
            if (adminDashboard) {
                adminDashboard.classList.remove('hidden');
                loadAdminData();
            }
        } else {
            adminDashboard && adminDashboard.classList.add('hidden');
            if (studentDashboard) studentDashboard.classList.remove('hidden');
            if (user && user.id) {
                loadStudentData(user.id);
            }
        }
    }
})();
