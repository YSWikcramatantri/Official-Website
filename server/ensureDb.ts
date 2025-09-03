import { pool } from "./db";

async function run() {
  const queries = [
    "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
    `CREATE TABLE IF NOT EXISTS schools (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      created_at timestamp DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS participants (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text NOT NULL,
      phone text NOT NULL,
      institution text,
      passcode text NOT NULL UNIQUE,
      mode text NOT NULL,
      school_id varchar,
      subject text,
      is_leader boolean DEFAULT false,
      has_completed_quiz boolean DEFAULT false,
      registered_at timestamp DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS questions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      text text NOT NULL,
      options json NOT NULL,
      correct_answer text NOT NULL,
      time_limit integer NOT NULL,
      marks integer NOT NULL,
      order_index integer NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS quiz_submissions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      participant_id varchar NOT NULL,
      answers json NOT NULL,
      score integer NOT NULL,
      total_marks integer NOT NULL,
      time_taken integer NOT NULL,
      completed_at timestamp DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      id varchar PRIMARY KEY DEFAULT 'system',
      solo_registration_open boolean DEFAULT true,
      school_registration_open boolean DEFAULT true,
      quiz_active boolean DEFAULT false
    );`,
    `INSERT INTO system_settings (id, solo_registration_open, school_registration_open, quiz_active)
     VALUES ('system', true, true, false)
     ON CONFLICT (id) DO NOTHING;`
  ];

  for (const q of queries) {
    await pool.query(q);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
