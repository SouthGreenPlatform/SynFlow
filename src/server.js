
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const app = express();

const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir));

const keyPath = process.env.SYNFLOW_SSL_KEY;
const certPath = process.env.SYNFLOW_SSL_CERT;
const caPath = process.env.SYNFLOW_SSL_CA;

let server;
if (keyPath && certPath) {
    try {
        const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        };
    if (caPath) {
        options.ca = fs.readFileSync(caPath);
        }
        server = https.createServer(options, app);
        console.log('Starting SynFlow server in HTTPS mode.');
    } catch (error) {
        console.warn('Failed to load TLS certificates, falling back to HTTP.', error);
    }
    }

    if (!server) {
    server = http.createServer(app);
    console.log('Starting SynFlow server in HTTP mode.');
    }

    const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

const configFilePath = process.env.CONFIG_FILE_PATH || path.resolve(__dirname, '../public/data/config.json');
const configUrlsEnv = process.env.CONFIG_URLS;
if (configUrlsEnv) {
    let urls = [];
    try {
        const parsed = JSON.parse(configUrlsEnv);
        if (Array.isArray(parsed)) {
            urls = parsed;
        }
    } catch (error) {
        urls = configUrlsEnv.split(',').map((entry) => entry.trim()).filter(Boolean);
    }

    if (urls.length > 0) {
        fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
        fs.writeFileSync(configFilePath, JSON.stringify(urls, null, 4));
        console.log(`Update configuration file: ${configFilePath}`);
    } else {
        console.warn("CONFIG_URLS is define but URL is not valid. Keep existing config file.");
    }
}
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('clientInfo', (data) => {
        if (data && data.url) {
        console.log(`Client connected from: ${data.url}`);
        }
    });

    socket.on('sendData', (data) => {
        io.emit('receiveData', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
    console.log(`SynFlow server is running on port ${port}`);
});