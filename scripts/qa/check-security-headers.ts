import nextConfig from '../../next.config';

async function testSecurityHeaders() {
  console.log("=== Testing Security Headers Configuration ===");

  if (typeof nextConfig.headers !== 'function') {
    console.error("✗ FAILED: nextConfig.headers is not a function.");
    process.exit(1);
  }

  const headersList = await nextConfig.headers();
  const pathConfig = headersList.find(h => h.source === "/:path*");

  if (!pathConfig) {
    console.error("✗ FAILED: No security headers configuration found for source '/:path*'.");
    process.exit(1);
  }

  const expectedHeaders = [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security"
  ];

  let missing = 0;
  expectedHeaders.forEach(headerKey => {
    const header = pathConfig.headers.find(h => h.key === headerKey);
    if (header) {
      console.log(`✓ Header present: ${headerKey} = "${header.value}"`);
    } else {
      console.error(`✗ Missing Header: ${headerKey}`);
      missing++;
    }
  });

  if (missing === 0) {
    console.log("✓ SUCCESS: All 5 primary security headers are correctly configured!");
  } else {
    process.exit(1);
  }
}

testSecurityHeaders().catch(err => {
  console.error(err);
  process.exit(1);
});
