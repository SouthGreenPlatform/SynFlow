
import { selectedGenomes, updateChainDiv } from './form.js';
import { logActivity } from './main.js';
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
            logActivity(`Selected genome "${rowGenome}" in matrix`);
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
        logActivity(isMatrixVisible ? 'Hid File Matrix' : 'Displayed File Matrix');
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
export function updateFileMatrix(files) {
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