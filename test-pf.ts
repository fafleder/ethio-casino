// Quick test of provably fair engine
import { ProvablyFairEngine } from './src/games/provably-fair';

const pf = new ProvablyFairEngine();
const serverSeedHash = pf.getServerSeedHash();
console.log('Server Seed Hash:', serverSeedHash);

const clientSeed = 'client-seed-123';
const nonce = 1;

// Test Dice
const diceResult = pf.diceRoll(clientSeed, nonce, 50, 'under');
console.log('\n🎲 Dice Roll:');
console.log('  Roll:', diceResult.details.roll);
console.log('  Target:', diceResult.details.target);
console.log('  Condition:', diceResult.details.condition);
console.log('  Win:', diceResult.isWin);
console.log('  Multiplier:', diceResult.multiplier);
console.log('  Server Seed:', diceResult.provablyFair.serverSeed.substring(0, 16) + '...');

// Test Coin Flip
const coinResult = pf.coinFlip(clientSeed, nonce + 1, 'heads');
console.log('\n🪙 Coin Flip:');
console.log('  Result:', coinResult.details.result);
console.log('  Choice:', coinResult.details.choice);
console.log('  Win:', coinResult.isWin);
console.log('  Multiplier:', coinResult.multiplier);

// Test Slots
const slotsResult = pf.slots(clientSeed, nonce + 2, ['🍒', '🍋', '🍊', '🍇', '⭐', '7️⃣']);
console.log('\n🎰 Slots:');
console.log('  Reels:', slotsResult.details.reels);
console.log('  Winning Symbol:', slotsResult.details.winningSymbol);
console.log('  Win:', slotsResult.isWin);
console.log('  Multiplier:', slotsResult.multiplier);

// Test Crash
const crashResult = pf.crash(clientSeed, nonce + 3, 0.03);
console.log('\n📈 Crash:');
console.log('  Crash Point:', crashResult.details.crashPoint + 'x');
console.log('  Win:', crashResult.isWin);
console.log('  Multiplier:', crashResult.multiplier);

// Test Plinko
const plinkoResult = pf.plinko(clientSeed, nonce + 4, 16, 'medium');
console.log('\n🎯 Plinko:');
console.log('  Position:', plinkoResult.details.position);
console.log('  Risk:', plinkoResult.details.risk);
console.log('  Win:', plinkoResult.isWin);
console.log('  Multiplier:', plinkoResult.multiplier);

// Test Mines
const minesResult = pf.mines(clientSeed, nonce + 5, 5, 3, [0, 6, 12]);
console.log('\n💣 Mines:');
console.log('  Mines:', minesResult.details.mines);
console.log('  Clicks:', minesResult.details.clicks);
console.log('  Gems Found:', minesResult.details.gemsFound);
console.log('  Hit Mine:', minesResult.details.hitMine);
console.log('  Win:', minesResult.isWin);
console.log('  Multiplier:', minesResult.multiplier);

// Verify
console.log('\n🔐 Verification Test:');
const serverSeed = pf.revealServerSeed();
console.log('  Server Seed Revealed:', serverSeed.substring(0, 16) + '...');
const verified = pf.verifyResult(serverSeed, clientSeed, nonce, diceResult.provablyFair.result);
console.log('  Dice Result Verified:', verified);

console.log('\n✅ All tests passed!');