/**
 * Casino Game Logic
 * Implements client-side game mechanics with provably fair verification
 */

class ProvablyFairClient {
    constructor() {
        this.serverSeedHash = null;
        this.clientSeed = null;
        this.nonce = 0;
    }

    setServerSeedHash(hash) {
        this.serverSeedHash = hash;
    }

    setClientSeed(seed) {
        this.clientSeed = seed;
    }

    setNonce(nonce) {
        this.nonce = nonce;
    }

    // Generate HMAC-SHA256
    async hmacSha256(key, message) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(key);
        const messageData = encoder.encode(message);
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Generate result from seeds
    async generateResult(serverSeed, clientSeed, nonce) {
        const hmac = await this.hmacSha256(serverSeed, `${clientSeed}:${nonce}`);
        // Use first 6 hex chars (24 bits) for result 0-16777215, normalize to 0-999999
        const hexResult = hmac.substring(0, 6);
        const intResult = parseInt(hexResult, 16);
        return intResult % 1000000;
    }

    // Verify a game result
    async verifyResult(serverSeed, clientSeed, nonce, expectedResult) {
        const result = await this.generateResult(serverSeed, clientSeed, nonce);
        return result === expectedResult;
    }
}

// Game implementations
class DiceGame {
    constructor(pfClient) {
        this.pfClient = pfClient;
        this.target = 50; // 0-99.99
        this.condition = 'under'; // 'under' or 'over'
    }

    setTarget(target) {
        this.target = Math.max(0.01, Math.min(99.99, target));
    }

    setCondition(condition) {
        this.condition = condition;
    }

    // Calculate roll from 0-999999 result
    calculateRoll(result) {
        return result / 10000; // 0.00-99.99
    }

    // Check if win
    isWin(roll) {
        if (this.condition === 'under') {
            return roll < this.target;
        } else {
            return roll > this.target;
        }
    }

    // Calculate multiplier with 1% house edge
    calculateMultiplier() {
        if (this.condition === 'under') {
            const winProb = this.target / 100;
            return (0.99 / winProb);
        } else {
            const winProb = (100 - this.target) / 100;
            return (0.99 / winProb);
        }
    }

    // Play game
    async play(serverSeed, clientSeed, nonce) {
        const result = await this.pfClient.generateResult(serverSeed, clientSeed, nonce);
        const roll = this.calculateRoll(result);
        const win = this.isWin(roll);
        const multiplier = this.calculateMultiplier();
        
        return {
            result: result,
            roll: roll,
            target: this.target,
            condition: this.condition,
            win: win,
            multiplier: win ? multiplier : 0,
            payout: win ? multiplier : 0
        };
    }
}

class CoinFlipGame {
    constructor(pfClient) {
        this.pfClient = pfClient;
        this.choice = 'heads'; // 'heads' or 'tails'
    }

    setChoice(choice) {
        this.choice = choice;
    }

    async play(serverSeed, clientSeed, nonce) {
        const result = await this.pfClient.generateResult(serverSeed, clientSeed, nonce);
        const flipResult = result % 2 === 0 ? 'heads' : 'tails';
        const win = flipResult === this.choice;
        const multiplier = 1.98; // 2% house edge
        
        return {
            result: result,
            flip: flipResult,
            choice: this.choice,
            win: win,
            multiplier: win ? multiplier : 0,
            payout: win ? multiplier : 0
        };
    }
}

class SlotsGame {
    constructor(pfClient) {
        this.pfClient = pfClient;
        this.symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '7️⃣'];
        this.reels = 3;
    }

    async play(serverSeed, clientSeed, nonce) {
        const result = await this.pfClient.generateResult(serverSeed, clientSeed, nonce);
        const hmac = await this.pfClient.hmacSha256(serverSeed, `${clientSeed}:${nonce}`);
        
        const reels = [];
        for (let i = 0; i < this.reels; i++) {
            const reelResult = parseInt(hmac.substring(i * 4, i * 4 + 4), 16) % this.symbols.length;
            reels.push(reelResult);
        }

        // Count matches
        const counts = {};
        reels.forEach(r => counts[r] = (counts[r] || 0) + 1);
        
        let maxMatch = 0;
        let winningSymbol = -1;
        Object.entries(counts).forEach(([symbol, count]) => {
            if (count > maxMatch) {
                maxMatch = count;
                winningSymbol = parseInt(symbol);
            }
        });

        let multiplier = 0;
        if (maxMatch === 3) {
            multiplier = winningSymbol === this.symbols.length - 1 ? 100 : 10; // Jackpot for last symbol
        } else if (maxMatch === 2) {
            multiplier = 2;
        }

        return {
            result: result,
            reels: reels.map(r => this.symbols[r]),
            winningSymbol: winningSymbol >= 0 ? this.symbols[winningSymbol] : null,
            matchCount: maxMatch,
            win: multiplier > 0,
            multiplier: multiplier,
            payout: multiplier
        };
    }
}

class CrashGame {
    constructor(pfClient) {
        this.pfClient = pfClient;
        this.crashRate = 0.03;
        this.maxMultiplier = 1000;
    }

    async play(serverSeed, clientSeed, nonce) {
        const result = await this.pfClient.generateResult(serverSeed, clientSeed, nonce);
        const uniform = result / 1000000;
        const crashPoint = Math.floor(-Math.log(1 - uniform) / this.crashRate * 100) / 100;
        const cappedCrashPoint = Math.min(crashPoint, this.maxMultiplier);
        
        return {
            result: result,
            crashPoint: cappedCrashPoint,
            // Win is determined by when player cashes out
            win: false,
            multiplier: cappedCrashPoint,
            payout: 0
        };
    }

    // Calculate payout if cashed out at multiplier
    calculatePayout(cashoutMultiplier, crashPoint) {
        if (cashoutMultiplier <= crashPoint) {
            return cashoutMultiplier;
        }
        return 0;
    }
}

class PlinkoGame {
    constructor(pfClient) {
        this.pfClient = pfClient;
        this.rows = 16;
        this.risk = 'medium'; // 'low', 'medium', 'high'
    }

    setRows(rows) {
        this.rows = Math.max(8, Math.min(16, rows));
    }

    setRisk(risk) {
        this.risk = risk;
    }

    async play(serverSeed, clientSeed, nonce) {
        const result = await this.pfClient.generateResult(serverSeed, clientSeed, nonce);
        const hmac = await this.pfClient.hmacSha256(serverSeed, `${clientSeed}:${nonce}`);
        
        let position = 0;
        for (let i = 0; i < this.rows; i++) {
            const bit = parseInt(hmac.substring(i * 2, i * 2 + 2), 16) % 2;
            position += bit;
        }

        const multipliers = {
            low: [2, 1.5, 1.2, 1.1, 1, 1, 1.1, 1.2, 1.5, 2, 1.5, 1.2, 1.1, 1, 1, 1.1, 1.2, 1.5, 2],
            medium: [10, 5, 3, 2, 1.5, 1.2, 1.1, 1, 1, 1.1, 1.2, 1.5, 2, 3, 5, 10],
            high: [100, 50, 20, 10, 5, 3, 2, 1.5, 1, 1, 1.5, 2, 3, 5, 10, 20, 50, 100]
        };

        const multiplier = multipliers[this.risk][position] || 1;
        
        return {
            result: result,
            position: position,
            path: position,
            rows: this.rows,
            risk: this.risk,
            win: multiplier > 1,
            multiplier: multiplier,
            payout: multiplier > 1 ? multiplier : 0
        };
    }
}

class MinesGame {
    constructor(pfClient) {
        this.pfClient = pfClient;
        this.gridSize = 5;
        this.mineCount = 3;
    }

    setGridSize(size) {
        this.gridSize = Math.max(3, Math.min(10, size));
    }

    setMineCount(count) {
        this.mineCount = Math.max(1, Math.min(this.gridSize * this.gridSize - 1, count));
    }

    async play(serverSeed, clientSeed, nonce, clicks = []) {
        const result = await this.pfClient.generateResult(serverSeed, clientSeed, nonce);
        const totalCells = this.gridSize * this.gridSize;
        const hmac = await this.pfClient.hmacSha256(serverSeed, `${clientSeed}:${nonce}`);
        
        // Generate mine positions
        const mines = new Set();
        let hash = hmac;
        while (mines.size < this.mineCount) {
            const pos = parseInt(hash.substring(0, 4), 16) % totalCells;
            mines.add(pos);
            hash = await this.pfClient.hmacSha256(hash, 'next');
        }

        // Check clicks
        let hitMine = false;
        let gemsFound = 0;
        for (const click of clicks) {
            if (mines.has(click)) {
                hitMine = true;
                break;
            }
            gemsFound++;
        }

        const multiplier = hitMine ? 0 : Math.pow(1 + this.mineCount / (totalCells - this.mineCount), gemsFound);
        
        return {
            result: result,
            mines: Array.from(mines),
            clicks: clicks,
            gemsFound: gemsFound,
            hitMine: hitMine,
            gridSize: this.gridSize,
            mineCount: this.mineCount,
            win: !hitMine && clicks.length > 0,
            multiplier: multiplier,
            payout: hitMine ? 0 : multiplier
        };
    }
}

// Game factory
class GameFactory {
    static createGame(gameId, pfClient) {
        switch (gameId) {
            case 'dice':
                return new DiceGame(pfClient);
            case 'coinflip':
                return new CoinFlipGame(pfClient);
            case 'slots':
                return new SlotsGame(pfClient);
            case 'crash':
                return new CrashGame(pfClient);
            case 'plinko':
                return new PlinkoGame(pfClient);
            case 'mines':
                return new MinesGame(pfClient);
            default:
                throw new Error(`Unknown game: ${gameId}`);
        }
    }

    static getGameInfo(gameId) {
        const games = {
            dice: {
                id: 'dice',
                name: 'Dice',
                icon: '🎲',
                description: 'Roll under or over a target number',
                minBet: 100,
                maxBet: 1000000,
                rtp: 99,
                category: 'classic'
            },
            coinflip: {
                id: 'coinflip',
                name: 'Coin Flip',
                icon: '🪙',
                description: 'Simple 50/50 coin toss',
                minBet: 100,
                maxBet: 500000,
                rtp: 98,
                category: 'classic'
            },
            slots: {
                id: 'slots',
                name: 'Slots',
                icon: '🎰',
                description: 'Classic 3-reel slot machine',
                minBet: 100,
                maxBet: 200000,
                rtp: 95,
                category: 'slots'
            },
            crash: {
                id: 'crash',
                name: 'Crash',
                icon: '📈',
                description: 'Cash out before the multiplier crashes!',
                minBet: 100,
                maxBet: 500000,
                rtp: 97,
                category: 'instant'
            },
            plinko: {
                id: 'plinko',
                name: 'Plinko',
                icon: '🎯',
                description: 'Drop the ball through pegs to win',
                minBet: 100,
                maxBet: 500000,
                rtp: 96,
                category: 'arcade'
            },
            mines: {
                id: 'mines',
                name: 'Mines',
                icon: '💣',
                description: 'Find gems, avoid mines!',
                minBet: 100,
                maxBet: 500000,
                rtp: 97,
                category: 'strategy'
            }
        };
        return games[gameId] || null;
    }

    static getAllGames() {
        return ['dice', 'coinflip', 'slots', 'crash', 'plinko', 'mines'].map(id => this.getGameInfo(id));
    }
}

// Export for use in other modules
window.ProvablyFairClient = ProvablyFairClient;
window.DiceGame = DiceGame;
window.CoinFlipGame = CoinFlipGame;
window.SlotsGame = SlotsGame;
window.CrashGame = CrashGame;
window.PlinkoGame = PlinkoGame;
window.MinesGame = MinesGame;
window.GameFactory = GameFactory;