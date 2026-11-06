ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

INSERT INTO users(contact,display_name)
VALUES ('superadmin@firstgear.local','FirstGear Superadmin')
ON CONFLICT(contact) DO NOTHING;

INSERT INTO user_roles(user_id,role_id)
SELECT u.id,r.id FROM users u,roles r
WHERE u.contact='superadmin@firstgear.local' AND r.name='admin'
ON CONFLICT DO NOTHING;

UPDATE instructor_profiles
SET approval_status='approved'
WHERE approval_status IS NULL;
