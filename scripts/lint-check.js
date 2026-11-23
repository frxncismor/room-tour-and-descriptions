#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Running lint checks...\n');

try {
  // Run Angular linting
  console.log('📝 Running Angular linting...');
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('✅ Angular linting passed\n');

  // Run Prettier check
  console.log('💅 Running Prettier check...');
  execSync('npx prettier --check "src/**/*.{ts,html,scss}"', {
    stdio: 'inherit',
  });
  console.log('✅ Prettier check passed\n');

  console.log('🎉 All lint checks passed!');
} catch (error) {
  console.error('❌ Lint checks failed:', error.message);
  process.exit(1);
}
