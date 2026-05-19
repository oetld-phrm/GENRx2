/**
 * Migration 017: DTP & Recommendation Submissions
 *
 * Adds JSONB columns to the chats table for storing student DTP and
 * recommendation submissions at conclude time. These are used by the
 * debrief generation Lambda to perform embedding-based matching against
 * instructor-defined expected DTPs and recommendations.
 *
 * Columns added to chats:
 *   - dtp_submission (jsonb): Array of DTP strings submitted by the student
 *   - recommendation_submission (jsonb): Array of { recommendation, rationale } objects
 *
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'chats' AND column_name = 'dtp_submission') THEN
        ALTER TABLE chats ADD COLUMN dtp_submission jsonb;
      END IF;

      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'chats' AND column_name = 'recommendation_submission') THEN
        ALTER TABLE chats ADD COLUMN recommendation_submission jsonb;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE chats DROP COLUMN IF EXISTS dtp_submission;
    ALTER TABLE chats DROP COLUMN IF EXISTS recommendation_submission;
  `);
};
