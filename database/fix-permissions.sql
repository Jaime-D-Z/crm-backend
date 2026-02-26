-- Fix missing permissions for new modules
-- Run this script if you're getting 403 Forbidden errors

-- Add missing modules
INSERT IGNORE
INTO permisos
(modulo, accion, label) VALUES
('Asistencia', 'ver', 'Asistencia > ver'),
('Asistencia', 'crear', 'Asistencia > crear'),
('Asistencia', 'editar', 'Asistencia > editar'),
('Asistencia', 'eliminar', 'Asistencia > eliminar'),

('Proyectos', 'ver', 'Proyectos > ver'),
('Proyectos', 'crear', 'Proyectos > crear'),
('Proyectos', 'editar', 'Proyectos > editar'),
('Proyectos', 'eliminar', 'Proyectos > eliminar'),

('Ventas', 'ver', 'Ventas > ver'),
('Ventas', 'crear', 'Ventas > crear'),
('Ventas', 'editar', 'Ventas > editar'),
('Ventas', 'eliminar', 'Ventas > eliminar'),

('Finanzas', 'ver', 'Finanzas > ver'),
('Finanzas', 'crear', 'Finanzas > crear'),
('Finanzas', 'editar', 'Finanzas > editar'),
('Finanzas', 'eliminar', 'Finanzas > eliminar'),

('Notificaciones', 'ver', 'Notificaciones > ver'),
('Notificaciones', 'crear', 'Notificaciones > crear'),

('Calendario', 'ver', 'Calendario > ver'),
('Calendario', 'crear', 'Calendario > crear'),
('Calendario', 'editar', 'Calendario > editar'),

('Analitica', 'ver', 'Analítica Web > ver'),
('Analitica', 'exportar', 'Analítica Web > exportar');

-- Grant DEFAULT permissions to admin_rrhh role for all new modules
-- Get admin_rrhh role ID
SET @admin_rrhh_id = (SELECT id
FROM roles
WHERE nombre = 'admin_rrhh'
LIMIT 1);
SET @super_admin_id = (SELECT id
FROM roles
WHERE nombre = 'super_admin'
LIMIT 1);

-- Add admin_rrhh permissions
INSERT IGNORE
INTO roles_permisos
(role_id, permiso_id)
SELECT @admin_rrhh_id, id
FROM permisos
WHERE modulo IN ('Asistencia', 'Proyectos', 'Ventas', 'Finanzas', 'Notificaciones', 'Calendario', 'Analitica') AND accion IN ('ver', 'crear', 'editar');

-- Add super_admin permissions (full access)
INSERT IGNORE
INTO roles_permisos
(role_id, permiso_id)
SELECT @super_admin_id, id
FROM permisos
WHERE modulo IN ('Asistencia', 'Proyectos', 'Ventas', 'Finanzas', 'Notificaciones', 'Calendario', 'Analitica');

-- Verify permissions were added
SELECT 'Permissions summary after fix:' as 'Info';
SELECT modulo, COUNT(*) as total_permissions
FROM permisos
GROUP BY modulo
ORDER BY modulo;
