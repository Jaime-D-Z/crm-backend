-- ═══════════════════════════════════════════════════════════
-- SEED: 10 PRODUCTOS ADICIONALES PARA LA TIENDA
-- ═══════════════════════════════════════════════════════════

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria, stock, activo, destacado, orden) VALUES

-- Tecnología
('MacBook Pro 16" M3', 'Laptop Apple MacBook Pro con chip M3 Max, 36GB RAM, 1TB SSD, pantalla Liquid Retina XDR de 16 pulgadas. Rendimiento extremo para profesionales.', 3499.99, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800', 'Tecnologia', 8, true, true, 6),

('Samsung Galaxy S24 Ultra', 'Smartphone Samsung Galaxy S24 Ultra con S Pen integrado, cámara de 200MP, pantalla AMOLED 6.8", 12GB RAM, 512GB almacenamiento.', 1299.99, 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800', 'Tecnologia', 15, true, false, 7),

('iPad Pro 12.9" M2', 'Tablet Apple iPad Pro con chip M2, pantalla Liquid Retina XDR de 12.9 pulgadas, 256GB, compatible con Apple Pencil y Magic Keyboard.', 1199.99, 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800', 'Tecnologia', 12, true, true, 8),

('Sony WH-1000XM5', 'Audífonos inalámbricos Sony con cancelación de ruido líder en la industria, 30 horas de batería, sonido Hi-Res, micrófono con IA.', 399.99, 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800', 'Tecnologia', 25, true, false, 9),

('Dell UltraSharp 32" 4K', 'Monitor profesional Dell 32 pulgadas, resolución 4K (3840x2160), panel IPS Black, HDR 400, USB-C con 90W Power Delivery, 99% sRGB.', 749.99, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800', 'Tecnologia', 10, true, false, 10),

-- Oficina
('Silla Herman Miller Aeron', 'Silla ergonómica Herman Miller Aeron tamaño B, soporte lumbar PostureFit SL, reposabrazos ajustables 4D, malla transpirable. Garantía 12 años.', 1495.00, 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=800', 'Oficina', 5, true, true, 11),

('Escritorio Eléctrico Ajustable', 'Escritorio de pie eléctrico con altura ajustable 71-121cm, tablero de bambú 160x80cm, memoria de 4 posiciones, motor silencioso, carga 120kg.', 599.99, 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=800', 'Oficina', 8, true, false, 12),

('Lámpara LED Arquitecto', 'Lámpara de escritorio LED con brazo articulado, 3 modos de color, 10 niveles de brillo, puerto USB de carga, control táctil, ahorro energético.', 89.99, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800', 'Oficina', 30, true, false, 13),

-- Hogar
('Cafetera Espresso Breville', 'Cafetera espresso Breville Barista Express con molinillo integrado, 15 bares de presión, vaporizador de leche, control de temperatura PID.', 699.99, 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800', 'Hogar', 12, true, false, 14),

('Robot Aspiradora Roomba j7+', 'Robot aspiradora iRobot Roomba j7+ con vaciado automático, mapeo inteligente, evita obstáculos con IA, compatible con Alexa y Google Home.', 799.99, 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800', 'Hogar', 10, true, true, 15);

-- Verificar inserción
SELECT COUNT(*) as total_productos FROM productos;
