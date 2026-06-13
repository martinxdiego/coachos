-- S3.6: drop the person-specific column name. Rename keeps the existing data.
ALTER TABLE "MondayTraining" RENAME COLUMN "sanduNotes" TO "assistantNotes";
