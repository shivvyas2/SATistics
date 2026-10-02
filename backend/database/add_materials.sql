-- Study material uploaded by users, and the questions pulled out of it
CREATE TABLE IF NOT EXISTS materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  exam TEXT NOT NULL CHECK (exam IN ('sat', 'gre')),
  section TEXT NOT NULL CHECK (section IN ('quant', 'verbal')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_questions (
  id BIGSERIAL PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam TEXT NOT NULL,
  section TEXT NOT NULL,
  question TEXT NOT NULL,
  passage TEXT NOT NULL DEFAULT '',
  options JSONB NOT NULL,
  -- NULL until an answer is found in the material or set during review
  correct_answer INTEGER,
  topic TEXT NOT NULL DEFAULT 'My material',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  explanation TEXT NOT NULL DEFAULT '',
  -- extracted: copied from the material. generated: written by AI from the material
  origin TEXT NOT NULL DEFAULT 'extracted' CHECK (origin IN ('extracted', 'generated')),
  -- Only approved questions appear in games
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_questions_material_id ON custom_questions(material_id);
CREATE INDEX IF NOT EXISTS idx_custom_questions_user_section ON custom_questions(user_id, exam, section, status);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_questions ENABLE ROW LEVEL SECURITY;

-- Uploaded material is private to the person who uploaded it
DROP POLICY IF EXISTS "Users can manage own materials" ON materials;
CREATE POLICY "Users can manage own materials" ON materials
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own custom questions" ON custom_questions;
CREATE POLICY "Users can manage own custom questions" ON custom_questions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
