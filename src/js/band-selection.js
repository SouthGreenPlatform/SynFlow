import { globalMaxChromosomeLengths, allParsedData } from './process.js';
import { showInfoPanel, showInfoUpdatedMessage } from './info.js';
import { getLinesInRange, createAnchorsSection } from './draw.js';
import { createSummarySection, createDetailedTable, createTableBadges, initializeTableFiltering, createZoomedSyntenyView } from './info.js';

// Set pour stocker les bandes sélectionnées
export let selectedBands = new Set();
let contextMenu = null;
let _docClickHandler = null;

function closeContextMenu() {
    if (contextMenu) {
        contextMenu.remove();
        contextMenu = null;
    }
    if (_docClickHandler) {
        document.removeEventListener('click', _docClickHandler);
        _docClickHandler = null;
    }
}

// Créer et afficher le menu contextuel
export function createContextMenu(x, y, band) {

    // Supprimer menu existant et son handler
    if (contextMenu) {
        closeContextMenu();
    }
    
    contextMenu = document.createElement('div');
    contextMenu.className = 'band-context-menu';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;

    // Close (X) button
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'position:absolute; top:6px; right:8px; border:none; background:transparent; font-size:16px; cursor:pointer;';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeContextMenu();
    });
    contextMenu.appendChild(closeBtn);
    
    // Item de sélection similaire
    const similarItem = document.createElement('div');
    similarItem.className = 'band-context-menu-item';
    similarItem.innerHTML = '<i class="fas fa-object-group"></i> Slide to select similar bands';
    
    // Container pour le slider
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'distance-slider-container';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
	//max = taille du chromosome
	slider.max = globalMaxChromosomeLengths[band.getAttribute('data-ref-num')] || '10000000';
    slider.value = '100000';
    slider.style.width = '100%';
    
    const sliderValue = document.createElement('div');
    sliderValue.textContent = 'Distance: 100kb';
    slider.oninput = () => {
        const val = parseInt(slider.value);
        sliderValue.textContent = `Distance: ${val >= 1000000 ? (val/1000000).toFixed(1) + 'Mb' : (val/1000).toFixed(0) + 'kb'}`;
        selectSimilarBands(band, val);
    };
    
    sliderContainer.appendChild(sliderValue);
    sliderContainer.appendChild(slider);
    
    // Color picker
    const colorContainer = document.createElement('div');
    colorContainer.className = 'color-picker-container';
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
	//value = couleur actuelle de la bande
	//<path d=" M2422.94544,100 C2422.94544,155 2082.47711,155 2082.47711,210 L2090.94569,210 C2090.94569,155 2431.10569,155 2431.10569,100 Z " fill="#008000" opacity="1" display="null" class="band band-selected" data-length="816025" data-pos="intra" data-type="TRANS" data-ref-genome="e-glaucum" data-ref="chr04" data-ref-num="4" data-query-num="4" data-query="chr04" data-query-genome="e-ventricosum" data-ref-start="39067289" data-ref-end="39883314" data-query-start="5020456" data-query-end="5867314"></path>
	colorPicker.value = band.getAttribute('fill');
    colorPicker.onchange = () => {
        colorSelectedBands(colorPicker.value);
    };
    
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Couleur: ';
    colorContainer.appendChild(colorLabel);
    colorContainer.appendChild(colorPicker);
    
    // Bouton de mise à jour des infos
    const updateInfoBtn = document.createElement('div');
    updateInfoBtn.className = 'band-context-menu-item';
    updateInfoBtn.innerHTML = '<i class="fas fa-sync"></i> Update info panel for selected bands';
    updateInfoBtn.onclick = () => {
        updateInfoForSelectedBands();
        closeContextMenu();
    };
    
    // Assemblage du menu
    contextMenu.appendChild(similarItem);
    contextMenu.appendChild(sliderContainer);
    const separator = document.createElement('div');
    separator.className = 'band-context-menu-separator';
    contextMenu.appendChild(separator);
    contextMenu.appendChild(colorContainer);
    contextMenu.appendChild(updateInfoBtn);
    
    document.body.appendChild(contextMenu);
    
    // Prevent clicks inside the menu from closing it by stopping propagation
    contextMenu.addEventListener('click', (e) => e.stopPropagation());
    contextMenu.addEventListener('pointerdown', (e) => e.stopPropagation());

    // Close the menu when clicking outside. Keep a reference so we can remove it later.
    _docClickHandler = function(e) {
        if (!contextMenu) return;
        if (!contextMenu.contains(e.target) && !e.target.closest('.band')) {
            closeContextMenu();
        }
    };
    document.addEventListener('click', _docClickHandler);
}

// Sélectionner les bandes similaires dans un rayon donné
export function selectSimilarBands(sourceBand, distance) {
    const sourceType = sourceBand.getAttribute('data-type');
    const sourceRefNum = sourceBand.getAttribute('data-ref-num');
    const sourceQueryNum = sourceBand.getAttribute('data-query-num');
	const sourceRefGenome = sourceBand.getAttribute('data-ref-genome');
	const sourceQueryGenome = sourceBand.getAttribute('data-query-genome');
    
    selectedBands.clear();
    selectedBands.add(sourceBand);
    
    document.querySelectorAll('.band').forEach(band => {
        if (band === sourceBand) return;
        
        if (band.getAttribute('data-type') === sourceType &&
            band.getAttribute('data-ref-num') === sourceRefNum &&
            band.getAttribute('data-query-num') === sourceQueryNum &&
            band.getAttribute('data-ref-genome') === sourceRefGenome &&
            band.getAttribute('data-query-genome') === sourceQueryGenome) {

            // Vérifier la distance
            const sourceBandData = getBandData(sourceBand);
            const targetBandData = getBandData(band);
            
            if (areBandsClose(sourceBandData, targetBandData, distance)) {
                selectedBands.add(band);
            }
        }
    });
    
    // Mettre à jour l'affichage
    updateBandSelection();
}

// Extraire les données d'une bande
function getBandData(band) {
    return {
        refStart: parseInt(band.getAttribute('data-ref-start')),
        refEnd: parseInt(band.getAttribute('data-ref-end')),
        queryStart: parseInt(band.getAttribute('data-query-start')),
        queryEnd: parseInt(band.getAttribute('data-query-end'))
    };
}

// Vérifier si deux bandes sont proches
function areBandsClose(band1, band2, maxDistance) {
    const refDist = Math.min(
        Math.abs(band1.refEnd - band2.refStart),
        Math.abs(band2.refEnd - band1.refStart)
    );
    const queryDist = Math.min(
        Math.abs(band1.queryEnd - band2.queryStart),
        Math.abs(band2.queryEnd - band1.queryStart)
    );
    
    return refDist <= maxDistance && queryDist <= maxDistance;
}

// Mettre à jour la visualisation de la sélection
export function updateBandSelection() {
    document.querySelectorAll('.band').forEach(band => {
        if (selectedBands.has(band)) {
            band.classList.add('band-selected');
        } else {
            band.classList.remove('band-selected');
        }
    });
}

// Colorer les bandes sélectionnées
export function colorSelectedBands(color) {
    // Apply color to selected bands using style (takes precedence) and attribute as fallback
    const types = new Set();
    selectedBands.forEach(band => {
        try {
            // style.fill updates the inline style which overrides presentation attributes set previously
            band.style.fill = color;
            // also set the attribute for compatibility
            band.setAttribute('fill', color);
            const t = band.getAttribute('data-type');
            if (t) types.add(t);
        } catch (e) {
            console.warn('Failed to color band', band, e);
        }
    });
}

// Mettre à jour les sections d'info avec les données des bandes sélectionnées
export function updateInfoForSelectedBands() {
    if (selectedBands.size === 0) return;
    
    // Calculer les coordonnées englobantes
    let minRefStart = Infinity;
    let maxRefEnd = -Infinity;
    let minQueryStart = Infinity;
    let maxQueryEnd = -Infinity;
    
    selectedBands.forEach(band => {
        const data = getBandData(band);
        minRefStart = Math.min(minRefStart, data.refStart);
        maxRefEnd = Math.max(maxRefEnd, data.refEnd);
        minQueryStart = Math.min(minQueryStart, data.queryStart);
        maxQueryEnd = Math.max(maxQueryEnd, data.queryEnd);
    });
    
    // Mettre à jour la visualisation avec les nouvelles coordonnées
    const firstBand = selectedBands.values().next().value;
    const refGenome = firstBand.getAttribute('data-ref-genome');
    const queryGenome = firstBand.getAttribute('data-query-genome');
    const refChr = firstBand.getAttribute('data-ref');
    const queryChr = firstBand.getAttribute('data-query');
    
    // Créer un objet similaire à celui attendu par les fonctions existantes
    const mergedBand = {
        refChr,
        queryChr,
        refStart: minRefStart,
        refEnd: maxRefEnd,
        queryStart: minQueryStart,
        queryEnd: maxQueryEnd,
        type: firstBand.getAttribute('data-type')
    };
    
    showInfoPanel();
    showInfoUpdatedMessage();
    
    // Utiliser les fonctions existantes avec les nouvelles coordonnées
    const parsedSet = allParsedData.find(set =>
        set.refGenome === refGenome && set.queryGenome === queryGenome
    );
    
    if (parsedSet) {
        const linesInRange = getLinesInRange(
            parsedSet.data,
            mergedBand.refChr,
            mergedBand.queryChr,
            mergedBand.refStart,
            mergedBand.refEnd,
            mergedBand.queryStart,
            mergedBand.queryEnd
        );
        
        const summary = createSummarySection(
            linesInRange,
            mergedBand.refStart,
            mergedBand.refEnd,
            mergedBand.queryStart,
            mergedBand.queryEnd,
            refGenome,
            queryGenome
        );
        
        d3.select('#summary').html(`<div class="summary-section"><h4>Summary (${selectedBands.size} bands)</h4>${summary}</div>`);
        
        const tableBadges = createTableBadges(linesInRange);
        const table = createDetailedTable(linesInRange, refGenome, queryGenome);
        d3.select('#info').html(`${tableBadges}${table}`);
        
        // Initialiser le filtrage après l'insertion dans le DOM
        setTimeout(() => {
            initializeTableFiltering();
        }, 0);
        
        // Mettre à jour la section des ancres
        createAnchorsSection(linesInRange, mergedBand.refStart, mergedBand.refEnd, 
            mergedBand.queryStart, mergedBand.queryEnd, refGenome, queryGenome)
            .then(result => {
                const anchorsHtml = result.html;
                d3.select('#orthology-table').html(`<br>${anchorsHtml}`);
                const orthologPairs = result.data;
                createZoomedSyntenyView(orthologPairs, refGenome, queryGenome, 
                    mergedBand.refStart, mergedBand.refEnd,
                    mergedBand.queryStart, mergedBand.queryEnd);
            });
    }
}