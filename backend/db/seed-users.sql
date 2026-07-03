-- Usuarios demo (SOLO desarrollo o primer despliegue con SEED_DEMO_USERS=true)
-- Contraseñas: ver .env.example (SEED_ADMIN_PASSWORD / SEED_CLIENT_PASSWORD)

INSERT INTO users (email, password_hash, full_name, role, auth_provider) VALUES
('admin@ecommerce.com', '$2a$10$fo8ZLYXuIAG2pioQLPxYLOfglaxTclBCuLunqjIQuWJsE0MzQwqCS', 'Administrador Principal', 'admin', 'email'),
('cliente@ecommerce.com', '$2a$10$Lye31HEbi6jj4Fy0p0UrzOULVMModOsJZwS6afGRZfiOdWL14U46m', 'Elian Perez', 'client', 'email');