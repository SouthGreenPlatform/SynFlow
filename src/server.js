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
                                                                     
// Configuration de multer pour gérer les fichiers
const multer = require('multer'); //upload des fichiers
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '/var/www/html/synflow/data/comparisons/');
    },
    filename: function (req, file, cb) {
        const prefix = req.uploadId || Date.now();
        // garde le nom original pour retrouver facilement
        cb(null, prefix + "_" + file.originalname);
    }
});
const upload = multer({ storage: storage });


// Route POST pour gérer l'upload de fichiers et les paramètres texte
app.post('/upload', assignUploadId, upload.any(), (req, res) => {
    console.log('Upload ID:', req.uploadId);
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

    const { exec } = require('child_process');
    const { spawn } = require('child_process');
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
            function buildLaunchCommand(formData, uploadedFiles, params) {
                const { url, action, arguments: args } = formData;
                const inputs = args.inputs;
                if (!inputs) {
                    throw new Error("Les 'inputs' ne sont pas définis pour ce service.");
                }
                let commandArgs = ``;
                let aArgs = "";  // Les arguments pour -a
                // Parcourir les inputs
                inputs.forEach(input => {
                    console.log("Traitement input:", input);
                    if (input.flag) {
                        if (input.type !== "file" && input.type !== "file[]") {
                            const value = params[input.name];
                            if (value && value !== "") {
                                aArgs += ` ${input.flag} ${value}`;
                            }
                        }
                    }
                    if (input.type === "file" || input.type === "file[]") {
                        const matchingFiles = uploadedFiles.filter(file => file.fieldname === input.name);
                        console.log(`Fichiers trouvés pour ${input.name}:`, matchingFiles);
                        matchingFiles.forEach(file => {
                            if (file && file.path && isSafePath(file.path)) {
                                aArgs += ` ${input.flag} ${file.path}`;
                            }
                        });
                    }
                });
                // Ajout du bloc -a
                if (aArgs) {
                    commandArgs += aArgs.trim();
                }

                // Extraire l'UUID des noms de fichiers (format: UUID_filename)
                const uuidMatch = commandArgs.match(/(\d+-\d+)_/);
                const uuid = uuidMatch ? uuidMatch[1] : '';

                // Ajouter l'UUID à la commande si trouvé (avec un ESPACE avant -u)
                const uuidArg = uuid ? ` -u ${uuid}` : ''; //ESPACE au début

                // Retourner la commande complète avec activation de l'environnement conda
                return `bash -c "source /opt/conda/etc/profile.d/conda.sh && conda activate synflow && python /app/workflow/create_conf.py ${commandArgs.trim()}${uuidArg}"`;
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
            launchCommand = buildLaunchCommand(serviceData, uploadedFiles, params);
            console.log(`Commande générée : ${launchCommand}`);
            socket.emit('consoleMessage', launchCommand);

            // __________   ___  _______   ______ 
            // |   ____\  \ /  / |   ____| /      |
            // |  |__   \  V  /  |  |__   |  ,----'
            // |   __|   >   <   |   __|  |  |     
            // |  |____ /  .  \  |  |____ |  `----.
            // |_______/__/ \__\ |_______| \______|                  
            // Exécuter la commande
            exec(launchCommand, (error, stdout, stderr) => {

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
