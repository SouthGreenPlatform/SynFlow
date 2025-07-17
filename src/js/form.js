import * as toolkit from '../../toolkit/toolkit.js';
import { createLegendContainer } from './legend.js';
import { zoom } from './draw.js';
import { handleFileUpload, extractAllGenomes, spinner } from './process.js';

//mode de chargement des fichiers
export let fileUploadMode = ''; // 'remote' ou 'local'
export let jbrowseLinks = {}; //liste des lien jbrowse pour les genome sélectionnés dans "existing files"


// Sélection ordonnée
let selectedGenomes = [];
export function setSelectedGenomes(genomes) {
    selectedGenomes = genomes;
};

export async function createForm() {
    const form = document.createElement('form');
    form.setAttribute('id', 'file-upload-form');

    // Créer un conteneur pour le titre qui reste toujours visible
    const headerBar = document.createElement('div');
    headerBar.style.cssText = `
        padding: 10px 15px;
        background-color: #f5f5f5;
        border-radius: 8px 8px 0 0;
        border-bottom: 1px solid #ddd;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
    `;
    
    // Ajout du titre
    const title = document.createElement('h4');
    title.textContent = 'Input Selection';
    title.style.margin = '0';
    headerBar.appendChild(title);

    // Ajout de l'icône de fermeture
    const chevronIcon = document.createElement('i');
    chevronIcon.className = 'fas fa-chevron-up';
    chevronIcon.style.color = '#666';
    headerBar.appendChild(chevronIcon);

    // Créer un conteneur pour le contenu
    const formContent = document.createElement('div');
    formContent.setAttribute('id', 'form-content');
    formContent.style.cssText = `
        background-color: white;
        transition: max-height 0.3s ease-out;
        overflow: hidden;
        max-height: 1000px; 
    `;

    // Event listener sur headerBar
    headerBar.addEventListener('click', (event) => {
        event.preventDefault();
        if(formContent.style.maxHeight === '0px' || !formContent.style.maxHeight) {
            // formContent.style.maxHeight = formContent.scrollHeight + 'px';
            formContent.style.maxHeight = '1000px'; // Pour une animation fluide
            chevronIcon.className = 'fas fa-chevron-up';
        } else {
            formContent.style.maxHeight = '0px';
            chevronIcon.className = 'fas fa-chevron-down';
        }
    });

    // Container principal avec CSS Grid
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: 200px 1fr;
        gap: 20px;
        padding: 20px;
        background-color: #f5f5f5;
        border-radius: 0 0 8px 8px;
    `;

    // Colonne 1 : Menu de sélection
    const menuColumn = document.createElement('div');
    menuColumn.style.cssText = `
        padding: 15px;
        background-color: white;
        border-radius: 5px;
        box-shadow: 0 0 5px rgba(0,0,0,0.1);
    `;

    const menuItems = [
        { id: 'existing', icon: 'fas fa-folder-open', text: 'Existing Files' },
        { id: 'upload', icon: 'fas fa-upload', text: 'Upload Files' },
        { id: 'calculate', icon: 'fas fa-cogs', text: 'Run Calculation' }
    ];

    menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.style.cssText = `
            padding: 15px;
            margin: 5px 0;
            cursor: pointer;
            border-radius: 5px;
            transition: all 0.3s ease;
        `;
        menuItem.innerHTML = `<i class="${item.icon}"></i> ${item.text}`;
        menuItem.setAttribute('data-option', item.id);
        
        menuItem.addEventListener('click', async () => {
            // Retirer la classe active de tous les items
            menuColumn.querySelectorAll('div').forEach(div => {
                div.style.backgroundColor = 'transparent';
                div.style.color = '#000';
            });
            // Ajouter la classe active à l'item sélectionné
            menuItem.style.backgroundColor = 'black';
            menuItem.style.color = 'white';
            
            // Afficher le formulaire correspondant
            await showForm(item.id);
        });
        
        menuColumn.appendChild(menuItem);
    });

    // Colonne 2 : Zone de contenu dynamique
    const contentColumn = document.createElement('div');
    contentColumn.style.cssText = `
        padding: 15px;
        background-color: white;
        border-radius: 5px;
        overflow: hidden;
        box-shadow: 0 0 5px rgba(0,0,0,0.1);
    `;

    // Fonction pour afficher le bon formulaire
    async function showForm(option) {
        contentColumn.innerHTML = '';
        switch(option) {
            case 'existing':
                contentColumn.appendChild(await createExistingFilesForm());
                break;
            case 'upload':
                contentColumn.appendChild(createUploadSection());
                break;
            case 'calculate':
                contentColumn.appendChild(createToolkitContainer());
                break;
        }
    }

    // Ajout des colonnes au container
    gridContainer.appendChild(menuColumn);
    gridContainer.appendChild(contentColumn);

    // Ajouter le bouton et le contenu au formulaire    
    form.appendChild(headerBar);
    form.appendChild(formContent);
    formContent.appendChild(gridContainer);  // Ne garder que cette ligne

    // Afficher le formulaire "existing" par défaut
    // Ajouter la classe active à l'item sélectionné
    //selectionne la dive "existing" par défaut
    const selectedItem = menuColumn.querySelector(`div[data-option="upload"]`);
    selectedItem.style.backgroundColor = 'black';
    selectedItem.style.color = 'white';
    (async () => { await showForm('upload'); })();    
    return form;
}

//fonction hide form
export function hideForm() {
    const formContent = document.getElementById('form-content');
    if (formContent) {
        formContent.style.maxHeight = '0px';
        const chevronIcon = document.querySelector('#file-upload-form i');
        chevronIcon.className = 'fas fa-chevron-down';

    }
}

// Fonction pour récupérer les répertoires Synflow depuis un fichier JSON
async function fetchSynflowDirectories() {
    try {
        const response = await fetch('public/data/config.json');
        if (!response.ok) throw new Error('Erreur lors du chargement du JSON');
        const dirs = await response.json();
        return dirs; // tableau d'URLs
    } catch (error) {
        console.error('Error fetching Synflow directories:', error);
        return [];
    }
}

// Fonction pour récupérer la liste des fichiers .out depuis un dossier distant
function fetchRemoteFileList(folder) {
    // Récupère la liste des fichiers .out depuis le HTML du dossier distant
    return fetch(folder)
        .then(response => {
            if (!response.ok) throw new Error('Erreur lors du chargement de la liste de fichiers');
            return response.text();
        })
        .then(html => {
            // Parse le HTML pour extraire les liens vers les fichiers .out
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'));
            // Filtre les fichiers .out
            const files = links
                .map(link => link.textContent)
                .filter(name => name.endsWith('.out'));
            return files;
        });
}

// Cree le formulaire pour sélectionner les fichiers existants
async function createExistingFilesForm() {

    //Crée un conteneur pour le form + le help
    const existingSection = document.createElement('div');
    existingSection.setAttribute('id', 'existing-file-form');
    existingSection.style.display = 'flex';
    existingSection.style.gap = '20px';

    const existingFormContainer = document.createElement('div');
    existingFormContainer.style.flex = '1';

    const title = document.createElement('h5');
    title.textContent = 'Select Study';
    title.style.marginBottom = '10px';
    existingFormContainer.appendChild(title);

    // Sélecteur de dossier (dataset)
    const folderSelect = document.createElement('select');
    folderSelect.setAttribute('id', 'remote-folder-select');
    folderSelect.style.width = '100%';
    folderSelect.style.marginBottom = '10px';

    //va chercher les répertoires Synflow depuis le fichier JSON
    const remoteFolders = await fetchSynflowDirectories();
    remoteFolders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        //affiche uniquement le nom du dossier avant /synflow (avec ou sans majuscules)
        //exemple : https://hpc.cirad.fr/bank/banana/synflow/ devient "Banana"
        //exemple : https://hpc.cirad.fr/bank/vitis/Synflow/ devient "Vitis"
        const folderName = folder.replace('/synflow/', '').replace('/Synflow/', '').split('/').pop();
        // Mettre la première lettre en majuscule et le reste en minuscules
        const formattedFolderName = folderName.charAt(0).toUpperCase() + folderName.slice(1).toLowerCase();
        option.textContent = formattedFolderName;
        folderSelect.appendChild(option);
    });
    existingFormContainer.appendChild(folderSelect);

    // Liste cliquable des génomes
    const fileListDiv = document.createElement('div');
    fileListDiv.setAttribute('id', 'existing-files-list');
    fileListDiv.style.maxHeight = '180px';
    fileListDiv.style.overflowY = 'auto';
    fileListDiv.style.border = '1px solid #ccc';
    fileListDiv.style.padding = '5px';
    existingFormContainer.appendChild(fileListDiv);

    // Affichage de la chaîne sélectionnée
    const chainDiv = document.createElement('div');
    chainDiv.setAttribute('id', 'selected-chain');
    chainDiv.style.marginTop = '15px';
    chainDiv.style.fontSize = '0.95em';
    chainDiv.style.color = '#333';
    existingFormContainer.appendChild(chainDiv);

    // Sélection ordonnée
    selectedGenomes = [];
    

    function updateChainDiv() {
        if (selectedGenomes.length > 0) {
            chainDiv.innerHTML = `<b>Selected chain :</b> <br>${selectedGenomes.join(' &rarr; ')}`;
        } else {
            chainDiv.innerHTML = '';
        }
    }

    //charge la liste des fichiers disponibles
    function loadFiles(folder) {
        fileListDiv.innerHTML = '';
        selectedGenomes = [];
        updateChainDiv();
        fetchRemoteFileList(folder).then(files => {
            const genomes = extractAllGenomes(files);
            genomes.forEach(genome => {
                const genomeDiv = document.createElement('div');
                genomeDiv.style.cursor = 'pointer';
                genomeDiv.style.padding = '4px 8px';
                genomeDiv.style.margin = '2px 0';
                genomeDiv.style.borderRadius = '4px';
                genomeDiv.style.transition = 'background 0.2s';
                genomeDiv.classList.add('genome-item');
                genomeDiv.dataset.fileName = genome; // vrai nom de fichier

                //affiche le nom sans tiret
                genomeDiv.textContent = genome.replace(/-/g, ' ');

                genomeDiv.addEventListener('click', () => {
                    const idx = selectedGenomes.indexOf(genome);
                    if (idx !== -1) {
                        selectedGenomes.splice(idx, 1);
                        genomeDiv.style.background = '';
                        genomeDiv.style.color = '';
                    } else {
                        selectedGenomes.push(genome);
                        genomeDiv.style.background = 'grey';
                        genomeDiv.style.color = '#fff';
                    }
                    updateChainDiv();
                });

                fileListDiv.appendChild(genomeDiv);
            });
        });
    }

    // Initialisation avec le premier dossier
    loadFiles(folderSelect.value);

    // Changement de dossier = recharge la liste de fichiers
    folderSelect.addEventListener('change', (e) => {
        loadFiles(e.target.value);
    });

    //bouton clear pour deselectionner tout
    const clearButton = document.createElement('button');
    clearButton.setAttribute('type', 'button');
    clearButton.classList.add('btn-simple');
    clearButton.textContent = 'Clear Selection';
    clearButton.style.marginTop = '10px';
    clearButton.addEventListener('click', () => {
        selectedGenomes = [];
        updateChainDiv();
        fileListDiv.querySelectorAll('.genome-item').forEach(item => {
            item.style.background = '';
            item.style.color = '';
        });
    });
    existingFormContainer.appendChild(clearButton);

    // Bouton pour charger les fichiers sélectionnés
    const loadButton = document.createElement('button');
    loadButton.setAttribute('type', 'button');
    loadButton.classList.add('btn-magic');
    loadButton.setAttribute('id', 'submit-remote');
    loadButton.textContent = 'Draw';
    loadButton.style.marginTop = '10px';
    existingFormContainer.appendChild(loadButton);

    loadButton.addEventListener('click', async () => {

        // Lance le spinner
        var target = document.getElementById('spinner');
        spinner.spin(target); 

        fileUploadMode = 'remote'; // Change mode to remote for file upload

        if (selectedGenomes.length < 2) {
            chainDiv.innerHTML = '<span style="color:red;">Sélectionnez au moins 2 génomes pour créer une chaîne.</span>';
            return;
        }

        // Récupère la liste des fichiers disponibles dans le dossier sélectionné
        const folder = folderSelect.value;
        const allFiles = await fetchRemoteFileList(folder);
        // Nettoie les espaces autour des noms de fichiers
        const allFilesTrimmed = allFiles.map(f => f.trim());

        // Construit la liste des fichiers nécessaires pour la chaîne
        const neededFiles = [];
        let missingFiles = [];
        for (let i = 0; i < selectedGenomes.length - 1; i++) {
            const fileName = `${selectedGenomes[i]}_${selectedGenomes[i+1]}.out`;
            if (allFilesTrimmed.includes(fileName)) {
                neededFiles.push(fileName);
            } else {
                missingFiles.push(fileName);
            }
        }

        // Affiche un message si des fichiers sont manquants
        if (missingFiles.length > 0) {
            chainDiv.innerHTML = `<span style="color:red;">Fichiers manquants :<br>${missingFiles.join('<br>')}</span>`;
            return;
        }

        // Télécharge les fichiers nécessaires et crée des objets File
        const files = await Promise.all(neededFiles.map(async file => {
            const filePath = `${folder}${file}`;
            // Utilise fetch pour récupérer le contenu du fichier
            const response = await fetch(filePath);
            const text = await response.text();
            return new File([text], file, { type: 'text/plain' });
        }));

        // Simule un input file multiple pour handleFileUpload
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));

        //cherche s'il y a un fichier jbrowse_links.json dans le dossier et si oui, le télécharge
        const jbrowseFileName = 'jbrowse_link.json';
        const jbrowseFilePath = `${folder}${jbrowseFileName}`;
        
        try {
            const jbrowseResponse = await fetch(jbrowseFilePath);
            if (jbrowseResponse.ok) {
                jbrowseLinks = await jbrowseResponse.json();   
                console.log(jbrowseLinks);         
            }
        } catch (error) {
            console.log("No jbrowse links");
        }

        // Appelle ta fonction de visualisation
        const visualizationContainer = document.getElementById('viz');
        visualizationContainer.innerHTML = ''; // Efface le contenu existant
        d3.select('#info').html('');
        d3.select("#viz").call(zoom);
        // Ajoutez un groupe à l'intérieur de l'élément SVG pour contenir les éléments zoomables
        d3.select("#viz").append("g").attr("id", "zoomGroup");
        handleFileUpload(dataTransfer.files);
    });

    // Container pour l'aide (partie droite)
    const existingHelpContainer = document.createElement('div');
    existingHelpContainer.style.flex = '0 0 600px'; // Largeur fixe de 400px
    existingHelpContainer.style.padding = '15px';
    existingHelpContainer.style.backgroundColor = '#f8f9fa';
    existingHelpContainer.style.borderRadius = '5px';
    existingHelpContainer.style.border = '1px solid #dee2e6';
    existingHelpContainer.style.maxHeight = '600px'; // Hauteur maximale
    existingHelpContainer.style.overflowY = 'auto'; // Scroll si le contenu dépasse

    // Contenu de l'aide
    existingHelpContainer.innerHTML = `
        <h5>About the studies</h5>
        <div style="margin-top: 15px;">
            <p>
                The available files come from analyses performed on several organisms using the <b>Synflow workflow</b>.
                See the 
                <a href="https://github.com/SouthGreenPlatform/synflow" target="_blank">Synflow documentation</a>.
            </p>
            <h6>How to select files</h6>
            <ul style="padding-left: 20px;">
                <li>
                    Select a study from the dropdown menu to view the available accessions.
                    <br>
                </li>
                <li>
                    Click on every accession you want to include in the chain. The order of selection matters.
                </li>
            </ul>
        </div>
    `;

    existingSection.appendChild(existingFormContainer);
    existingSection.appendChild(existingHelpContainer);
    return existingSection;
}
    


















// Fonction helper pour créer la section upload (votre code existant)
function createUploadSection() {
    const uploadSection = document.createElement('div');
    uploadSection.setAttribute('id', 'file-upload-form');
    uploadSection.style.display = 'flex';
    uploadSection.style.gap = '20px';

    // Container pour le formulaire (partie gauche)
    const formContainer = document.createElement('div');
    formContainer.style.flex = '1';

    // Container pour l'aide (partie droite)
    const helpContainer = document.createElement('div');
    helpContainer.style.flex = '0 0 600px'; // Largeur fixe de 400px
    helpContainer.style.padding = '15px';
    helpContainer.style.backgroundColor = '#f8f9fa';
    helpContainer.style.borderRadius = '5px';
    helpContainer.style.border = '1px solid #dee2e6';
    helpContainer.style.maxHeight = '600px'; // Hauteur maximale
    helpContainer.style.overflowY = 'auto'; // Scroll si le contenu dépasse

    // Contenu de l'aide
    helpContainer.innerHTML = `
        <h5>File Requirements</h5>
        <div style="margin-top: 15px;">
            <h6>SyRI output files (.out)</h6>
            <ul style="padding-left: 20px;">
                <li>Files must be in SyRI output format. <a href="https://schneebergerlab.github.io/syri/fileformat.html" target="_blank">See the SyRI documentation</a></li>
                <li>The file names should follow the pattern: <strong>ref-genome_query-genome.out</strong></li>
                <li>Files can be chained for multiple genome comparisons:</li>
            </ul>
            
            <div style="margin: 15px 0; padding: 10px; background-color: #fff; border-radius: 4px;">
                <strong>Example of file chain:</strong>
                <ul style="padding-left: 20px;">
                    <li>A-thaliana_C-rubella.out</li>
                    <li>C-rubella_B-rapa.out</li>
                    <li>B-rapa_O-sativa.out</li>
                </ul>
                <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    This will create a visualization chain: A-thaliana → C-rubella → B-rapa → O-sativa
                </p>
            </div>
        </div>
    `;

    // Container for the file inputs and legend
    const inputContainer = document.createElement('div');
    inputContainer.setAttribute('id', 'input-container');
    inputContainer.style.display = 'flex';
    inputContainer.style.justifyContent = 'space-between';
    inputContainer.style.alignItems = 'flex-start';

    // Container for band files
    const bandContainer = document.createElement('div');

    const bandH5 = document.createElement('h5');
    bandH5.textContent = 'Upload Syri output files';

    const bandInput = document.createElement('input');
    bandInput.setAttribute('type', 'file');
    bandInput.setAttribute('id', 'band-files');
    bandInput.setAttribute('name', 'band-files');
    bandInput.setAttribute('multiple', true);
    bandInput.setAttribute('accept', '.out');
    bandInput.style.display = 'none'; // Cache l'input file par défaut

    // Créer un bouton personnalisé
    const customButton = document.createElement('button');
    customButton.type = 'button';
    customButton.classList.add('btn-simple');
    customButton.textContent = 'Select Files';
    customButton.style.marginBottom = '10px';
    
    // Div pour afficher les fichiers sélectionnés
    const fileLabel = document.createElement('span');
    fileLabel.textContent = 'No files chosen';
    fileLabel.style.marginLeft = '10px';
    
    // Event listener pour le bouton personnalisé
    customButton.addEventListener('click', () => {
        bandInput.click();
    });
    
    // Mettre à jour le label quand des fichiers sont sélectionnés
    bandInput.addEventListener('change', () => {
        if (bandInput.files.length > 0) {
            fileLabel.textContent = `${bandInput.files.length} file(s) selected`;
        } else {
            fileLabel.textContent = 'No files chosen';
        }
    });

    const bandFileList = document.createElement('div');
    bandFileList.setAttribute('id', 'band-file-list');
    bandFileList.classList.add('file-list');

    bandContainer.appendChild(bandH5);
    bandContainer.appendChild(document.createElement('br'));
    bandContainer.appendChild(bandInput);
    bandContainer.appendChild(customButton);
    bandContainer.appendChild(fileLabel);
    bandContainer.appendChild(bandFileList);

    // Append containers to input container
    inputContainer.appendChild(bandContainer);

    // Button to load test dataset
    const loadTestButton = document.createElement('button');
    loadTestButton.setAttribute('type', 'button');
    loadTestButton.classList.add('btn-simple');
    loadTestButton.setAttribute('id', 'load-test');
    loadTestButton.textContent = 'Load Test Data';

    // Event listener for the load test button
    loadTestButton.addEventListener('click', loadTestData);

    // Submit button
    const submitButton = document.createElement('button');
    submitButton.setAttribute('type', 'button');
    submitButton.classList.add('btn-magic');
    submitButton.setAttribute('style', 'margin-bottom:20px');
	submitButton.setAttribute('id', 'submit-local');
    submitButton.style.marginLeft = '10px';
    submitButton.textContent = 'Draw';

    submitButton.addEventListener('click', () => {

        // Lance le spinner
        var target = document.getElementById('spinner');
        spinner.spin(target); 

        fileUploadMode = 'local'; // Change mode to local for file upload

        const visualizationContainer = document.getElementById('viz');
        visualizationContainer.innerHTML = ''; // Efface le contenu existant

        d3.select('#info').html('');

        d3.select("#viz").call(zoom);

        // Ajoutez un groupe à l'intérieur de l'élément SVG pour contenir les éléments zoomables
        d3.select("#viz").append("g").attr("id", "zoomGroup");

        ///////////////changement
        const bandFiles = document.getElementById('band-files').files;
        handleFileUpload(bandFiles);
    });

    bandInput.addEventListener('change', (event) => {
        updateFileList(bandInput, bandFileList);
    });


     // Boutons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '20px';
    buttonContainer.appendChild(loadTestButton);
    buttonContainer.appendChild(submitButton);

    // Assemblage final
    formContainer.appendChild(inputContainer);
    formContainer.appendChild(buttonContainer);
    
    uploadSection.appendChild(document.createElement('br'));
    uploadSection.appendChild(formContainer);
    uploadSection.appendChild(helpContainer);

    return uploadSection;
}
































export function createToolkitContainer() {
    //////////////////:
    // TOOLKIT
    ///////////////////

    //crée le container pour le module toolkit
    const toolkitContainer = document.createElement("div");
    toolkitContainer.id = "toolkitContainer";    
    toolkitContainer.style.position = "relative"; // Ajout de la position relative

    // Ajout du bouton de fermeture
    const closeButton = document.createElement("div");
    closeButton.innerHTML = "&#10006;"; // Symbole croix (✖)
    closeButton.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        padding: 5px;
        cursor: pointer;
        font-size: 20px;
        color: #666;
    `;
    closeButton.addEventListener("click", () => {
        toolkitContainer.style.display = "none";
    });
    
    toolkitContainer.appendChild(closeButton);
    closeButton.style.display = "none"; // Masquer le bouton par défaut


    document.body.appendChild(toolkitContainer);

    //charge le css de toolkit
    const toolkitCSS = document.createElement("link");
    toolkitCSS.rel = "stylesheet";
    toolkitCSS.href = "../../toolkit/toolkit.css";
    document.head.appendChild(toolkitCSS);

    // // Bouton pour lancer le calcul
    // const runCalculationButton = document.getElementById('runCalculation');

    // // Event listener pour envoyer l'événement de calcul au serveur
    // runCalculationButton.addEventListener('click', () => {

        toolkitContainer.style.display = "block"; // Afficher le container
        closeButton.style.display = "block"; // Afficher le bouton de fermeture

        // Option pour générer le selecteur de service ou appeler un service spécifique
        const generateSelect = false;
        // const serviceName = 'synflow-galaxy';
        const serviceName = 'synflow';

        //init toolkit
        toolkit.initToolkit(generateSelect, serviceName);

        //reception du toolkit path pour générer une url
        document.addEventListener('ToolkitPathEvent', (event) => {
            const toolkitPath = event.detail;
            console.log('Toolkit Path:', toolkitPath);

            //exemple de path = /opt/projects/gemo.southgreen.fr/prod/tmp/toolkit_run/toolkit_D_kHW7cvKUZrzrn-AAAP/ref_querry.out
            const toolkitID = toolkitPath.split('/')[7];

            //genère une URL synflow pour acceder aux resultats
            const baseURL = window.location.origin;
            let synflowURL;
            if (window.location.pathname.startsWith('/synflow')) {
                // Sur la dev, il faut ajouter /synflow
                synflowURL = `${baseURL}/synflow/?id=${toolkitID}`;
            } else {
                // Sur la prod, pas besoin
                synflowURL = `${baseURL}/?id=${toolkitID}`;
            }
            
            // Créer et déclencher un événement personnalisé
            event = new CustomEvent('consoleMessage', { detail: 'Job is running, result will be available here for 10 days : ' + synflowURL });
            document.dispatchEvent(event);

            const consoleDiv = document.getElementById('console');
            let jobMsg = document.getElementById('job-status-msg');
            if (!jobMsg) {
                jobMsg = document.createElement('div');
                jobMsg.id = 'job-status-msg';
                jobMsg.style.position = 'sticky'; // Fixe en haut de la console
                jobMsg.style.top = '0';
                jobMsg.style.zIndex = '10';
                jobMsg.style.background = '#eaf7ea';
                jobMsg.style.border = '1px solid #b2d8b2';
                jobMsg.style.padding = '8px';
                jobMsg.style.marginBottom = '8px';
                jobMsg.style.borderRadius = '5px';
                jobMsg.fontSize = 'small';
                jobMsg.style.fontWeight = 'bold';
                jobMsg.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)';
                consoleDiv.prepend(jobMsg);
            }
            jobMsg.innerHTML = `Job is running, result will be available here : <br>
                <a href="${synflowURL}" target="_blank">${synflowURL}</a>
                <button id="copy-link-btn" style="margin-left:10px;padding:4px 10px;border-radius:4px;border:1px solid #b2d8b2;background:#fff;cursor:pointer;">Copy Link</button>`;

            const copyBtn = document.getElementById('copy-link-btn');
            copyBtn.addEventListener('click', (event) => {
                event.preventDefault();
                navigator.clipboard.writeText(synflowURL)
                    .then(() => {
                        copyBtn.textContent = 'Copied!';
                        setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1500);
                    })
                    .catch(() => {
                        copyBtn.textContent = 'Error';
                        setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1500);
                    });
            });

        });

        //reception des resultats de toolkit
        document.addEventListener('ToolkitResultEvent', (event) => {
            const data = event.detail;
            console.log('Data received in other script:', data);

            //C'etait pour galaxy, c'est géré dans toolkit maintenant
            //data to path
            // data type = /opt/projects/gemo.southgreen.fr/prod/tmp/toolkit_run/toolkit_AmC0Yl-V3-bZ4f9OAAFq/ref_querry.txt
            //path type = https://gemo.southgreen.fr/tmp/toolkit_run/toolkit_AmC0Yl-V3-bZ4f9OAAFq/ref_querry.txt
            // const toolkitID = data.split('/')[7];
            // const fileName = data.split('/')[8];
            // const path = `https://gemo.southgreen.fr/tmp/toolkit_run/${toolkitID}/${fileName}`;
            // console.log(path);

            const path = data;

            //affiche un bouton dans la console pour charger les fichiers dans le formulaire
            const loadOutputButton = document.createElement('button');
            loadOutputButton.textContent = 'Draw Output';
            loadOutputButton.style.marginLeft = '10px';
            loadOutputButton.style.marginTop = '10px';
            loadOutputButton.style.display = 'block';
            const consoleDiv = document.getElementById('console');
            consoleDiv.appendChild(loadOutputButton);

            //scroll jusqu'en bas de la console    
            consoleDiv.scrollTop = consoleDiv.scrollHeight;


            // event pour lancer le dessin des fichiers de sortie
            loadOutputButton.addEventListener('click', async (event) => {
                //prevent default
                event.preventDefault();
                try {

                    // Sélectionne et affiche l'onglet 'upload'
                    const menuColumn = document.querySelector('[data-option="upload"]');
                    if (menuColumn) menuColumn.click();

                    const response = await fetch(path);
                    const text = await response.text();
                    const fileName = path.split('/').pop();
                    const bandFile = new File([text], fileName, { type: 'text/plain' });
                
                
                    // Creating DataTransfer objects to simulate file upload
                    // const chrLenDataTransfer = new DataTransfer();
                    const bandDataTransfer = new DataTransfer();
                
                    // Add files to the DataTransfer objects
                    bandDataTransfer.items.add(bandFile);
                
                    // Set the files to the input fields
                    const bandInput = document.getElementById('band-files');
                
                    // chrLenInput.files = chrLenDataTransfer.files;
                    bandInput.files = bandDataTransfer.files;
                
                    // Update the file lists
                    // updateFileList(chrLenInput, document.getElementById('chrlen-file-list'));
                    updateFileList(bandInput, document.getElementById('band-file-list'));
                } catch (error) {
                    console.error('Error fetching the file:', error);
                }
            });
        })
    // });
    // const formContainer = document.getElementById('form-container');
    // formContainer.appendChild(toolkitContainer);
    return toolkitContainer;
}




export function updateFileList(inputElement, fileListElement) {
    const files = inputElement.files;
    fileListElement.innerHTML = ''; // Clear the previous file list
    for (let i = 0; i < files.length; i++) {
        const listItem = document.createElement('div');
        listItem.textContent = files[i].name;
        fileListElement.appendChild(listItem);
    }
}




function readChromosomeLengths(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const lengths = {};
            const lines = event.target.result.split('\n');
            lines.forEach(line => {
                const parts = line.split('\t');
                if (parts.length === 2) {
                    lengths[parts[0]] = +parts[1];
                }
            });
            resolve(lengths);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}

export let genomeLengths = {};

export function loadAllChromosomeLengths(files) {
    const lengthPromises = Array.from(files).map(file => {
        const genome = file.name.replace('.chrlen', ''); // Extraire le nom du génome sans l'extension
        return readChromosomeLengths(file).then(lengths => {
            genomeLengths[genome] = lengths;
        });
    });
    return Promise.all(lengthPromises);
}

async function loadTestData() {
    // Define paths to your test files
    const testBandFiles = [
        'public/data/C21-464_C23-A03.out',
        'public/data/C23-A03_C45-410.out',
        'public/data/C45-410_C5-126-2.out',
        'public/data/DH-200-94_C21-464.out'
    ];

    const bandFiles = await Promise.all(testBandFiles.map(async path => {
        const response = await fetch(path);
        const text = await response.text();
        const fileName = path.split('/').pop();
        return new File([text], fileName, { type: 'text/plain' });
    }));

    // Creating DataTransfer objects to simulate file upload
    const bandDataTransfer = new DataTransfer();

    // Add files to the DataTransfer objects
    bandFiles.forEach(file => bandDataTransfer.items.add(file));

    // Set the files to the input fields
    const bandInput = document.getElementById('band-files');

    // chrLenInput.files = chrLenDataTransfer.files;
    bandInput.files = bandDataTransfer.files;

    // Update the file lists
    updateFileList(bandInput, document.getElementById('band-file-list'));
}