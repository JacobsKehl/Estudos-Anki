const { execSync } = require('child_process');

console.log('=== STARTING VERCEL BUILD SCRIPT ===');

try {
  // 1. Generate Prisma Client
  console.log('> prisma generate');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // 2. Run migrations only if we are building on Vercel
  if (process.env.VERCEL === '1') {
    console.log('> Vercel detected. Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } else {
    console.log('> Local build detected. Skipping database migrations.');
  }

  // 3. Build Next.js
  console.log('> next build');
  execSync('npx next build', { stdio: 'inherit' });

  console.log('=== VERCEL BUILD SCRIPT COMPLETED ===');
} catch (error) {
  console.error('=== VERCEL BUILD SCRIPT FAILED ===', error);
  process.exit(1);
}
