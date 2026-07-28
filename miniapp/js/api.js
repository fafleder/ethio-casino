/**
 * API Client for Ethio Casino Mini App
 * Handles communication with the backend bot
 */

class CasinoAPI {
    constructor() {
        this.baseUrl = '';
        this.initData = '';
        this.user = null;
        this.isReady = false;
    }

    init() {
        return new Promise((resolve) => {
            if (window.Telegram?.WebApp) {
                this.webApp = window.Telegram.WebApp;
                this.webApp.ready();
                this.webApp.expand();
                
                // Get init data for authentication
                this.initData = this.webApp.initData || '';
                this.user = this.webApp.initDataUnsafe?.user || null;
                
                // Apply theme
                this.applyTheme();
                
                // Main button for game actions
                this.webApp.MainButton.setParams({
                    color: '#ffd700',
                    text_color: '#0d0d1a',
                    is_visible: false
                });
                
                this.isReady = true;
                console.log('✅ Telegram WebApp initialized', { user: this.user });
                resolve(true);
            } else {
                // Development mode - mock user
                console.warn('⚠️ Telegram WebApp not available - using mock data');
                this.mockInitData();
                this.isReady = true;
                resolve(true);
            }
        });
    }

    mockInitData() {
        this.user = {
            id: 361695664,
            first_name: 'Faisel',
            last_name: '',
            username: 'faisel_test',
            language_code: 'en',
            is_premium: true
        };
        this.initData = 'mock_init_data';
        
        // Mock theme
        document.documentElement.style.setProperty('--tg-theme-bg-color', '#0d0d1a');
        document.documentElement.style.setProperty('--tg-theme-text-color', '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-hint-color', '#a0a0b8');
        document.documentElement.style.setProperty('--tg-theme-link-color', '#ffd700');
        document.documentElement.style.setProperty('--tg-theme-button-color', '#ffd700');
        document.documentElement.style.setProperty('--tg-theme-button-text-color', '#0d0d1a');
    }

    applyTheme() {
        if (!this.webApp) return;
        
        const theme = this.webApp.themeParams || {};
        const root = document.documentElement;
        
        if (theme.bg_color) root.style.setProperty('--bg-primary', theme.bg_color);
        if (theme.text_color) root.style.setProperty('--text-primary', theme.text_color);
        if (theme.hint_color) root.style.setProperty('--text-secondary', theme.hint_color);
        if (theme.link_color) root.style.setProperty('--accent-blue', theme.link_color);
        if (theme.button_color) root.style.setProperty('--accent-gold', theme.button_color);
        if (theme.button_text_color) root.style.setProperty('--bg-primary', theme.button_text_color);
        
        // Apply Telegram's background
        document.body.style.backgroundColor = theme.bg_color || '#0d0d1a';
    }

    // Send data back to bot
    sendData(data) {
        if (this.webApp) {
            this.webApp.sendData(JSON.stringify(data));
        } else {
            console.log('📤 Mock sendData:', data);
        }
    }

    // Close the Mini App
    close() {
        if (this.webApp) {
            this.webApp.close();
        }
    }

    // Show main button
    showMainButton(text, onClick, color = '#ffd700') {
        if (this.webApp) {
            this.webApp.MainButton.setParams({
                text,
                color,
                text_color: '#0d0d1a',
                is_visible: true
            });
            this.webApp.MainButton.onClick(onClick);
            this.webApp.MainButton.show();
        }
    }

    hideMainButton() {
        if (this.webApp) {
            this.webApp.MainButton.hide();
            this.webApp.MainButton.offClick();
        }
    }

    // Haptic feedback
    hapticFeedback(type = 'light') {
        if (this.webApp?.HapticFeedback) {
            this.webApp.HapticFeedback.impactOccurred(type);
        }
    }

    notificationFeedback(type = 'success') {
        if (this.webApp?.HapticFeedback) {
            this.webApp.HapticFeedback.notificationOccurred(type);
        }
    }

    // Back button handling
    onBackButtonClick(callback) {
        if (this.webApp) {
            this.webApp.BackButton.show();
            this.webApp.BackButton.onClick(callback);
        }
    }

    offBackButtonClick(callback) {
        if (this.webApp) {
            this.webApp.BackButton.hide();
            this.webApp.BackButton.offClick(callback);
        }
    }

    // API calls to backend
    async apiRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': this.initData,
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // Game actions
    async getGames() {
        return this.apiRequest('/api/games');
    }

    async getBalance() {
        return this.apiRequest('/api/user/balance');
    }

    async placeBet(gameId, betAmount, gameData, clientSeed) {
        return this.apiRequest('/api/game/play', {
            method: 'POST',
            body: JSON.stringify({
                game_id: gameId,
                bet_amount: betAmount,
                client_seed: clientSeed,
                game_data: gameData
            })
        });
    }

    async getHistory(limit = 50, offset = 0, filters = {}) {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            ...filters
        });
        return this.apiRequest(`/api/user/history?${params}`);
    }

    async getStats() {
        return this.apiRequest('/api/user/stats');
    }

    async getLeaderboard(limit = 10) {
        return this.apiRequest(`/api/leaderboard?limit=${limit}`);
    }

    async claimDailyBonus() {
        return this.apiRequest('/api/bonus/daily', { method: 'POST' });
    }

    async verifyGame(serverSeed, clientSeed, nonce) {
        return this.apiRequest('/api/game/verify', {
            method: 'POST',
            body: JSON.stringify({ server_seed: serverSeed, client_seed: clientSeed, nonce })
        });
    }

    // Client seed generation
    generateClientSeed() {
        const array = new Uint32Array(4);
        crypto.getRandomValues(array);
        return Array.from(array, n => n.toString(16).padStart(8, '0')).join('');
    }

    // Format currency
    formatCurrency(amount, currency = 'ETB') {
        return (amount / 100).toFixed(2);
    }

    // Format number with commas
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}

// Export singleton
window.CasinoAPI = new CasinoAPI();
export default window.CasinoAPI;