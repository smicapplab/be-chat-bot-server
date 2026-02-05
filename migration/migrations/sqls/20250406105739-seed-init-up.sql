INSERT INTO app_user (
  id, first_name, last_name, password, email, is_active, created_at, updated_at, provider, updated_by
)
VALUES
  (1, 'Steve', 'Torrefranca', '', 's.torrefranca@gmail.com', true, NOW(), NOW(), ARRAY['Microsoft']::providers[], NULL)
ON CONFLICT (email) DO NOTHING;

-- Now insert roles that reference updated_by = 1
INSERT INTO role (id, role_name, description, created_at, updated_at, updated_by)
VALUES
  (1, 'Admin', 'Full access to all resources', NOW(), NOW(), 1),
  (2, 'Content Manager', 'Can manage documents and assistant prompts', NOW(), NOW(), 1),
  (3, 'Voice Assistant', 'Voice Assistant', NOW(), NOW(), 1)
ON CONFLICT (id) DO NOTHING;

-- Reset Role ID sequence
SELECT setval(pg_get_serial_sequence('role', 'id'), (SELECT MAX(id) FROM role));

-- Insert other users (now safe to use role_id = 1)
INSERT INTO app_user (
  id, first_name, last_name, password, email, role_id, is_active, created_at, updated_at, provider, updated_by
)
VALUES
  (2, 'Stephanie', 'Vea', '', 's.vea@gmail.com', 1, true, NOW(), NOW(), ARRAY['Microsoft']::providers[], 1),
  (3, 'Jayson', 'Baylon', '', 'j.baylon@gmail.com', 1, true, NOW(), NOW(), ARRAY['Microsoft']::providers[], 1)
ON CONFLICT (email) DO NOTHING;

-- Reset User ID sequence
SELECT setval(pg_get_serial_sequence('app_user', 'id'), (SELECT MAX(id) FROM app_user));

-- Insert projects
INSERT INTO project (id, title, service_type)
VALUES 
  (1, 'Website', 'site-chat'),
  (2, 'Voice Assistant', 'voice-assistant')
ON CONFLICT (id) DO NOTHING;