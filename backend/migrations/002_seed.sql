INSERT INTO lesson_types(name,description,duration_minutes,price_cents) VALUES
('Behind-the-wheel','Practical driving instruction',60,6500),
('Road test preparation','Focused preparation for your driving test',90,9000)
ON CONFLICT(name) DO NOTHING;
INSERT INTO users(contact,display_name) VALUES('demo.instructor@roadready.local','Demo Instructor') ON CONFLICT(contact) DO NOTHING;
INSERT INTO instructor_profiles(user_id,bio,license_number)
SELECT id,'Experienced certified driving instructor','DEMO-001' FROM users WHERE contact='demo.instructor@roadready.local'
ON CONFLICT(user_id) DO NOTHING;
INSERT INTO user_roles(user_id,role_id) SELECT u.id,r.id FROM users u,roles r WHERE u.contact='demo.instructor@roadready.local' AND r.name='instructor' ON CONFLICT DO NOTHING;
