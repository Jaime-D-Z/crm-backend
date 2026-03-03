-- ============================================================
-- ROLLBACK: E-COMMERCE - PRODUCTOS Y ANALYTICS
-- Fecha: 2026-03-03
-- Descripción: Revierte la migración de productos
-- USAR SOLO SI NECESITAS DESHACER LOS CAMBIOS
-- ============================================================

-- ⚠️ ADVERTENCIA: Este script eliminará las tablas y datos
-- Solo ejecutar si realmente necesitas revertir la migración

BEGIN;

-- 1. Eliminar tabla de eventos (primero por FK)
DROP TABLE IF EXISTS eventos_productos CASCADE;
COMMENT ON SCHEMA public IS 'Tabla eventos_productos eliminada';

-- 2. Eliminar tabla de productos
DROP TABLE IF EXISTS productos CASCADE;
COMMENT ON SCHEMA public IS 'Tabla productos eliminada';

-- 3. Eliminar permisos
DELETE FROM roles_permisos 
WHERE permiso_id IN (
    SELECT id FROM permisos WHERE modulo = 'Productos'
);

DELETE FROM permisos WHERE modulo = 'Productos';

-- 4. Eliminar función de trigger
DROP FUNCTION IF EXISTS update_productos_updated_at() CASCADE;

COMMIT;

-- Verificación
SELECT 'Rollback completado' AS status;
SELECT COUNT(*) AS productos_restantes FROM information_schema.tables WHERE table_name = 'productos';
SELECT COUNT(*) AS eventos_restantes FROM information_schema.tables WHERE table_name = 'eventos_productos';
