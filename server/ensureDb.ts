import { pool } from "./db";

async function safeExec(sql: string) {
  try {
    await pool.query(sql);
  } catch (e) {
    console.warn("skip:", (e as any).message);
  }
}

async function run() {
  // Extensions
  await safeExec("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  // Schools
  await safeExec(`CREATE TABLE IF NOT EXISTS schools (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    team text DEFAULT 'A',
    created_at timestamp DEFAULT now()
  );`);
  await safeExec(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS team text DEFAULT 'A';`);

  // Participants base table
  await safeExec(`CREATE TABLE IF NOT EXISTS participants (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text,
    phone text,
    institution text,
    passcode text NOT NULL,
    has_completed_quiz boolean DEFAULT false,
    registered_at timestamp DEFAULT now()
  );`);
  // Ensure unique passcode
  await safeExec(`CREATE UNIQUE INDEX IF NOT EXISTS participants_passcode_idx ON participants (passcode);`);
  // Remove legacy unique constraint on email if present
  await safeExec(`ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_email_unique;`);
  // Add/align columns
  await safeExec(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS mode text DEFAULT 'solo';`);
  await safeExec(`ALTER TABLE participants ALTER COLUMN mode SET NOT NULL;`);
  await safeExec(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS school_id varchar;`);
  await safeExec(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS subject text;`);
  await safeExec(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_leader boolean DEFAULT false;`);
  await safeExec(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS registered_at timestamp DEFAULT now();`);
  await safeExec(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS has_completed_quiz boolean DEFAULT false;`);
  // institution should be optional
  await safeExec(`ALTER TABLE participants ALTER COLUMN institution DROP NOT NULL;`);
  await safeExec(`ALTER TABLE participants ALTER COLUMN email DROP NOT NULL;`);
  await safeExec(`ALTER TABLE participants ALTER COLUMN phone DROP NOT NULL;`);

  // Questions
  await safeExec(`CREATE TABLE IF NOT EXISTS questions (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    text text NOT NULL,
    options json NOT NULL,
    correct_answer text NOT NULL,
    time_limit integer NOT NULL,
    marks integer NOT NULL,
    order_index integer NOT NULL,
    mode text DEFAULT 'both',
    subject text
  );`);
  await safeExec(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS mode text DEFAULT 'both';`);
  await safeExec(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject text;`);

  // Quiz submissions
  await safeExec(`CREATE TABLE IF NOT EXISTS quiz_submissions (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id varchar NOT NULL,
    answers json NOT NULL,
    score integer NOT NULL,
    total_marks integer NOT NULL,
    time_taken integer NOT NULL,
    completed_at timestamp DEFAULT now()
  );`);

  // System settings
  await safeExec(`CREATE TABLE IF NOT EXISTS system_settings (
    id varchar PRIMARY KEY DEFAULT 'system'
  );`);
  await safeExec(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS solo_registration_open boolean DEFAULT true;`);
  await safeExec(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS school_registration_open boolean DEFAULT true;`);
  await safeExec(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS quiz_active boolean DEFAULT false;`);
  await safeExec(`INSERT INTO system_settings (id, solo_registration_open, school_registration_open, quiz_active)
    VALUES ('system', true, true, false)
    ON CONFLICT (id) DO NOTHING;`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
