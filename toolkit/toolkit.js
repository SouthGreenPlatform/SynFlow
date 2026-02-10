import { logActivity } from "../src/js/main.js";

// Déclarer la variable socket globalement pour qu'elle soit accessible partout dans le script
let socket = null;
export { socket };
let servicesData = {};  // Contiendra les services et databases
let databasesData = {};  // Stocke les databases séparément
let serviceName = '';  // Nom du service sélectionné


/**
 * Fonction pour initier toolkit
 * @param {boolean} generateSelect - Booléen pour déterminer si l'on génère le selecteur de service ou pas
 * @param {string} serviceName - Nom du service sélectionné, si pas de selecteur
 * 
 * Exécute les étapes suivantes :
 * 1. Charge le script Socket.IO
 * 2. Initialise la connexion Socket.IO
 * 3. Charge le JSON avec les services et les bases de données
 * 4. Selon generateSelect, génère le formulaire ou appelle la fonction populateServiceSelect
 */
export function initToolkit(generateSelect, serviceName) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.fontSize = '18px';
    loadingIndicator.style.fontWeight = 'bold';
    loadingIndicator.style.color = '#333';
    loadingIndicator.style.backgroundColor = '#fff';
    loadingIndicator.style.padding = '20px';
    loadingIndicator.style.borderRadius = '10px';
    loadingIndicator.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.2)';
    loadingIndicator.style.fontFamily = 'Montserrat, sans-serif'; // Ajouter une police moderne
    loadingIndicator.textContent = 'Loading toolkit...';
    const toolkitContainer = document.getElementById("toolkitContainer");
    toolkitContainer.appendChild(loadingIndicator);

    console.log('1Initializing toolkit...');
    // Charger et initialiser Socket.IO
    loadSocketIOScript()
        .then(() => {
            console.log('2Socket.IO chargé avec succès.');
            initSocketConnection();  // Initialiser la connexion après le chargement
        })
        .then(() => {
            console.log('3Loading services...');
            // Charger le JSON avec les services et les bases de données
            return loadServices();
        })
        .then(() => {
            if(generateSelect){
                console.log('4Generating select...');
                // Appeler la fonction populateServiceSelect aprés le chargement
                populateServiceSelect();
                loadingIndicator.remove(); // Supprimer le message de chargement

            }else{
                console.log('5Generating form...');
                generateForm(serviceName);
                loadingIndicator.remove(); // Supprimer le message de chargement

            }
        })
        .catch(error => {
            console.error('Error initializing toolkit:', error);
            loadingIndicator.remove(); // Supprimer le message de chargement

        });
}


/**
 * Fonction pour injecter le script Socket.IO dans le document si ce n'est pas déja fait
 * @return {Promise} Une promesse qui se résout lorsque le script est chargé
 */
export function loadSocketIOScript() {
    // Vérifie si Socket.IO est déjà chargé
    if (typeof io !== 'undefined') {
        console.log('Socket.IO déjà chargé.');
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');

        // URL du script Socket.IO
        script.src = 'https://cdn.socket.io/4.0.0/socket.io.min.js';

        // Fonction callback pour lorsque le script est chargé
        script.onload = () => resolve();

        // Fonction callback pour lorsque le script n'a pas pu être chargé
        script.onerror = () => reject(new Error('Erreur lors du chargement de Socket.IO'));

        // Ajouter le script au document
        document.head.appendChild(script);
    });
}

//si url = http://localhost:8080, on utilise localhost:3031
//sinon on utilise https://wsp1453.southgreen.fr

const isLocalhost = globalThis.location.hostname === 'localhost';
const socketURL = isLocalhost ? 'http://localhost:3031' : 'https://wsp1453.southgreen.fr';


/**
 * Fonction pour initialiser la connexion Socket.IO après le chargement du script si elle n'était pas déjà établie
 * @return {void} N'a pas de valeur de retour
 */
export function initSocketConnection() {
    if (socket) {
        console.log('Connexion Socket.IO déjà établie.');
        return;
    }

    console.log('Initialisation de la connexion Socket.IO...');
    // Créer la connexion Socket.IO
    socket = io(socketURL, { transports: ['websocket'] });

    // Envoyer les infos du client au serveur
    socket.emit('clientInfo', { url: globalThis.location.href });

    // Écouter les messages du serveur
    socket.on('consoleMessage', function(message) {
        // Ajouter le message à la console
        addToConsole(`<pre>${message}<pre>`);
    });

    // Gérer les erreurs de connexion
    socket.on('connect_error', (error) => {
        // Afficher l'erreur de connexion
        console.error('Erreur de connexion à Socket.IO :', error);
    });

    socket.on('toolkitPath', (data) => {
        // Créer et déclencher un événement personnalisé
        const event = new CustomEvent('ToolkitPathEvent', { detail: data });
        document.dispatchEvent(event);
    });

    socket.on('outputResult', (data) => {
        // Ajouter le message à la console
        console.log(`${data}`);
        const toolkitID = data.split('/')[7];
        const fileName = data.split('/')[8];
        const path = `https://gemo.southgreen.fr/tmp/toolkit_run/${toolkitID}/${fileName}`;
        // Créer et déclencher un événement personnalisé
        const event = new CustomEvent('ToolkitResultEvent', { detail: path });
        document.dispatchEvent(event);
    });

    socket.on('outputResultOpal', (data) => {
        // Ajouter le message à la console
        console.log(`${data}`);
        //transforme le path en URL
        //exemple : path = /opt/projects/gemo.southgreen.fr/prod/tmp/toolkit_run/toolkit_mPyhtgJXDWApk9wvAAAL/ref_querry.out
        //exemple url = https://gemo.southgreen.fr/tmp/toolkit_run/toolkit_mPyhtgJXDWApk9wvAAAL/ref_querry.out
        const toolkitID = data.split('/')[7];
        const fileName = data.split('/')[8];
        const path = `https://gemo.southgreen.fr/tmp/toolkit_run/${toolkitID}/${fileName}`;
        // Créer et déclencher un événement personnalisé
        const event = new CustomEvent('ToolkitResultEvent', { detail: path });
        document.dispatchEvent(event);
    });


    //ecoute l'event 'toolkitID' 
    document.addEventListener('toolkitID', (event) => {
        const toolkitID = event.detail;
        console.log('Toolkit ID reçu:', toolkitID);
        socket.emit('getToolkitFiles', toolkitID);
        socket.emit('toolkitFTP', toolkitID);

    });

    //recupère les fichier de toolkitID
    socket.on('toolkitFilesResults', (data) => {
        let outputFilesPath = data.map(file => {
            const toolkitID = file.split('/')[7];
            const fileName = file.split('/')[8];
            return `https://synflow.southgreen.fr/tmp/toolkit_run/${toolkitID}/${fileName}`;
        });

        // Un seul event avec tous les fichiers
        const event = new CustomEvent('toolkitFilesFromID', { detail: outputFilesPath });
        document.dispatchEvent(event);
    });

    //envoie l'url du ftp contenant les fichiers output
    socket.on('toolkitFTP', (toolkitID) => {
        // Détermine si on est en local ou en prod
        const currentHost = globalThis.location.hostname;
        let outputFilesPath;

        if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
            // En local → serveur sur port 8080
            outputFilesPath = `http://localhost:8080/data/comparisons/${toolkitID}`;
        } else {
            // En prod → garde l’URL d’origine
            outputFilesPath = `https://synflow.southgreen.fr/tmp/toolkit_run/${toolkitID}`;
        }

        console.log('Output files path:', outputFilesPath);

        // Émet un seul event avec tous les fichiers
        const event = new CustomEvent('toolkitFilesFromID', { detail: outputFilesPath });
        document.dispatchEvent(event);
    });
}

const config = {
    development: {
        servicesPath: '/synflow/toolkit/services.json',
        baseUrl: 'https://dev-synflow.southgreen.fr'
    },
    production: {
        servicesPath: '/toolkit/services.json',
        baseUrl: 'https://synflow.southgreen.fr'
    }
};

function getEnvironmentConfig() {
    // Détection de l'environnement basée sur l'URL
    const isDevelopment = globalThis.location.hostname.includes('dev-');
    return isDevelopment ? config.development : config.production;
}

/**
 * Loads the services and databases from the specified JSON file.
 * @return {Promise<void>} A promise that resolves when the services and databases are loaded.
 */
export function loadServices() {
    return new Promise((resolve, reject) => {
        const { servicesPath } = getEnvironmentConfig();
        
        fetch(servicesPath)
            .then(response => response.json())
            .then(data => {
                servicesData = data.services;
                databasesData = data.databases;
                console.log('Services chargés depuis:', servicesPath);
                resolve();
            })
            .catch(error => {
                console.error('Erreur lors du chargement des services:', error);
                reject(error);
            });
    });
}

/**
 * Génère le menu déroulant des services
 * @return {void} N'a pas de valeur de retour
 */
export function populateServiceSelect() {
    console.log('populateServiceSelect() called');
    const toolkitContainer = document.getElementById("toolkitContainer");

    // Crée le select element
    const serviceSelect = document.createElement("select");
    serviceSelect.id = "serviceSelect";    
    serviceSelect.innerHTML = '<option value="">--Select a service--</option>'; // Reset de la liste

    // Loop through the services and create an option for each one
    console.log('servicesData:', servicesData);
    for (const serviceKey in servicesData) {
        console.log('serviceKey:', serviceKey);
        const option = document.createElement("option");
        option.value = serviceKey;
        option.textContent = servicesData[serviceKey].label;
        serviceSelect.appendChild(option);
    }

    // Ajoutez l'événement onchange
    serviceSelect.onchange = function() {
        const selectedService = serviceSelect.value;
        console.log('selectedService:', selectedService);
        // Faites quelque chose lorsque l'utilisateur sélectionne un nouveau service
        console.log(`Service sélectionné : ${selectedService}`);
        generateForm(selectedService);
    };

    // Append the select element to the DOM
    toolkitContainer.appendChild(serviceSelect);
    console.log('serviceSelect appended to toolkitContainer');
}

// Fonction pour générer le formulaire en fonction du service sélectionné
/**
 * Génère le formulaire en fonction du service sélectionné
 * @param {string} selectedService Le nom du service sélectionné
 * @return {void} N'a pas de valeur de retour
 */
export function generateForm(selectedService) {
    const toolkitContainer = document.getElementById("toolkitContainer");
    serviceName = selectedService;

    // Vérifier si le conteneur du formulaire existe déjà
    let formContainer = document.getElementById("formContainer");

    if (!formContainer) {
        formContainer = document.createElement("div");
        formContainer.id = "formContainer";
        toolkitContainer.appendChild(formContainer);
    }

    // Vérifier si la console existe déjà
    let consoleDiv = document.getElementById("console");

    if (!consoleDiv) {
        consoleDiv = document.createElement("div");
        consoleDiv.id = "console";
        toolkitContainer.appendChild(consoleDiv);
    }

    // On vide le conteneur du formulaire à chaque fois
    formContainer.innerHTML = "";
    consoleDiv.innerHTML = "<p>Console :</p>";

    if (selectedService && servicesData[selectedService]) {
        const service = servicesData[selectedService];
        const fields = service.arguments.inputs;

        // Générer les champs dynamiquement
        fields.forEach(field => {
            const labelContainer = document.createElement("div");
            labelContainer.style.display = "flex";
            labelContainer.style.alignItems = "center";
            labelContainer.style.gap = "5px";

            const label = document.createElement("label");
            label.textContent = field.label;
            label.htmlFor = field.name;
            labelContainer.appendChild(label);

            // Ajouter le tooltip s'il existe
            if (field.tooltip) {
                const tooltipIcon = document.createElement("span");
                tooltipIcon.innerHTML = "?";
                tooltipIcon.style.cursor = "help";
                tooltipIcon.style.backgroundColor = "#f0f0f0";
                tooltipIcon.style.borderRadius = "50%";
                tooltipIcon.style.width = "16px";
                tooltipIcon.style.height = "16px";
                tooltipIcon.style.display = "inline-flex";
                tooltipIcon.style.justifyContent = "center";
                tooltipIcon.style.alignItems = "center";
                tooltipIcon.style.fontSize = "12px";
                tooltipIcon.style.position = "relative";
                
                const tooltipText = document.createElement("div");
                tooltipText.textContent = field.tooltip;
                tooltipText.style.visibility = "hidden";
                tooltipText.style.backgroundColor = "black";
                tooltipText.style.color = "white";
                tooltipText.style.padding = "5px 10px";
                tooltipText.style.borderRadius = "6px";
                tooltipText.style.position = "absolute";
                tooltipText.style.zIndex = "1";
                tooltipText.style.width = "200px";
                tooltipText.style.left = "25px";
                tooltipText.style.top = "-5px";
                tooltipText.style.fontSize = "12px";
                
                // Événements pour afficher/masquer le tooltip
                const showTooltip = () => tooltipText.style.visibility = "visible";
                const hideTooltip = () => tooltipText.style.visibility = "hidden";
                
                tooltipIcon.addEventListener("mouseover", showTooltip);
                tooltipIcon.addEventListener("mouseout", hideTooltip);
                tooltipIcon.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (tooltipText.style.visibility === "visible") {
                        hideTooltip();
                    } else {
                        showTooltip();
                    }
                });
                
                // Fermer le tooltip si on clique ailleurs sur la page
                document.addEventListener("click", hideTooltip);
                
                tooltipIcon.appendChild(tooltipText);
                labelContainer.appendChild(tooltipIcon);
            }

            let input;
            if (field.type === "select") {
                input = document.createElement("select");
                input.name = field.name;

                const options = databasesData[field.optionsSource];
                options.forEach(optionValue => {
                    const option = document.createElement("option");
                    //en minuscule
                    option.value = optionValue.toLowerCase();
                    option.textContent = optionValue;
                    input.appendChild(option);
                });

            } else if (field.type === "text") {
                input = document.createElement("input");
                input.type = "text";
                input.name = field.name;
                input.value = field.default || "";

            } else if (field.type === "file") {
                console.log('single file input detected');
                input = document.createElement("input");
                input.type = "file";
                input.name = field.name;

            } else if (field.type === "file[]") {
                console.log('multiple file input detected');
                input = document.createElement("input");
                input.type = "file";
                input.name = field.name;
                input.multiple = true; // Permet la sélection multiple
            }

            if (field.required) {
                input.required = true;
            }

            formContainer.appendChild(labelContainer);
            formContainer.appendChild(input);
            formContainer.appendChild(document.createElement("br"));
        });

        // Bouton Submit
        const submitButton = document.createElement("button");
        submitButton.id = "submitBtn";
        submitButton.textContent = "Submit";
        submitButton.onclick = (event) => {
            logActivity('Submitting toolkit form');
            event.preventDefault();
            addToConsole('Sending files...');
            submitForm();
            console.log("Bouton cliqué !");
        };
        formContainer.appendChild(submitButton);
    }
}

/**
 * Ajouter un message à la console HTML
 * @param {string} message - Le message à ajouter
 */
function addToConsole(message) {
    const consoleDiv = document.getElementById("console");
    const messageElement = document.createElement("p");

    // Utilisation de innerHTML pour que les balises HTML (comme <pre>) soient interprétées
    // Par exemple, si le message est "<pre>hello</pre>", cela ajoutera un élément <pre> contenant le texte "hello" au messageElement
    messageElement.innerHTML = message;

    // Ajouter le messageElement à la fin de la consoleDiv
    consoleDiv.appendChild(messageElement);

    // Faire défiler vers le bas pour afficher le dernier message
    // La propriété scrollHeight contient la hauteur totale de l'élément, y compris la partie qui est hors de l'écran
    // La propriété scrollTop définit la position de défaut du scroll, à 0,0
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

/**
 * Fonction pour soumettre le formulaire avec les fichiers via FormData
 * 
 * @returns {void} N'a pas de valeur de retour
 */
function submitForm() {

    const serviceSelect = document.getElementById("serviceSelect");
    let selectedService;

    if (serviceSelect) {
        selectedService = serviceSelect.value;
        console.log(`Service sélectionné : ${selectedService}`);

    } else {
        selectedService = serviceName;
        console.log(`Service sélectionné : ${selectedService}`);

    }
    
    const serviceData = servicesData[selectedService];
    const formContainer = document.getElementById("formContainer");

    const formData = new FormData();

    Array.from(formContainer.querySelectorAll("input, select")).forEach(input => {
        if (input.type === "file" && input.files.length > 0) {
            if (input.multiple) {
                //Boucle sur chaque fichier pour les champs multi-fichier
                Array.from(input.files).forEach(file => {
                    formData.append(input.name, file);
                });
            } else {
                // Champ fichier simple : on ajoute le fichier unique
                formData.append(input.name, input.files[0]);
            }
        } else {
            formData.append(input.name, input.value);
        }
    });

    // Envoyer les fichiers et paramètres via fetch
    fetch(socketURL+'/upload', {
        method: 'POST',
        body: formData
    }).then(response => response.json())
    .then(data => {
        addToConsole('Fichiers et paramètres envoyés avec succès:');
        addToConsole(JSON.stringify(data, null, 2));
        // Ensuite, lancer l'exécution du service via Socket.IO ou un autre mécanisme
        try {
            socket.emit('runService', selectedService, serviceData, data);
        } catch (error) {
            addToConsole('Erreur lors de run service: ' + error.message);
        }
    }).catch((error) => {
        addToConsole('Erreur lors de l\'envoi: ' + error.message);
    });
}

