const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');

// URLs correctas desde el CDN de face-api
const models = [
    {
        name: 'tiny_face_detector_model-weights_manifest.json',
        url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/tiny_face_detector_model-weights_manifest.json'
    },
    {
        name: 'tiny_face_detector_model-shard1',
        url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/tiny_face_detector_model-shard1'
    },
    {
        name: 'face_landmark_68_model-weights_manifest.json',
        url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model-weights_manifest.json'
    },
    {
        name: 'face_landmark_68_model-shard1',
        url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model-shard1'
    },
    {
        name: 'face_recognition_model-weights_manifest.json',
        url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_recognition_model-weights_manifest.json'
    },
    {
        name: 'face_recognition_model-shard1',
        url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_recognition_model-shard1'
    }
];

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            } else if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                file.close();
                fs.unlinkSync(dest);
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            } else {
                file.close();
                fs.unlinkSync(dest);
                reject(new Error(`Failed to download: ${response.statusCode}`));
            }
        }).on('error', (err) => {
            file.close();
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function downloadModels() {
    console.log('📦 Descargando modelos de Face-API desde CDN...\n');
    
    // Crear directorio si no existe
    if (!fs.existsSync(MODELS_DIR)) {
        fs.mkdirSync(MODELS_DIR, { recursive: true });
        console.log(`✅ Directorio creado: ${MODELS_DIR}\n`);
    }

    let successCount = 0;
    let errorCount = 0;

    for (const model of models) {
        const dest = path.join(MODELS_DIR, model.name);
        
        // Skip if already exists
        if (fs.existsSync(dest)) {
            const stats = fs.statSync(dest);
            console.log(`⏭️  Ya existe: ${model.name} (${(stats.size / 1024).toFixed(2)} KB)`);
            successCount++;
            continue;
        }

        try {
            console.log(`⬇️  Descargando: ${model.name}...`);
            await downloadFile(model.url, dest);
            const stats = fs.statSync(dest);
            console.log(`✅ Descargado: ${model.name} (${(stats.size / 1024).toFixed(2)} KB)`);
            successCount++;
        } catch (err) {
            console.error(`❌ Error descargando ${model.name}:`, err.message);
            errorCount++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`🎉 Proceso completado!`);
    console.log(`✅ Exitosos: ${successCount}/${models.length}`);
    if (errorCount > 0) {
        console.log(`❌ Errores: ${errorCount}/${models.length}`);
    }
    console.log(`📁 Modelos guardados en: ${MODELS_DIR}`);
    console.log('='.repeat(60));

    if (successCount === models.length) {
        console.log('\n✨ Todos los modelos descargados correctamente!');
        console.log('🔄 Reinicia el backend: pm2 restart crm-backend');
    } else {
        console.log('\n⚠️  Algunos modelos no se descargaron. Intenta de nuevo.');
    }
}

downloadModels().catch(console.error);
