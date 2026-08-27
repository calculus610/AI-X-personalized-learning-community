-- MySQL 8.4-compatible, idempotent migration.
-- Production execution still requires explicit approval and a verified backup.
SET @career_schema_name = DATABASE();

SET @career_add_primary_sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @career_schema_name
      AND TABLE_NAME = 'user_profiles'
      AND COLUMN_NAME = 'primary_career_id'
  ),
  'SELECT 1',
  'ALTER TABLE `user_profiles` ADD COLUMN `primary_career_id` VARCHAR(96) NULL AFTER `selected_interest_ids`'
);
PREPARE career_add_primary_stmt FROM @career_add_primary_sql;
EXECUTE career_add_primary_stmt;
DEALLOCATE PREPARE career_add_primary_stmt;

SET @career_add_updated_at_sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @career_schema_name
      AND TABLE_NAME = 'user_profiles'
      AND COLUMN_NAME = 'career_preference_updated_at'
  ),
  'SELECT 1',
  'ALTER TABLE `user_profiles` ADD COLUMN `career_preference_updated_at` DATETIME(3) NULL AFTER `primary_career_id`'
);
PREPARE career_add_updated_at_stmt FROM @career_add_updated_at_sql;
EXECUTE career_add_updated_at_stmt;
DEALLOCATE PREPARE career_add_updated_at_stmt;
