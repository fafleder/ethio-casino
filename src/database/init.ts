// Load dotenv first before any other imports
import 'dotenv/config';
import { initSchema, closePool } from './index';
import { config } from '../config/index';

async function main() {
  console.log('🔧 Initializing database...');
  console.log('📍 Environment:', config.NODE_ENV);
  console.log('📍 Database:', config.DATABASE_URL);
  
  try {
    await initSchema();
    console.log('✅ Database initialized successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();