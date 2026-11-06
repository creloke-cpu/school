INSERT INTO users(contact,display_name)
VALUES ('steveotien8@gmail.com','FirstGear Superadmin')
ON CONFLICT(contact) DO UPDATE SET display_name=EXCLUDED.display_name;

INSERT INTO user_roles(user_id,role_id)
SELECT u.id,r.id FROM users u,roles r
WHERE u.contact='steveotien8@gmail.com' AND r.name='admin'
ON CONFLICT DO NOTHING;
