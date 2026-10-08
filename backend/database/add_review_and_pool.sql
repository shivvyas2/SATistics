-- Answer review after games, and a shared pool of checked AI-written questions.
-- Additive and safe to run again.

-- Each attempt keeps the question as it was shown and the answer picked, so
-- past games can be reviewed with the correct answers and explanations
ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS question JSONB;
-- Index of the option picked; NULL when time ran out
ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS selected_answer INTEGER;
-- Order within the game; attempts saved together share a timestamp
ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS position INTEGER;

-- AI-written questions that passed the format and answer-key checks. Serving them
-- again to students who haven't seen them means paying to write each one only once.
CREATE TABLE IF NOT EXISTS question_pool (
  -- The id the question has in games, so attempts can be matched to it
  id INTEGER PRIMARY KEY,
  exam TEXT NOT NULL CHECK (exam IN ('sat', 'gre')),
  section TEXT NOT NULL CHECK (section IN ('quant', 'verbal')),
  skill TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  -- The full question as the games receive it
  question JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_pool_exam_section ON question_pool(exam, section, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_attempts_user_question ON question_attempts(user_id, question_id);

-- No policies: only the backend's service-role key reads and writes the pool
ALTER TABLE question_pool ENABLE ROW LEVEL SECURITY;
