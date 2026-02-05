-- Remove seeded users
DELETE FROM app_user WHERE email IN (
  's.torrefranca@gmail.com',
);

-- Remove seeded roles
DELETE FROM role WHERE id IN (1, 2, 3);

-- Remove seeded projects
DELETE FROM project WHERE title IN ('Website', 'Voice Assistant');