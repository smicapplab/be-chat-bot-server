CREATE TABLE doc_training (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES app_user(id) ON DELETE SET NULL ON UPDATE CASCADE,
  stage TEXT NOT NULL,
  summary TEXT,
  file_name TEXT,
  pages INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doc_extract (
  id SERIAL PRIMARY KEY,
  doc_training_id INTEGER REFERENCES doc_training(id) ON DELETE SET NULL ON UPDATE CASCADE,
  job_id TEXT NOT NULL,
  user_id INTEGER REFERENCES app_user(id) ON DELETE SET NULL ON UPDATE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  summary TEXT,
  file_name TEXT,
  blocks TEXT,
  generated_content JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);