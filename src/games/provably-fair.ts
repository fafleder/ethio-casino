import { createHash, createHmac, randomBytes } from 'crypto';

export interface ProvablyFairResult {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  result: number; // 0-999999 for dice, 0-1 for coinflip, etc.
  hash: string;
}

export interface GameResult {
  isWin: boolean;
  payout: number;
  multiplier: number;
  details: Record<string, any>;
  provablyFair: ProvablyFairResult;
}

export class ProvablyFairEngine {
  private serverSeed: string;
  private serverSeedHash: string;

  constructor(serverSeed?: string) {
    this.serverSeed = serverSeed || this.generateServerSeed();
    this.serverSeedHash = this.hashServerSeed(this.serverSeed);
  }

  private generateServerSeed(): string {
    return randomBytes(32).toString('hex');
  }

  private hashServerSeed(seed: string): string {
    return createHash('sha256').update(seed).digest('hex');
  }

  getServerSeedHash(): string {
    return this.serverSeedHash;
  }

  revealServerSeed(): string {
    return this.serverSeed;
  }

  generateResult(clientSeed: string, nonce: number): ProvablyFairResult {
    const hmac = createHmac('sha256', this.serverSeed)
      .update(`${clientSeed}:${nonce}`)
      .digest('hex');
    
    // Use first 6 hex chars (24 bits) for result 0-16777215, normalize to 0-999999
    const hexResult = hmac.substring(0, 6);
    const intResult = parseInt(hexResult, 16);
    const normalizedResult = intResult % 1000000;

    return {
      serverSeed: this.serverSeed,
      clientSeed,
      nonce,
      result: normalizedResult,
      hash: hmac,
    };
  }

  // Dice: roll under/over target (0-999999 -> 0.00-99.99%)
  diceRoll(clientSeed: string, nonce: number, target: number, condition: 'under' | 'over'): GameResult {
    const pf = this.generateResult(clientSeed, nonce);
    const roll = pf.result / 10000; // 0.00-99.99
    const isWin = condition === 'under' ? roll < target : roll > target;
    const multiplier = condition === 'under' 
      ? 9900 / (target * 100) * 0.99  // 1% house edge
      : 9900 / ((9999 - target) * 100) * 0.99;
    
    return {
      isWin,
      payout: isWin ? Math.floor(multiplier) : 0,
      multiplier: isWin ? multiplier : 0,
      details: { roll, target, condition },
      provablyFair: pf,
    };
  }

  // Coinflip: 0 = heads, 1 = tails
  coinFlip(clientSeed: string, nonce: number, choice: 'heads' | 'tails'): GameResult {
    const pf = this.generateResult(clientSeed, nonce);
    const result = pf.result % 2; // 0 or 1
    const isWin = (choice === 'heads' && result === 0) || (choice === 'tails' && result === 1);
    const multiplier = 1.98; // 2% house edge
    
    return {
      isWin,
      payout: isWin ? Math.floor(multiplier * 100) / 100 : 0,
      multiplier: isWin ? multiplier : 0,
      details: { result: result === 0 ? 'heads' : 'tails', choice },
      provablyFair: pf,
    };
  }

  // Slots: 3 reels with symbols
  slots(clientSeed: string, nonce: number, symbols: string[]): GameResult {
    const pf = this.generateResult(clientSeed, nonce);
    const reels = 3;
    const results: number[] = [];
    let hash = pf.hash;
    
    for (let i = 0; i < reels; i++) {
      const reelResult = parseInt(hash.substring(i * 4, i * 4 + 4), 16) % symbols.length;
      results.push(reelResult);
    }

    // Check for matches
    const symbolCounts = new Map<number, number>();
    results.forEach(r => symbolCounts.set(r, (symbolCounts.get(r) || 0) + 1));
    
    let maxMatch = 0;
    let winningSymbol = -1;
    symbolCounts.forEach((count, symbol) => {
      if (count > maxMatch) {
        maxMatch = count;
        winningSymbol = symbol;
      }
    });

    // Payouts: 3 of a kind = high, 2 of a kind = low
    let multiplier = 0;
    if (maxMatch === 3) {
      multiplier = winningSymbol === symbols.length - 1 ? 100 : 10; // Jackpot for last symbol
    } else if (maxMatch === 2) {
      multiplier = 2;
    }

    const isWin = multiplier > 0;
    
    return {
      isWin,
      payout: isWin ? multiplier : 0,
      multiplier,
      details: { reels: results.map(r => symbols[r]), winningSymbol: winningSymbol >= 0 ? symbols[winningSymbol] : null },
      provablyFair: pf,
    };
  }

  // Crash: multiplier increases until crash point
  crash(clientSeed: string, nonce: number, crashRate: number = 0.03): GameResult {
    const pf = this.generateResult(clientSeed, nonce);
    // Convert 0-999999 to crash point using exponential distribution
    const uniform = pf.result / 1000000;
    const crashPoint = Math.floor(-Math.log(1 - uniform) / crashRate * 100) / 100;
    const cappedCrashPoint = Math.min(crashPoint, 1000); // Max 1000x
    
    return {
      isWin: false, // Determined by when player cashes out
      payout: 0,
      multiplier: cappedCrashPoint,
      details: { crashPoint: cappedCrashPoint },
      provablyFair: pf,
    };
  }

  // Plinko: ball drops through pegs
  plinko(clientSeed: string, nonce: number, rows: number = 16, risk: 'low' | 'medium' | 'high' = 'medium'): GameResult {
    const pf = this.generateResult(clientSeed, nonce);
    let position = 0;
    let hash = pf.hash;
    
    for (let i = 0; i < rows; i++) {
      const bit = parseInt(hash.substring(i * 2, i * 2 + 2), 16) % 2;
      position += bit; // 0 = left, 1 = right
    }

    // Multipliers based on position and risk level
    const multipliers: Record<string, number[]> = {
      low: [2, 1.5, 1.2, 1.1, 1, 1, 1.1, 1.2, 1.5, 2, 1.5, 1.2, 1.1, 1, 1, 1.1, 1.2, 1.5, 2],
      medium: [10, 5, 3, 2, 1.5, 1.2, 1.1, 1, 1, 1.1, 1.2, 1.5, 2, 3, 5, 10],
      high: [100, 50, 20, 10, 5, 3, 2, 1.5, 1, 1, 1.5, 2, 3, 5, 10, 20, 50, 100],
    };

    const multiplier = multipliers[risk][position] || 1;
    const isWin = multiplier > 1;

    return {
      isWin,
      payout: isWin ? multiplier : 0,
      multiplier,
      details: { position, path: position, rows, risk },
      provablyFair: pf,
    };
  }

  // Mines: grid with hidden mines
  mines(clientSeed: string, nonce: number, gridSize: number = 5, mineCount: number = 3, clicks: number[] = []): GameResult {
    const pf = this.generateResult(clientSeed, nonce);
    const totalCells = gridSize * gridSize;
    let hash = pf.hash;
    
    // Generate mine positions
    const mines = new Set<number>();
    while (mines.size < mineCount) {
      const pos = parseInt(hash.substring(0, 4), 16) % totalCells;
      mines.add(pos);
      hash = createHash('sha256').update(hash).digest('hex');
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

    // Multiplier based on gems found and mine count
    const multiplier = hitMine ? 0 : Math.pow(1 + mineCount / (totalCells - mineCount), gemsFound);
    
    return {
      isWin: !hitMine && clicks.length > 0,
      payout: hitMine ? 0 : multiplier,
      multiplier: hitMine ? 0 : multiplier,
      details: { mines: Array.from(mines), clicks, gemsFound, hitMine, gridSize, mineCount },
      provablyFair: pf,
    };
  }

  verifyResult(serverSeed: string, clientSeed: string, nonce: number, expectedResult: number): boolean {
    const hmac = createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}`)
      .digest('hex');
    const hexResult = hmac.substring(0, 6);
    const intResult = parseInt(hexResult, 16);
    const normalizedResult = intResult % 1000000;
    return normalizedResult === expectedResult;
  }
}

export const provablyFairEngine = new ProvablyFairEngine();