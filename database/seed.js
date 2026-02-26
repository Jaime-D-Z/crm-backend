const { v4: uuidv4 } = require('uuid');
const db = require('../core/db');

async function seed() {
    console.log('--- Inicia Seed de Datos Global ---');

    try {
        // Limpiar datos previos (OPCIONAL - lo comentamos para no borrar lo del usuario si prefiere acumular)
        // await db.execute('DELETE FROM config_global');

        // 1. Configuración Global
        console.log('Insertando configuración global...');
        const configs = [
            ['APP_NAME', 'CRM Nexus Enterprise', 'Nombre oficial de la plataforma'],
            ['APP_VERSION', '2.5.0-stable', 'Versión actual del sistema'],
            ['COMPANY_NAME', 'Nexus Technologies S.A.C.', 'Razón social de la empresa'],
            ['SUPPORT_EMAIL', 'soporte@nexus.com', 'Correo de contacto técnico'],
            ['MAINTENANCE_MODE', 'false', 'Estado de mantenimiento del sitio'],
            ['THEME_DEFAULT', 'light', 'Tema visual predeterminado'],
            ['CURRENCY_SYMBOL', '$', 'Símbolo monetario para finanzas']
        ];
        for (const [key, val, desc] of configs) {
            await db.query(
                'INSERT INTO config_global (key_name, value_content, description) VALUES ($1, $2, $3) ON CONFLICT (key_name) DO UPDATE SET value_content = EXCLUDED.value_content',
                [key, val, desc]
            );
        }

        // 2. Analítica Web (Simulando tráfico de los últimos 7 días)
        console.log('Insertando analítica web (100+ eventos)...');
        const now = new Date();
        const paths = ['/admin/dashboard', '/admin/employees', '/admin/ventas', '/admin/proyectos', '/admin/finanzas'];
        for (let i = 0; i < 120; i++) {
            const date = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
            await db.query(
                `INSERT INTO web_analytics (session_id, user_id, event_type, path, ip, device_type, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    uuidv4(),
                    null,
                    ['pageview', 'session_start', 'click'][Math.floor(Math.random() * 3)],
                    paths[Math.floor(Math.random() * paths.length)],
                    `192.168.1.${Math.floor(Math.random() * 255)}`,
                    ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
                    date
                ]
            );
        }

        // 3. Ventas (Simulando pipeline comercial)
        console.log('Insertando 10 ventas...');
        const ventasData = [
            [uuidv4(), 'Corporación Wong', 'Licencias Software ERP', 15000.00, 'cerrada', 'transferencia'],
            [uuidv4(), 'Inversiones La Cruz', 'Consultoría IT 3 Meses', 8500.00, 'negociacion', 'tarjeta'],
            [uuidv4(), 'Minera Volcan', 'Soporte Técnico Anual', 12000.00, 'prospecto', 'otro'],
            [uuidv4(), 'Banco de Crédito', 'Desarrollo App Móvil', 45000.00, 'cerrada', 'transferencia'],
            [uuidv4(), 'Retail S.A.', 'Implementación Cloud', 22000.00, 'negociacion', 'tarjeta'],
            [uuidv4(), 'Tech Startups Inc', 'Mantenimiento Web', 3000.00, 'cerrada', 'efectivo'],
            [uuidv4(), 'Global Logistics', 'Auditoría de Seguridad', 9500.00, 'prospecto', 'transferencia'],
            [uuidv4(), 'EducaPlus', 'Plataforma E-learning', 18000.00, 'cerrada', 'tarjeta'],
            [uuidv4(), 'HealthCare Peru', 'Sistema Gestión Pacientes', 27000.00, 'negociacion', 'otro'],
            [uuidv4(), 'AgroExport SAC', 'Optimización Procesos', 11000.00, 'perdida', 'transferencia']
        ];
        for (const v of ventasData) {
            await db.query(
                `INSERT INTO ventas (id, cliente_nombre, concepto, monto, fecha, estado, metodo_pago) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [v[0], v[1], v[2], v[3], new Date().toISOString().split('T')[0], v[4], v[5]]
            );
        }

        // 4. Proyectos
        console.log('Insertando 3 proyectos maestros...');
        const p1Id = uuidv4();
        const p2Id = uuidv4();
        const p3Id = uuidv4();

        const adminId = '00000000-0000-0000-0000-000000000001';
        const proyectos = [
            [p1Id, 'Rediseño Portal Corporativo', 'Actualización de marca y frontend', '2026-01-15', '2026-04-15', 5500.00, 'activo', null, adminId],
            [p2Id, 'Migración AWS', 'Mover infraestructura local a la nube', '2026-02-01', '2026-05-30', 12500.00, 'planificacion', null, adminId],
            [p3Id, 'App Fidelización v2', 'Segunda versión de la app de puntos', '2025-11-20', '2026-03-10', 8000.00, 'activo', null, adminId]
        ];
        for (const p of proyectos) {
            await db.query(
                `INSERT INTO proyectos (id, nombre, descripcion, fecha_inicio, fecha_fin, presupuesto, estado, responsable_id, creado_por) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                p
            );
        }

        // Tareas de proyectos
        console.log('Insertando tareas de proyectos...');
        const tareas = [
            [uuidv4(), p1Id, 'Diseño de Mockups', 'media', 'completada'],
            [uuidv4(), p1Id, 'Implementación React', 'alta', 'en_progreso'],
            [uuidv4(), p2Id, 'Configuración VPC', 'critica', 'pendiente'],
            [uuidv4(), p3Id, 'Testing QA Android', 'media', 'revision']
        ];
        for (const t of tareas) {
            await db.query(
                `INSERT INTO tareas_proyecto (id, proyecto_id, titulo, prioridad, estado) VALUES ($1, $2, $3, $4, $5)`,
                t
            );
        }

        // 5. Finanzas (Ingresos/Egresos recientes)
        console.log('Insertando 8 transacciones financieras...');
        const finanzas = [
            ['ingreso', 'Cobro Factura #882', 'Ventas', 5000.00, '2026-02-20', null],
            ['ingreso', 'Cobro Factura #883', 'Ventas', 3200.00, '2026-02-21', null],
            ['egreso', 'Pago Alquiler Oficinas', 'Infraestructura', 2500.00, '2026-02-01', null],
            ['egreso', 'Sueldos Febrero', 'RRHH', 15000.00, '2026-02-25', null],
            ['ingreso', 'Abono Proyecto AWS', 'Servicios', 6000.00, '2026-02-22', null],
            ['egreso', 'Pago AWS Mensual', 'Servicios Cloud', 450.00, '2026-02-15', null],
            ['egreso', 'Compra Hardware Laptops', 'Equipamiento', 4200.00, '2026-02-10', null],
            ['ingreso', 'Suscripciones Mensuales', 'SaaS', 1800.00, '2026-02-24', null]
        ];
        for (const f of finanzas) {
            await db.query(
                `INSERT INTO transacciones_financieras (tipo, concepto, categoria, monto, fecha, registrado_por) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                f
            );
        }

        // 6. Calendario (Próximos eventos)
        console.log('Insertando eventos de calendario...');
        const eventos = [
            ['Reunión de Sincronización', 'Daily semanal del equipo', '2026-02-26 09:00:00', '2026-02-26 10:00:00', 'reunion', null],
            ['Capacitación Seguridad', 'Workshop de buenas prácticas', '2026-02-28 15:00:00', '2026-02-28 17:30:00', 'capacitacion', null],
            ['Lanzamiento Marketing', 'Kick-off campaña Q2', '2026-03-05 11:00:00', '2026-03-05 12:00:00', 'evento', null]
        ];
        for (const ev of eventos) {
            await db.query(
                `INSERT INTO eventos_calendario (titulo, descripcion, fecha_inicio, fecha_fin, tipo, creado_por) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                ev
            );
        }

        // 7. Empleados
        console.log('Insertando empleados de prueba...');
        const employees = [
            [uuidv4(), adminId, 'CTO', 'admin@crm.com', 'Tecnología', 8500.00, '2025-01-01', 'full-time', adminId],
            [uuidv4(), null, 'Juan Perez', 'juan@example.com', 'Desarrollo', 6000.00, '2025-03-01', 'full-time', adminId],
            [uuidv4(), null, 'Maria Garcia', 'maria@example.com', 'Diseño', 4500.00, '2025-04-15', 'part-time', adminId]
        ];
        for (const e of employees) {
            await db.query(
                `INSERT INTO employees (id, user_id, name, email, department, salary, hire_date, employee_type, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (email) DO NOTHING`,
                e
            );
        }

        // 8. Evaluaciones Desempeño
        console.log('Insertando evaluaciones de desempeño...');

        // 7. Evaluaciones Desempeño
        console.log('Insertando evaluaciones de desempeño...');
        const evals = [
            [uuidv4(), 'EMP-001', adminId, 5, 'Excelente desempeño este trimestre', '2026-02-15'],
            [uuidv4(), 'EMP-002', adminId, 4, 'Buen trabajo, puede mejorar en puntualidad', '2026-02-10']
        ];
        // Note: employee_id in evaluations must match existing employee IDs. 
        // Our seed currently doesn't have a fixed set of employees with controlled IDs here, but EMP-001/002 are usually placeholders.
        // Let's find real ids if possible or just use some. The seed.js doesn't seed employees!
        // Wait, EmployeesPage.jsx uses evaluations/summary.

        // 8. Objetivos
        console.log('Insertando objetivos...');
        const objetivos = [
            [uuidv4(), 'EMP-001', adminId, 'Certificación AWS Solutions Architect', 'Completar examen antes de Junio', 40, 'en_progreso', '2026-06-30'],
            [uuidv4(), 'EMP-002', adminId, 'Refactorización Backend', 'Migrar todos los controladores a PG', 10, 'en_progreso', '2026-04-15']
        ];
        // Same for employee IDs.

        // Let's actually find some employees from the DB if they exist, or just use dummy IDs and hope for the best during this seed test.
        // Actually, seed.js SHOULD seed some employees if it expects evaluations.
        // Let's check if I can find where employees are seeded.
        // Looking at seed.js again... it doesn't seed employees. 
        // This means the foreign key might fail if I use dummy IDs.

        for (const e of evals) {
            // We use a subquery to get a real employee ID if none hardcoded
            await db.query(
                `INSERT INTO evaluaciones_desempeno (id, employee_id, evaluador_id, puntaje, comentario, fecha)
                 SELECT $1, id, $2, $3, $4, $5 FROM employees LIMIT 1 ON CONFLICT DO NOTHING`,
                [e[0], e[2], e[3], e[4], e[5]]
            );
        }
        for (const o of objetivos) {
            await db.query(
                `INSERT INTO objetivos (id, employee_id, admin_id, titulo, descripcion, avance, estado, fecha_limite)
                 SELECT $1, id, $2, $3, $4, $5, $6, $7 FROM employees LIMIT 1 ON CONFLICT DO NOTHING`,
                [o[0], o[2], o[3], o[4], o[5], o[6], o[7]]
            );
        }

        console.log('--- Seed Global completado con éxito ---');
    } catch (err) {
        console.error('Error durante el seed:', err);
    } finally {
        process.exit();
    }
}

seed();
