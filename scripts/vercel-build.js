const { execSync } = require('child_process');

console.log('=== STARTING VERCEL BUILD SCRIPT ===');

try {
  // 1. Generate Prisma Client
  console.log('> prisma generate');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // 2. Run migrations only if we are building on Vercel Production
  const { shouldRunDatabaseMigrations } = require('./vercel-build-policy');
  if (shouldRunDatabaseMigrations(process.env)) {
    console.log('> Vercel production deployment detected. Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } else if (process.env.VERCEL === '1') {
    if (process.env.VERCEL_ENV === 'preview') {
      console.log('> Vercel preview deployment detected. Skipping database migrations.');
    } else {
      console.log(`> Vercel ${process.env.VERCEL_ENV || 'unknown'} deployment detected. Skipping database migrations.`);
    }
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
