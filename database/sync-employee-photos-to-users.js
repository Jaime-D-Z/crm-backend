const { pool } = require('../core/db');

async function syncPhotos() {
    try {
        console.log('🔄 Sincronizando fotos y descriptores de employees a users...\n');
        
        // Get all employees with photos that have linked users
        const result = await pool.query(`
            SELECT e.id as employee_id, e.user_id, e.photo_url, e.face_descriptor, e.name, e.email
            FROM employees e
            WHERE e.user_id IS NOT NULL
              AND (e.photo_url IS NOT NULL OR e.face_descriptor IS NOT NULL)
        `);

        if (result.rows.length === 0) {
            console.log('ℹ️  No hay empleados con fotos para sincronizar');
            process.exit(0);
        }

        console.log(`📋 Encontrados ${result.rows.length} empleados con fotos:\n`);

        let updated = 0;
        let skipped = 0;

        for (const emp of result.rows) {
            // Check if user already has photo
            const userCheck = await pool.query(
                'SELECT photo_url, face_descriptor FROM users WHERE id = $1',
                [emp.user_id]
            );

            if (userCheck.rows.length === 0) {
                console.log(`⚠️  Usuario ${emp.user_id} no encontrado para empleado ${emp.name}`);
                skipped++;
                continue;
            }

            const user = userCheck.rows[0];

            // Only update if user doesn't have photo/descriptor
            if (!user.photo_url && !user.face_descriptor) {
                await pool.query(
                    `UPDATE users SET photo_url = $1, face_descriptor = $2 WHERE id = $3`,
                    [emp.photo_url, emp.face_descriptor, emp.user_id]
                );
                console.log(`✅ ${emp.name} (${emp.email})`);
                console.log(`   Foto: ${emp.photo_url || 'N/A'}`);
                console.log(`   Descriptor: ${emp.face_descriptor ? 'Sí' : 'No'}\n`);
                updated++;
            } else {
                console.log(`⏭️  ${emp.name} - Usuario ya tiene foto/descriptor\n`);
                skipped++;
            }
        }

        console.log('='.repeat(60));
        console.log(`✅ Sincronización completada!`);
        console.log(`   Actualizados: ${updated}`);
        console.log(`   Omitidos: ${skipped}`);
        console.log('='.repeat(60));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error sincronizando fotos:', error);
        process.exit(1);
    }
}

syncPhotos();
