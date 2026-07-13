function shouldRunDatabaseMigrations(env) {
  return !!(
    env &&
    env.VERCEL === "1" &&
    env.VERCEL_ENV === "production"
  );
}

module.exports = {
  shouldRunDatabaseMigrations,
};
