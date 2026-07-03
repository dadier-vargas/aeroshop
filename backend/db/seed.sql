-- Inserción de Categorías
INSERT INTO categories (name, description, slug) VALUES
('Tecnología', 'Dispositivos electrónicos, computadores y accesorios de última generación', 'tecnologia'),
('Moda', 'Prendas de vestir y accesorios de moda para hombres y mujeres', 'moda'),
('Hogar y Cocina', 'Electrodomésticos, decoración y elementos esenciales para el hogar', 'hogar-cocina'),
('Deportes y Fitness', 'Equipamiento deportivo, ropa de entrenamiento y accesorios', 'deportes-fitness');

-- Inserción de Productos
INSERT INTO products (name, description, price, stock, image_url, category_id) VALUES
-- Categoría Tecnología (id = 1)
('Auriculares Inalámbricos Pro', 'Auriculares con cancelación activa de ruido y autonomía de 30 horas.', 120000.0, 15, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60', 1),
('Smartphone Android X10', 'Pantalla AMOLED de 6.5 pulgadas, 128GB de almacenamiento y triple cámara.', 899000.0, 8, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&auto=format&fit=crop&q=60', 1),
('Teclado Mecánico RGB', 'Teclado mecánico con switches rojos para gaming y oficina con iluminación RGB.', 180000.0, 25, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60', 1),
('Cargador Rápido GaN 65W', 'Cargador de pared con doble puerto USB-C y puerto USB-A, ideal para laptops y celulares.', 75000.0, 50, 'https://images.unsplash.com/photo-1622445262465-2481c4574875?w=500&auto=format&fit=crop&q=60', 1),

-- Categoría Moda (id = 2)
('Chaqueta de Mezclilla Unisex', 'Chaqueta de jeans clásica, corte holgado y botones metálicos de alta calidad.', 150000.0, 20, 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500&auto=format&fit=crop&q=60', 2),
('Tenis Deportivos Confort', 'Calzado ultraligero con suela amortiguadora para correr o uso diario.', 220000.0, 12, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60', 2),
('Camiseta de Algodón Orgánico', 'Camiseta de cuello redondo 100% algodón orgánico, suave y transpirable.', 45000.0, 40, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=60', 2),

-- Categoría Hogar y Cocina (id = 3)
('Cafetera de Goteo Programable', 'Cafetera automática con jarra de vidrio de 1.25 litros y filtro permanente.', 195000.0, 10, 'https://images.unsplash.com/photo-1517256064527-09c53b2d0bc6?w=500&auto=format&fit=crop&q=60', 3),
('Lámpara de Escritorio Inteligente', 'Lámpara LED con control de temperatura de color, brillo regulable y puerto de carga USB.', 90000.0, 30, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop&q=60', 3),

-- Categoría Deportes (id = 4)
('Tapete de Yoga Antideslizante', 'Tapete de caucho ecológico de 6mm de grosor con líneas de alineación corporal.', 80000.0, 35, 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500&auto=format&fit=crop&q=60', 4);

-- Inserción de Cupones
INSERT INTO coupons (code, discount_type, discount_value, min_order_value, active, expires_at) VALUES
('DESCUENTO10', 'percentage', 10.0, 50000.0, 1, '2028-12-31 23:59:59'),
('SALE50K', 'fixed', 50000.0, 300000.0, 1, '2028-12-31 23:59:59'),
('BIENVENIDA', 'percentage', 15.0, 0.0, 1, '2028-12-31 23:59:59'),
('CADUCADO', 'percentage', 20.0, 0.0, 0, '2020-01-01 00:00:00');
