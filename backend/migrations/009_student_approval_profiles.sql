ALTER TABLE users ADD COLUMN IF NOT EXISTS student_approval_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (student_approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT;
UPDATE users SET student_approval_status = 'approved' WHERE student_approval_status = 'pending';
