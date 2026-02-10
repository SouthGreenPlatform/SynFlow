import { drawChromosomes, drawStackedChromosomes, drawCorrespondenceBands, resetDrawGlobals, drawMiniChromosome, zoom } from './draw.js';
import { generateBandTypeFilters, createSlider, createLengthChart, updateBandsVisibility, showControlPanel } from './legend.js';
import { Spinner } from './spin.js';
import { fileOrderMode, fileUploadMode, hideForm, setSelectedGenomes } from './form.js';
import { logActivity } from './main.js';

export let refGenome; // Définir globalement
export let queryGenome; // Définir globalement
export const genomeColors = {};
export let allParsedData = [];
let genomeLengths; // taille des chromosomes
export let genomeData; // Données des chromosomes
let maxAlignments; //duo de chromosomes ref/query avec le plus grand alignement
export let uniqueGenomes;
let orderedFileObjects = []; // Défini globalement
let previousChromosomePositions = null;
export let globalMaxChromosomeLengths = {};
let currentFile; // Défini globalement
const CHUNK_SIZE = 20000; // Nombre de lignes à traiter à la fois
let numGenomes; //nombre de génomes à traiter
export let scale = 100000; // diviseur pour la taille des chromosomes
export let isFirstDraw = true; //premier dessin
// Mode de coloration des bandes : 'type' (par défaut) ou 'byChrom'
export let bandColorMode = 'type';
export function setBandColorMode(mode) {
    if (mode === 'type' || mode === 'byChrom') {
        bandColorMode = mode;
    } else {
        console.warn('Unknown bandColorMode:', mode);
    }
}
//spinner
const opts = {
    lines: 20, length: 120, width: 50, radius: 1, scale: 0.8,
    corners: 1, speed: 1, rotate: 0, animation: 'spinner-line-shrink',
    direction: 1, color: 'grey', fadeColor: 'transparent', top: '50%',
    left: '50%', shadow: '0 0 1px transparent', zIndex: 2000000000,
    className: 'spinner', position: 'fixed'
};
export var spinner = new Spinner(opts);

function resetGlobals() {
    isFirstDraw = true;
    refGenome = null;
    queryGenome = null;
    // Clear genomeColors without reassigning the exported object so other modules
    // can't accidentally replace the reference. This keeps consumers holding
    // the same object while removing all keys.
    try {
        for (const k in genomeColors) {
            if (Object.hasOwn(genomeColors, k)) delete genomeColors[k];
        }
    } catch (e) {
        //catching
        console.error("Error resetting genomeColors:", e);
    }
    uniqueGenomes = null;
    orderedFileObjects = [];
    previousChromosomePositions = null;
    globalMaxChromosomeLengths = {};
    currentFile = null;
    numGenomes = null;
    allParsedData = [];
    resetDrawGlobals(); // Réinitialiser currentYOffset

    // Clear any per-chrom or per-genome display overrides stored on window to avoid leaking between sessions
    try {
        if (globalThis.genomeDisplaySettings) delete globalThis.genomeDisplaySettings;
        if (globalThis.chromDisplaySettings) delete globalThis.chromDisplaySettings;
    } catch (e) {
        // noop
    }

}

export function generateColor(index) {
    const colors = [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b',
        '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
    ];
    return colors[index % colors.length];
}

function readFileInChunks(file, isFirstFile) {
    const reader = new FileReader();

    reader.onload = function(event) {
        const data = event.target.result;
        // console.log("File read successfully: " + file.name);
        const lines = data.split('\n');
        processChunks(lines, isFirstFile);
    };

    reader.onerror = function(event) {
        console.error('Erreur lors de la lecture du fichier:', event.target.error);
    };

    reader.readAsText(file);
}

function processChunks(lines, isFirstFile) {
    // console.log(isFirstFile, refGenome, queryGenome);
    let offset = 0;
    let parsedData = [];

    function processNextChunk() {
        const chunk = lines.slice(offset, offset + CHUNK_SIZE);
        offset += CHUNK_SIZE;

        const chunkData = parseSyriData(chunk.join('\n'));
        parsedData = parsedData.concat(chunkData);

        // const stackMode = document.getElementById('stack-mode').checked;
        const stackMode = false; // IGNORE

        if (offset < lines.length) {
            requestAnimationFrame(processNextChunk);
        } else {
            // const refChromosomeLengths = genomeLengths[refGenome];
            // const queryChromosomeLengths = genomeLengths[queryGenome];
            // console.log(refChromosomeLengths);
            // console.log(queryChromosomeLengths);

            let chromPositions;
            if(stackMode){
                const fileIndex = orderedFileObjects.indexOf(currentFile);
                chromPositions = drawStackedChromosomes(genomeData, globalMaxChromosomeLengths, fileIndex, numGenomes, scale);
            }else{
                chromPositions = drawChromosomes(genomeData, globalMaxChromosomeLengths, refGenome, queryGenome, isFirstFile, scale);

            }
            
            drawCorrespondenceBands(parsedData, chromPositions, isFirstFile, scale);
            previousChromosomePositions = chromPositions;
            // globalThis.fullParsedData = parsedData; // Sauvegarder les données du dernier fichier traité
            allParsedData.push({ //toutes les données de tous les fichiers
                refGenome,
                queryGenome,
                data: parsedData
            });
            processNextFile(); // Traiter le fichier suivant
        }
    }

    processNextChunk();
}

function processNextFile() {
    const fileIndex = orderedFileObjects.indexOf(currentFile);
    if (fileIndex < orderedFileObjects.length - 1) {
        currentFile = orderedFileObjects[fileIndex + 1];
        // console.log("Current file: " + currentFile.name);
        refGenome = uniqueGenomes[fileIndex + 1];
        queryGenome = uniqueGenomes[fileIndex + 2];
        readFileInChunks(currentFile, false);
    } else {
        allDone();
        spinner.stop();
    }
}

// Mise à jour de la liste des chromosomes à filtrer
// event listener pour afficher / cacher les chromosomes 
function updateChromList(globalMaxChromosomeLengths) {
    const chromListDiv = document.getElementById('chrom-list');
    chromListDiv.innerHTML = '';

    const chromNums = Object.keys(globalMaxChromosomeLengths);
    const chromPositions = {};

    // Récupérer les positions des chromosomes
    chromNums.forEach(chromNum => {
        const chromElement = document.querySelector(`path[data-chrom-num="${chromNum}"]`);
        if (chromElement) {
            const bbox = chromElement.getBBox();
            chromPositions[chromNum] = { refX: bbox.x, refY: bbox.y, width: bbox.width, height: bbox.height };
        }
    });

    chromNums.forEach(chromNum => {
        const listItem = document.createElement('div');
        listItem.style.display = 'flex';
        listItem.style.alignItems = 'center';
        listItem.style.cursor = 'grab';
        listItem.setAttribute('draggable', 'true');
        listItem.dataset.chromNum = chromNum;

        // Create eye icon
        const eyeIcon = document.createElement('i');
        eyeIcon.setAttribute('class', 'fas fa-eye chrom-eye-icon');
        eyeIcon.dataset.chrom = chromNum;
        eyeIcon.dataset.feature = 'toggle-visibility';
        eyeIcon.style.cursor = 'pointer';
        eyeIcon.style.marginRight = '10px';

        eyeIcon.addEventListener('click', () => {
            if (eyeIcon.classList.contains('fa-eye')) {
                logActivity(`Hide chromosome ${chromNum}`);
                eyeIcon.classList.remove('fa-eye');
                eyeIcon.classList.add('fa-eye-slash');
            } else {
                logActivity(`Show chromosome ${chromNum}`);
                eyeIcon.classList.remove('fa-eye-slash');
                eyeIcon.classList.add('fa-eye');
            }
            updateBandsVisibility();
        });

        // Goto icon
        const goto = document.createElement('span');
        goto.setAttribute('class', 'fas fa-crosshairs');
        goto.dataset.feature = 'goto-chromosome';
        goto.style.cursor = 'pointer';
        goto.style.marginRight = '10px';

    //     // Ajout du comportement de zoom sur le chromosome
        goto.addEventListener('click', () => {
            logActivity(`Go to chromosome ${chromNum}`);
            const chromPos = chromPositions[chromNum];
            // console.log("Chromosome position:", chromPos);

            if (chromPos) {
                const margin = 100;
                const svg = d3.select('#viz');
                const svgNode = svg.node();
                const svgRect = svgNode.getBoundingClientRect();
                const svgWidth = svgRect.width;
                const svgHeight = svgRect.height;

                // Calculer l'échelle pour que le chromosome occupe la largeur disponible moins les marges
                const availableWidth = svgWidth - (2 * margin);
                const scale = 10;
                
                // Calculer la translation pour centrer le chromosome
                const translateX = margin - (scale * chromPos.refX);
                const translateY = margin - (scale * chromPos.refY) - svgHeight + 50;

                // console.log("Translate X: ", translateX, "Translate Y: ", translateY);

                // Animer le zoom
                svg.transition()
                    .duration(1200)
                    .call(
                        zoom.transform,
                        d3.zoomIdentity
                            .translate(translateX, translateY)
                            .scale(scale)
                );
            }
        });











        // Drag and drop events sur l'item
        listItem.addEventListener('dragstart', (e) => {
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', chromNum);
        });

        listItem.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
        });

        // Ajouter les éléments à l'item
        listItem.appendChild(eyeIcon);
        listItem.appendChild(goto);
        
        // const text = document.createElement('span');
        // text.textContent = chromNum;
    const text = document.createElement('span');
    const chromObj = genomeData[refGenome] && genomeData[refGenome][chromNum];
    const chromName = (chromObj && chromObj.name) ? chromObj.name : '-';
    text.textContent = chromName;

        listItem.appendChild(text);
        
        chromListDiv.appendChild(listItem);
    });

    // Drag and drop events sur le conteneur
    chromListDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingItem = chromListDiv.querySelector('.dragging');
        if (!draggingItem) return;

        const siblings = [...chromListDiv.querySelectorAll('[draggable]:not(.dragging)')];
        let insertBefore = null;

        for (const sibling of siblings) {
            const rect = sibling.getBoundingClientRect();
            // Si la souris est dans la moitié gauche de l'élément, on insère avant
            if (
                e.clientY >= rect.top && e.clientY <= rect.bottom &&
                e.clientX < rect.left + rect.width / 2
            ) {
                insertBefore = sibling;
                break;
            }
            // Si la souris est au-dessus de la première ligne, on insère avant le premier
            if (e.clientY < siblings[0].getBoundingClientRect().top) {
                insertBefore = siblings[0];
                break;
            }
        }

        if (insertBefore) {
            chromListDiv.insertBefore(draggingItem, insertBefore);
        } else {
            chromListDiv.appendChild(draggingItem);
        }
    });

    chromListDiv.addEventListener('dragend', () => {
        const newOrder = [...chromListDiv.querySelectorAll('[draggable]')]
            .map(item => item.dataset.chromNum);
        // console.log('Nouvel ordre des chromosomes:', newOrder);

        updateChromosomesOrder(newOrder);

    });
}

/**
 * Recalcule globalMaxChromosomeLengths selon le nouvel ordre et genomeData.
 * @param {Array} newOrder - Tableau des positions (ex: ['8','1','2',...])
 * @param {Object} genomeData - Données des chromosomes pour chaque génome
 * @returns {Object} globalMaxChromosomeLengths recalculé
 */
function recalculateGlobalMaxChromosomeLengths(newOrder, genomeData) {
    const globalMaxLengths = {};
    // Pour chaque position dans le nouvel ordre
    newOrder.forEach((chromNum, index) => {
        let maxLength = 0;
        // Pour chaque génome, on regarde la taille du chromosome à cette position
        for (const genome in genomeData) {
            const chrom = genomeData[genome][chromNum];
            if (chrom && chrom.length > maxLength) {
                maxLength = chrom.length;
            }
        }
        // On attribue la position (index+1) au max trouvé
        globalMaxLengths[index + 1] = maxLength;
    });
    return globalMaxLengths;
}

// Redraw avec le nouvel ordre des chromosomes
function updateChromosomesOrder(newOrder, targetGenome = null) {
    logActivity('Updating chromosome order: ' + newOrder.join(', '));
    // Réorganiser globalMaxChromosomeLengths selon le nouvel ordre
    globalMaxChromosomeLengths = recalculateGlobalMaxChromosomeLengths(newOrder, genomeData);

    // Réorganiser genomeData
    if (targetGenome) {
        // Ne modifie que le génome concerné
        const reorderedGenomeData = {};
        newOrder.forEach((chromNum, index) => {
            reorderedGenomeData[index + 1] = genomeData[targetGenome][chromNum];
        });
        genomeData[targetGenome] = reorderedGenomeData;
    } else {
        // Modifie tous les génomes (drag global)
        for (const genome in genomeData) {
            const reorderedGenomeData = {};
            newOrder.forEach((chromNum, index) => {
                reorderedGenomeData[index + 1] = genomeData[genome][chromNum];
            });
            genomeData[genome] = reorderedGenomeData;
        }
    }

    // Reset les variables globales nécessaires
    resetDrawGlobals();
    d3.select('#zoomGroup').selectAll('*:not(defs)').remove();
    currentFile = orderedFileObjects[0];
    refGenome = uniqueGenomes[0];
    queryGenome = uniqueGenomes[1];

    // Relancer le traitement depuis le début
    readFileInChunks(currentFile, true);
}

//Fonction d'animation du swap des chromosomes
function animateSwap(container) {
    logActivity('Animating chromosome swap');
    // Sauvegarder les positions initiales (utilise le nom du chromosome comme clé stable)
    const oldCells = Array.from(container.querySelectorAll('[draggable="true"]'));
    const positions = new Map();

    oldCells.forEach(cell => {
        const key = cell.dataset.id || cell.textContent.trim();
        if (key) {
            positions.set(key, cell.getBoundingClientRect());
        }
    });

    // Redraw
    updateChromControler();

    // Récupérer les nouvelles cellules après redraw
    const newCells = Array.from(container.querySelectorAll('[draggable="true"]'));

    // Appliquer la position initiale aux nouvelles cellules
    newCells.forEach(cell => {
        const key = cell.dataset.id || cell.textContent.trim();
        const oldRect = positions.get(key);
        if (!oldRect) return;

        const newRect = cell.getBoundingClientRect();
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;

        if (dx !== 0 || dy !== 0) {
            cell.style.transform = `translate(${dx}px, ${dy}px)`;
        }
    });

    // Lancer l'animation de transition
    requestAnimationFrame(() => {
        newCells.forEach(cell => {
            cell.style.transition = 'transform 0.3s ease';
            cell.style.transform = '';
        });

        // Nettoyer après animation
        setTimeout(() => {
            newCells.forEach(cell => {
                cell.style.transition = '';
            });
        }, 300);
    });
}




////////////////////////////////////////
// rempli la div chrom-controler
// Variable globale pour suivre le drag en cours
let currentDrag = null;
function updateChromControler() {
    const chromControlerDiv = document.getElementById('chrom-controler');
    chromControlerDiv.innerHTML = '';
    chromControlerDiv.style.overflowX = 'auto';

    const genomes = Object.keys(genomeData);
    const maxChromCount = Math.max(...genomes.map(g => Object.keys(genomeData[g]).length));

    const grid = document.createElement('div');
    grid.style.padding = '15px';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${maxChromCount + 1}, 1fr)`;
    grid.style.gap = '8px';

    // --- EN-TÊTES ---
    const headerRow = document.createElement('div');
    headerRow.style.display = 'contents';
    const genomeHeader = document.createElement('div');
    // genomeHeader.textContent = 'Genome';
    genomeHeader.style.fontWeight = 'bold';
    genomeHeader.style.textAlign = 'center';
    headerRow.appendChild(genomeHeader);

    for (let i = 1; i <= maxChromCount; i++) {
        const col = document.createElement('div');
        col.textContent = `${i}`;
        col.style.fontWeight = 'bold';
        col.style.textAlign = 'center';
        col.style.cursor = 'grab';
        col.setAttribute('draggable', 'true');
        col.dataset.position = i;

        //drag and drop colonne
        col.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('col-drag', i);
            col.classList.add('dragging');
            // Ajoute la classe à toute la colonne
            document.querySelectorAll(`[data-position="${i}"]`).forEach(cell => {
                cell.classList.add('drag-col');
            });
        });

        col.addEventListener('dragend', () => {
            // Nettoyage visuel uniquement
            col.classList.remove('dragging');
            document.querySelectorAll('.drag-col').forEach(cell => {
                cell.classList.remove('drag-col');
            });
        });

        col.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('col-drag')) {
                e.preventDefault();
                col.classList.add('drop-target');
            }
        });

        col.addEventListener('dragleave', () => {
            col.classList.remove('drop-target');
        });

        col.addEventListener('drop', (e) => {
            logActivity('Chromosome controller : swapping columns ' + e.dataTransfer.getData('col-drag') + ' and ' + i);
            e.preventDefault();
            col.classList.remove('drop-target');
            document.querySelectorAll('.drag-col').forEach(cell => {
                cell.classList.remove('drag-col');
            });

            const fromPos = parseInt(e.dataTransfer.getData('col-drag'));
            const toPos = i;
            if (fromPos === toPos) return;

            for (const genome in genomeData) {
                const temp = genomeData[genome][fromPos];
                genomeData[genome][fromPos] = genomeData[genome][toPos];
                genomeData[genome][toPos] = temp;
            }
            // updateChromControler();
            const chromControlerDiv = document.getElementById('chrom-controler');
            animateSwap(chromControlerDiv);
            // Lance le spinner
            var target = document.getElementById('spinner');
            spinner.spin(target); 
            // Redraw complet
            resetDrawGlobals();
            d3.select('#zoomGroup').selectAll('*:not(defs)').remove();
            currentFile = orderedFileObjects[0];
            refGenome = uniqueGenomes[0];
            queryGenome = uniqueGenomes[1];
            globalMaxChromosomeLengths = calculateGlobalMaxChromosomeLengths(genomeData);
            scale = calculateScale(globalMaxChromosomeLengths);
            readFileInChunks(currentFile, true);
        });

        headerRow.appendChild(col);
    }
    grid.appendChild(headerRow);

    // --- LIGNES ---
    genomes.forEach(genome => {
        const row = document.createElement('div');
        row.style.display = 'contents';
        const color = genomeColors[genome] || '#000';

        const genomeCell = document.createElement('div');
        genomeCell.textContent = genome;
        genomeCell.style.fontWeight = 'bold';
        genomeCell.style.whiteSpace = 'nowrap';
        genomeCell.style.maxWidth = '250px';
        genomeCell.style.padding = '2px 4px';
        row.appendChild(genomeCell);

        for (let i = 1; i <= maxChromCount; i++) {
            const chrom = genomeData[genome][i];
            const chromCell = document.createElement('div');
            chromCell.style.border = `2px solid ${color}`;
            chromCell.style.borderRadius = '30px';
            chromCell.style.padding = '2px 4px';
            chromCell.style.cursor = 'grab';
            chromCell.style.textAlign = 'center';
            chromCell.setAttribute('draggable', 'true');
            chromCell.dataset.genome = genome;
            chromCell.dataset.position = i;
            chromCell.dataset.visible = 'true';
            chromCell.textContent = chrom ? chrom.name : '-';
            chromCell.dataset.id = chrom ? `${genome}-${chrom.name}` : `empty-${i}`;

            //click pour show/hide
            chromCell.addEventListener('click', (e) => {
                if (e.target === chromCell) { // Vérifier que le clic est sur la cellule
                    const isVisible = chromCell.dataset.visible === 'true';
                    chromCell.dataset.visible = !isVisible;
                    
                    logActivity(`${isVisible ? 'Hide' : 'Show'} chromosome ${chrom ? chrom.name : '-'} of genome ${genome}`);

                    if (isVisible) {
                        chromCell.style.opacity = '0.5';
                        chromCell.style.backgroundColor = '#f5f5f5';
                    } else {
                        chromCell.style.opacity = '1';
                        chromCell.style.backgroundColor = 'white';
                    }
                    
                    updateBandsVisibility();
                }
            });

            chromCell.addEventListener('dragstart', (e) => {
                currentDrag = { genome, pos: i };
                e.dataTransfer.setData('chrom-drag', JSON.stringify(currentDrag));
                chromCell.classList.add('dragging');
            });

            chromCell.addEventListener('dragenter', (e) => {
                if (e.dataTransfer.types.includes('chrom-drag') && currentDrag?.genome === genome) {
                    chromCell.classList.add('drop-target');
                }
            });

            chromCell.addEventListener('dragover', (e) => {
                if (e.dataTransfer.types.includes('chrom-drag')) {
                    e.preventDefault();
                }
            });

            chromCell.addEventListener('dragleave', () => chromCell.classList.remove('drop-target'));

            // Dans le dragend event (juste le nettoyage)
            chromCell.addEventListener('dragend', () => {
                chromCell.classList.remove('dragging');
                chromCell.classList.remove('drop-target');
                currentDrag = null;
            });

            // Dans le drop event (faire le swap et le redraw)
            chromCell.addEventListener('drop', (e) => {
                logActivity('Chromosome controller : swapping column numbers ' + currentDrag?.pos + ' and ' + i + ' for genome ' + genome);
                e.preventDefault();
                chromCell.classList.remove('drop-target');

                try {
                    const dragData = JSON.parse(e.dataTransfer.getData('chrom-drag'));
                    if (dragData.genome === genome) {
                        const fromPos = Number.parseInt(dragData.pos, 10);
                        const toPos = Number.parseInt(chromCell.dataset.position, 10);

                        if (!Number.isNaN(fromPos) && !Number.isNaN(toPos) && fromPos !== toPos) {
                            // Swap dans genomeData
                            const temp = genomeData[genome][fromPos];
                            genomeData[genome][fromPos] = genomeData[genome][toPos];
                            genomeData[genome][toPos] = temp;
                            
                            // Anime le changement
                            const chromControlerDiv = document.getElementById('chrom-controler');
                            animateSwap(chromControlerDiv);

                            // Lance le spinner
                            var target = document.getElementById('spinner');
                            spinner.spin(target); 
                            
                            // Redraw complet
                            resetDrawGlobals();
                            d3.select('#zoomGroup').selectAll('*:not(defs)').remove();
                            currentFile = orderedFileObjects[0];
                            refGenome = uniqueGenomes[0];
                            queryGenome = uniqueGenomes[1];
                            globalMaxChromosomeLengths = calculateGlobalMaxChromosomeLengths(genomeData);
                            scale = calculateScale(globalMaxChromosomeLengths);
                            readFileInChunks(currentFile, true);
                        }
                    }
                } catch {
                    // Ignore les erreurs
                }
                currentDrag = null;
            });

            row.appendChild(chromCell);
        }
        grid.appendChild(row);
    });

    chromControlerDiv.appendChild(grid);
}






function allDone() {

    // Après avoir chargé les données et dessiné le graphique, détecter les bornes
    const zoomGroup = d3.select('#zoomGroup');

    if (zoomGroup.empty()) {
        console.error('zoomGroup not found');
        return;
    }

    const graphBounds = zoomGroup.node().getBBox();
    const width = graphBounds.width;
    const height = graphBounds.height;

    // console.log("*************"+width, height);

    // Mettre à jour les limites de translation du zoom
    // Ajoute une marge (par exemple 200px) à droite et en bas
    const margin = 200;
    zoom.translateExtent([[0, 0], [width + margin, height + margin]]);
    d3.select("#viz").call(zoom);

    // Determine min and max band sizes
    const allBandLengths = d3.selectAll('path.band').nodes().map(path => Number.parseFloat(path.dataset.length));
    const minBandSize = d3.min(allBandLengths);
    const maxBandSize = d3.max(allBandLengths);

    // Create and add the slider to filter bands by size
    createSlider(minBandSize, maxBandSize);

    //merge slider
    // createMergeSlider(0, 100000);

    // Create the bar chart to display band size distribution
    createLengthChart(allBandLengths);

    //chromosomes controler avant le show control panel
    updateChromControler();

    //Affiche la légende
    showControlPanel();   
    //cache le formulaire
    hideForm();

    // // Remove existing chromlist container
    // const vizContainer = document.getElementById('viz-container')
    // const existingchromListContainer = document.getElementById('chrom-list-container');
    // if (existingchromListContainer) {
    //     vizContainer.removeChild(existingchromListContainer);
    // }

    // // Container for chromosomes list
    // const chromListContainer = document.createElement('div');
    // chromListContainer.setAttribute('id', 'chrom-list-container');
    // chromListContainer.style.marginRight = '20px';

    // // Toggle button
    // const toggleButton = document.createElement('div');
    // toggleButton.setAttribute('id', 'toggle-button');
    // toggleButton.style.position = 'absolute';
    // toggleButton.style.top = '0px';
    // toggleButton.style.left = '0px';
    // toggleButton.style.cursor = 'pointer';
    // toggleButton.style.zIndex = '20';
    // toggleButton.innerHTML = '&#x25C0;'; // Flèche gauche

    // const chromListDiv = document.createElement('div');
    // chromListDiv.setAttribute('id', 'chrom-list');
    // chromListContainer.appendChild(toggleButton); 
    // chromListContainer.appendChild(chromListDiv);

    // // Append legend and chromosomes list container to viz container
    // const viz = document.getElementById('viz')
    // vizContainer.insertBefore(chromListContainer, viz);

    // // Toggle button event listener
    // let isListVisible = true;
    // toggleButton.addEventListener('click', () => {
    //     if (isListVisible) {
    //         chromListDiv.style.display = 'none';
    //         toggleButton.innerHTML = '&#x25B6;'; // Flèche droite
    //     } else {
    //         chromListDiv.style.display = 'flex'; // Réappliquer flex pour garder l'affichage en ligne
    //         toggleButton.innerHTML = '&#x25C0;'; // Flèche gauche
    //     }
    //     isListVisible = !isListVisible;
    // });


    // updateChromList(globalMaxChromosomeLengths);
    
    // Add download buttons
    const formContainer = document.getElementById('file-upload');

    // Remove existing download button if it exists
    const existingDownloadButton = document.getElementById('download-svg');
    if (existingDownloadButton) {
        existingDownloadButton.remove();
    }

    const downloadSvgButton = document.createElement('button');
    downloadSvgButton.id = 'download-svg';
    downloadSvgButton.setAttribute('type', 'button');
    downloadSvgButton.classList.add('btn-simple');
    downloadSvgButton.textContent = 'Download SVG';
    formContainer.appendChild(downloadSvgButton);
    const svgElement = document.getElementById('viz');

    downloadSvgButton.addEventListener('click', function(event) {
        logActivity('Download SVG');
        event.preventDefault();
        downloadSvg(svgElement);
    });

    isFirstDraw = false;

}

function calculateSNPDensity(data, refLengths, binSize = 100000) {
    const snpDensity = {};

    // Initialiser les densités de SNP pour chaque chromosome
    for (const chr in refLengths) {
        const chrLength = refLengths[chr];
        const numBins = Math.ceil(chrLength / binSize);
        snpDensity[chr] = Array(numBins).fill(0);
    }

    // Compter les SNP dans chaque segment
    data.forEach(d => {
        if (d.type === 'SNP') {
            const binIndex = Math.floor(d.refStart / binSize);
            snpDensity[d.refChr][binIndex]++;
        }
    });

    return snpDensity;
}

//BED file example :
//chromosome    start	end	name	strand
//Macmad_h1_01	16953	25284	Macmad_h1_01g000010	+
export function calculateAnnotationDensity(data, genomeName, binSize = 20000) {
    // console.log("Calculating annotation density for genome:", genomeName);
    const annotationDensity = {};

    // Compter les annotations par bin
    data.split('\n').forEach(d => {
        const [chr, start, end, name, strand] = d.split('\t');
        if (!chr || !start) return; // Ignorer les lignes vides ou incorrectes
        const binIndex = Math.floor(+start / binSize);
        if (!annotationDensity[chr]) {
            annotationDensity[chr] = {};
        }
        annotationDensity[chr][binIndex] = (annotationDensity[chr][binIndex] || 0) + 1;
    });

    // Extraire toutes les densités pour l'échelle de couleur
    const allCounts = [];
    for (const chr in annotationDensity) {
        allCounts.push(...Object.values(annotationDensity[chr]));
    }

    //applique les couleurs des genomes
    const color = genomeColors[genomeName] || '#000'; // Couleur de départ
    const colorScale = d3.scaleSequential(d3.interpolateRgb("white", color))
        .domain([0, d3.max(allCounts)]);

    // Ajouter les gradients
    const svg = d3.select('#viz');

    let defs = svg.select('defs');
    if (defs.empty()) {
        defs = svg.append('defs');
    }

    for (const chr in annotationDensity) {
        const gradientId = `gradient-${genomeName}-${chr}`;

        const gradient = defs.append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');

        const bins = Object.keys(annotationDensity[chr]).map(Number);
        const minBin = Math.min(...bins);
        const maxBin = Math.max(...bins);

        for (const bin of bins) {
            const density = annotationDensity[chr][bin] || 0;
            const offset = ((bin - minBin) / (maxBin - minBin)) * 100;
            gradient.append('stop')
                .attr('offset', `${offset}%`)
                .attr('stop-color', colorScale(density));
        }
    }
    return annotationDensity;
}

// Extraire les noms des génomes à partir des fichiers .chrlen
function extractGenomeNames(chrlenFileNames) {
    return chrlenFileNames.map(fileName => fileName.replace('.chrlen', ''));
}

// Trouver les génomes uniques à partir des fichiers de bandes
// export function findUniqueGenomes(bandFileNames) {
//     console.log("Finding unique genomes from :", bandFileNames);
//     const fileCount = bandFileNames.length;
//     const uniqueNamesToFind = fileCount + 1;
//     numGenomes = uniqueNamesToFind;
//     let possibleNames = new Set();

//     // Extraire les noms de génomes directement à partir des noms de fichiers de bandes
//     bandFileNames.forEach(file => {
//         const baseName = file.replace('.out', '');
//         const parts = baseName.split('_');
//         for (let i = 1; i < parts.length; i++) {
//             possibleNames.add(parts.slice(0, i).join('_'));
//             possibleNames.add(parts.slice(i).join('_'));
//         }
//     });

//     possibleNames = Array.from(possibleNames);

//     function findCombination(currentCombination, depth) {
//         // console.log("Current combination:", currentCombination, "Depth:", depth);
//         if (depth === uniqueNamesToFind) {
//             const genomeSet = new Set(currentCombination);
//             if (genomeSet.size === uniqueNamesToFind) {
//                 const generatedFiles = [];
//                 for (let i = 0; i < currentCombination.length - 1; i++) {
//                     generatedFiles.push(`${currentCombination[i]}_${currentCombination[i + 1]}.out`);
//                 }
//                 const match = generatedFiles.every(f => bandFileNames.includes(f));
//                 if (match) {
//                     return Array.from(genomeSet);
//                 }
//             }
//             return null;
//         }

//         for (let i = 0; i < possibleNames.length; i++) {
//             if (!currentCombination.includes(possibleNames[i])) {
//                 currentCombination.push(possibleNames[i]);
//                 const result = findCombination(currentCombination, depth + 1);
//                 if (result) {
//                     return result;
//                 }
//                 currentCombination.pop();
//             }
//         }

//         return null;
//     }

//     return findCombination([], 0);
// }


//version avec nommage simple des fichiers de bandes
// exemple genome-1_genome-2.out
export function findUniqueGenomes(bandFileNames) {

    //met à jour le nombre de génomes
    numGenomes = bandFileNames.length + 1; // Nombre de génomes = nombre de fichiers + 1

    // Extrait les paires de chaque fichier
    const pairs = bandFileNames
        .map(f => f.replace('.out', '').split('_'))
        .filter(parts => parts.length === 2);

    // Compte les occurrences de chaque génome
    const counts = {};
    pairs.forEach(([a, b]) => {
        counts[a] = (counts[a] || 0) + 1;
        counts[b] = (counts[b] || 0) + 1;
    });

    // Liste des génomes qui apparaissent en début de fichier
    const firsts = pairs.map(([a, b]) => a);

    // Trouve une extrémité : n'apparaît qu'une fois ET est en début de fichier
    let start = Object.keys(counts).find(g => counts[g] === 1 && firsts.includes(g));
    if (!start) {
        alert("Error: Unable to find a unique starting genome. Please check your band files.");
        spinner.stop();
        return null;
    }
    // Reconstitue la chaîne
    const result = [start];
    let current = start;
    let prev = null;
    while (result.length < pairs.length + 1) {
        // Cherche le binôme du génome courant qui n'est pas le précédent
        const next = pairs.find(([a, b]) => (a === current && b !== prev) || (b === current && a !== prev));
        if (!next) break;
        const nextGenome = next[0] === current ? next[1] : next[0];
        result.push(nextGenome);
        prev = current;
        current = nextGenome;
    }
    return result;
}

function handleFileUpload(bandFiles, bedFiles) {
    resetGlobals(); // Réinitialiser les variables globales
    // spinner.spin(target);

    // console.log('Chromosome Length Files:', chrlenFiles);
    // console.log('Band Files:', bandFiles);

    // Extraire les noms de fichiers des objets File
    const bandFileNames = Array.from(bandFiles).map(file => file.name);
    // console.log(bandFileNames);
    
    // Trouver et ordonne les génomes à partir des noms de fichiers de bandes
    uniqueGenomes = findUniqueGenomes(bandFileNames);
    // console.log(uniqueGenomes);

    // Vérifier si tous les fichiers de bandes nécessaires sont présents
    if (!uniqueGenomes || uniqueGenomes.length < 2) {
        alert('Some band files are missing. Please ensure all necessary files are uploaded.');
        spinner.stop();
        return;
    }

    // console.log("Unique Genomes: ", uniqueGenomes);

    // Attribuer des couleurs aux génomes
    uniqueGenomes.forEach((genome, index) => {
        genomeColors[genome] = generateColor(index);
    });

    //retrouve l'ordre des fichier 
    const orderedFiles = orderFilesByGenomes(bandFileNames, uniqueGenomes);
    // console.log("Ordered Files: ", orderedFiles);

    // Vérifier si tous les fichiers de bandes nécessaires sont présents et dans l'ordre
    if (orderedFiles.length !== bandFileNames.length) {
        alert('Some band files are missing. Please ensure all necessary files are uploaded.');
        spinner.stop();
        return;
    }

    // Générer et afficher la légende
    generateBandTypeFilters();

    // Réordonner les listes de fichiers
    const genomeList = document.getElementById('genome-list');
    const bandFileList = document.getElementById('band-file-list');
    reorderFileList(genomeList, uniqueGenomes, 'chrlen'); //affiche les mini chromosomes
    reorderFileList(bandFileList, orderedFiles, 'out'); // réordonne les fichier de bandes dans la div band-file-list

    // Utiliser les objets File pour lire les fichiers
    orderedFileObjects = orderedFiles.map(fileName => 
        Array.from(bandFiles).find(file => file.name === fileName)
    );

    currentFile = orderedFileObjects[0];

    // Définir globalement refGenome et queryGenome
    refGenome = uniqueGenomes[0];
    queryGenome = uniqueGenomes[1];

    //Si on a des fichiers .bed, on clacule pour chacun la densité d'annotation
    if (bedFiles && bedFiles.length > 0) {
        // Calcule la densité d'annotation pour chaque fichier .bed
        bedFiles.forEach(async bedFile => {
            //si pas null
            if (!bedFile) return;
            const text = await bedFile.text();
            const genomeName = bedFile.name.replace('.bed', ''); // Enlève l'extension .bed pour obtenir le nom du génome
            const density = calculateAnnotationDensity(text, genomeName);
        });
    }

    // Lire les longueurs des chromosomes à partir du fichier band
    calculateChromosomeDataFromBandFilesAlphabetical(orderedFileObjects, uniqueGenomes).then((data) => {
        genomeData = data;
        // console.log(genomeData)
        globalMaxChromosomeLengths = calculateGlobalMaxChromosomeLengths(genomeData);
        scale = calculateScale(globalMaxChromosomeLengths);
        // console.log("Global Max Chromosome Lengths: ", globalMaxChromosomeLengths);
        //traite les fichiers
        readFileInChunks(currentFile, true, refGenome, queryGenome);
    });
}

//calcul le scale a partir des tailles des chromosomes globalMaxChromosomeLengths
        // {
        //     "1": 70856583,
        //     "2": 54676892,
        //     "3": 47271773,
        //     "4": 82204888,
        //     "5": 50696038,
        //     "6": 61498972,
        //     "7": 55122646,
        //     "8": 77822268,
        //     "9": 47989177,
        //     "10": 61339363,
        //     "11": 47069596
        // }
        // ici max = 82204888 donc scale = 100000
        // {
        //     "1": 562643,
        //     "2": 230218,
        //     "3": 813184,
        //     "4": 316620,
        //     "5": 1531933,
        //     "6": 576874,
        //     "7": 279643,
        //     "8": 1090940,
        //     "9": 439888,
        //     "10": 745751,
        //     "11": 666816,
        //     "12": 1556556,
        //     "13": 924431,
        //     "14": 784333,
        //     "15": 1091291,
        //     "16": 948066
        // }
        //ici max = 1556556 donc scale = 10000
        // Selon l'ordre de grandeur des chromosomes, on peut ajuster le scale
        function calculateScale(chromosomeLengths) {
            // Trouver la longueur maximale parmi les chromosomes
            const maxLength = Math.max(...Object.values(chromosomeLengths));
            
            // Calculer l'ordre de grandeur du plus grand chromosome
            const orderOfMagnitude = Math.pow(10, Math.floor(Math.log10(maxLength)));
            
            // Ajuster le scale en fonction de l'ordre de grandeur
            const scale = orderOfMagnitude / 100;
            // console.log(scale);
            return scale;
        }
        
        // // Exemple d'utilisation
        // const globalMaxChromosomeLengths1 = {
        //     "1": 70856583,
        //     "2": 54676892,
        //     "3": 47271773,
        //     "4": 82204888,
        //     "5": 50696038,
        //     "6": 61498972,
        //     "7": 55122646,
        //     "8": 77822268,
        //     "9": 47989177,
        //     "10": 61339363,
        //     "11": 47069596
        // };
        
        // const globalMaxChromosomeLengths2 = {
        //     "1": 562643,
        //     "2": 230218,
        //     "3": 813184,
        //     "4": 316620,
        //     "5": 1531933,
        //     "6": 576874,
        //     "7": 279643,
        //     "8": 1090940,
        //     "9": 439888,
        //     "10": 745751,
        //     "11": 666816,
        //     "12": 1556556,
        //     "13": 924431,
        //     "14": 784333,
        //     "15": 1091291,
        //     "16": 948066
        // };
        
        // const scale1 = calculateScale(globalMaxChromosomeLengths1);
        // console.log("Scale 1: ", scale1);
        
        // const scale2 = calculateScale(globalMaxChromosomeLengths2);
        // console.log("Scale 2: ", scale2);

// Calcule la taille des chromosomes à partir des fichiers band
// Format : genomeData[genomeName][index] = { name: chrName, length: chrLength };
async function calculateChromosomeDataFromBandFiles(orderedFileObjects, uniqueGenomes) {
    const genomeData = {};
    const usedChromosomes = {};
    
    // Initialisation
    uniqueGenomes.forEach(genome => {
        genomeData[genome] = {};
        usedChromosomes[genome] = new Set();
    });
    
    // Traiter chaque paire de génomes
    for (let i = 0; i < orderedFileObjects.length; i++) {
        const currentFile = orderedFileObjects[i];
        const refGenome = uniqueGenomes[i];
        const queryGenome = uniqueGenomes[i + 1];
        
        const { refLengths, queryLengths, alignments } = await readChromosomeLengthsFromBandFile(currentFile);
        
        // 1. Initialiser le génome ref s'il est vide
        if (Object.keys(genomeData[refGenome]).length === 0) {
            Object.entries(refLengths).forEach(([pos, data]) => {
                genomeData[refGenome][pos] = data;
                usedChromosomes[refGenome].add(data.name);
            });
        }

        // 2. Trouver les meilleures correspondances
        const matches = new Map();
        const usedQueryChrs = new Set();

        // Pour chaque chromosome ref, trouver sa meilleure correspondance
        Object.entries(genomeData[refGenome]).forEach(([refPos, refData]) => {
            if (!refData || !alignments[refData.name]) return;

            let bestMatch = null;
            let maxAlignment = 0;

            Object.entries(alignments[refData.name]).forEach(([queryName, alignLength]) => {
                // Trouver le chromosome query correspondant
                const queryEntry = Object.entries(queryLengths).find(([_, data]) => data.name === queryName);
                if (!queryEntry || usedQueryChrs.has(queryName)) return;

                if (alignLength > maxAlignment) {
                    maxAlignment = alignLength;
                    bestMatch = {
                        queryPos: queryEntry[0],
                        queryData: queryEntry[1],
                        alignLength
                    };
                }
            });

            if (bestMatch) {
                matches.set(refPos, bestMatch);
                usedQueryChrs.add(bestMatch.queryData.name);
            }
        });

        // 3. Placer les chromosomes query appariés
        matches.forEach((match, refPos) => {
            genomeData[queryGenome][refPos] = match.queryData;
            usedChromosomes[queryGenome].add(match.queryData.name);
        });

        // 4. Ajouter les chromosomes query non appariés à la fin
        let nextPos = Math.max(...Object.keys(genomeData[queryGenome]).map(Number), 0);
        Object.entries(queryLengths).forEach(([_, queryData]) => {
            if (!usedChromosomes[queryGenome].has(queryData.name)) {
                nextPos++;
                genomeData[queryGenome][nextPos] = queryData;
                usedChromosomes[queryGenome].add(queryData.name);
            }
        });
    }

    // console.log("genomeData mis à jour :");
    console.log(genomeData);
    return genomeData;
}

async function calculateChromosomeDataFromBandFilesAlphabetical(orderedFileObjects, uniqueGenomes) {
    const genomeData = {};

    // Temp stock par génome : name -> {name, length}
    const genomeChromMap = {};
    uniqueGenomes.forEach(g => {
        genomeChromMap[g] = {};
    });

    // Parcourir tous les fichiers et accumuler les chromosomes trouvés
    for (let i = 0; i < orderedFileObjects.length; i++) {
        const file = orderedFileObjects[i];
        const refGenome = uniqueGenomes[i];
        const queryGenome = uniqueGenomes[i + 1];

        try {
            const { refLengths, queryLengths } = await readChromosomeLengthsFromBandFile(file);

            // Ajouter/refresher les chromosomes ref
            Object.values(refLengths).forEach(ch => {
                if (!ch?.name) return;
                const existing = genomeChromMap[refGenome][ch.name];
                if (!existing || (ch.length && ch.length > existing.length)) {
                    genomeChromMap[refGenome][ch.name] = { name: ch.name, length: ch.length };
                }
            });

            // Ajouter/refresher les chromosomes query
            Object.values(queryLengths).forEach(ch => {
                if (!ch?.name) return;
                const existing = genomeChromMap[queryGenome][ch.name];
                if (!existing || (ch.length && ch.length > existing.length)) {
                    genomeChromMap[queryGenome][ch.name] = { name: ch.name, length: ch.length };
                }
            });
        } catch (err) {
            console.warn('Erreur lecture fichier band pour', file?.name, err);
        }
    }

    // Construire genomeData en triant par nom (ordre naturel)
    uniqueGenomes.forEach(genome => {
        genomeData[genome] = {};
        const names = Object.keys(genomeChromMap[genome] || {});
        names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        names.forEach((name, idx) => {
            genomeData[genome][idx + 1] = genomeChromMap[genome][name];
        });
    });

    // console.log('genomeData (alphabetical) mis à jour :', genomeData);
    return genomeData;
}

// lis la longueur des chromosomes à partir du fichier band
// pour les fichiers ref et query
// calcul pour chaque chrom ref la longueur des alignements avec chaque chrom querry
// retourne 3 tableaux
// refLengths = { "1": { name: "chr1", length: 70856583 }, "2": { name: "chr2", length: 54676892 }, ... }
// queryLengths = { "1": { name: "chr1", length: 70856583 }, "2": { name: "chr2", length: 54676892 }, ... }
// alignments = { "chr1": { "chr1": 1000, "chr2": 2000, ... }, "chr2": { "chr1": 3000, "chr2": 4000, ... }, ... }
function readChromosomeLengthsFromBandFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const refLengths = {};
            const queryLengths = {};
            const alignments = {};
            const lines = event.target.result.split('\n');
            let refIndex = 0;
            let queryIndex = 1;
            let lastRefChromosome = null;

            lines.forEach(line => {
                const parts = line.split('\t');
                if (parts.length >= 8) {
                    const refChromosome = parts[0];
                    const queryChromosome = parts[5];
                    const refStart = +parts[1];
                    const refEnd = +parts[2];
                    const queryEnd = +parts[7];
                    const alignmentLength = refEnd - refStart;

                    if (refChromosome !== "-") {
                        if (refChromosome !== lastRefChromosome) {
                            lastRefChromosome = refChromosome;
                            refIndex++;
                        }
                        if (!refLengths[refIndex] || refEnd > refLengths[refIndex].length) {
                            refLengths[refIndex] = { name: refChromosome, length: refEnd };
                        }
                    }

                    if (queryChromosome !== "-") {
                        let found = false;
                        for (const key in queryLengths) {
                            if (queryLengths[key].name === queryChromosome) {
                                queryIndex = key;
                                found = true;
                                if (queryEnd > queryLengths[queryIndex].length) {
                                    queryLengths[queryIndex] = { name: queryChromosome, length: queryEnd };
                                }
                                break;
                            }
                        }
                        if (!found) {
                            queryIndex = Object.keys(queryLengths).length + 1;
                            queryLengths[queryIndex] = { name: queryChromosome, length: queryEnd };
                        }
                    }

                    if (!alignments[refChromosome]) {
                        alignments[refChromosome] = {};
                    }
                    if (!alignments[refChromosome][queryChromosome]) {
                        alignments[refChromosome][queryChromosome] = 0;
                    }
                    alignments[refChromosome][queryChromosome] += alignmentLength;
                }
            });

            resolve({ refLengths, queryLengths, alignments });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}




export function downloadSvg(svgElement) {
    const serializer = new XMLSerializer();

    // Utilise le bounding box du SVG entier pour être sûr d'inclure tout
    const bbox = svgElement.getBBox();
    const padding = 20;
    const viewBox = [
        bbox.x - padding,
        bbox.y - padding,
        bbox.width + 2 * padding,
        bbox.height + 2 * padding
    ].join(' ');

    // Clone the SVG element to avoid modifying the original
    const clonedSvgElement = svgElement.cloneNode(true);
    clonedSvgElement.removeAttribute('width');
    clonedSvgElement.removeAttribute('height');
    clonedSvgElement.setAttribute('viewBox', viewBox);
    clonedSvgElement.setAttribute('width', bbox.width + 2 * padding);
    clonedSvgElement.setAttribute('height', bbox.height + 2 * padding);

    // Serialize and create a blob
    const source = serializer.serializeToString(clonedSvgElement);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Create a download link and trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SynFlow.svg';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export { readFileInChunks, handleFileUpload };


function reorderFileList(fileListElement, orderedFileNames, fileType) {
    // Ne rien faire si la liste n'existe pas
    //exemple: chargement depuis l'onglet existing files
    if (!fileListElement) return;

    // console.log(fileListElement);
    // console.log(orderedFileNames);
    // console.log(fileType);

    // Ajoute le listener dragend UNE SEULE FOIS
    if (!fileListElement.dataset.dragendListener) {
        fileListElement.addEventListener('dragend', () => {
            const newOrder = [...fileListElement.querySelectorAll('[draggable]')].map(item =>
                item.dataset.fileName.replace(`.${fileType}`, '')
            );
            setSelectedGenomes(newOrder);
            // console.log('Nouvel ordre:', newOrder);
            uniqueGenomes = newOrder;
            if (fileUploadMode === 'remote') {
                const chainDiv = document.querySelector('#selected-chain');
                chainDiv.innerHTML = `<b>Selected chain :</b> <br>${newOrder.join(' &rarr; ')}`;
                document.querySelector('#submit-existing').click();
            }else if(fileOrderMode === 'allvsall') {
                const chainDiv = document.querySelector('#selected-chain');
                chainDiv.innerHTML = `<b>Selected chain :</b> <br>${newOrder.join(' &rarr; ')}`;
                document.querySelector('#submit-local').click();
            }
        });
        fileListElement.dataset.dragendListener = "true";
    }

    fileListElement.classList.add('reordering');

    setTimeout(() => {
        fileListElement.innerHTML = '';

        orderedFileNames.forEach((fileName, index) => {
            const listItem = document.createElement('div');
            listItem.style.display = 'flex';
            listItem.style.alignItems = 'center';
            listItem.style.cursor = 'grab';
            listItem.setAttribute('draggable', 'true');
            listItem.dataset.fileName = fileName;

            // Ajouter les événements de drag and drop
            listItem.addEventListener('dragstart', (e) => {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', fileName);
            });

            listItem.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
            });

            listItem.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingItem = fileListElement.querySelector('.dragging');
                const siblings = [...fileListElement.querySelectorAll('[draggable]:not(.dragging)')];
                const nextSibling = siblings.find(sibling => {
                    const rect = sibling.getBoundingClientRect();
                    return e.clientY < rect.top + rect.height / 2;
                });

                if (nextSibling) {
                    nextSibling.before(draggingItem);
                } else {
                    fileListElement.appendChild(draggingItem);
                }
            });

            const genome = fileName.replace(`.${fileType}`, '');

            if (fileType === 'chrlen') {
                const miniChromosomeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                miniChromosomeSvg.setAttribute("width", "50");
                miniChromosomeSvg.setAttribute("height", "20");
                miniChromosomeSvg.style.marginRight = "10px";
                
                drawMiniChromosome(genome, d3.select(miniChromosomeSvg));

                listItem.appendChild(miniChromosomeSvg);
            }

            const fileNameSpan = document.createElement('span');
            fileNameSpan.textContent = fileName;

            listItem.appendChild(fileNameSpan);
            fileListElement.appendChild(listItem);
        });

        void fileListElement.offsetWidth;

        fileListElement.classList.remove('reordering');
        fileListElement.classList.add('reordered');
    }, 10);
}

function orderFilesByGenomes(files, genomes) {
    const orderedFiles = [];
    for (let i = 0; i < genomes.length - 1; i++) {
        const fileName = `${genomes[i]}_${genomes[i + 1]}.out`;
        if (files.includes(fileName)) {
            orderedFiles.push(fileName);
        }
    }
    return orderedFiles;
}

function calculateGlobalMaxChromosomeLengths(genomeData) {
    // console.log("Calculating global max chromosome lengths from genome data:");
    const globalMaxLengths = {};

    for (const genome in genomeData) {
        const chromosomes = genomeData[genome];
        for (const index in chromosomes) {
            const chrData = chromosomes[index];
            // Treat undefined or invalid entries as length 0
            const len = (chrData && typeof chrData.length === 'number') ? chrData.length : 0;
            if (chrData === undefined) {
                console.warn(`Genome: ${genome}, Chromosome Index: ${index} is undefined - treating length as 0`);
            } else {
                // console.log(`Genome: ${genome}, Chromosome Index: ${index}, Data: `, chrData);
            }

            if (globalMaxLengths[index] === undefined || len > globalMaxLengths[index]) {
                globalMaxLengths[index] = len;
            }
        }
    }
    // console.log(globalMaxLengths);
    return globalMaxLengths;
}

function parseSyriData(data) {
    const lines = data.split('\n');
    const parsedData = lines.map(line => {
        const parts = line.split('\t');
        return {
            refChr: parts[0],
            refStart: +parts[1],
            refEnd: +parts[2],
            refSeq: parts[3],
            querySeq: parts[4],
            queryChr: parts[5],
            queryStart: +parts[6],
            queryEnd: +parts[7],
            type: parts[10]
        };
    });
    return parsedData.filter(d => d.refChr && d.queryChr && d.queryChr !== '-' && d.refChr !== '-'); // Filtrer les lignes invalides
}

// parse la liste des fichiers syri all vs all et renvoie la liste des génomes
export function extractAllGenomes(bandFileNames) {
    const fragmentCounts = {};
    // console.log("Extracting all genomes from band files: ", bandFileNames);
    bandFileNames = bandFileNames
        .filter(name => name.endsWith('.out'))
        .map(name => name.trim());


    // Génère tous les fragments possibles pour chaque nom de fichier
    bandFileNames.forEach(file => {
        const baseName = file.replace('.out', '');
        const parts = baseName.split('_');
        for (let i = 1; i < parts.length; i++) {
            const left = parts.slice(0, i).join('_');
            const right = parts.slice(i).join('_');
            fragmentCounts[left] = (fragmentCounts[left] || 0) + 1;
            fragmentCounts[right] = (fragmentCounts[right] || 0) + 1;
        }
    });

    // Calcul du nombre de génomes attendu
    const fileCount = bandFileNames.length;
    let n = 2;
    while (n * (n - 1) < fileCount) n++;
    const expectedCount = 2 * (n - 1);

    // On prend les fragments qui apparaissent exactement expectedCount fois
    let genomes = Object.keys(fragmentCounts).filter(
        frag => fragmentCounts[frag] === expectedCount
    );

    // On complète avec les parties simples (ex: B1) qui apparaissent seules à gauche ou à droite d'un nom de fichier
    const singles = new Set();
    bandFileNames.forEach(file => {
        const baseName = file.replace('.out', '');
        const parts = baseName.split('_');
        if (parts.length === 2) {
            singles.add(parts[0]);
            singles.add(parts[1]);
        }
    });
    singles.forEach(s => {
        if (!genomes.includes(s)) genomes.push(s);
    });

    // On retire les fragments qui sont strictement inclus dans un autre génome détecté ET qui ne sont pas dans singles
    genomes = genomes.filter(g =>
        singles.has(g) || !genomes.some(other => other !== g && other.includes(g))
    );

    // classe par ordre alphabetique
    genomes.sort((a, b) => a.localeCompare(b));

    return genomes;
}




// Fusionne les bandes consécutives de même type et chromosomes si elles sont proches (distance ≤ threshold)
export function mergeBands(bands, threshold) {
    if (!bands || bands.length === 0 || threshold <= 0) return bands;

    // On trie pour que les bandes proches soient consécutives
    const sorted = [...bands].sort((a, b) => {
        if (a.refChr !== b.refChr) return a.refChr.localeCompare(b.refChr);
        if (a.queryChr !== b.queryChr) return a.queryChr.localeCompare(b.queryChr);
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.refStart - b.refStart;
    });

    const merged = [];
    let current = null;

    for (const band of sorted) {
        if (
            current &&
            band.refChr === current.refChr &&
            band.queryChr === current.queryChr &&
            band.type === current.type &&
            (band.refStart - current.refEnd <= threshold) &&
            (band.queryStart - current.queryEnd <= threshold)
        ) {
            // Fusionne la bande courante avec la précédente
            current.refEnd = band.refEnd;
            current.queryEnd = band.queryEnd;
            // (optionnel) tu peux aussi fusionner d'autres propriétés si besoin
        } else {
            if (current) merged.push(current);
            current = { ...band };
        }
    }
    if (current) merged.push(current);

    return merged;
}