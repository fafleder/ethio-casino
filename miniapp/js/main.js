/**
 * Main Entry Point for Ethio Casino Mini App
 * Initializes the app, handles Telegram Web App integration
 */

import './api.js';
import './games.js';
import './ui.js';

// Telegram Web App initialization
let tg = window.Telegram?.WebApp;

if (tg) {
    tg.expand();
    tg.ready();
    
    // Theme handling
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.backgroundColor || '#1a1a2e');
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.textColor || '#ffffff');
    
    // Main button (for native feel)
    if (tg.MainButton) {
        tg.MainButton.setText('Play');
        tg.MainButton.onClick(() => {
            window.ui?.switchTab('games');
        });
        tg.MainButton.show();
    }
    
    // Back button
    if (tg.BackButton) {
        tg.BackButton.onClick(() => {
            if (window.ui?.currentTab !== 'games') {
                window.ui?.switchTab('games');
            } else {
                tg.close();
            }
        });
        tg.BackButton.show();
    }
    
    // Haptic feedback
    window.haptic = (type = 'light') => {
        if (tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred(type);
        }
    };
} else {
    // Desktop/web fallback
    window.haptic = () => {};
    console.log('Running outside Telegram Web App');
}

// API base URL detection
const API_BASE = window.location.origin;

// API client (from api.js)
window.api = {
    async get(endpoint, headers = {}) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            credentials: 'omit'
        });
        return res.json();
    },
    
    async post(endpoint, data, headers = {}) {
        const initData = tg?.initData || '';
        
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData,
                ...headers
            },
            body: JSON.stringify(data),
            credentials: 'omit'
        });
        
        const result = await res.json();
        
        if (!res.ok) {
            throw new Error(result.error || 'Request failed');
        }
        
        return result;
    }
};

// App state
window.appState = {
    user: null,
    balance: 0,
    games: [],
    initialized: false
};

// Initialize app
async function initApp() {
    if (window.appState.initialized) return;
    
    try {
        // Check if we have Telegram user data
        if (tg?.initDataUnsafe?.user) {
            window.appState.user = tg.initDataUnsafe.user;
            console.log('User:', window.appState.user);
        }
        
        // Load games
        try {
            const gamesRes = await window.api.get('/api/games');
            window.appState.games = gamesRes.games || [];
            window.GameFactory?.getAllGames().forEach(game => {
                const apiGame = window.appState.games.find(g => g.id === game.id);
                if (apiGame) {
                    game.minBet = apiGame.min_bet;
                    game.maxBet = apiGame.max_bet;
                    game.rtp = Math.round((1 - apiGame.house_edge) * 100);
                }
            });
        } catch (err) {
            console.warn('Failed to load games from API, using defaults');
        }
        
        // Load balance
        if (tg?.initData) {
            try {
                const balanceRes = await window.api.get('/api/user/balance');
                window.appState.balance = balanceRes.balance || 0;
                window.ui?.updateBalance(window.appState.balance);
            } catch (err) {
                console.warn('Failed to load balance');
            }
        }
        
        // Update UI with game data
        window.ui?.renderGamesGrid();
        
        window.appState.initialized = true;
        console.log('App initialized');
        
    } catch (err) {
        console.error('App init error:', err);
    }
}

// Handle Web App data from bot
if (tg?.initData) {
    // Validate and parse initData
    console.log('Telegram initData available');
}

// Start app when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Handle visibility changes (Telegram minimizes/maximizes)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && tg?.initData) {
        // Refresh data when app becomes visible
        initApp();
    }
});

// Export for global access
window.initApp = initApp;