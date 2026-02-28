const faceapi = require('@vladmandic/face-api');
const faceApiService = require('../services/faceApiService');
const Employee = require('../models/Employee');
const User = require('../models/User');

const MIN_SIMILARITY_THRESHOLD = 0.75; // 75%
const MAX_EUCLIDEAN_DISTANCE = 1.0 - MIN_SIMILARITY_THRESHOLD;
const MAX_ATTEMPTS = 3;

// Map para simular estado de bloqueos (en prod usar Redis/DB)
const securityLog = {};

async function verifyFace(req, res) {
    const { email, photo_url_base64 } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!email || !photo_url_base64) {
        return res.status(400).json({ error: 'Faltan datos requeridos (email y foto).' });
    }

    try {
        // 1. Check IP block
        if (securityLog[ip] && securityLog[ip].blocked) {
            const timePassed = Date.now() - securityLog[ip].blockedAt;
            if (timePassed < 15 * 60 * 1000) { // 15 mins block
                return res.status(403).json({
                    error: 'IP bloqueada temporalmente por intentos fallidos.',
                    blocked: true
                });
            } else {
                delete securityLog[ip]; // unblock
            }
        }

        // 2. Fetch Employee descriptor
        const employee = await Employee.findByEmail(email);

        if (!employee) {
            return res.status(404).json({ error: 'Empleado no encontrado.' });
        }

        if (!employee.face_descriptor) {
            return res.status(400).json({ error: 'Este empleado no tiene datos biométricos registrados.' });
        }

        const registeredDescriptor = new Float32Array(employee.face_descriptor);

        // 3. Process new photo
        const currentDescriptorArray = await faceApiService.getFaceDescriptorFromBase64(photo_url_base64);
        const currentDescriptor = new Float32Array(currentDescriptorArray);

        // 4. Calculate Distance
        // faceapi.euclideanDistance(vec1, vec2)
        const distance = faceapi.euclideanDistance(registeredDescriptor, currentDescriptor);
        const similarity = Math.max(0, 100 - (distance * 100)); // Para mostrar en el response

        if (distance <= MAX_EUCLIDEAN_DISTANCE) {
            // Success!
            if (securityLog[ip]) delete securityLog[ip];

            // Notify Admin
            const io = req.app.get('io');
            if (io) {
                io.emit('alerta_seguridad', {
                    type: 'success',
                    message: `Acceso facial exitoso: ${employee.name}`,
                    similarity: similarity.toFixed(1),
                    time: new Date()
                });
            }

            return res.json({
                ok: true,
                message: 'Verificación biométrica exitosa.',
                similarity: similarity.toFixed(1),
                employee: { id: employee.id, name: employee.name }
            });
        } else {
            // Failed
            if (!securityLog[ip]) securityLog[ip] = { attempts: 0 };
            securityLog[ip].attempts++;

            const isBlocked = securityLog[ip].attempts >= MAX_ATTEMPTS;
            if (isBlocked) {
                securityLog[ip].blocked = true;
                securityLog[ip].blockedAt = Date.now();
            }

            // Notify Admin in real-time
            const io = req.app.get('io');
            if (io) {
                io.emit('alerta_seguridad', {
                    type: isBlocked ? 'critical' : 'warning',
                    message: isBlocked ? `IP ${ip} bloqueada por múltiples intentos fallidos.` : `Fallo de verificación facial para ${email}`,
                    similarity: similarity.toFixed(1),
                    time: new Date()
                });
            }

            return res.status(401).json({
                error: isBlocked
                    ? 'Bloqueo automático: Ha superado los intentos de verificación facial.'
                    : `Verificación fallida (${securityLog[ip].attempts}/${MAX_ATTEMPTS} intentos).`,
                similarity: similarity.toFixed(1),
                blocked: isBlocked
            });
        }

    } catch (err) {
        console.error('Face verification error:', err);
        res.status(500).json({ error: 'Error del servidor procesando biométricos: ' + err.message });
    }
}

module.exports = {
    verifyFace
};
