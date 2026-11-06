ALTER TABLE payments ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

INSERT INTO lesson_types(name, description, duration_minutes, price_cents, active)
VALUES ('Extended practical driving lesson', 'A two-hour practical driving lesson.', 120, 9000, true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  price_cents = EXCLUDED.price_cents,
  active = true;
