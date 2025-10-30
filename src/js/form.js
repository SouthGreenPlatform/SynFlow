import * as toolkit from '../../toolkit/toolkit.js';
import { createLegendContainer } from './legend.js';
import { zoom } from './draw.js';
import { handleFileUpload, extractAllGenomes, spinner } from './process.js';
import { calculateAnnotationDensity } from './process.js';

//mode de chargement des fichiers
export let fileUploadMode = ''; //  'remote' ou 'local'
export let fileOrderMode = ''; //'allavsall' ou 'chain'
export let jbrowseLinks = {}; //liste des lien jbrowse pour les genome sélectionnés dans "existing files"
export let anchorsFiles = [];
export let bedFiles = [];

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
    `;

    // Event listener sur headerBar
    headerBar.addEventListener('click', (event) => {
        event.preventDefault();
        if(formContent.style.maxHeight === '0px' || !formContent.style.maxHeight) {
            // formContent.style.maxHeight = formContent.scrollHeight + 'px';
            formContent.style.maxHeight = 'unset'; // Pour une animation fluide
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
    menuColumn.setAttribute('class', 'menu-section');

    const menuItems = [
        { id: 'existing', icon: 'fas fa-folder-open', text: 'Existing Files' },
        { id: 'upload', icon: 'fas fa-upload', text: 'Upload Files' },
        { id: 'ftp', icon: 'fas fa-network-wired', text: 'Browse FTP' },
        { id: 'calculate', icon: 'fas fa-cogs', text: 'Run analysis' }
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
            case 'ftp':
                contentColumn.appendChild(createFTPSection());
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
function fetchRemoteOutFileList(folder) {
    // Normalise l'URL pour s'assurer qu'elle se termine par un /
    let url = folder.trim();
    if (!url.endsWith('/')) {
        url += '/';
    }
    
    console.log('Fetching out files from:', url);
    
    return fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'text/html'
        }
    })
        .then(response => {
            if (!response.ok) throw new Error(`Erreur ${response.status}: ${response.statusText}`);
            return response.text();
        })
        .then(html => {
            // Parse le HTML pour extraire les liens vers les fichiers .out
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'));
            
            // Filtre les fichiers .out en utilisant l'attribut href
            const files = links
                .map(link => {
                    const href = link.getAttribute('href');
                    // Ignore le lien parent (..)
                    if (!href || href === '../') return null;
                    // Retourne seulement les fichiers .out
                    if (href.endsWith('.out')) {
                        return href;
                    }
                    return null;
                })
                .filter(name => name !== null);
            
            console.log('Fichiers .out trouvés:', files);
            return files;
        });
}

// Fonction pour récupérer la liste de tous les fichiers depuis un dossier distant
function fetchRemoteAllFileList(folder) {
    // Normalise l'URL pour s'assurer qu'elle se termine par un /
    let url = folder.trim();
    if (!url.endsWith('/')) {
        url += '/';
    }
    
    console.log('Fetching all files from:', url);
    
    return fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'text/html'
        }
    })
        .then(response => {
            if (!response.ok) throw new Error(`Erreur ${response.status}: ${response.statusText}`);
            return response.text();
        })
        .then(html => {
            // Parse le HTML pour extraire les liens vers les fichiers .out
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'));
            
            // Filtre les fichiers parents seulement
            const files = links
                .map(link => {
                    const href = link.getAttribute('href');
                    // Ignore le lien parent (..)
                    if (!href || href === '../') return null;
                    //ignore les dossiers (ceux qui se terminent par /)
                    if (href.endsWith('/')) return null;
                    return href;
                })
                .filter(name => name !== null);
            
            console.log('Fichiers trouvés:', files);
            return files;
        });
}

function updateChainDiv() {
    const chainDiv = document.getElementById('selected-chain');
    if(chainDiv){
         if (selectedGenomes.length > 0) {
            chainDiv.innerHTML = `<b>Selected chain :</b> <br>${selectedGenomes.join(' &rarr; ')}`;
        } else {
            chainDiv.innerHTML = '';
        }
    }
   
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

    //charge la liste des fichiers disponibles
    function loadFiles(folder) {
        fileListDiv.innerHTML = '';
        selectedGenomes = [];
        updateChainDiv();
        fetchRemoteAllFileList(folder).then(files => {
            const genomes = extractAllGenomes(files);
            populateGenomeList(genomes, fileListDiv);
            updateFileMatrix(files);
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

        // Réinitialise les variables de dessin
        const visualizationContainer = document.getElementById('viz');
        visualizationContainer.innerHTML = ''; // Efface le contenu existant
        d3.select('#info').html('');
        d3.select("#viz").call(zoom);
        // Ajoutez un groupe à l'intérieur de l'élément SVG pour contenir les éléments zoomables
        d3.select("#viz").append("g").attr("id", "zoomGroup");

        if (selectedGenomes.length < 2) {
            chainDiv.innerHTML = '<span style="color:red;">Please select at least 2 genomes to construct a chain.</span>';
            return;
        }

        // Récupère la liste des fichiers disponibles dans le dossier sélectionné
        const folder = folderSelect.value;
        const allFiles = await fetchRemoteOutFileList(folder);
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
            chainDiv.innerHTML = `<span style="color:red;">Missing file(s) :<br>${missingFiles.join('<br>')}</span>`;
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

        //cherche les fichiers anchors, bed et jbrowse associés
        await searchAdditionalFiles(selectedGenomes, files, folder);

        // Simule un input file multiple pour handleFileUpload
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        handleFileUpload(dataTransfer.files, bedFiles);
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
    helpContainer.style.maxHeight = '300px'; // Hauteur maximale
    helpContainer.style.overflowY = 'auto'; // Scroll si le contenu dépasse

    // Contenu de l'aide
    helpContainer.innerHTML = `
        <h5>File Requirements</h5>
        <div style="margin-top: 15px;">
            <h6>SyRI output files (.out)</h6>
            <ul style="padding-left: 20px;">
                <li>Files must be in SyRI output format. <a href="https://schneebergerlab.github.io/syri/fileformat.html" target="_blank">See the SyRI documentation</a></li>
                <li>The file names should follow the pattern: <strong>ref-genome_query-genome.out</strong></li>
                <li>Files can be chained for multiple genome comparisons (chain mode), or you can upload all possible pairs (all vs all mode).</li>
            </ul>
            
            <div style="margin: 15px 0; padding: 10px; background-color: #fff; border-radius: 4px;">
                <strong>Example of file chain for 3 genomes :</strong>
                <ul style="padding-left: 20px;">
                    <li>A-thaliana_C-rubella.out</li>
                    <li>C-rubella_B-rapa.out</li>
                    <li>B-rapa_O-sativa.out</li>
                </ul>
                <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    This will create a visualization chain: A-thaliana → C-rubella → B-rapa → O-sativa
                </p>
            </div>
            <div style="margin: 15px 0; padding: 10px; background-color: #fff; border-radius: 4px;">
                <strong>Example of all vs all for 3 genomes:</strong>
                <div style="display: flex; gap: 30px;">
                    <ul style="padding-left: 20px; margin:0;">
                        <li>A-thaliana_C-rubella.out</li>
                        <li>C-rubella_A-thaliana.out</li>
                        <li>A-thaliana_B-rapa.out</li>
                        <li>B-rapa_A-thaliana.out</li>
                        <li>A-thaliana_O-sativa.out</li>
                        <li>O-sativa_A-thaliana.out</li>
                    </ul>
                    <ul style="padding-left: 20px; margin:0;">
                        <li>C-rubella_B-rapa.out</li>
                        <li>B-rapa_C-rubella.out</li>
                        <li>C-rubella_O-sativa.out</li>
                        <li>O-sativa_C-rubella.out</li>
                        <li>B-rapa_O-sativa.out</li>
                        <li>O-sativa_B-rapa.out</li>
                    </ul>
                </div>
                <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    If all possible pairs are detected, you will be asked to select the order of genomes for the visualization chain.
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
    //fichiers acceptés = out bed anchors json
    bandInput.setAttribute('accept', '.out,.bed,.anchors,.json');
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
            //compte chaque type de fichier
            const fileCounts = {
                out: 0,
                bed: 0,
                anchors: 0,
                json: 0
            };
            Array.from(bandInput.files).forEach(file => {
                const ext = file.name.split('.').pop();
                if (fileCounts.hasOwnProperty(ext)) {
                    fileCounts[ext]++;
                }
            });
            
            fileLabel.textContent = `${bandInput.files.length} file(s) selected`;
            const details = [];
            for (const [ext, count] of Object.entries(fileCounts)) {
                if (count > 0) {
                    details.push(`${count} ${ext} file(s)`);
                }
            }
            fileLabel.textContent += ` (${details.join(', ')})`;

            // Chercher le fichier .json
            const jbrowseFile = Array.from(bandInput.files).find(file => file.name.endsWith('.json'));
            if (jbrowseFile) {
                console.log('jbrowse_link.json found, reading...');
                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        jbrowseLinks = JSON.parse(event.target.result);
                        console.log('Found jbrowse links:', jbrowseLinks);
                    } catch (error) {
                        console.log('Error parsing jbrowse_link.json:', error);
                    }
                };
                reader.readAsText(jbrowseFile);
            }

            //met les fichiers .anchors dans anchorsFiles
            anchorsFiles = Array.from(bandInput.files).filter(file => file.name.endsWith('.anchors'));
            //met les fichiers .bed dans bedFiles
            bedFiles = Array.from(bandInput.files).filter(file => file.name.endsWith('.bed'));
            console.log('Anchors files:', anchorsFiles);
            console.log('Bed files:', bedFiles);


            //////////////////
            //matrix
            updateFileMatrix(bandInput.files);


        } else {
            fileLabel.textContent = 'No files chosen';
            
            //////////////////
            //matrix
            updateFileMatrix([]); // Supprime la matrice si aucun fichier

        }
    });

    // const bandFileList = document.createElement('div');
    // bandFileList.setAttribute('id', 'band-file-list');
    // bandFileList.classList.add('file-list');

    bandContainer.appendChild(bandH5);
    bandContainer.appendChild(document.createElement('br'));
    bandContainer.appendChild(bandInput);
    bandContainer.appendChild(customButton);
    bandContainer.appendChild(fileLabel);
    // bandContainer.appendChild(bandFileList);

    // Append containers to input container
    inputContainer.appendChild(bandContainer);

    //affiche la chain
    const chainDiv = document.createElement('div');
    chainDiv.setAttribute('id', 'selected-chain');
    chainDiv.style.marginTop = '15px';
    chainDiv.style.fontSize = '0.95em';
    chainDiv.style.color = '#333';


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


        //si mode allavsall
        //récupère la chaine choisi par l'utilisateur
        if(fileOrderMode === 'allvsall'){
            if (selectedGenomes.length < 2) {
                chainDiv.innerHTML = '<span style="color:red;">Please select at least 2 genomes to construct a chain.</span>';
                return;
            }

            // Nettoie les espaces autour des noms de fichiers
            const files = document.getElementById('band-files').files;
            const allFilesTrimmed = Array.from(files).map(f => f.name.trim());
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
                chainDiv.innerHTML = `<span style="color:red;">Missing file(s) :<br>${missingFiles.join('<br>')}</span>`;
                return;
            }

            // Récupère les objets File correspondant à neededFiles
            const filesArray = Array.from(files);
            const filesToSend = neededFiles.map(name =>
                filesArray.find(f => f.name.trim() === name)
            );

            // Vérifie qu'on a bien tous les objets File
            if (filesToSend.includes(undefined)) {
                chainDiv.innerHTML = `<span style="color:red;">Internal error: some files not found.</span>`;
                return;
            }
            handleFileUpload(filesToSend);


        }else{
            //sinon charge comme avant a partir des fichiers.
            const bandFiles = document.getElementById('band-files').files;
            handleFileUpload(bandFiles);
        }
    });

    bandInput.addEventListener('change', (event) => {
        updateFileList(bandInput);
    });
        

     // Boutons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '20px';
    buttonContainer.appendChild(loadTestButton);
    buttonContainer.appendChild(submitButton);

    // Assemblage final
    formContainer.appendChild(inputContainer);
    formContainer.appendChild(chainDiv);
    formContainer.appendChild(buttonContainer);
    
    uploadSection.appendChild(document.createElement('br'));
    uploadSection.appendChild(formContainer);
    uploadSection.appendChild(helpContainer);

    return uploadSection;
}






//
//      ///////////    /////////////    ////////////
//     //                  //          //        //
//    /////               //          ////////////
//   //                  //          //    
//  //                  //          //
//

export function createFTPSection() {
    // Section principale
    const ftpSection = document.createElement('div');
    ftpSection.setAttribute('id', 'ftp-section');
    ftpSection.style.display = 'flex';
    ftpSection.style.gap = '20px';

    // Partie gauche : formulaire FTP
    const formContainer = document.createElement('div');
    formContainer.style.flex = '1';

    const title = document.createElement('h5');
    title.textContent = 'Import files from FTP';
    title.style.marginBottom = '10px';
    formContainer.appendChild(title);

    // Champ d'URL FTP
    const ftpInput = document.createElement('input');
    ftpInput.setAttribute('type', 'text');
    ftpInput.setAttribute('id', 'ftp-input');
    ftpInput.setAttribute('placeholder', 'Paste FTP folder URL here');
    ftpInput.style.width = '100%';
    ftpInput.style.marginBottom = '5px';
    formContainer.appendChild(ftpInput);

    //exemple cliquable
    const exampleLink = document.createElement('a');
    exampleLink.setAttribute('href', 'https://hpc.cirad.fr/bank/banana/synflow/');
    exampleLink.setAttribute('target', '_blank');
    exampleLink.textContent = 'Example: https://hpc.cirad.fr/bank/banana/synflow/';
    exampleLink.style.display = 'block';
    exampleLink.style.marginBottom = '10px';
    exampleLink.style.color = 'grey';
    exampleLink.style.fontSize = '0.9em';
    exampleLink.style.fontStyle = 'italic';
    exampleLink.style.textDecoration = 'none';
    exampleLink.addEventListener('click', (event) => {
        event.preventDefault(); // Empêche le comportement par défaut du lien
        ftpInput.value = exampleLink.href; // Remplit le champ d'URL avec l'exemple
    });
    formContainer.appendChild(exampleLink);

    // Bouton pour charger la liste des fichiers
    const fetchButton = document.createElement('button');
    fetchButton.setAttribute('type', 'button');
    fetchButton.setAttribute('id', 'fetch-ftp-button');
    fetchButton.classList.add('btn-simple');
    fetchButton.textContent = 'Fetch Files';
    fetchButton.style.marginBottom = '10px';
    formContainer.appendChild(fetchButton);

    // Liste des fichiers .out trouvés
    const fileListDiv = document.createElement('div');
    fileListDiv.setAttribute('id', 'ftp-files-list');
    fileListDiv.style.maxHeight = '180px';
    fileListDiv.style.overflowY = 'auto';
    fileListDiv.style.border = '1px solid #ccc';
    fileListDiv.style.padding = '5px';
    fileListDiv.style.display = 'none';
    formContainer.appendChild(fileListDiv);

    // Affichage de la chaîne sélectionnée
    const chainDiv = document.createElement('div');
    chainDiv.setAttribute('id', 'selected-chain-ftp');
    chainDiv.style.marginTop = '15px';
    chainDiv.style.fontSize = '0.95em';
    chainDiv.style.color = '#333';
    formContainer.appendChild(chainDiv);

    // Bouton pour lancer la visualisation
    const drawButton = document.createElement('button');
    drawButton.setAttribute('type', 'button');
    drawButton.classList.add('btn-magic');
    drawButton.textContent = 'Draw';
    drawButton.style.marginTop = '10px';
    formContainer.appendChild(drawButton);

    // Sélection ordonnée
    let ftpSelectedGenomes = [];

    fetchButton.addEventListener('click', async () => {
        fileListDiv.innerHTML = '';
        fileListDiv.style.display = 'block';

        ftpSelectedGenomes = [];
        chainDiv.innerHTML = '';
        
        // Récupère la valeur brute sans transformation
        const folder = ftpInput.value.trim();
        
        console.log('URL saisie:', folder); // Pour vérifier que le port est présent
        
        if (!folder) {
            fileListDiv.innerHTML = '<span style="color:red;">Please enter a valid FTP folder URL.</span>';
            return;
        }
        
        // Vérification que le port est bien présent
        if (folder.includes('localhost') && !folder.includes(':8080')) {
            fileListDiv.innerHTML = '<span style="color:red;">Port 8080 is missing from the URL.</span>';
            return;
        }
        
        try {
            const files = await fetchRemoteAllFileList(folder);

            // Met à jour la matrice avec les fichiers récupérés
            updateFileMatrix(files);

            if (files.length === 0) {
                fileListDiv.innerHTML = '<span style="color:red;">No .out files found in this folder.</span>';
                return;
            }
            const genomes = extractAllGenomes(files);
            const outFiles = Array.from(files).filter(file => {
                // Si c'est un objet File, utilise file.name, sinon utilise la chaîne directement
                const fileName = typeof file === 'string' ? file : file.name;
                return fileName.endsWith('.out');
            });
            
            // Mode all vs all ou chaîne
            const expectedFileCount = genomes.length * (genomes.length - 1);
            
            if (outFiles.length === 1 && genomes.length === 2) {
                // Mode chaîne avec 2 génomes
                console.log(outFiles, genomes);
                //mets les genomes dans l'ordre d'apparition du nom du fichier out
                const file = outFiles[0];
                const parts = file.replace('.out', '').split('_').map(part => part.trim());
                ftpSelectedGenomes = parts;
                updateChainDivFTP(chainDiv, ftpSelectedGenomes);
            } else if (outFiles.length === expectedFileCount) {
                // Mode all vs all
                fileListDiv.innerHTML = '<div style="margin-bottom:8px;color:#555;font-style:italic;">Select genomes in the desired order for the chain.</div>';
                populateGenomeListFTP(genomes, fileListDiv, ftpSelectedGenomes, chainDiv);
            } else {
                // Mode chaîne
                ftpSelectedGenomes = genomes;
                updateChainDivFTP(chainDiv, ftpSelectedGenomes);
            }
        } catch (error) {
            fileListDiv.innerHTML = `<span style="color:red;">Error fetching files: ${error.message}</span>`;
        }
    });

    //press enter is clicking the submit button
    ftpInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Empêche le comportement par défaut du formulaire
            fetchButton.click();
        }
    });

    // Fonction pour afficher la chaîne sélectionnée
    function updateChainDivFTP(chainDiv, genomes) {
        if (genomes.length > 0) {
            chainDiv.innerHTML = `<b>Selected chain :</b> <br>${genomes.join(' &rarr; ')}`;
        } else {
            chainDiv.innerHTML = '';
        }
    }

    // Fonction pour afficher la liste des génomes et gérer la sélection
    function populateGenomeListFTP(genomes, listDiv, selectedGenomes, chainDiv) {
        listDiv.innerHTML = '';
        genomes.forEach(genome => {
            const genomeDiv = document.createElement('div');
            genomeDiv.style.cursor = 'pointer';
            genomeDiv.style.padding = '4px 8px';
            genomeDiv.style.margin = '2px 0';
            genomeDiv.style.borderRadius = '4px';
            genomeDiv.style.transition = 'background 0.2s';
            genomeDiv.classList.add('genome-item');
            genomeDiv.dataset.fileName = genome;
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
                updateChainDivFTP(chainDiv, selectedGenomes);
            });

            listDiv.appendChild(genomeDiv);
        });
    }

    // Handler du bouton Draw
    drawButton.addEventListener('click', async () => {
        // Lance le spinner
        var target = document.getElementById('spinner');
        spinner.spin(target);

        fileUploadMode = 'remote'; // Mode FTP = remote

        if (ftpSelectedGenomes.length < 2) {
            chainDiv.innerHTML = '<span style="color:red;">Please select at least 2 genomes to construct a chain.</span>';
            return;
        }

        const folder = ftpInput.value.trim();
        const allFiles = await fetchRemoteOutFileList(folder);
        //nettoie les espaces autour des noms de fichiers
        const allFilesTrimmed = allFiles.map(f => f.trim());

        // Construit la liste des fichiers nécessaires pour la chaîne
        const neededFiles = [];
        let missingFiles = [];
        for (let i = 0; i < ftpSelectedGenomes.length - 1; i++) {
            const fileName = `${ftpSelectedGenomes[i]}_${ftpSelectedGenomes[i+1]}.out`;
            //nettoie les espaces autour des noms de fichiers
            const fileNameTrimmed = fileName.trim();
            if (allFilesTrimmed.includes(fileNameTrimmed)) {
                neededFiles.push(fileNameTrimmed);
            } else {
                missingFiles.push(fileNameTrimmed);
            }
        }

        // Affiche un message si des fichiers sont manquants
        if (missingFiles.length > 0) {
            chainDiv.innerHTML = `<span style="color:red;">Missing file(s) :<br>${missingFiles.join('<br>')}</span>`;
            return;
        }

        // Télécharge les fichiers nécessaires et crée des objets File
        const files = await Promise.all(neededFiles.map(async file => {

            //ajoute un slash à la fin du folder si pas présent
            const folderWithSlash = folder.endsWith('/') ? folder : folder + '/';
            const filePath = `${folderWithSlash}${file}`;
            const response = await fetch(filePath);
            const text = await response.text();
            return new File([text], file, { type: 'text/plain' });
        }));

        //cherche les fichiers anchors, bed et jbrowse associés
        await searchAdditionalFiles(ftpSelectedGenomes, files, folder);

        // Simule un input file multiple pour handleFileUpload
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));

        // Appelle la fonction de visualisation
        const visualizationContainer = document.getElementById('viz');
        visualizationContainer.innerHTML = '';
        d3.select('#info').html('');
        d3.select("#viz").call(zoom);
        d3.select("#viz").append("g").attr("id", "zoomGroup");
        handleFileUpload(dataTransfer.files);
    });

    // Partie droite : aide
    const helpContainer = document.createElement('div');
    helpContainer.style.flex = '0 0 600px';
    helpContainer.style.padding = '15px';
    helpContainer.style.backgroundColor = '#f8f9fa';
    helpContainer.style.borderRadius = '5px';
    helpContainer.style.border = '1px solid #dee2e6';
    helpContainer.style.maxHeight = '300px';
    helpContainer.style.overflowY = 'auto';

    helpContainer.innerHTML = `
        <h5>FTP Import Help</h5>
        <div style="margin-top: 15px;">
            <ul style="padding-left: 20px;">
                <li>Paste the FTP folder URL containing your SyRI output files (.out).</li>
                <li>Click "Fetch Files" to list available files.</li>
                <li>If all possible pairs are detected, select genomes in the desired order for the chain.</li>
                <li>Click "Draw" to visualize the selected chain.</li>
            </ul>
            <div style="margin: 15px 0; padding: 10px; background-color: #fff; border-radius: 4px;">
                <strong>Example FTP URL:</strong>
                <div style="margin-top:5px; font-size:0.95em; color:#333;">
                    ftp://yourserver.org/path/to/syri/results/
                </div>
            </div>
            <div style="margin: 15px 0; padding: 10px; background-color: #fff; border-radius: 4px;">
                <strong>File naming:</strong>
                <ul style="padding-left: 20px;">
                    <li>ref-genome_query-genome.out</li>
                    <li>All vs all mode: all possible pairs must be present.</li>
                    <li>Chain mode: only consecutive pairs are needed.</li>
                </ul>
            </div>
        </div>
    `;

    // Assemblage final
    ftpSection.appendChild(formContainer);
    ftpSection.appendChild(helpContainer);

    return ftpSection;
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
            event = new CustomEvent('consoleMessage', { detail: 'Job is running, result will be available here for 10 days: ' + synflowURL });
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
            jobMsg.innerHTML = `Job is running, result will be available here for 10 days: <br>
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
         
           //ENLEVE LE BOUTON DRAW
            // MAINTENANT IL Y A LE LIEN
            // consoleDiv.appendChild(loadOutputButton);

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
                    updateFileList(bandInput);
                } catch (error) {
                    console.error('Error fetching the file:', error);
                }
            });
        })

    return toolkitContainer;
}




export function updateFileList(inputElement) {

    //reinitialise la liste des genomes
    selectedGenomes = [];
    updateChainDiv();

    const files = inputElement.files;
    const outFiles = Array.from(files).filter(file => file.name.endsWith('.out'));
    const anchorsFiles = Array.from(files).filter(file => file.name.endsWith('.anchors'));
    const bedFiles = Array.from(files).filter(file => file.name.endsWith('.bed'));
    const jsonFiles = Array.from(files).filter(file => file.name.endsWith('.json'));

    // fileListElement.innerHTML = ''; // Clear the previous file list
    // for (let i = 0; i < outFiles.length; i++) {
    //     const listItem = document.createElement('div');
    //     listItem.textContent = outFiles[i].name;
    //     fileListElement.appendChild(listItem);
    // }

    //detecte le all vs all
    const genomes = extractAllGenomes(outFiles.map(file => file.name));
    const expectedFileCount = genomes.length * (genomes.length - 1);


    if (outFiles.length === expectedFileCount) {
        // Mode all vs all
        fileOrderMode = 'allvsall';
        console.log("All vs All mode detected with genomes: ", genomes);
        //affiche un message pour selectionner les genomes dans l'ordre souhaité : 
        const allvsAllMessage = document.createElement('div');
        allvsAllMessage.textContent = 'Select genomes in the desired order for the chain.';
        allvsAllMessage.style.marginTop = '10px';
        allvsAllMessage.style.fontSize = '0.9em';
        allvsAllMessage.style.color = '#555';
        allvsAllMessage.style.fontStyle = 'italic';
        allvsAllMessage.style.padding = '5px';
        allvsAllMessage.style.backgroundColor = '#f9f9f9';
        allvsAllMessage.style.border = '1px solid #ddd';
        allvsAllMessage.style.borderRadius = '4px';
        allvsAllMessage.style.textAlign = 'center';
        //affiche le selection des genomes
        const fileListDiv = document.createElement('div');
        fileListDiv.setAttribute('id', 'existing-files-list');
        fileListDiv.style.maxHeight = '180px';
        fileListDiv.style.overflowY = 'auto';
        fileListDiv.style.border = '1px solid #ccc';
        fileListDiv.style.padding = '5px';

        //append à la fin de l'element inputElement
        inputElement.parentNode.appendChild(allvsAllMessage);
        inputElement.parentNode.appendChild(fileListDiv);


        populateGenomeList(genomes, fileListDiv);

        
    } else {
        // Mode chaîne
        fileOrderMode = 'chain';
        console.log("Chain mode detected with genomes: ", genomes);

        // Sélection ordonnée
        selectedGenomes = genomes;
        updateChainDiv();
    }
}

function populateGenomeList(genomes, listDiv){
    genomes.forEach(genome => {
        const genomeDiv = document.createElement('div');
        genomeDiv.style.cursor = 'pointer';
        genomeDiv.style.padding = '4px 8px';
        genomeDiv.style.margin = '2px 0';
        genomeDiv.style.borderRadius = '4px';
        genomeDiv.style.transition = 'background 0.2s';
        genomeDiv.classList.add('genome-item');
        genomeDiv.dataset.fileName = genome; // vrai nom de fichier

        //affiche le nom sans tiret et avec une majuscule en première lettre
        genomeDiv.textContent = genome.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());

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

        listDiv.appendChild(genomeDiv);
    });
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
    updateFileList(bandInput);
}

async function searchAdditionalFiles(selectedGenomes, files, folder) {
    const folderWithSlash = folder.endsWith('/') ? folder : folder + '/';

    //Cherche s'il y a un fichier .bed pour chaque genome et si oui, le télécharge
    bedFiles = await Promise.all(selectedGenomes.map(async genome => {
        const bedFilePath = `${folderWithSlash}${genome}.bed`;
        //si le fichier existe on le télécharge
        try {
            const response = await fetch(bedFilePath);
            if (response.ok) {
                const text = await response.text();
                return new File([text], `${genome}.bed`, { type: 'text/plain' });
            }
        } catch (error) {
            console.log(`Error fetching bed file for ${genome}:`, error);
        }
        
        return null;
    }));

    //Cherche les fichiers .anchors correspondant aux fichiers .out sélectionnés
    anchorsFiles = [];
    files.forEach(async file => {
        const anchorsFileName = file.name.replace('.out', '.anchors');
        const anchorsFilePath = `${folderWithSlash}${anchorsFileName}`;
        try {
            const response = await fetch(anchorsFilePath);
            if (response.ok) {
                const text = await response.text();
                anchorsFiles.push(new File([text], anchorsFileName, { type: 'text/plain' }));
            }
        } catch (error) {
            console.log(`Error fetching anchors file for ${file.name}:`, error);
        }
    });
    
    //cherche s'il y a un fichier jbrowse_links.json dans le dossier et si oui, le télécharge
    const jbrowseFileName = 'jbrowse_link.json';
    const jbrowseFilePath = `${folderWithSlash}${jbrowseFileName}`;

    try {
        const jbrowseResponse = await fetch(jbrowseFilePath);
        if (jbrowseResponse.ok) {
            jbrowseLinks = await jbrowseResponse.json();   
            console.log(jbrowseLinks);         
        }
    } catch (error) {
        console.log("No jbrowse links");
    }
}














/**
 * Crée et affiche une matrice des fichiers détectés (version compacte)
 * @param {FileList} files - Liste des fichiers uploadés
 * @param {string} containerId - ID du container où afficher la matrice
 */
function createFileMatrix(files, containerId = 'file-matrix-container') {
    // Analyse des fichiers
    const outFiles = [];
    const bedFiles = new Set();
    const anchorFiles = new Set();
    let hasJsonFile = false;
    
    Array.from(files).forEach(file => {
        // Gère à la fois les objets File et les chemins de fichiers distants
        const fileName = file.name || (typeof file === 'string' ? file.split('/').pop() : null);
        if (!fileName) {
            console.warn("Fichier sans nom détecté:", file);
            return;
        }
        const ext = fileName.split('.').pop();
        
        if (ext === 'out') {
            // Parse le nom du fichier pour extraire les génomes
            const baseName = fileName.replace('.out', '');
            const parts = baseName.split('_');
            if (parts.length === 2) {
                outFiles.push({ 
                    from: parts[0], 
                    to: parts[1], 
                    fileName: fileName 
                });
            }
        } else if (ext === 'bed') {
            // Extrait le nom du génome du fichier BED
            const genomeName = fileName.replace('.bed', '');
            bedFiles.add(genomeName);
        } else if (ext === 'anchors') {
            // Parse le fichier anchors (format: genome1_genome2.anchors)
            const baseName = fileName.replace('.anchors', '');
            anchorFiles.add(baseName);
        } else if (ext === 'json') {
            hasJsonFile = true;
        }
    });
    
    // Extrait tous les génomes uniques
    const genomesSet = new Set();
    outFiles.forEach(comp => {
        genomesSet.add(comp.from);
        genomesSet.add(comp.to);
    });
    const genomes = Array.from(genomesSet).sort();
    
    if (genomes.length === 0) {
        return null; // Pas de génomes détectés
    }
    
    // Crée la matrice de comparaisons
    const comparisonMatrix = {};
    outFiles.forEach(comp => {
        const key = `${comp.from}_${comp.to}`;
        comparisonMatrix[key] = {
            fileName: comp.fileName,
            hasAnchor: anchorFiles.has(`${comp.from}_${comp.to}`) || anchorFiles.has(`${comp.to}_${comp.from}`)
        };
    });
    
    // Trouve ou crée le container
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.setAttribute('id', containerId);
        container.style.marginTop = '20px';
        container.style.padding = '15px';
        container.style.backgroundColor = '#f8f9fa';
        container.style.borderRadius = '5px';
        container.style.border = '1px solid #dee2e6';
    }
    
    // Efface le contenu existant
    container.innerHTML = '';
    
    // Titre
    const title = document.createElement('h5');
    title.textContent = 'Genome Comparison Matrix';
    title.style.marginBottom = '15px';
    container.appendChild(title);
    
    // Stats rapides
    const statsDiv = document.createElement('div');
    statsDiv.style.display = 'flex';
    statsDiv.style.gap = '15px';
    statsDiv.style.marginBottom = '15px';
    statsDiv.style.fontSize = '0.9em';
    
    const stats = [
        { label: 'Genomes', value: genomes.length, color: '#6366f1' },
        { label: 'with annotation', value: bedFiles.size, color: '#f59e0b' },
        { label: 'Comparisons', value: outFiles.length, color: '#8b5cf6' },
        { label: 'with anchors', value: Object.values(comparisonMatrix).filter(c => c.hasAnchor).length, color: '#10b981' },
        { label: 'JBrowse links', value: hasJsonFile ? '✓' : '✗', color: hasJsonFile ? '#10b981' : '#ef4444' }
    ];
    
    stats.forEach(stat => {
        const statBox = document.createElement('div');
        statBox.style.padding = '8px 12px';
        statBox.style.backgroundColor = 'white';
        statBox.style.borderRadius = '4px';
        statBox.style.border = '1px solid #e5e7eb';
        statBox.innerHTML = `
            <div style="font-weight: bold; color: ${stat.color}; font-size: 1.2em;">${stat.value}</div>
            <div style="color: #6b7280; font-size: 0.85em;">${stat.label}</div>
        `;
        statsDiv.appendChild(statBox);
    });
    container.appendChild(statsDiv);
    
    // Bouton pour afficher/cacher la matrice
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.classList.add('btn-simple');
    toggleButton.textContent = '▼ Show File Matrix';
    container.appendChild(toggleButton);
    
    // Légende
    const legend = document.createElement('div');
    legend.style.display = 'flex';
    legend.style.gap = '15px';
    legend.style.padding = '10px';
    legend.style.backgroundColor = 'white';
    legend.style.borderRadius = '4px';
    legend.style.marginBottom = '15px';
    legend.style.fontSize = '0.85em';
    legend.innerHTML = `
        <div style="display: flex; align-items: center; gap: 5px;">
            <div style="width: 16px; height: 16px; border: 2px solid #d1d5db; background-color: #ffffffff; border-radius: 3px;"></div>
            <span>No comparison</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <div style="width: 16px; height: 16px; background-color: #10b98180; border: 2px solid #d1d5db; border-radius: 3px;"></div>
            <span>Comparison</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <div style="width: 16px; height: 16px; border-radius: 3px;"><i class="fa fa-anchor"></i></div>
            <span>With anchor</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <span style="color: #f59e0b; font-weight: bold;">●</span>
            <span>Annotation available</span>
        </div>
    `;
    
    // Wrapper pour la matrice (caché par défaut)
    const matrixContainer = document.createElement('div');
    matrixContainer.style.display = 'none';
    matrixContainer.appendChild(legend);
    
    // Wrapper pour la matrice avec scroll horizontal
    const matrixWrapper = document.createElement('div');
    matrixWrapper.style.overflowX = 'auto';
    matrixWrapper.style.backgroundColor = 'white';
    matrixWrapper.style.borderRadius = '4px';
    matrixWrapper.style.padding = '10px';
    
    // Table de la matrice
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = 'auto';
    
    const backgroundColorMatrix = "white";
    const bedColorMatrix = "#f59e0b";
    const cellSize = '35px'; // Taille des cellules carrées
    
    // En-tête
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Cellule vide en haut à gauche - plus haute pour les noms inclinés
    const emptyHeader = document.createElement('th');
    emptyHeader.style.padding = '5px';
    emptyHeader.style.width = '120px';
    emptyHeader.style.height = '150px'; // Hauteur pour les noms inclinés
    emptyHeader.style.position = 'relative';
    headerRow.appendChild(emptyHeader);
    
    // En-têtes des colonnes avec rotation
    genomes.forEach(genome => {
        const th = document.createElement('th');
        th.style.padding = '0';
        th.style.width = cellSize;
        th.style.minWidth = cellSize;
        th.style.maxWidth = cellSize;
        th.style.height = '150px';
        th.style.position = 'relative';
        th.style.verticalAlign = 'bottom';
        th.style.overflow = 'visible';
        
        // Container pour le texte roté
        const rotatedDiv = document.createElement('div');
        rotatedDiv.style.transform = 'rotate(-45deg)';
        rotatedDiv.style.transformOrigin = 'bottom left';
        rotatedDiv.style.position = 'absolute';
        rotatedDiv.style.left = '20px';
        rotatedDiv.style.bottom = '0px';
        rotatedDiv.style.whiteSpace = 'nowrap';
        rotatedDiv.style.fontSize = '0.75em';
        rotatedDiv.style.fontWeight = 'bold';
        
        // Badge BED si présent (petit point coloré)
        if (bedFiles.has(genome)) {
            const bedBadge = document.createElement('span');
            bedBadge.textContent = '● ';
            bedBadge.style.color = bedColorMatrix;
            bedBadge.style.fontSize = '1em';
            rotatedDiv.appendChild(bedBadge);
        }
        
        const textSpan = document.createElement('span');
        textSpan.textContent = genome;
        rotatedDiv.appendChild(textSpan);
        
        th.appendChild(rotatedDiv);
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Corps de la table
    const tbody = document.createElement('tbody');
    
    genomes.forEach(rowGenome => {
        const row = document.createElement('tr');
        
        // En-tête de ligne
        const rowHeader = document.createElement('th');
        rowHeader.style.padding = '5px';
        rowHeader.style.backgroundColor = backgroundColorMatrix;
        rowHeader.style.textAlign = 'right';
        rowHeader.style.fontWeight = 'bold';
        rowHeader.style.fontSize = '0.75em';
        rowHeader.style.whiteSpace = 'nowrap';
        rowHeader.style.overflow = 'hidden';
        
        const rowText = document.createElement('span');
        rowText.textContent = rowGenome;
        rowText.title = rowGenome; // Tooltip pour le nom complet
        rowHeader.appendChild(rowText);
        
        // Badge BED si présent
        if (bedFiles.has(rowGenome)) {
            const bedBadge = document.createElement('span');
            bedBadge.textContent = ' ●';
            bedBadge.style.color = bedColorMatrix;
            bedBadge.style.fontSize = '1em';
            rowHeader.appendChild(bedBadge);
        }

        // Event listener pour la sélection de genomes dans la chaîne
        rowHeader.addEventListener('click', () => {
            const idx = selectedGenomes.indexOf(rowGenome);
            if (idx !== -1) {
                selectedGenomes.splice(idx, 1);
                rowHeader.style.background = '';
                rowHeader.style.color = '';
            } else {
                selectedGenomes.push(rowGenome);
                rowHeader.style.background = 'grey';
                rowHeader.style.color = '#fff';
            }
            updateChainDiv();
        });

        row.appendChild(rowHeader);
        
        // Cellules de la matrice
        genomes.forEach(colGenome => {
            const cell = document.createElement('td');
            cell.style.border = '2px solid white';
            cell.style.padding = '0';
            cell.style.textAlign = 'center';
            cell.style.width = cellSize;
            cell.style.height = cellSize;
            cell.style.minWidth = cellSize;
            cell.style.maxWidth = cellSize;
            cell.style.minHeight = cellSize;
            cell.style.maxHeight = cellSize;
            
            if (rowGenome === colGenome) {
                // Diagonale = gris foncé
            } else {
                // Cherche la comparaison
                const key1 = `${rowGenome}_${colGenome}`;
                //const key2 = `${colGenome}_${rowGenome}`;
                const comp = comparisonMatrix[key1]; // || comparisonMatrix[key2];
                
                if (comp) {
                    const cellContent = document.createElement('div');
                    cellContent.style.width = '100%';
                    cellContent.style.height = '100%';
                    cellContent.style.display = 'flex';
                    cellContent.style.alignItems = 'center';
                    cellContent.style.justifyContent = 'center';
                    cellContent.style.cursor = 'pointer';
                    cellContent.style.transition = 'all 0.2s';
                    cellContent.style.backgroundColor = '#10b98180';


                    if (comp.hasAnchor) {
                        cellContent.innerHTML = '<i class="fa fa-anchor"></i>';
                    }
                    
                        // } else {
                    //     cellContent.style.backgroundColor = '#60a5fa';
                    //     cellContent.innerHTML = '<i class="fa fa-check"></i>';
                    // }
                    
                    // Effet hover
                    cellContent.addEventListener('mouseenter', () => {
                        cellContent.style.transform = 'scale(1.2)';
                        cellContent.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                        cellContent.style.zIndex = '10';
                        cellContent.style.position = 'relative';
                    });
                    cellContent.addEventListener('mouseleave', () => {
                        cellContent.style.transform = 'scale(1)';
                        cellContent.style.boxShadow = 'none';
                        cellContent.style.zIndex = '1';
                    });
                    
                    // Tooltip détaillé
                    cellContent.title = `${rowGenome} ↔ ${colGenome}\nFile: ${comp.fileName}\n${comp.hasAnchor ? '✓ Anchor file available' : '✗ No anchor file'}`;
                    
                    cell.appendChild(cellContent);
                } else {
                    // Pas de comparaison
                    cell.style.backgroundColor = '#e5e7eb';
                }
            }
            
            row.appendChild(cell);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    matrixWrapper.appendChild(table);
    matrixContainer.appendChild(matrixWrapper);
    container.appendChild(matrixContainer);
    
    // Event listener pour le bouton toggle
    let isMatrixVisible = false;
    toggleButton.addEventListener('click', () => {
        isMatrixVisible = !isMatrixVisible;
        matrixContainer.style.display = isMatrixVisible ? 'block' : 'none';
        toggleButton.textContent = isMatrixVisible ? '▲ Hide File Matrix' : '▼ Show File Matrix';
    });
    
    return container;
}

/**
 * Met à jour la matrice quand les fichiers changent
 * Fonction à appeler dans le addEventListener('change') de bandInput
 */
function updateFileMatrix(files) {
    const matrixContainer = document.getElementById('file-matrix-container');
    
    if (files.length === 0) {
        // Supprime la matrice si aucun fichier
        if (matrixContainer) {
            matrixContainer.remove();
        }
        return;
    }
    
    // Crée ou met à jour la matrice
    const matrix = createFileMatrix(files, 'file-matrix-container');
    
    if (matrix) {
        // Insère la matrice après le chainDiv (gère les deux cas : FTP et normal)
        const chainDiv = document.getElementById('selected-chain') || document.getElementById('selected-chain-ftp');
        if (chainDiv && !document.getElementById('file-matrix-container')) {
            chainDiv.parentNode.insertBefore(matrix, chainDiv.nextSibling);
        }
    }
}