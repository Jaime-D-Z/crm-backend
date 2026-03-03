-- ══════════════════════════════════════════════════════════════
-- PRODUCTOS DE EJEMPLO PARA E-COMMERCE
-- ══════════════════════════════════════════════════════════════

-- Limpiar productos existentes (opcional)
-- DELETE FROM productos;

-- ── Tecnología ────────────────────────────────────────────────
INSERT INTO productos (id, nombre, descripcion, precio, imagen_url, categoria, stock, activo, destacado, orden) VALUES
('prod-tech-001', 'iPhone 15 Pro Max', 'Smartphone Apple con chip A17 Pro, cámara de 48MP y pantalla Super Retina XDR de 6.7"', 1299.99, 'https://images.unsplash.com/photo-1696446702183-cbd50c2e5e0d?w=500', 'Tecnología', 50, true, true, 1),
('prod-tech-002', 'MacBook Pro 16"', 'Laptop profesional con chip M3 Pro, 18GB RAM, 512GB SSD. Perfecta para desarrollo y diseño', 2499.99, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500', 'Tecnología', 25, true, true, 2),
('prod-tech-003', 'iPad Air M2', 'Tablet con chip M2, pantalla Liquid Retina de 11", compatible con Apple Pencil Pro', 599.99, 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500', 'Tecnología', 40, true, false, 3),
('prod-tech-004', 'AirPods Pro 2', 'Audífonos inalámbricos con cancelación activa de ruido y audio espacial personalizado', 249.99, 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=500', 'Tecnología', 100, true, true, 4),
('prod-tech-005', 'Apple Watch Series 9', 'Smartwatch con pantalla siempre activa, GPS, monitor de salud y fitness avanzado', 399.99, 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=500', 'Tecnología', 60, true, false, 5),
('prod-tech-006', 'Samsung Galaxy S24 Ultra', 'Smartphone Android premium con S Pen, cámara de 200MP y pantalla AMOLED 6.8"', 1199.99, 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500', 'Tecnología', 35, true, true, 6),
('prod-tech-007', 'Sony WH-1000XM5', 'Audífonos over-ear con la mejor cancelación de ruido del mercado y 30h de batería', 399.99, 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500', 'Tecnología', 45, true, false, 7),
('prod-tech-008', 'Dell XPS 15', 'Laptop ultradelgada con Intel i7, 16GB RAM, RTX 4050 y pantalla 4K OLED', 1899.99, 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=500', 'Tecnología', 20, true, false, 8)
ON CONFLICT (id) DO NOTHING;

-- ── Hogar y Decoración ────────────────────────────────────────
INSERT INTO productos (id, nombre, descripcion, precio, imagen_url, categoria, stock, activo, destacado, orden) VALUES
('prod-home-001', 'Sofá Modular Escandinavo', 'Sofá de 3 plazas en tela gris claro, diseño minimalista con patas de madera natural', 899.99, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500', 'Hogar', 15, true, true, 10),
('prod-home-002', 'Lámpara de Pie Industrial', 'Lámpara de diseño industrial con acabado en negro mate y detalles en cobre', 149.99, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500', 'Hogar', 30, true, false, 11),
('prod-home-003', 'Mesa de Centro Mármol', 'Mesa de centro con tapa de mármol blanco y estructura de acero dorado', 399.99, 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=500', 'Hogar', 12, true, false, 12),
('prod-home-004', 'Set de Cojines Decorativos', 'Pack de 4 cojines en tonos neutros con texturas variadas, 45x45cm', 79.99, 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500', 'Hogar', 50, true, false, 13),
('prod-home-005', 'Espejo Redondo Dorado', 'Espejo decorativo de 80cm con marco dorado envejecido, estilo vintage', 189.99, 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=500', 'Hogar', 25, true, true, 14)
ON CONFLICT (id) DO NOTHING;

-- ── Moda y Accesorios ─────────────────────────────────────────
INSERT INTO productos (id, nombre, descripcion, precio, imagen_url, categoria, stock, activo, destacado, orden) VALUES
('prod-fashion-001', 'Reloj Inteligente Garmin', 'Smartwatch deportivo con GPS, monitor cardíaco y resistencia al agua 10ATM', 349.99, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', 'Moda', 40, true, false, 20),
('prod-fashion-002', 'Mochila Ejecutiva Cuero', 'Mochila de cuero genuino con compartimento para laptop 15", color café', 199.99, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500', 'Moda', 30, true, true, 21),
('prod-fashion-003', 'Gafas de Sol Ray-Ban', 'Gafas de sol clásicas Wayfarer con protección UV400 y lentes polarizados', 159.99, 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500', 'Moda', 60, true, false, 22),
('prod-fashion-004', 'Cartera Minimalista RFID', 'Cartera delgada de aluminio con protección RFID, capacidad para 12 tarjetas', 49.99, 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500', 'Moda', 80, true, false, 23)
ON CONFLICT (id) DO NOTHING;

-- ── Deportes y Fitness ────────────────────────────────────────
INSERT INTO productos (id, nombre, descripcion, precio, imagen_url, categoria, stock, activo, destacado, orden) VALUES
('prod-sport-001', 'Bicicleta de Montaña Trek', 'MTB 29" con suspensión delantera, 21 velocidades Shimano, frenos de disco', 799.99, 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=500', 'Deportes', 10, true, true, 30),
('prod-sport-002', 'Set de Pesas Ajustables', 'Mancuernas ajustables de 2.5kg a 24kg por mancuerna, incluye base', 299.99, 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500', 'Deportes', 20, true, false, 31),
('prod-sport-003', 'Yoga Mat Premium', 'Tapete de yoga antideslizante 6mm, material ecológico con bolsa de transporte', 59.99, 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500', 'Deportes', 50, true, false, 32),
('prod-sport-004', 'Banda Elástica Resistencia', 'Set de 5 bandas de resistencia con diferentes niveles, incluye anclajes y manual', 34.99, 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=500', 'Deportes', 70, true, false, 33)
ON CONFLICT (id) DO NOTHING;

-- ── Oficina y Productividad ───────────────────────────────────
INSERT INTO productos (id, nombre, descripcion, precio, imagen_url, categoria, stock, activo, destacado, orden) VALUES
('prod-office-001', 'Silla Ergonómica Herman Miller', 'Silla de oficina con soporte lumbar ajustable, reposabrazos 4D y malla transpirable', 899.99, 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=500', 'Oficina', 15, true, true, 40),
('prod-office-002', 'Escritorio Elevable Eléctrico', 'Escritorio sit-stand con ajuste eléctrico de altura, superficie de 140x70cm', 599.99, 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=500', 'Oficina', 12, true, true, 41),
('prod-office-003', 'Monitor LG UltraWide 34"', 'Monitor curvo 21:9 QHD, 144Hz, HDR10, ideal para multitarea y gaming', 499.99, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500', 'Oficina', 25, true, false, 42),
('prod-office-004', 'Teclado Mecánico Logitech', 'Teclado mecánico inalámbrico con switches táctiles, retroiluminación RGB', 149.99, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500', 'Oficina', 40, true, false, 43),
('prod-office-005', 'Mouse Vertical Ergonómico', 'Mouse vertical inalámbrico para reducir tensión en muñeca, 6 botones programables', 69.99, 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500', 'Oficina', 35, true, false, 44)
ON CONFLICT (id) DO NOTHING;

-- Verificar inserción
SELECT 
    id, 
    nombre, 
    precio, 
    categoria, 
    stock,
    CASE WHEN activo THEN 'Activo' ELSE 'Inactivo' END as estado,
    CASE WHEN destacado THEN 'Destacado' ELSE 'Normal' END as destacado
FROM productos
ORDER BY orden;

SELECT COUNT(*) as total_productos FROM productos;
