const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');
const BASE_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';

const models = [
    // Tiny Face Detector
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    
    // Face Landmark 68
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    
    // Face Recognition
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
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
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            } else {
                reject(new Error(`Failed to download: ${response.statusCode}`));
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function downloadModels() {
    console.log('📦 Descargando modelos de Face-API...\n');
    
    // Crear directorio si no existe
    if (!fs.existsSync(MODELS_DIR)) {
        fs.mkdirSync(MODELS_DIR, { recursive: true });
        console.log(`✅ Directorio creado: ${MODELS_DIR}\n`);
    }

    for (const model of models) {
        const url = `${BASE_URL}/${model}`;
        const dest = path.join(MODELS_DIR, model);
        
        // Skip if already exists
        if (fs.existsSync(dest)) {
            console.log(`⏭️  Ya existe: ${model}`);
            continue;
        }

        try {
            console.log(`⬇️  Descargando: ${model}...`);
            await downloadFile(url, dest);
            console.log(`✅ Descargado: ${model}`);
        } catch (err) {
            console.error(`❌ Error descargando ${model}:`, err.message);
        }
    }

    console.log('\n🎉 Descarga completada!');
    console.log(`📁 Modelos guardados en: ${MODELS_DIR}`);
}

downloadModels().catch(console.error);
