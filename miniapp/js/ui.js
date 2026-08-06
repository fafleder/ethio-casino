/**
 * UI Manager for Ethio Casino Mini App
 * Handles DOM updates, modals, toasts, navigation
 */

class UIManager {
    constructor() {
        this.currentTab = 'games';
        this.loadingScreen = document.getElementById('loading-screen');
        this.app = document.getElementById('app');
        this.toastContainer = document.getElementById('toast-container');
        
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        // Navigation tabs
        this.navTabs = document.querySelectorAll('.nav-tab');
        this.tabPanels = document.querySelectorAll('.tab-panel');
        this.bottomNavItems = document.querySelectorAll('.bottom-nav-item');
        
        // Modals
        this.gameModal = document.getElementById('game-modal');
        this.betModal = document.getElementById('bet-modal');
        this.fairModal = document.getElementById('fair-modal');
        
        // Buttons
        this.settingsBtn = document.getElementById('settings-btn');
        this.menuBtn = document.getElementById('menu-btn');
        this.claimDailyBtn = document.getElementById('claim-daily');
        this.copyRefBtn = document.getElementById('copy-ref');
        this.provablyFairBtn = document.getElementById('provably-fair-btn');
        this.supportBtn = document.getElementById('support-btn');
        this.faqBtn = document.getElementById('faq-btn');
        
        // Balance
        this.balanceEl = document.getElementById('balance');
        this.betBalanceEl = document.getElementById('bet-balance');
        
        // Game grid
        this.gamesGrid = document.getElementById('games-grid');
    }

    bindEvents() {
        // Tab navigation
        this.navTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
        
        this.bottomNavItems.forEach(item => {
            item.addEventListener('click', () => this.switchTab(item.dataset.tab));
        });
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });
        
        // Modal overlays
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => this.closeAllModals());
        });
        
        // Buttons
        this.claimDailyBtn?.addEventListener('click', () => this.handleClaimDaily());
        this.copyRefBtn?.addEventListener('click', () => this.handleCopyRef());
        this.provablyFairBtn?.addEventListener('click', () => this.openFairModal());
        this.supportBtn?.addEventListener('click', () => this.openSupport());
        this.faqBtn?.addEventListener('click', () => this.openFAQ());
        
        // Bet modal
        document.getElementById('bet-cancel')?.addEventListener('click', () => this.closeAllModals());
        document.getElementById('bet-confirm')?.addEventListener('click', () => this.handleBetConfirm());
        
        // Fair modal
        document.getElementById('verify-btn')?.addEventListener('click', () => this.handleVerify());
    }

    showLoading(show) {
        if (this.loadingScreen) {
            this.loadingScreen.classList.toggle('hidden', !show);
        }
        if (this.app) {
            this.app.classList.toggle('hidden', show);
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update nav tabs
        this.navTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
            tab.setAttribute('aria-selected', tab.dataset.tab === tabName);
        });
        
        // Update bottom nav
        this.bottomNavItems.forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabName);
        });
        
        // Update tab panels
        this.tabPanels.forEach(panel => {
            const isActive = panel.id === `tab-${tabName}`;
            panel.classList.toggle('active', isActive);
            panel.hidden = !isActive;
        });
    }

    updateBalance(balance) {
        const formatted = (balance / 100).toFixed(2);
        if (this.balanceEl) this.balanceEl.textContent = formatted;
        if (this.betBalanceEl) this.betBalanceEl.textContent = formatted;
    }

    openGameModal(gameId) {
        const gameInfo = window.GameFactory?.getGameInfo(gameId);
        if (!gameInfo) return;
        
        document.getElementById('game-modal-title').textContent = `${gameInfo.icon} ${gameInfo.name}`;
        document.getElementById('game-modal-body').innerHTML = this.renderGameUI(gameId, gameInfo);
        this.gameModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    renderGameUI(gameId, gameInfo) {
        return `
            <div class="game-ui">
                <p class="game-description">${gameInfo.description}</p>
                <div class="game-controls">
                    ${this.renderGameControls(gameId)}
                </div>
                <div class="game-actions">
                    <button class="btn primary" onclick="ui.openBetModal('${gameId}')">Play</button>
                </div>
            </div>
        `;
    }

    renderGameControls(gameId) {
        switch (gameId) {
            case 'dice':
                return `
                    <div class="control-group">
                        <label>Target: <span id="dice-target">50.00</span></label>
                        <input type="range" id="dice-slider" min="1" max="98" value="50" step="0.01">
                    </div>
                    <div class="control-group">
                        <label>Condition:</label>
                        <select id="dice-condition">
                            <option value="under">Under</option>
                            <option value="over">Over</option>
                        </select>
                    </div>
                    <div class="multiplier-display">Multiplier: <span id="dice-multiplier">2.00</span>x</div>
                `;
            case 'coinflip':
                return `
                    <div class="control-group">
                        <label>Choose:</label>
                        <select id="coinflip-choice">
                            <option value="heads">Heads</option>
                            <option value="tails">Tails</option>
                        </select>
                    </div>
                    <div class="multiplier-display">Multiplier: 1.98x</div>
                `;
            case 'slots':
                return `<div class="multiplier-display">Match 3 for up to 100x!</div>`;
            case 'crash':
                return `<div class="multiplier-display">Cash out before it crashes! Max: 1000x</div>`;
            case 'plinko':
                return `
                    <div class="control-group">
                        <label>Rows: <span id="plinko-rows">16</span></label>
                        <input type="range" id="plinko-rows-slider" min="8" max="16" value="16">
                    </div>
                    <div class="control-group">
                        <label>Risk:</label>
                        <select id="plinko-risk">
                            <option value="low">Low</option>
                            <option value="medium" selected>Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                `;
            case 'mines':
                return `
                    <div class="control-group">
                        <label>Grid: <span id="mines-grid">5x5</span></label>
                        <input type="range" id="mines-grid-slider" min="3" max="10" value="5">
                    </div>
                    <div class="control-group">
                        <label>Mines: <span id="mines-count">3</span></label>
                        <input type="range" id="mines-count-slider" min="1" max="24" value="3">
                    </div>
                `;
            default:
                return '';
        }
    }

    openBetModal(gameId) {
        this.closeAllModals();
        const gameInfo = window.GameFactory?.getGameInfo(gameId);
        if (!gameInfo) return;
        
        document.getElementById('bet-modal-title').textContent = `Bet on ${gameInfo.name}`;
        document.getElementById('bet-amount').value = '';
        document.getElementById('bet-amount').min = gameInfo.minBet;
        document.getElementById('bet-amount').max = gameInfo.maxBet;
        document.getElementById('bet-amount').placeholder = gameInfo.minBet;
        
        // Quick bets
        const quickBets = document.getElementById('quick-bets');
        const amounts = [gameInfo.minBet, gameInfo.minBet * 5, gameInfo.minBet * 10, gameInfo.minBet * 50];
        quickBets.innerHTML = amounts
            .filter(a => a <= gameInfo.maxBet)
            .map(a => `<button class="quick-bet" data-amount="${a}">${(a/100).toFixed(2)} ETB</button>`)
            .join('');
        
        quickBets.querySelectorAll('.quick-bet').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('bet-amount').value = btn.dataset.amount;
            });
        });
        
        this.betModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Store current game
        this.betModal.dataset.gameId = gameId;
    }

    closeAllModals() {
        this.gameModal?.classList.add('hidden');
        this.betModal?.classList.add('hidden');
        this.fairModal?.classList.add('hidden');
        document.body.style.overflow = '';
    }

    openFairModal() {
        this.closeAllModals();
        this.fairModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    async handleClaimDaily() {
        try {
            const res = await window.api.post('/api/bonus/daily');
            if (res.bonus) {
                this.showToast(`🎁 Daily bonus claimed! ${(res.bonus/100).toFixed(2)} ETB`, 'success');
                this.updateBalance(res.newBalance);
            }
        } catch (err) {
            this.showToast('Failed to claim bonus', 'error');
        }
    }

    handleCopyRef() {
        const code = document.getElementById('ref-code').textContent;
        navigator.clipboard.writeText(`ETHIO-${code}`);
        this.showToast('Referral code copied!', 'success');
    }

    openSupport() {
        window.open('https://t.me/ethioautocasino', '_blank');
    }

    openFAQ() {
        this.showToast('FAQ coming soon!', 'info');
    }

    async handleBetConfirm() {
        const amount = parseInt(document.getElementById('bet-amount').value);
        const gameId = this.betModal.dataset.gameId;
        
        if (!amount || amount < 100) {
            this.showToast('Invalid bet amount', 'error');
            return;
        }
        
        try {
            // Get server seed hash
            const seedRes = await window.api.post('/api/game/seed');
            const clientSeed = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
            
            // Play game
            const res = await window.api.post('/api/game/play', {
                game_id: gameId,
                bet_amount: amount,
                client_seed: clientSeed,
                game_data: this.getGameData(gameId)
            });
            
            this.updateBalance(res.newBalance);
            this.showGameResult(res.result, res.session.payout > 0);
            this.closeAllModals();
        } catch (err) {
            this.showToast(err.message || 'Bet failed', 'error');
        }
    }

    getGameData(gameId) {
        const data = {};
        if (gameId === 'dice') {
            data.target = parseFloat(document.getElementById('dice-target')?.textContent) || 50;
            data.condition = document.getElementById('dice-condition')?.value || 'under';
        } else if (gameId === 'coinflip') {
            data.choice = document.getElementById('coinflip-choice')?.value || 'heads';
        } else if (gameId === 'plinko') {
            data.rows = parseInt(document.getElementById('plinko-rows')?.textContent) || 16;
            data.risk = document.getElementById('plinko-risk')?.value || 'medium';
        } else if (gameId === 'mines') {
            data.gridSize = parseInt(document.getElementById('mines-grid')?.textContent) || 5;
            data.mineCount = parseInt(document.getElementById('mines-count')?.textContent) || 3;
        }
        return data;
    }

    showGameResult(result, isWin) {
        const modal = document.createElement('div');
        modal.className = 'modal-result';
        modal.innerHTML = `
            <div class="result-overlay"></div>
            <div class="result-content ${isWin ? 'win' : 'lose'}">
                <div class="result-icon">${isWin ? '🎉' : '😢'}</div>
                <h2>${isWin ? 'YOU WON!' : 'BETTER LUCK NEXT TIME'}</h2>
                <p class="result-payout">${isWin ? '+' : ''}${(result.payout/100).toFixed(2)} ETB</p>
                <button class="btn primary" onclick="this.closest('.modal-result').remove()">OK</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async handleVerify() {
        const serverSeed = document.getElementById('verify-server-seed').value;
        const clientSeed = document.getElementById('verify-client-seed').value;
        const nonce = parseInt(document.getElementById('verify-nonce').value);
        
        if (!serverSeed || !clientSeed || isNaN(nonce)) {
            this.showToast('Fill all fields', 'error');
            return;
        }
        
        try {
            const res = await window.api.post('/api/game/verify', {
                server_seed: serverSeed,
                client_seed: clientSeed,
                nonce: nonce
            });
            
            const resultEl = document.getElementById('verification-result');
            const detailsEl = document.getElementById('result-details');
            resultEl.classList.remove('hidden');
            
            if (res.verified) {
                resultEl.querySelector('.result-status').innerHTML = '✅ <span class="success">VERIFIED</span> - Result matches';
                detailsEl.textContent = JSON.stringify(res.result, null, 2);
            } else {
                resultEl.querySelector('.result-status').innerHTML = '❌ <span class="error">FAILED</span> - Result mismatch';
            }
        } catch (err) {
            this.showToast('Verification failed', 'error');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    renderGamesGrid() {
        const games = window.GameFactory?.getAllGames() || [];
        this.gamesGrid.innerHTML = games.map(game => `
            <div class="game-card" onclick="ui.openGameModal('${game.id}')">
                <div class="game-icon">${game.icon}</div>
                <div class="game-name">${game.name}</div>
                <div class="game-desc">${game.description}</div>
                <div class="game-meta">
                    <span class="rtp">RTP: ${game.rtp}%</span>
                    <span class="min-bet">Min: ${(game.minBet/100).toFixed(2)} ETB</span>
                </div>
            </div>
        `).join('');
    }
}

// Initialize UI when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.ui = new UIManager();
    window.ui.renderGamesGrid();
});