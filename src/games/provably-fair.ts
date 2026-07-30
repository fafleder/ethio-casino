import { createHash, randomBytes } from 'crypto';

export interface ProvablyFairResult {
  result: any;
  hash: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

export interface GameResult {
  isWin: boolean;
  payout: number;
  multiplier: number;
  details: any;
}

export class ProvablyFairEngine {
  private serverSeed: string;

  constructor(serverSeed?: string) {
    this.serverSeed = serverSeed || randomBytes(32).toString('hex');
  }

  getServerSeed(): string {
    return this.serverSeed;
  }

  getServerSeedHash(): string {
    return createHash('sha256').update(this.serverSeed).digest('hex');
  }

  private generateHash(serverSeed: string, clientSeed: string, nonce: number): string {
    const hmac = createHash('sha256');
    hmac.update(`${serverSeed}:${clientSeed}:${nonce}`);
    return hmac.digest('hex');
  }

  private hashToFloat(hash: string): number {
    // Convert first 8 chars of hash to float between 0 and 1
    const intVal = parseInt(hash.substring(0, 8), 16);
    return intVal / 0xffffffff;
  }

  generateResult(clientSeed: string, nonce: number): ProvablyFairResult {
    const hash = this.generateHash(this.serverSeed, clientSeed, nonce);
    const float = this.hashToFloat(hash);

    return {
      result: float,
      hash,
      serverSeed: this.serverSeed,
      clientSeed,
      nonce,
    };
  }

  // Dice: roll under/over target (0-9999)
  dice(clientSeed: string, nonce: number, target: number, condition: 'under' | 'over'): GameResult {
    const { result: float, hash } = this.generateResult(clientSeed, nonce);
    const roll = Math.floor(float * 10000);
    const isWin = condition === 'under' ? roll < target : roll > target;
    const multiplier = condition === 'under' 
      ? 9900 / target 
      : 9900 / (9999 - target);
    const houseEdge = 0.01;
    const payoutMultiplier = multiplier * (1 - houseEdge);

    return {
      isWin,
      payout: 0, // Set by caller based on bet amount
      multiplier: payoutMultiplier,
      details: { roll, target, condition, hash, float },
    };
  }

  // Coin Flip: 50/50
  coinflip(clientSeed: string, nonce: number, choice: 'heads' | 'tails'): GameResult {
    const { result: float, hash } = this.generateResult(clientSeed, nonce);
    const roll = float < 0.5 ? 'heads' : 'tails';
    const isWin = roll === choice;
    const multiplier = 1.98; // 2x with 1% house edge

    return {
      isWin,
      payout: 0,
      multiplier,
      details: { roll, choice, hash, float },
    };
  }

  // Slots: 3 reels
  slots(clientSeed: string, nonce: number): GameResult {
    const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '7️⃣'];
    const weights = [30, 25, 20, 15, 7, 3]; // Weighted probabilities
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    const reels: string[] = [];
    let hash = '';
    let float = 0;

    // Generate 3 independent results
    for (let i = 0; i < 3; i++) {
      const { result: f, hash: h } = this.generateResult(`${clientSeed}:${i}`, nonce + i);
      float = f;
      hash = h;
      const idx = Math.floor(f * totalWeight);
      let acc = 0;
      for (let j = 0; j < weights.length; j++) {
        acc += weights[j];
        if (idx < acc) {
          reels.push(symbols[j]);
          break;
        }
      }
    }

    // Check win: all 3 match
    const isWin = reels[0] === reels[1] && reels[1] === reels[2];
    const symbolIndex = symbols.indexOf(reels[0]);
    const multipliers = [2, 3, 5, 8, 20, 100];
    const multiplier = isWin ? multipliers[symbolIndex] * 0.95 : 0; // 5% house edge

    return {
      isWin,
      payout: 0,
      multiplier,
      details: { reels, hash, float },
    };
  }

  // Crash: multiplier grows until crash
  crash(clientSeed: string, nonce: number): GameResult {
    const { result: float, hash } = this.generateResult(clientSeed, nonce);
    // Crash point: 1% chance of instant crash, otherwise exponential distribution
    const crashPoint = float < 0.01 ? 1.0 : Math.floor(100 / (1 - float)) / 100;
    const maxMultiplier = 1000;
    const finalMultiplier = Math.min(crashPoint, maxMultiplier);
    
    // Player cashes out at some point - this is determined by client
    // For server-side, we just return the crash point
    return {
      isWin: false, // Determined by client cashout
      payout: 0,
      multiplier: finalMultiplier,
      details: { crashPoint: finalMultiplier, hash, float },
    };
  }

  // Plinko: ball drops through pegs
  plinko(clientSeed: string, nonce: number, rows: number, risk: 'low' | 'medium' | 'high'): GameResult {
    const { result: float, hash } = this.generateResult(clientSeed, nonce);
    let position = 0;
    const multipliers: Record<string, number[]> = {
      low: [0.5, 1, 2, 5, 10, 20, 50, 100, 50, 20, 10, 5, 2, 1, 0.5],
      medium: [0.2, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 50, 10, 5, 2, 1, 0.5, 0.2],
      high: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 500, 100, 20, 5, 2, 1, 0.5, 0.2, 0.1],
    };
    
    const mults = multipliers[risk];
    const maxPos = mults.length - 1;
    
    // Simulate ball dropping through rows
    for (let i = 0; i < rows; i++) {
      const { result: f } = this.generateResult(`${clientSeed}:${i}`, nonce + i);
      position += f < 0.5 ? 0 : 1;
    }
    
    position = Math.min(position, maxPos);
    const multiplier = mults[position] * 0.96; // 4% house edge

    return {
      isWin: multiplier > 1,
      payout: 0,
      multiplier,
      details: { position, maxPos, risk, rows, hash, float },
    };
  }

  // Mines: reveal tiles
  mines(clientSeed: string, nonce: number, gridSize: number, mineCount: number, picks: number[]): GameResult {
    const { result: float, hash } = this.generateResult(clientSeed, nonce);
    const totalTiles = gridSize * gridSize;
    
    // Generate mine positions deterministically
    const tiles = Array(totalTiles).fill(false);
    let minesPlaced = 0;
    let hashState = float;
    
    for (let i = 0; i < totalTiles && minesPlaced < mineCount; i++) {
      const { result: f } = this.generateResult(`${clientSeed}:mine:${i}`, nonce + i);
      hashState = f;
      if (f < mineCount / (totalTiles - i)) {
        tiles[i] = true;
        minesPlaced++;
      }
    }
    
    // Check picks
    let hitMine = false;
    for (const pick of picks) {
      if (tiles[pick]) {
        hitMine = true;
        break;
      }
    }
    
    const safePicks = picks.filter(p => !tiles[p]).length;
    const multiplier = hitMine ? 0 : Math.pow(1 + (mineCount / totalTiles), safePicks) * 0.97; // 3% house edge

    return {
      isWin: !hitMine,
      payout: 0,
      multiplier: hitMine ? 0 : multiplier,
      details: { picks, safePicks, hitMine, mineCount, gridSize, hash, float },
    };
  }

  // Verify a result
  static verify(serverSeed: string, clientSeed: string, nonce: number): ProvablyFairResult {
    const engine = new ProvablyFairEngine(serverSeed);
    return engine.generateResult(clientSeed, nonce);
  }
}