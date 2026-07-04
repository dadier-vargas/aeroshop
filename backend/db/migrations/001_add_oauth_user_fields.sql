-- Migración 001: campos OAuth en users (providerId, avatar)
-- auth_provider ya existe y equivale a "provider" ('email', 'google', 'apple')

-- provider_id: ID único del proveedor (nullable para usuarios email/contraseña)
-- avatar: URL de foto de perfil (opcional)

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_provider_id
  ON users(auth_provider, provider_id)
  WHERE provider_id IS NOT NULL;