// Déclarer la variable socket globalement pour qu'elle soit accessible partout dans le script
let socket = null;
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
                toolkitContainer.removeChild(loadingIndicator); // Supprimer le message de chargement

            }else{
                console.log('5Generating form...');
                generateForm(serviceName);
                toolkitContainer.removeChild(loadingIndicator); // Supprimer le message de chargement

            }
        })
        .catch(error => {
            console.error('Error initializing toolkit:', error);
            toolkitContainer.removeChild(loadingIndicator); // Supprimer le message de chargement

        });
}


/**
 * Fonction pour injecter le script Socket.IO dans le document
 * @return {Promise} Une promesse qui se résout lorsque le script est chargé
 */
export function loadSocketIOScript() {
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

const isLocalhost = window.location.hostname === 'localhost';
const socketURL = isLocalhost ? 'http://localhost:3031' : 'https://wsp1453.southgreen.fr';


/**
 * Fonction pour initialiser la connexion Socket.IO après le chargement du script
 * @return {void} N'a pas de valeur de retour
 */
export function initSocketConnection() {
    // Créer la connexion Socket.IO
    socket = io(socketURL, { transports: ['websocket'] });

    // Envoyer les infos du client au serveur
    socket.emit('clientInfo', { url: window.location.href });

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
        const currentHost = window.location.hostname;
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

    // //receptionne la liste des fichiers à partie du toolkitID
    // socket.on('toolkitFiles', (files) => {

    //     //fetch les fichiers resultats de toolkit :
    //     // exemple : /opt/projects/gemo.southgreen.fr/prod/tmp/toolkit_run/toolkit_jD1prpcgQajoO2umAAAV/
    //     // toolkitID = toolkit_jD1prpcgQajoO2umAAAV
    //     const toolkitPath = `https://gemo.southgreen.fr/tmp/toolkit_run/${toolkitID}/`;
    //     fetch(toolkitPath)
    //         .then(response => {
    //             if (!response.ok) {
    //                 throw new Error('Network response was not ok');
    //             }
    //             return response.text();
    //         })
    //         .then(async data => {
    //             // Traiter les données reçues
    //             console.log('Toolkit data:', data);
    //             // Afficher les fichiers dans la console
    //             const consoleDiv = document.getElementById('console');
    //             consoleDiv.innerHTML = ''; // Vider la console avant d'afficher les nouveaux fichiers
                
    //             // Sélectionne et affiche l'onglet 'upload'
    //             const menuColumn = document.querySelector('[data-option="upload"]');

    //             if (menuColumn) menuColumn.click();

    //             try {
    //                 const response = await fetch(path);
    //                 const text = await response.text();
    //                 const fileName = path.split('/').pop();
    //                 const bandFile = new File([text], fileName, { type: 'text/plain' });
                
                
    //                 // Creating DataTransfer objects to simulate file upload
    //                 // const chrLenDataTransfer = new DataTransfer();
    //                 const bandDataTransfer = new DataTransfer();
                
    //                 // Add files to the DataTransfer objects
    //                 bandDataTransfer.items.add(bandFile);
                
    //                 // Set the files to the input fields
    //                 const bandInput = document.getElementById('band-files');
                
    //                 // chrLenInput.files = chrLenDataTransfer.files;
    //                 bandInput.files = bandDataTransfer.files;
                
    //                 // Update the file lists
    //                 // updateFileList(chrLenInput, document.getElementById('chrlen-file-list'));
    //                 updateFileList(bandInput, document.getElementById('band-file-list'));
    //             } catch (error) {
    //                 console.error('Error fetching the file:', error);
    //             }


    //         })
    //         .catch(error => {
    //             console.error('Error fetching toolkit data:', error);
    //             const consoleDiv = document.getElementById('console');
    //             consoleDiv.innerHTML = `<div>Error fetching toolkit data: ${error.message}</div>`;
    //         });
    // });
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
    const isDevelopment = window.location.hostname.includes('dev-');
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
            const label = document.createElement("label");
            label.textContent = field.label;
            label.htmlFor = field.name;

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

            formContainer.appendChild(label);
            formContainer.appendChild(input);
            formContainer.appendChild(document.createElement("br"));
        });

        // Bouton Submit
        const submitButton = document.createElement("button");
        submitButton.id = "submitBtn";
        submitButton.textContent = "Submit";
        submitButton.onclick = (event) => {
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
            addToConsole('Erreur lors de run service:', error);
        }
    }).catch((error) => {
        addToConsole('Erreur lors de l\'envoi:', error);
    });
}

