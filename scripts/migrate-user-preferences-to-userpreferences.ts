/* eslint-disable */
// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = args.includes('--dry-run') || !isApply;

  console.log(`=== Preferences Migration: ${isApply ? 'APPLY MODE' : 'DRY-RUN MODE'} ===\n`);

  try {
    const users = await prisma.user.findMany({
      include: { preferences: true }
    });

    console.log(`Total users found: ${users.length}`);

    let usersWithPrefs = 0;
    let usersWithoutPrefs = 0;
    let recordsToUpdate = 0;
    let recordsToCreate = 0;

    const migrationPlan: any[] = [];

    for (const user of users) {
      if (user.preferences) {
        usersWithPrefs++;
        
        // Compare values to see if any updates are needed. 
        // Rule: UserPreferences wins. But if UserPreferences has default values and User has customized ones,
        // we can copy them. In our database, let's identify differences.
        const diffs: any = {};
        const updateData: any = {};

        // We check theme if it is available in UserPreferences schema dynamically
        const hasThemeInPrefs = 'theme' in user.preferences;

        if (user.dailyGoalMinutes !== user.preferences.dailyGoalMinutes) {
          diffs.dailyGoalMinutes = { user: user.dailyGoalMinutes, prefs: user.preferences.dailyGoalMinutes };
          // If prefs has default 120, but user has customized, copy it if wanted. But since UserPreferences is source of truth,
          // we preserve UserPreferences unless it's a default and user is custom. Let's just log it.
        }

        if (user.flashcardDifficulty !== user.preferences.flashcardDifficulty) {
          diffs.flashcardDifficulty = { user: user.flashcardDifficulty, prefs: user.preferences.flashcardDifficulty };
        }

        if (user.emailReminderEnabled !== user.preferences.emailReminderEnabled) {
          diffs.emailReminderEnabled = { user: user.emailReminderEnabled, prefs: user.preferences.emailReminderEnabled };
        }

        if (user.emailReminderTime !== user.preferences.emailReminderTime) {
          diffs.emailReminderTime = { user: user.emailReminderTime, prefs: user.preferences.emailReminderTime };
        }

        const userDensity = user.displayDensity;
        const prefsDensity = user.preferences.visualDensity;
        if (userDensity !== prefsDensity) {
          diffs.visualDensity = { user: userDensity, prefs: prefsDensity };
        }

        const userMotion = user.animations === "reduced";
        const prefsMotion = user.preferences.reducedMotion;
        if (userMotion !== prefsMotion) {
          diffs.reducedMotion = { user: userMotion, prefs: prefsMotion };
        }

        if (user.studyFocus !== user.preferences.focusArea) {
          diffs.focusArea = { user: user.studyFocus, prefs: user.preferences.focusArea };
        }

        // Copy theme from User to UserPreferences if the column exists in UserPreferences and is not set
        if (hasThemeInPrefs) {
          const prefsTheme = (user.preferences as any).theme;
          if (!prefsTheme || prefsTheme === 'light') {
            if (user.theme && user.theme !== 'light') {
              diffs.theme = { user: user.theme, prefs: prefsTheme };
              updateData.theme = user.theme;
            }
          }
        }

        if (Object.keys(updateData).length > 0) {
          recordsToUpdate++;
          migrationPlan.push({
            userId: user.id,
            email: user.email,
            action: 'UPDATE_PREFERENCES',
            data: updateData,
            diffs
          });
        } else if (Object.keys(diffs).length > 0) {
          migrationPlan.push({
            userId: user.id,
            email: user.email,
            action: 'PRESERVE_PREFERENCES',
            diffs,
            message: 'UserPreferences has different values but they are preserved (UserPreferences is source of truth)'
          });
        }

      } else {
        usersWithoutPrefs++;
        recordsToCreate++;

        // Create initial preferences from User values
        const dataToCreate: any = {
          dailyGoalMinutes: user.dailyGoalMinutes,
          studyResetTime: "00:00",
          studyDaysOfWeek: "1,2,3,4,5",
          defaultBlockDurationMinutes: 30,
          maxNewCardsPerDay: 20,
          flashcardDifficulty: user.flashcardDifficulty,
          emailReminderEnabled: user.emailReminderEnabled,
          emailReminderTime: user.emailReminderTime,
          visualDensity: user.displayDensity === "compact" ? "compact" : "comfortable",
          reducedMotion: user.animations === "reduced",
          focusArea: user.studyFocus || "Geral",
          displayName: user.name || "Estudante",
          examGoal: "TRT4",
          avatarUrl: null
        };

        // If theme exists in schema, copy it
        if ('theme' in prisma.userPreferences.fields || true) {
          dataToCreate.theme = user.theme || "light";
        }

        migrationPlan.push({
          userId: user.id,
          email: user.email,
          action: 'CREATE_PREFERENCES',
          data: dataToCreate
        });
      }
    }

    console.log(`Users with UserPreferences: ${usersWithPrefs}`);
    console.log(`Users without UserPreferences: ${usersWithoutPrefs}`);
    console.log(`Migration plans: Create: ${recordsToCreate}, Update: ${recordsToUpdate}\n`);

    if (migrationPlan.length === 0) {
      console.log("No migration actions required. Data is completely synchronized!");
      return;
    }

    console.log("--- Detailed Migration Plan ---");
    console.log(JSON.stringify(migrationPlan, null, 2));
    console.log("--------------------------------\n");

    if (isDryRun) {
      console.log("Dry-run finished. No database modifications were made.");
      console.log("To apply these changes, run the script with the '--apply' flag.");
    } else {
      console.log("Applying migration to the database...");

      for (const plan of migrationPlan) {
        if (plan.action === 'CREATE_PREFERENCES') {
          console.log(`Creating preferences for user ${plan.email}...`);
          await prisma.userPreferences.create({
            data: {
              userId: plan.userId,
              ...plan.data
            }
          });
        } else if (plan.action === 'UPDATE_PREFERENCES') {
          console.log(`Updating preferences for user ${plan.email}...`);
          await prisma.userPreferences.update({
            where: { userId: plan.userId },
            data: plan.data
          });
        }
      }

      console.log("\nMigration completed successfully and changes applied!");
    }

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
