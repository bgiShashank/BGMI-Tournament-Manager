// BGMI Tournament - Team-only registration (no admin login, no Google Sheets)
class TournamentManager {
    constructor() {
        this.tournaments = this.loadFromStorage('tournaments') || [];
        this.registrations = this.loadFromStorage('registrations') || [];
        this.adminSession = this.loadFromStorage('adminSession') || { isAuthenticated: false, username: null };
        this.defaultAdmin = { username: 'SudeepPandit', passwordHash: this.simpleHash('Sudeep2004') };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTournaments();
        this.populateTournamentSelects();
        this.loadRegistrations();
        this.setupMobileMenu();
    }

    // Event Listeners
    setupEventListeners() {
        // Team registration only
        const teamForm = document.getElementById('teamRegistrationForm');
        if (teamForm) teamForm.addEventListener('submit', (e) => this.handleTeamRegistration(e));

        // Create Tournament
        const createForm = document.getElementById('createTournamentForm');
        if (createForm) createForm.addEventListener('submit', (e) => this.handleCreateTournament(e));

        // Tabs
        this.setupTabSwitching();
        this.setupAdminTabSwitching();

        // Search/filter
        const search = document.getElementById('searchRegistrations');
        const filter = document.getElementById('filterType');
        if (search) search.addEventListener('input', () => this.filterRegistrations());
        if (filter) filter.addEventListener('change', () => this.filterRegistrations());

        // Download CSV
        const downloadCsvBtn = document.getElementById('downloadCsvBtn');
        if (downloadCsvBtn) downloadCsvBtn.addEventListener('click', () => this.guard(() => this.downloadCsv()));

        // Default static QR image filename (placed in project root)
        this.staticPayment = { qrUrl: 'qr.jpg', upiId: '' };

        // Success modal close
        const closeBtn = document.querySelector('.close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('modal')) this.closeModal();
        });

        // Auth modal
        const authBtn = document.getElementById('authBtn');
        const authModal = document.getElementById('authModal');
        const authClose = document.getElementById('authClose');
        const authForm = document.getElementById('authForm');
        const authError = document.getElementById('authError');
        this.updateAuthUI();
        if (authBtn) authBtn.addEventListener('click', () => {
            if (this.adminSession.isAuthenticated) {
                this.adminSession = { isAuthenticated: false, username: null };
                this.saveToStorage('adminSession', this.adminSession);
                this.updateAuthUI();
                this.showSuccessModal('You have been logged out.', 'Logged Out');
            } else {
                if (authModal) authModal.style.display = 'block';
            }
        });
        if (authClose) authClose.addEventListener('click', () => authModal.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target === authModal) authModal.style.display = 'none'; });
        if (authForm) authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (authError) authError.style.display = 'none';
            const form = new FormData(authForm);
            const u = form.get('authUsername').trim();
            const p = form.get('authPassword');
            if (this.verifyAdmin(u, p)) {
                this.adminSession = { isAuthenticated: true, username: u };
                this.saveToStorage('adminSession', this.adminSession);
                this.updateAuthUI();
                if (authModal) authModal.style.display = 'none';
                this.showSuccessModal('Welcome, admin. You are now logged in.', 'Login Successful');
            } else {
                if (authError) authError.style.display = 'block';
            }
        });

        // Smooth scroll
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    setupTabSwitching() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const pane = document.getElementById(target + '-tab');
                if (pane) pane.classList.add('active');
            });
        });
    }

    setupAdminTabSwitching() {
        const btns = document.querySelectorAll('.admin-tab-btn');
        const panes = document.querySelectorAll('.admin-tab-content');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                btns.forEach(b => b.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const pane = document.getElementById(target + '-tab');
                if (pane) pane.classList.add('active');
            });
        });
    }

    setupMobileMenu() {
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        if (!hamburger || !navMenu) return;
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    // Tournaments
    loadTournaments() {
        const grid = document.getElementById('tournamentGrid');
        const adminTable = document.getElementById('adminTournamentsTable');

        if (this.tournaments.length === 0) {
            this.tournaments = [
                { id: 1, name: 'BGMI Championship 2024', description: 'The ultimate BGMI tournament with massive prize pool', date: '2024-02-15T18:00', maxPlayers: 100, entryFee: 100, prizePool: 50000, type: 'team', status: 'active' }
            ];
            this.saveToStorage('tournaments', this.tournaments);
        }

        if (grid) this.renderTournaments(grid);
        if (adminTable) this.renderAdminTournaments(adminTable);
    }

    renderTournaments(container) {
        const active = this.tournaments.filter(t => t.status === 'active');
        if (active.length === 0) {
            container.innerHTML = '<p class="text-center">No active tournaments available.</p>';
            return;
        }
        container.innerHTML = active.map(t => `
            <div class="tournament-card">
                <h3>${t.name}</h3>
                <p><strong>Type:</strong> Team (4v4)</p>
                <p><strong>Date:</strong> ${this.formatDateTime(t.date)}</p>
                <p><strong>Max Teams:</strong> ${t.maxPlayers}</p>
                <p><strong>Entry Fee:</strong> ₹${t.entryFee}</p>
                <div class="prize">Prize Pool: ₹${t.prizePool.toLocaleString()}</div>
                <p>${t.description}</p>
            </div>
        `).join('');
    }

    renderAdminTournaments(container) {
        if (this.tournaments.length === 0) {
            container.innerHTML = '<p class="text-center">No tournaments created yet.</p>';
            return;
        }
        container.innerHTML = `
            <div class="tournaments-table">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name</th><th>Type</th><th>Date</th><th>Max</th><th>Entry Fee</th><th>Prize Pool</th><th>Status</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.tournaments.map(t => `
                            <tr>
                                <td>${t.name}</td>
                                <td>Team</td>
                                <td>${this.formatDateTime(t.date)}</td>
                                <td>${t.maxPlayers}</td>
                                <td>₹${t.entryFee}</td>
                                <td>₹${t.prizePool.toLocaleString()}</td>
                                <td><span class="text-${t.status === 'active' ? 'success' : 'danger'}">${t.status}</span></td>
                                <td>
                                    <button onclick="tournamentManager.toggleTournamentStatus(${t.id})" class="btn btn-secondary" style="padding:5px 10px; font-size:.8rem;">${t.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                                    <button onclick="tournamentManager.deleteTournament(${t.id})" class="btn btn-primary" style="padding:5px 10px; font-size:.8rem; background:#f44336;">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    populateTournamentSelects() {
        const select = document.getElementById('teamTournament');
        if (!select) return;
        const active = this.tournaments.filter(t => t.status === 'active');
        select.innerHTML = '<option value="">Select Tournament</option>' + active.map(t => `<option value="${t.id}">${t.name} (Team)</option>`).join('');
    }

    // Team Registration
    handleTeamRegistration(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const registration = {
            id: Date.now(),
            type: 'team',
            teamName: formData.get('teamName'),
            teamCaptain: formData.get('teamCaptain'),
            teamCaptainId: formData.get('teamCaptainId'),
            teamEmail: formData.get('teamEmail'),
            teamPhone: formData.get('teamPhone'),
            tournamentId: parseInt(formData.get('teamTournament')),
            captainRole: formData.get('teamCaptainRole'),
            members: [
                { name: formData.get('member2Name'), id: formData.get('member2Id'), role: formData.get('member2Role') },
                { name: formData.get('member3Name'), id: formData.get('member3Id'), role: formData.get('member3Role') },
                { name: formData.get('member4Name'), id: formData.get('member4Id'), role: formData.get('member4Role') }
            ].filter(m => m.name && m.id),
            substitutes: [
                { name: formData.get('substitute1Name'), id: formData.get('substitute1Id'), role: formData.get('substitute1Role') },
                { name: formData.get('substitute2Name'), id: formData.get('substitute2Id'), role: formData.get('substitute2Role') }
            ].filter(s => s.name && s.id),
            registrationDate: new Date().toISOString()
        };

        if (this.validateTeamRegistration(registration)) {
            // gate by payment first
            this.pendingRegistration = Object.assign({}, registration, {
                payment: { status: 'pending', method: null, ref: null }
            });
            this.openPaymentModal(this.pendingRegistration);
        }
    }

    validateTeamRegistration(reg) {
        const required = ['teamName','teamCaptain','teamCaptainId','teamEmail','teamPhone','tournamentId','captainRole'];
        for (const key of required) {
            if (!reg[key]) { alert(`Please fill in all required fields. Missing: ${key}`); return false; }
        }
        // at least 4 players (captain + 3 members)
        if ((reg.members || []).length < 3) { alert('Please provide at least 3 additional team members (4 players total including captain).'); return false; }
        const t = this.tournaments.find(t => t.id === reg.tournamentId);
        if (!t) { alert('Selected tournament not found.'); return false; }
        const current = this.registrations.filter(r => r.tournamentId === reg.tournamentId);
        if (current.length >= t.maxPlayers) { alert('This tournament is full.'); return false; }
        return true;
    }

    // Admin functions (no auth)
    handleCreateTournament(e) {
        e.preventDefault();
        if (!this.adminSession.isAuthenticated) {
            this.showSuccessModal('You must be logged in as admin to create tournaments.', 'Access Denied');
            return;
        }
        const formData = new FormData(e.target);
        const t = {
            id: Date.now(),
            name: formData.get('tournamentName'),
            description: formData.get('tournamentDescription'),
            date: formData.get('tournamentDate'),
            maxPlayers: parseInt(formData.get('maxPlayers')),
            entryFee: parseInt(formData.get('entryFee')) || 0,
            prizePool: parseInt(formData.get('prizePool')) || 0,
            type: 'team',
            status: 'active'
        };
        this.tournaments.push(t);
        this.saveToStorage('tournaments', this.tournaments);
        this.loadTournaments();
        this.populateTournamentSelects();
        this.showSuccessModal('Your tournament has been created successfully.', 'Tournament Created!');
        e.target.reset();
    }

    toggleTournamentStatus(id) {
        if (!this.adminSession.isAuthenticated) {
            this.showSuccessModal('You must be logged in as admin to change status.', 'Access Denied');
            return;
        }
        const t = this.tournaments.find(x => x.id === id);
        if (t) {
            t.status = t.status === 'active' ? 'inactive' : 'active';
            this.saveToStorage('tournaments', this.tournaments);
            this.loadTournaments();
            this.populateTournamentSelects();
        }
    }

    deleteTournament(id) {
        if (!this.adminSession.isAuthenticated) {
            this.showSuccessModal('You must be logged in as admin to delete tournaments.', 'Access Denied');
            return;
        }
        if (!confirm('Are you sure you want to delete this tournament? This action cannot be undone.')) return;
        this.tournaments = this.tournaments.filter(t => t.id !== id);
        this.registrations = this.registrations.filter(r => r.tournamentId !== id);
        this.saveToStorage('tournaments', this.tournaments);
        this.saveToStorage('registrations', this.registrations);
        this.loadTournaments();
        this.loadRegistrations();
        this.populateTournamentSelects();
    }

    // Registrations table
    loadRegistrations() {
        const table = document.getElementById('registrationsTable');
        if (table) this.renderRegistrations(table);
    }

    renderRegistrations(container) {
        if (this.registrations.length === 0) {
            container.innerHTML = '<p class="text-center">No registrations found.</p>';
            return;
        }
        container.innerHTML = `
            <div class="registrations-table">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name/Team</th>
                            <th>Contact</th>
                            <th>Tournament</th>
                            <th>Registration Date</th>
                            <th>Ref ID</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.registrations.map(reg => {
                            const t = this.tournaments.find(x => x.id === reg.tournamentId);
                            return `
                                <tr>
                                    <td>${reg.teamName}</td>
                                    <td>${reg.teamEmail}</td>
                                    <td>${t ? t.name : 'Unknown'}</td>
                                    <td>${this.formatDateTime(reg.registrationDate)}</td>
                                    <td>${(reg.payment && reg.payment.ref) ? reg.payment.ref : '-'}</td>
                                    <td>
                                        <button onclick="tournamentManager.deleteRegistration(${reg.id})" class="btn btn-primary" style="padding:5px 10px; font-size:.8rem; background:#f44336;">Delete</button>
                                    </td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    viewRegistration(id) {
        const reg = this.registrations.find(r => r.id === id);
        if (!reg) return;
        let details = `
            <h3>Team Registration Details</h3>
            <p><strong>Team Name:</strong> ${reg.teamName}</p>
            <p><strong>Captain:</strong> ${reg.teamCaptain} (${reg.captainRole || 'No role specified'})</p>
            <p><strong>Captain BGMI ID:</strong> ${reg.teamCaptainId}</p>
            <p><strong>Email:</strong> ${reg.teamEmail}</p>
            <p><strong>Phone:</strong> ${reg.teamPhone}</p>
            <p><strong>Members:</strong></p>
            <ul>${(reg.members||[]).map(m => `<li>${m.name} (${m.id}) - ${m.role || 'No role specified'}</li>`).join('')}</ul>`;
        if (reg.substitutes && reg.substitutes.length) {
            details += `
            <p><strong>Substitute Players:</strong></p>
            <ul>${reg.substitutes.map(s => `<li>${s.name} (${s.id}) - ${s.role || 'No role specified'}</li>`).join('')}</ul>`;
        }
        const t = this.tournaments.find(x => x.id === reg.tournamentId);
        details += `<p><strong>Tournament:</strong> ${t ? t.name : 'Unknown'}</p>`;
        details += `<p><strong>Registration Date:</strong> ${this.formatDateTime(reg.registrationDate)}</p>`;
        alert(details);
    }

    deleteRegistration(id) {
        if (!this.adminSession.isAuthenticated) {
            this.showSuccessModal('You must be logged in as admin to delete registrations.', 'Access Denied');
            return;
        }
        if (!confirm('Are you sure you want to delete this registration?')) return;
        this.registrations = this.registrations.filter(r => r.id !== id);
        this.saveToStorage('registrations', this.registrations);
        this.loadRegistrations();
    }

    // Payment flow
    openPaymentModal(reg) {
        const t = this.tournaments.find(x => x.id === reg.tournamentId);
        const fee = t ? t.entryFee : 0;
        const details = document.getElementById('paymentDetails');
        if (details) details.textContent = `Entry fee: ₹${fee}. Scan the QR or use UPI to pay, then enter the reference ID below.`;
        // Use static QR/UPI
        const info = this.staticPayment;
        const qr = document.getElementById('paymentQr');
        const upiText = document.getElementById('upiText');
        if (qr) {
            if (info.qrUrl) { qr.src = info.qrUrl; qr.style.display = 'inline-block'; }
            else { qr.style.display = 'none'; }
        }
        if (upiText) {
            if (info.upiId) { upiText.textContent = `UPI ID: ${info.upiId}`; upiText.style.display = 'block'; }
            else { upiText.style.display = 'none'; }
        }
        const modal = document.getElementById('paymentModal');
        if (modal) modal.style.display = 'block';

        const close = document.getElementById('paymentClose');
        if (close) close.onclick = () => { modal.style.display = 'none'; };

        const confirmBtn = document.getElementById('confirmPaymentBtn');
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                const method = (document.getElementById('paymentMethod')?.value || 'upi');
                const ref = (document.getElementById('paymentRef')?.value || '').trim();
                if (!ref) { this.showSuccessModal('Please enter a valid payment reference/transaction ID.', 'Payment Required', false); return; }
                this.pendingRegistration.payment = { status: 'paid', method, ref };
                this.registrations.push(this.pendingRegistration);
                this.saveToStorage('registrations', this.registrations);
                this.loadRegistrations();
                modal.style.display = 'none';
                this.showSuccessModal('Payment confirmed. Registration completed!', 'Payment Successful', true);
                this.pendingRegistration = null;
                (document.getElementById('teamRegistrationForm')?.reset?.());
            };
        }
    }

    filterRegistrations() {
        const term = (document.getElementById('searchRegistrations')?.value || '').toLowerCase();
        const container = document.getElementById('registrationsTable');
        let data = this.registrations;
        if (term) {
            data = data.filter(r => (r.teamName || '').toLowerCase().includes(term) || (r.teamEmail || '').toLowerCase().includes(term));
        }
        if (!container) return;
        if (data.length === 0) { container.innerHTML = '<p class="text-center">No registrations found matching your criteria.</p>'; return; }
        container.innerHTML = `
            <div class="registrations-table">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name/Team</th>
                            <th>Contact</th>
                            <th>Tournament</th>
                            <th>Registration Date</th>
                            <th>Ref ID</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(reg => {
                            const t = this.tournaments.find(x => x.id === reg.tournamentId);
                            return `
                                <tr>
                                    <td>${reg.teamName}</td>
                                    <td>${reg.teamEmail}</td>
                                    <td>${t ? t.name : 'Unknown'}</td>
                                    <td>${this.formatDateTime(reg.registrationDate)}</td>
                                    <td>${(reg.payment && reg.payment.ref) ? reg.payment.ref : '-'}</td>
                                    <td>
                                        <button onclick="tournamentManager.deleteRegistration(${reg.id})" class="btn btn-primary" style="padding:5px 10px; font-size:.8rem; background:#f44336;">Delete</button>
                                    </td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    // Utilities
    showSuccessModal(message, title = 'Success', isSuccess = true) {
        const titleEl = document.getElementById('successTitle');
        if (titleEl) titleEl.textContent = title;
        const msgEl = document.getElementById('successMessage');
        if (msgEl) msgEl.textContent = message;
        const modal = document.getElementById('successModal');
        const icon = document.getElementById('modalIcon');
        if (icon) icon.className = isSuccess ? 'fas fa-check-circle success-icon' : 'fas fa-times-circle success-icon error-icon';
        if (modal) modal.style.display = 'block';
    }

    updateAuthUI() {
        const authBtn = document.getElementById('authBtn');
        if (!authBtn) return;
        authBtn.textContent = this.adminSession.isAuthenticated ? 'Logout' : 'Login';
    }

    verifyAdmin(username, password) {
        const stored = this.loadFromStorage('adminCreds') || this.defaultAdmin;
        return username === stored.username && this.simpleHash(password) === stored.passwordHash;
    }

    simpleHash(input) {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString();
    }

    // Require admin auth for protected actions
    guard(action) {
        if (!this.adminSession || !this.adminSession.isAuthenticated) {
            this.showSuccessModal('You must be logged in as admin to perform this action.', 'Access Denied');
            return;
        }
        try { action(); } catch (e) { console.error(e); }
    }

    // Google Sheets sync removed; using CSV download instead

    // CSV download (teams only) with your column order
    downloadCsv() {
        const header = [
            'Team Name','IGL','IGL Player ID','Email ID','Phone','Tournament Name',
            'Player 2','Player 2 ID','Player 3','Player 3 ID','Player 4','Player 4 ID',
            'Player 5','Player 5 ID','Player 6','Player 6 ID','Team Position'
        ];
        const tMap = {};
        this.tournaments.forEach(t => { tMap[t.id] = t.name; });
        const rows = this.registrations
            .filter(r => r.type === 'team')
            .map(r => {
                const m = r.members || []; const s = r.substitutes || [];
                const m2 = m[0] || {}; const m3 = m[1] || {}; const m4 = m[2] || {};
                const s1 = s[0] || {}; const s2 = s[1] || {};
                return [
                    r.teamName || '',
                    r.teamCaptain || '',
                    r.teamCaptainId || '',
                    r.teamEmail || '',
                    r.teamPhone || '',
                    tMap[r.tournamentId] || '',
                    m2.name || '', m2.id || '',
                    m3.name || '', m3.id || '',
                    m4.name || '', m4.id || '',
                    s1.name || '', s1.id || '',
                    s2.name || '', s2.id || '',
                    ''
                ];
            });
        const csv = [header, ...rows]
            .map(row => row.map(v => {
                const val = (v ?? '').toString().replace(/"/g,'""');
                return `"${val}"`;
            }).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const stamp = now.toISOString().slice(0,19).replace(/[:T]/g,'-');
        a.download = `bgmi_teams_${stamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    closeModal() {
        const modal = document.getElementById('successModal');
        if (modal) modal.style.display = 'none';
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    loadFromStorage(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }
}

// Initialize
let tournamentManager;
document.addEventListener('DOMContentLoaded', () => {
    tournamentManager = new TournamentManager();
});

// Minor UX animations
const style = document.createElement('style');
style.textContent = `
    .tournament-card { transition: all 0.3s ease; }
    .tournament-card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
    .btn { transition: all 0.3s ease; }
    .btn:hover { transform: translateY(-2px); }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { transform: scale(1.02); }
    @keyframes fadeIn { from { opacity:0; transform: translateY(20px);} to { opacity:1; transform: translateY(0);} }
    .tab-content.active { animation: fadeIn 0.3s ease; }
`;
document.head.appendChild(style);
