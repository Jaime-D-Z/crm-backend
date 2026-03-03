-- ============================================================
-- SEED: PRODUCTOS DE EJEMPLO
-- Ejecutar: psql -h host -U user -d database -f seed-productos-ejemplo.sql
-- ============================================================

-- Insertar 5 productos de ejemplo
INSERT INTO productos (id, nombre, descripcion, precio, imagen_url, categoria, stock, activo, destacado, orden, created_at) VALUES
(
    'prod-001-laptop-hp',
    'Laptop HP Pavilion 15',
    'Laptop de alto rendimiento con procesador Intel Core i7, 16GB RAM, 512GB SSD. Ideal para trabajo y entretenimiento. Pantalla Full HD de 15.6 pulgadas.',
    1299.99,
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500',
    'Tecnologia',
    15,
    true,
    true,
    1,
    CURRENT_TIMESTAMP
),
(
    'prod-002-iphone-14',
    'iPhone 14 Pro 256GB',
    'Smartphone Apple iPhone 14 Pro con chip A16 Bionic, camara de 48MP, pantalla Super Retina XDR de 6.1 pulgadas. Incluye cargador y audifonos.',
    1499.99,
    'https://images.unsplash.com/photo-1592286927505-4fd30c87f9d2?w=500',
    'Tecnologia',
    8,
    true,
    true,
    2,
    CURRENT_TIMESTAMP
),
(
    'prod-003-silla-oficina',
    'Silla Ergonomica Ejecutiva',
    'Silla de oficina ergonomica con soporte lumbar ajustable, reposabrazos 4D, respaldo de malla transpirable. Capacidad 150kg. Garantia 2 anos.',
    349.99,
    'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=500',
    'Oficina',
    25,
    true,
    false,
    3,
    CURRENT_TIMESTAMP
),
(
    'prod-004-monitor-4k',
    'Monitor LG 27" 4K UHD',
    'Monitor profesional 27 pulgadas resolucion 4K (3840x2160), panel IPS, HDR10, 99% sRGB. Ideal para diseno grafico y edicion de video.',
    599.99,
    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500',
    'Tecnologia',
    12,
    true,
    false,
    4,
    CURRENT_TIMESTAMP
),
(
    'prod-005-escritorio',
    'Escritorio Ejecutivo L-Shape',
    'Escritorio en forma de L, madera MDF de alta calidad, acabado nogal. Dimensiones: 150x150cm. Incluye organizador de cables y soporte para monitor.',
    449.99,
    'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=500',
    'Oficina',
    10,
    true,
    true,
    5,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

-- Verificar insercion
SELECT 
    id, 
    nombre, 
    precio, 
    categoria, 
    stock,
    CASE WHEN activo THEN 'Activo' ELSE 'Inactivo' END as estado,
    CASE WHEN destacado THEN 'Si' ELSE 'No' END as destacado
FROM productos
ORDER BY orden;

SELECT 'Productos insertados exitosamente' as mensaje;
