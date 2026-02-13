const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const app = express();

const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

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
if (process.env.CONFIG_FILE_PATH) {
    if (fs.existsSync(configFilePath)) {
        console.log(`Using existing configuration file: ${configFilePath}`);
        try {
            const existingConfig = fs.readFileSync(configFilePath, 'utf8');
            const parsed = JSON.parse(existingConfig);
            console.log(`Loaded configuration with ${parsed.length} organism(s)`);
        } catch (error) {
            console.error(`Failed to read existing config file: ${error.message}`);
        }
    } else {
        console.warn(`No CONFIG_URLS provided and no existing config file found at: ${configFilePath}`);
    }
} else {
    // CONFIG_URLS est défini, utilisons cette logique (code existant) 
    let configData = [];
    try {
        const parsed = JSON.parse(configUrlsEnv);
        if (Array.isArray(parsed)) {
            // Format tableau d'objets {organism, url, useProxy?} ou ancien format tableau simple
            if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].organism && parsed[0].url) {
                // Nouveau format : tableau d'objets
                configData = parsed;
            } else if (typeof parsed[0] === 'string') {
                // Ancien format : tableau simple d'URLs
                configData = parsed.map((url, index) => ({
                    organism: `organism_${index}`,
                    url: url,
                    useProxy: false
                }));
            }
        }
    } catch (error) {
        // Format chaîne séparée par virgules
		const urls = (configUrlsEnv || "")
  			.split(',')
  			.map((entry) => entry.trim())
  			.filter(Boolean);

        if (urls.length > 0) {
            configData = urls.map((url, index) => ({
                organism: `organism_${index}`,
                url: url,
                useProxy: false
            }));
        }
    }

    if (configData.length > 0) {
        fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
        fs.writeFileSync(configFilePath, JSON.stringify(configData, null, 4));
        console.log(`Update configuration file: ${configFilePath}`);
    } else {
        console.warn("CONFIG_URLS is define but URL is not valid. Keep existing config file.");
    }
}


/////////////////////////// fonctions

// Fonction pour obtenir l'heure et la date actuelles au format lisible
function getCurrentTimestamp() {
    const now = new Date();
    return now.toLocaleString(); // Format: "jj/mm/aaaa, hh:mm:ss"
}

// Middleware qui génère un identifiant unique par lot
function assignUploadId(req, res, next) {
    if (!req.uploadId) {
        req.uploadId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    }
    next();
}

function isSafePath(p) {
    if (typeof p !== 'string') return false;
    // Pas de retours à la ligne, pas de ;
    if (/[;\n\r`$]/.test(p)) return false;
    // Pas de chemins relatifs dangereux
    if (p.includes('..')) return false;
    //check extension
    const allowedExtensions = ['.txt', '.fasta', '.tsv', '.bed', '.gff', '.gff3', '.out', '.anchors', '.fa', '.fna', '.faa', '.json'];
    if (!allowedExtensions.some(ext => p.endsWith(ext))) return false;
    return true;
}

function isSafeValue(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 100) return false;

    // Blocage des métacaractères du shell
    const dangerous = [';', '|', '&', '$', '`', '>', '<', '(', ')', '{', '}', '\\', '"', "'"];
    if (dangerous.some(ch => value.includes(ch))) return false;

    // Évite les ../ etc.
    if (value.includes('..')) return false;

    return true;
}

// .______        ______    __    __  .___________. _______     _______.
// |   _  \      /  __  \  |  |  |  | |           ||   ____|   /       |
// |  |_)  |    |  |  |  | |  |  |  | `---|  |----`|  |__     |   (----`
// |      /     |  |  |  | |  |  |  |     |  |     |   __|     \   \    
// |  |\  \----.|  `--'  | |  `--'  |     |  |     |  |____.----)   |   
// | _| `._____| \______/   \______/      |__|     |_______|_______/    
                                                                     
// Validation du contenu réel d'un fichier uploadé
// Vérifie que les premiers octets correspondent au format attendu (par extension)
function validateFileContent(filePath, originalName) {

    //Vérif originalName
    if (!originalName || typeof originalName !== 'string') {
        logToFile(`Rejet: originalName manquant (${originalName})`);
        return false;
    }
    
    const ext = path.extname(originalName).toLowerCase();
    
    let head;
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(4096);
        const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
        fs.closeSync(fd);
        head = buf.toString('utf8', 0, bytesRead);
    } catch (e) {
        logToFile(`Erreur lecture head ${originalName}: ${e.message}`, uploadId);
        return false;
    }

    // Patterns dangereux
    const dangerousPatterns = /<script|javascript:|eval\s*\(|import\s+|require\s*\(|exec\s*\(/i;
    if (dangerousPatterns.test(head)) {
        logToFile(`Rejet malveillant: ${originalName}`, uploadId);
        return false;
    }

    const trimmed = head.trim();

    switch (ext) {
        case '.fasta': case '.fa': case '.fna': case '.faa':
            if (!/^>/.test(trimmed)) return false;
            break;
        case '.gff': case '.gff3':
            if (!/^(##gff-version|#)/.test(trimmed) && !/^\S+\t\S+\t/.test(trimmed)) return false;
            break;
        case '.bed': case '.tsv': case '.txt':
            {
                const lines = trimmed.split('\n').filter(l => l.trim() && !l.startsWith('#'));
                if (lines.length > 0 && !lines[0].includes('\t')) return false;
            }
            break;
        case '.json':
            try { JSON.parse(fs.readFileSync(filePath, 'utf8')); }
            catch { return false; }
            break;
        case '.anchors': case '.out':
            break;  // OK par défaut
    }
    return true;
}

// Configuration de multer pour gérer les fichiers
const multer = require('multer'); //upload des fichiers

const allowedUploadExtensions = [
    '.txt', '.fasta', '.tsv', '.bed', '.gff', '.gff3',
    '.out', '.anchors', '.fa', '.fna', '.faa', '.json'
];

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '/var/www/html/synflow/data/comparisons/');
    },
	filename: function (req, file, cb) {
		const prefix = req.uploadId || Date.now();
		
		// Protection originalname
		const safeName = (file.originalname || 'unknown')
			.replace(/[^a-zA-Z0-9._-]/g, '_')
			.substring(0, 100);
		
		cb(null, `${prefix}_${safeName}`);
	}
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024,  // 500MB max
        files: 20,                    // max 20 fichiers
        fieldSize: 10 * 1024          // 10KB max champ texte
    },
    fileFilter: (req, file, cb) => {

		const allowedUploadExtensions = ['.txt', '.fasta', '.tsv', '.bed', '.gff', '.gff3','.out', '.anchors', '.fa', '.fna', '.faa', '.json'];

		const ext = path.extname(file.originalname).toLowerCase();
		if (!allowedUploadExtensions.includes(ext)) {
            return cb(new Error(`Extension non autorisée: ${ext}`), false);
        }
        // Bloquer les noms de fichier contenant des caractères dangereux
        if (/[;\n\r`$|&<>(){}\\]/.test(file.originalname)) {
            return cb(new Error('Nom de fichier invalide'), false);
        }
        cb(null, true);
    }
});


// Route POST pour gérer l'upload de fichiers et les paramètres texte
app.post('/upload', assignUploadId, upload.any(), (req, res) => {
    console.log('Upload ID:', req.uploadId);

	// Validation du contenu de chaque fichier uploadé
    const rejected = [];
    for (const file of req.files) {
        if (!validateFileContent(file.path, file.originalname)) {
            rejected.push(file.originalname);
            // Supprimer le fichier rejeté du disque
            try { fs.unlinkSync(file.path); } catch { /* ignore */ }
        }
    }
    if (rejected.length > 0) {
        // Supprimer aussi les fichiers valides de ce lot (tout ou rien)
        for (const file of req.files) {
            try { fs.unlinkSync(file.path); } catch { /* already deleted or ignore */ }
        }
        return res.status(400).json({
            error: `Contenu invalide pour : ${rejected.join(', ')}. Formats attendus : FASTA, GFF3, BED, TSV, JSON, etc.`
        });
    }

    const uploadedFiles = req.files.map(file => ({
        fieldname: file.fieldname,
        originalname: file.originalname, // nom original utile pour mapping
        filename: file.filename,         // nom stocké avec prefix
        path: file.path
    }));

    const params = req.body;

    console.log('Fichiers uploadés:', uploadedFiles);
    console.log('Paramètres texte:', params);

    res.json({
        message: 'Fichiers et paramètres envoyés avec succès',
        files: uploadedFiles,
        params: params
    });
});

//Error handler Multer + Socket.IO
uploadRouter.use((error, req, res, next) => {
    if (!req.uploadId) {
        req.uploadId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    }
    
    // Multer errors (taille, type, etc.)
    if (error instanceof multer.MulterError) {
        const messages = {
            'LIMIT_FILE_SIZE': 'File too large (max 500MB)',
            'LIMIT_FILE_COUNT': 'Too many files (max 20)',
            'LIMIT_FIELD_SIZE': 'Text parameters too long',
            'LIMIT_UNEXPECTED_FILE': 'Unexpected file type'
        };
        
        const message = messages[error.code] || `Multer error: ${error.code}`;
        
        logToFile(`Multer error ${error.code}: ${message}`, req.uploadId);
        
        // Note: req.socket n'existe pas, on utilise une approche différente
        res.status(400).json({
            error: 'Upload failed',
            message: message,
            uploadId: req.uploadId
        });
        return;
    }
    
    // Erreurs validateFileContent
    if (error.message && error.message.includes('Invalid content')) {
        logToFile(`Invalid content: ${error.message}`, req.uploadId);
        res.status(400).json({
            error: 'Invalid content',
            message: error.message,
            uploadId: req.uploadId
        });
        return;
    }
    
    // Autres erreurs
    logToFile(`Upload error: ${error.message}`, req.uploadId);
    res.status(500).json({
        error: 'Server error',
        message: error.message,
        uploadId: req.uploadId
    });
});


io.on('connection', socket => {
	console.log( `\n\nNouveau visiteur : *** ${socket.id}` );

    //infos de connection
    socket.on('clientInfo', data => {
        const clientIp = socket.handshake.address;
        const userAgent = socket.handshake.headers['user-agent'];
        const cookies = socket.handshake.headers['cookie'];
        console.log(`Le client s'est connecté depuis l'URL : ${data.url}, IP : ${clientIp}, User-Agent : ${userAgent}, Cookies : ${cookies}`);
    });


// .___________.  ______     ______    __       __  ___  __  .___________.
// |           | /  __  \   /  __  \  |  |     |  |/  / |  | |           |
// `---|  |----`|  |  |  | |  |  |  | |  |     |  '  /  |  | `---|  |----`
//     |  |     |  |  |  | |  |  |  | |  |     |    <   |  |     |  |     
//     |  |     |  `--'  | |  `--'  | |  `----.|  .  \  |  |     |  |     
//     |__|      \______/   \______/  |_______||__|\__\ |__|     |__|     
                                                                       
    //repertoire de travail pour toolkit
    const toolkitWorkingPath = '/var/www/html/synflow/data/comparisons/';
    const toolkitAnalysisDir = toolkitWorkingPath + 'toolkit_' + socket.id +'/';
    fs.mkdirSync(toolkitAnalysisDir);

    const path = require('path');  // Utilisé pour extraire le nom de fichier
    
    // Récupérer les fichiers de sortie dans le repertoire d'analyse
    // paramètre : toolkitID (ex: toolkit_123456789)
    socket.on('getToolkitFiles', (toolkitID) => {
        console.log('Getting toolkit files for ID:', toolkitID);
        const dir = toolkitWorkingPath +'/'+ toolkitID + '/';
        //recupère la liste des fichiers dans le repertoire d'analyse
        fs.readdir(dir, (err, files) => {
            if (err) {
                console.error(`Erreur lors de la lecture du répertoire : ${err}`);
                socket.emit('consoleMessage', `Erreur lors de la lecture du répertoire : ${err}`);
                return;
            }
            console.log(`Fichiers dans le répertoire d'analyse : ${files}`);
            // Filtrer les fichiers pour ne garder que ceux qui ont l'extension .out
            // Liste des extensions d'intérêt
            const validExtensions = ['.out', '.bed', '.anchors'];

            const outputFiles = files.filter(file =>
                validExtensions.some(ext => file.endsWith(ext))
            );
            if (outputFiles.length > 0) {
                // Si des fichiers de sortie sont trouvés, les envoyer au client
                const outputFilePaths = outputFiles.map(file => path.join(dir, file));
                console.log(`Fichiers de sortie trouvés : ${outputFilePaths}`);
                socket.emit('toolkitFilesResults', outputFilePaths);
            } else {
                console.log('Aucun fichier de sortie trouvé.');
                socket.emit('consoleMessage', 'Aucun fichier de sortie trouvé.');
            }
        });
    });

    
    // .______       __    __  .__   __. 
    // |   _  \     |  |  |  | |  \ |  | 
    // |  |_)  |    |  |  |  | |   \|  | 
    // |      /     |  |  |  | |  . `  | 
    // |  |\  \----.|  `--'  | |  |\   | 
    // | _| `._____| \______/  |__| \__| 
                                  
    // Gestion générique pour n'importe quel service
    socket.on('runService', (serviceName, serviceData, formData) => {
        console.log(`[${getCurrentTimestamp()}] Lancement du service : ${serviceName}`);
        console.log('formData:', formData);
        console.log('serviceData:', serviceData);
        console.log(`service : ${serviceData.service}`)

        // Récupérer les fichiers et les paramètres depuis la requête
        const uploadedFiles = formData.files;  // Les fichiers uploadés via multer
        const params = formData.params;        // Les paramètres texte (comme la base de données sélectionnée)
        let launchCommand ='';

        //  __        ______     ______     ___       __         .______       __    __  .__   __. 
        // |  |      /  __  \   /      |   /   \     |  |        |   _  \     |  |  |  | |  \ |  | 
        // |  |     |  |  |  | |  ,----'  /  ^  \    |  |        |  |_)  |    |  |  |  | |   \|  | 
        // |  |     |  |  |  | |  |      /  /_\  \   |  |        |      /     |  |  |  | |  . `  | 
        // |  `----.|  `--'  | |  `----./  _____  \  |  `----.   |  |\  \----.|  `--'  | |  |\   | 
        // |_______| \______/   \______/__/     \__\ |_______|   | _| `._____| \______/  |__| \__| 

        //Opal = local dans docker
        if(serviceData.service == "opal"){

            // Fonction pour construire la commande de lancement Opal
    // buildOpalLaunchCommand (code original)
        function buildOpalLaunchCommand(serviceData, uploadedFiles, params) {
            const { url, action, arguments: argmts } = serviceData;
            const inputs = argmts.inputs;
            if (!inputs) throw new Error("Les 'inputs' ne sont pas définis");

            let aArgs = "";
            let filePaths = [];

            inputs.forEach(input => {
                logToFile(`Input: ${input.name} type ${input.type} flag ${input.flag}`, socket.id);
                if (input.flag) {
                if (input.type !== "file" && input.type !== "file[]") {
                    const value = params[input.name];
                    if (value && value !== "") aArgs += ` ${input.flag} ${value}`;
                }
                }
                if (input.type === "file" || input.type === "file[]") {
                const matchingFiles = uploadedFiles.filter(file => file.fieldname === input.name);
                matchingFiles.forEach(file => {
                    if (file && file.path) {
                    filePaths.push(file.path);
                    const fileName = path.basename(file.path);
                    aArgs += ` ${input.flag} ${fileName}`;
                    }
                });
                }
            });

            const args = ['-r', action, '-l', url];
            if (aArgs.trim()) args.push('-a', aArgs.trim());
            filePaths.forEach(filePath => args.push('-f', filePath));

            return {
                binary: 'python2',
                args: ['/opt/OpalPythonClient/opal-py-2.4.1/GenericServiceClient.py', ...args]
            };
        }

            // nettoie les paramètres pour éviter les injections de commandes
            Object.keys(params || {}).forEach(key => {
            const val = params[key];
            if (!isSafeValue(val)) {
                console.warn(`Paramètre rejeté (dangereux) ${key}=${val}`);
                delete params[key];
            }
            });


            // Générer la commande de lancement
            launchCommand = buildOpalLaunchCommand(serviceData, uploadedFiles, params);
            console.log(`Commande générée : ${launchCommand}`);
            socket.emit('consoleMessage', launchCommand);

            // __________   ___  _______   ______ 
            // |   ____\  \ /  / |   ____| /      |
            // |  |__   \  V  /  |  |__   |  ,----'
            // |   __|   >   <   |   __|  |  |     
            // |  |____ /  .  \  |  |____ |  `----.
            // |_______/__/ \__\ |_______| \______|                  
            // Exécuter la commande
            execFile(launchInfo.binary, launchInfo.args, (error, stdout, stderr) => {

                if (error) {
                    console.error(`Erreur d'exécution : ${error}`);
                    socket.emit('consoleMessage', `Erreur : ${error}`);
                    return;
                }

                console.log(`stdout: ${stdout}`);
                socket.emit('consoleMessage', 'Lancement en cours...');
                socket.emit('consoleMessage', `Sortie :\n ${stdout}`);

                //verifie le fichier de log pour récupérer les sortie quand elle sont disponibles.
                function getUuidFromCommand(launchCommand) {
                    const match = launchCommand.match(/-u\s+([a-f0-9-]+)/i);
                    return match ? match[1] : null;
                }
                const uuid = getUuidFromCommand(launchCommand);
                console.log('UUID:', uuid);

                const logPath = path.join(toolkitWorkingPath, uuid, 'stdout.txt');
                console.log(logPath);
                
                //revoie toolkitAnalysisDir au client pour générer une url d'accès aux resultats
                socket.emit('toolkitPath', toolkitAnalysisDir);

                let lastLogLength = 0; // Variable pour suivre la taille précédente du log

                function waitForOutputFiles(logPath, outputExtensions, callback) {
                    const fs = require('fs');
                    const path = require('path');

                    function checkLog() {
                        fs.readFile(logPath, 'utf8', (err, data) => {
                            if (err) {
                                if (err.code === 'ENOENT') {
                                    setTimeout(checkLog, 500);
                                    return;
                                }
                                callback(err);
                                return;
                            }
                            processLogData(data);
                        });
                    }

                    function processLogData(data) {
                        if (data.length > lastLogLength) {
                            const newContent = data.substring(lastLogLength);
                            lastLogLength = data.length;
                            newContent.split('\n').forEach(line => {
                                if (line.trim() !== '') {
                                    console.log(`${line}`);
                                    socket.emit('consoleMessage', `${line}`);
                                }
                            });
                        }

                        // Recherche de la section d'output
                        const outputSection = data.split('\n').find(line =>
                            line.includes("Checking expected output files:")
                        );

                        if (outputSection) {
                            // Vérifie la présence de fichiers correspondant aux extensions dans le dossier local
                            const outputDir = path.dirname(logPath);

                            fs.readdir(outputDir, (err, files) => {
                                if (err) {
                                    console.error('Erreur lecture dossier output:', err);
                                    callback(err);
                                    return;
                                }

                                const matchingFiles = files.filter(f =>
                                    outputExtensions.some(ext => f.endsWith(ext))
                                );

                                if (matchingFiles.length > 0) {
                                    console.log(`Fichiers de sortie détectés :`, matchingFiles);
                                    socket.emit('consoleMessage', `Output files detected locally: ${matchingFiles.join(', ')}`);
                                    callback(null, matchingFiles);
                                } else {
                                    socket.emit('consoleMessage', `No output files found yet.`);
                                    setTimeout(checkLog, 1000);
                                }
                            });
                        } else if (data.includes('Snakemake pipeline failed')) {
                            socket.emit('consoleMessage', `Pipeline failed, no output.`);
                            callback('Pipeline failed');
                        } else {
                            setTimeout(checkLog, 500);
                        }
                    }

                    checkLog();
                }


                //   ______    __    __  .___________..______    __    __  .___________.
                //  /  __  \  |  |  |  | |           ||   _  \  |  |  |  | |           |
                // |  |  |  | |  |  |  | `---|  |----`|  |_)  | |  |  |  | `---|  |----`
                // |  |  |  | |  |  |  |     |  |     |   ___/  |  |  |  |     |  |     
                // |  `--'  | |  `--'  |     |  |     |  |      |  `--'  |     |  |     
                //  \______/   \______/      |__|     | _|       \______/      |__|                                                                     
                // Surveille stdout.txt jusqu'à trouver tous les fichiers .out, .bed et .anchors

                waitForOutputFiles(logPath, ['.out', '.bed', '.anchors'], (err, foundFiles) => {
                    if (err) {
                        console.error('Error while monitoring log:', err);
                        socket.emit('consoleMessage', `Error while monitoring log: ${err.message}`);
                        return;
                    }

                    if (foundFiles && foundFiles.length > 0) {
                        console.log(`[${getCurrentTimestamp()}] Outputs found: ${foundFiles.length}`);
                        socket.emit('consoleMessage', `Found ${foundFiles.length} output file(s).`);

                        const jobDir = path.dirname(logPath);  // ex: /var/www/html/synflow/data/comparisons/<uuid>/
                        const targetDir = toolkitAnalysisDir;  // ex: /var/www/html/synflow/data/comparisons/toolkit_<sessionID>/
                        
                        // Vérifie que le dossier de destination existe
                        if (!fs.existsSync(targetDir)) {
                            fs.mkdirSync(targetDir, { recursive: true });
                        }

                        let filesMoved = 0;

                        foundFiles.forEach(fileName => {
                            const srcPath = path.join(jobDir, fileName.trim());
                            const destPath = path.join(targetDir, path.basename(fileName.trim()));

                            // Déplace le fichier vers le répertoire toolkit
                            fs.rename(srcPath, destPath, (errMove) => {
                                if (errMove) {
                                    console.error(`Erreur déplacement de ${srcPath}:`, errMove);
                                    socket.emit('consoleMessage', `Erreur déplacement de ${fileName}: ${errMove.message}`);
                                    return;
                                }

                                console.log(`Fichier déplacé: ${destPath}`);
                                socket.emit('consoleMessage', `File moved: ${path.basename(destPath)}`);
                                filesMoved++;

                                // Quand tous les fichiers sont déplacés, renvoyer le dossier
                                if (filesMoved === foundFiles.length) {
                                    console.log(`Tous les fichiers (${filesMoved}) ont été déplacés dans ${targetDir}`);
                                    socket.emit('consoleMessage', `All output files moved to ${targetDir}`);
                                    socket.emit('outputResultOpal', targetDir);
                                }
                            });
                        });
                    }
                });
            });
        }                                                    
    });

    //fonction commune pour tout les sites
    //quand le visiteur se déconnecte
    socket.on ( "disconnect" , function (){

        function rimraf(dir_path) {
            const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
            const now = Date.now();

            if (fs.existsSync(dir_path)) {
                fs.readdirSync(dir_path).forEach(function(entry) {
                    var entry_path = path.join(dir_path, entry);
                    var stats = fs.lstatSync(entry_path);
                    var mtime = stats.mtime.getTime();

                    if ((now - mtime) > TEN_DAYS_MS) {
                        if (stats.isDirectory()) {
                            rimraf(entry_path);
                        } else {
                            fs.unlinkSync(entry_path);
                        }
                    }
                });
                // Supprime le dossier si lui-même est vieux de plus de 10 jours et vide
                var dirStats = fs.lstatSync(dir_path);
                if ((now - dirStats.mtime.getTime()) > TEN_DAYS_MS && fs.readdirSync(dir_path).length === 0) {
                    fs.rmdirSync(dir_path);
                    console.log("cleaning " + dir_path);
                }
            }
        }
        rimraf(toolkitWorkingPath);//enlève aussi les fichiers temporaires du toolkit
    });
});
const port = 3031;
server.listen(port, '0.0.0.0', () => {
    console.log(`SynFlow server is running on port ${port}`);
});
