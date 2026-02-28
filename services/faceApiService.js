const canvas = require('canvas');
const faceapi = require('@vladmandic/face-api');
const path = require('path');
const fs = require('fs');

// Patch nodejs environment
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

async function initFaceApi() {
    if (modelsLoaded) return;
    try {
        const modelsPath = path.join(__dirname, '..', 'public', 'models');

        // Ensure models directory exists
        if (!fs.existsSync(modelsPath)) {
            console.log("No se encontró la carpeta models, creando...");
            fs.mkdirSync(modelsPath, { recursive: true });
        }

        await faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);

        modelsLoaded = true;
        console.log('✅ Face API Models loaded in Node.js');
    } catch (err) {
        console.error('❌ Error loading Face API Models:', err);
        // We'll ignore the error here if models don't exist yet, to not crash the server on boot
    }
}

async function getFaceDescriptorFromBase64(base64Image) {
    // Check if models are loaded
    if (!modelsLoaded) {
        await initFaceApi();
    }

    // If still not loaded, throw error
    if (!modelsLoaded) {
        throw new Error('Los modelos de reconocimiento facial no están disponibles. Por favor, ejecuta: node scripts/download-face-models.js');
    }

    // Extraer datos base64
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // Crear imagen compatible con face-api
    const img = await canvas.loadImage(buffer);

    // Detectar rostro y extraer descriptor usando TinyFaceDetector por rendimiento
    const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        throw new Error('No se detectó ningún rostro válido en la imagen proporcionada.');
    }

    // Convertir de Float32Array a Array normal para Guardarlo en DB (JSON o Array de PostgreSQL)
    return Array.from(detection.descriptor);
}

function areModelsLoaded() {
    return modelsLoaded;
}

module.exports = {
    initFaceApi,
    getFaceDescriptorFromBase64,
    areModelsLoaded
};
