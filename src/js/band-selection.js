import { globalMaxChromosomeLengths, allParsedData, genomeColors, uniqueGenomes } from './process.js';
import { showInfoPanel, showInfoUpdatedMessage, createSummarySection, createDetailedTable, createTableBadges, initializeTableFiltering, createZoomedSyntenyView } from './info.js';
import { getLinesInRange, createAnchorsSection, drawMiniChromosome, updateChromosomeHeatmapColor } from './draw.js';
import { logActivity } from './main.js';

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

function getCurrentGenomeMode(genome) {
    const chromosome = document.querySelector(`path.chrom[data-genome="${CSS.escape(genome)}"]`);
    const fill = chromosome?.style?.fill || chromosome?.getAttribute?.('fill') || '';
    return fill === 'none' ? 'outline' : fill.includes('gradient') ? 'heatmap' : 'filled';
}

// The stroke carries the actual display color, including the By chromosome palette.
function getDisplayedChromosomeColor(el) {
    const color = el.style.stroke || el.getAttribute('stroke') ||
        globalThis.chromDisplaySettings?.[`${el.dataset.genome}|${(el.dataset.chromName || '').replace(/_(ref|query)$/, '')}`]?.color ||
        globalThis.genomeDisplaySettings?.[el.dataset.genome]?.color || genomeColors?.[el.dataset.genome] || '#000000';
    return d3.color(color)?.formatHex() || '#000000';
}

// Créer et afficher le menu contextuel
export function createContextMenu(x, y, band) {

    // Supprimer menu existant et son handler
    if (contextMenu) {
        closeContextMenu();
    }

    contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.position = 'fixed';  // Ensure fixed positioning for dragging

    // Add drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'context-menu-drag-handle';
    dragHandle.style.cssText = 'cursor: move; height: 20px; background: #f5f5f5; border-bottom: 1px solid #ddd; position: relative;';

    // Add visual dots to indicate draggable
    const dragDots = document.createElement('div');
    dragDots.style.cssText = `
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        gap: 4px;
    `;
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = 'width: 4px; height: 4px; border-radius: 50%; background: #999;';
        dragDots.appendChild(dot);
    }
    dragHandle.appendChild(dragDots);

    // Add drag functionality
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        initialX = e.clientX - Number.parseFloat(contextMenu.style.left);
        initialY = e.clientY - Number.parseFloat(contextMenu.style.top);
        dragHandle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        contextMenu.style.left = `${currentX}px`;
        contextMenu.style.top = `${currentY}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        dragHandle.style.cursor = 'move';
    });

    contextMenu.appendChild(dragHandle);

    // Close (X) button
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'position:absolute; top:2px; right:8px; border:none; background:transparent; font-size:16px; cursor:pointer;';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeContextMenu();
    });
    contextMenu.appendChild(closeBtn);

    // Item de sélection similaire
    const similarItem = document.createElement('div');
    similarItem.className = 'context-menu-item';
    similarItem.innerHTML = '<i class="fas fa-object-group"></i> Slide to select similar bands';

    // Container pour le slider
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'distance-slider-container';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
	//max = taille du chromosome
	slider.max = globalMaxChromosomeLengths[band.dataset.refNum] || '10000000';
    slider.value = '100000';
    slider.style.width = '100%';

    const sliderValue = document.createElement('div');
    sliderValue.textContent = 'Distance: 100kb';
    slider.oninput = () => {
        const val = Number.parseInt(slider.value);
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
    colorLabel.textContent = 'Color: ';
    colorContainer.appendChild(colorLabel);
    colorContainer.appendChild(colorPicker);

    // Bouton de mise à jour des infos
    const updateInfoBtn = document.createElement('div');
    updateInfoBtn.style.cursor = 'pointer';
    updateInfoBtn.className = 'context-menu-item';
    updateInfoBtn.innerHTML = '<i class="fas fa-sync"></i> Update info panel for selected bands';
    updateInfoBtn.onmouseover = () => {
        updateInfoBtn.style.backgroundColor = '#f0f0f0';
    };
    updateInfoBtn.onmouseout = () => {
        updateInfoBtn.style.backgroundColor = '';
    };
    updateInfoBtn.onclick = () => {
        logActivity('Updated info panel for selected bands');
        updateInfoForSelectedBands();
        closeContextMenu();
    };

    //ajoute un goto vers la section block details et la section synteny view
    const gotoBlockDetails = document.createElement('div');
    gotoBlockDetails.style.cursor = 'pointer';
    gotoBlockDetails.className = 'context-menu-item';
    gotoBlockDetails.innerHTML = '<i class="fas fa-info-circle"></i> Go to Block Details';
    gotoBlockDetails.onmouseover = () => {
        gotoBlockDetails.style.backgroundColor = '#f0f0f0';
    };
    gotoBlockDetails.onmouseout = () => {
        gotoBlockDetails.style.backgroundColor = '';
    };
    gotoBlockDetails.onclick = () => {
        logActivity('Navigated to Block Details from context menu');
        // Try to scroll to the Info panel and activate the "details" tab.
        const panel = document.getElementById('info-panel') || document.getElementById('info-panel-content') || document.getElementById('info');
        if (panel) {
            try { panel.scrollIntoView({ behavior: 'smooth' }); } catch (e) { console.warn('scrollIntoView failed', e); }
            const detailsTab = panel.querySelector('[data-option="details"]');
            if (detailsTab) detailsTab.click();
        } else if (typeof showInfoPanel === 'function') {
            // fallback: try to open the panel (may create it or reveal it)
            try { showInfoPanel(); } catch (e) { console.warn('showInfoPanel failed', e); }
        }
        closeContextMenu();
    };

    const gotoSyntenyView = document.createElement('div');
    gotoSyntenyView.style.cursor = 'pointer';
    gotoSyntenyView.className = 'context-menu-item';
    gotoSyntenyView.innerHTML = '<i class="fas fa-project-diagram"></i> Go to Synteny View';
    gotoSyntenyView.onmouseover = () => {
        gotoSyntenyView.style.backgroundColor = '#f0f0f0';
    };
    gotoSyntenyView.onmouseout = () => {
        gotoSyntenyView.style.backgroundColor = '';
    };
    gotoSyntenyView.onclick = () => {
        logActivity('Navigated to Synteny View from context menu');
        // Scroll to the Info panel and activate the "anchors" (synteny) tab if available.
        const panel = document.getElementById('info-panel') || document.getElementById('info-panel-content') || document.getElementById('info');
        if (panel) {
            try { panel.scrollIntoView({ behavior: 'smooth' }); } catch (e) { console.warn('scrollIntoView failed', e); }
            const anchorsTab = panel.querySelector('[data-option="anchors"]');
            if (anchorsTab) anchorsTab.click();
        } else if (typeof showInfoPanel === 'function') {
            try { showInfoPanel(); } catch (e) { console.warn('showInfoPanel failed', e); }
        }
        closeContextMenu();
    };

    // Assemblage du menu
    contextMenu.appendChild(similarItem);
    contextMenu.appendChild(sliderContainer);
    const separator = document.createElement('div');
    separator.className = 'context-menu-separator';
    contextMenu.appendChild(separator);
    contextMenu.appendChild(colorContainer);
    contextMenu.appendChild(updateInfoBtn);
    contextMenu.appendChild(gotoBlockDetails);
    contextMenu.appendChild(gotoSyntenyView);

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

// Créer et afficher le menu contextuel pour un chromosome
export function createChromContextMenu(x, y, chromEl) {

    // Réutiliser le même mécanisme de fermeture
    if (contextMenu) {
        closeContextMenu();
    }

    contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;

    // Add drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'context-menu-drag-handle';
    dragHandle.style.cssText = 'cursor: move; height: 20px; background: #f5f5f5; border-bottom: 1px solid #ddd; position: relative;';

    // Add visual dots to indicate draggable
    const dragDots = document.createElement('div');
    dragDots.style.cssText = `
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        gap: 4px;
    `;
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = 'width: 4px; height: 4px; border-radius: 50%; background: #999;';
        dragDots.appendChild(dot);
    }
    dragHandle.appendChild(dragDots);

    // Add drag functionality
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        initialX = e.clientX - Number.parseFloat(contextMenu.style.left);
        initialY = e.clientY - Number.parseFloat(contextMenu.style.top);
        dragHandle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        contextMenu.style.left = `${currentX}px`;
        contextMenu.style.top = `${currentY}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        dragHandle.style.cursor = 'move';
    });

    contextMenu.appendChild(dragHandle);

    const genome = chromEl.dataset.genome;
    const chromNameAttr = chromEl.dataset.chromName || '';
    const chromBase = chromNameAttr.replace(/_(ref|query)$/, '');

	// Ajouter le titre
	const title = document.createElement('div');
	title.className = 'context-menu-item';
	title.style.marginBottom = '8px';
	title.style.marginRight = '24px'; // espace pour le bouton close
	title.textContent = `${genome} - ${chromBase}`;
	contextMenu.appendChild(title);

	const separator = document.createElement('div');
    separator.className = 'context-menu-separator';
    contextMenu.appendChild(separator);

    // Close (X) button
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'position:absolute; top:2px; right:8px; border:none; background:transparent; font-size:16px; cursor:pointer;';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeContextMenu();
    });
    contextMenu.appendChild(closeBtn);

    // Settings are created only by an explicit user action, never by opening the menu.
    if (!globalThis.genomeDisplaySettings) globalThis.genomeDisplaySettings = {};
    if (!globalThis.chromDisplaySettings) globalThis.chromDisplaySettings = {};

    const chromKey = `${genome}|${chromBase}`;
    const chromosomeGradientId = `gradient-${genome}-${chromBase}`;
    const chromosomeHasHeatmap = !!document.getElementById(chromosomeGradientId) ||
        !!document.querySelector(`linearGradient[id="${CSS.escape(chromosomeGradientId)}"]`);
    const currentFill = chromEl.style.fill || chromEl.getAttribute('fill') || '';
    const explicitChromSettings = globalThis.chromDisplaySettings[chromKey];
    const inheritedSettings = globalThis.genomeDisplaySettings[genome] || {};
    // Opening the menu must not create an individual override.
    const settings = {
        mode: explicitChromSettings?.mode || inheritedSettings.mode ||
            (chromosomeHasHeatmap && currentFill.includes('gradient') ? 'heatmap' : 'filled'),
        color: getDisplayedChromosomeColor(chromEl)
    };

    // Modes disponibles - inclure heatmap seulement si un gradient existe
    const modes = ['outline', 'filled', 'heatmap'];
    const gradientId = `gradient-${genome}-${chromBase}`;
    const hasHeatmap = !!document.getElementById(gradientId) || !!document.querySelector(`linearGradient[id="${CSS.escape(gradientId)}"]`);

    // Scope selector: this chromosome / all chromosomes of genome / all chromosomes of all genomes
    contextMenu.classList.add('chrom-appearance-menu');
    const scopeSection = document.createElement('fieldset');
    scopeSection.className = 'chrom-appearance-scope';
    const scopeLabel = document.createElement('legend');
    scopeLabel.textContent = 'Apply changes to';
    scopeSection.appendChild(scopeLabel);
    let selectedScope = 'this';

    const scopeOptions = ['this', 'genome', 'all'];
    const scopeContainer = document.createElement('div');
    const scopeSummary = document.createElement('div');
    scopeSummary.className = 'chrom-appearance-summary';
    scopeSummary.setAttribute('aria-live', 'polite');
    const scopeNames = {
        this: `This chromosome - ${chromBase}`,
        genome: `All chromosomes of ${genome}`,
        all: 'All chromosomes of all genomes'
    };
    const updateScopeSummary = () => {
        const targets = new Set();
        document.querySelectorAll('path.chrom').forEach(el => {
            const g = el.dataset.genome;
            const base = (el.dataset.chromName || '').replace(/_(ref|query)$/, '');
            if (!base || (selectedScope !== 'all' && g !== genome) ||
                (selectedScope === 'this' && base !== chromBase)) return;
            targets.add(JSON.stringify([g, base]));
        });
        const count = targets.size;
        scopeSummary.textContent = `${count} chromosome${count === 1 ? '' : 's'} affected. Changes apply immediately.`;
    };
    scopeOptions.forEach(opt => {
        const lbl = document.createElement('label');
        const r = document.createElement('input');
        r.type = 'radio';
        r.name = `chrom-scope-${chromKey}`;
        r.value = opt;
        r.checked = opt === 'this';
        r.addEventListener('change', () => {
            selectedScope = opt;
            updateScopeSummary();
            refreshControls();
        });
        lbl.appendChild(r);
        const scopeText = scopeNames[opt];
        lbl.appendChild(document.createTextNode(` ${scopeText}`));
        scopeContainer.appendChild(lbl);
    });
    scopeSection.append(scopeContainer, scopeSummary);
    contextMenu.appendChild(scopeSection);
    updateScopeSummary();

    // Replace simple radio buttons by clickable mini-chromosome thumbnails for better UX
    const thumbsLabel = document.createElement('div');
    thumbsLabel.className = 'context-menu-item';
    thumbsLabel.style.marginBottom = '6px';
    thumbsLabel.textContent = 'Display mode';

    const thumbsContainer = document.createElement('div');
    thumbsContainer.style.display = 'flex';
    thumbsContainer.style.gap = '8px';
    thumbsContainer.style.marginLeft = '20px';
    thumbsContainer.style.marginBottom = '8px';

    modes.forEach(mode => {
        const thumbDiv = document.createElement('button');
        thumbDiv.type = 'button';
        thumbDiv.className = 'mode-thumb';
        thumbDiv.dataset.mode = mode;
        thumbDiv.disabled = mode === 'heatmap' && !hasHeatmap;
        if (thumbDiv.disabled) thumbDiv.title = 'Heatmap data is unavailable for this chromosome.';
        thumbDiv.style.cursor = 'pointer';
        thumbDiv.style.padding = '4px';
        thumbDiv.style.display = 'flex';
        thumbDiv.style.flexDirection = 'column';
        thumbDiv.style.alignItems = 'center';

        // label under the thumbnail
        const lbl = document.createElement('div');
        lbl.textContent = mode === 'outline' ? 'Outline' : (mode === 'filled' ? 'Filled' : 'Heatmap');
        lbl.style.fontSize = '11px';
        lbl.style.color = '#333';
        lbl.style.marginTop = '4px';

        // create inline svg
        const svgNs = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('width', '64');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 60 18');
        svg.style.display = 'block';

        // Draw base mini chromosome using existing helper if possible
        try {
            // drawMiniChromosome expects a d3 selection; wrap the svg in a temporary container
            // but simpler: call the helper by selecting the svg with d3 if available
            if (typeof d3 !== 'undefined' && d3.select) {
                const sel = d3.select(svg);
                drawMiniChromosome(genome, sel);
            } else {
                // fallback: draw a rounded rect path
                const path = document.createElementNS(svgNs, 'rect');
                path.setAttribute('x', '2');
                path.setAttribute('y', '4');
                path.setAttribute('width', '56');
                path.setAttribute('height', '10');
                path.setAttribute('rx', '3');
                path.setAttribute('ry', '3');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', (settings.color || '#000'));
                svg.appendChild(path);
            }
        } catch (e) {
            console.warn('drawMiniChromosome preview failed', e);
        }

        // Adjust the preview to show the specific mode with current color
        const adjustPreview = () => {
            const pathEl = svg.querySelector('path') || svg.querySelector('rect');
            const gradientIdLocal = `gradient-${genome}-${chromBase}`;
            if (!pathEl) return;
            const color = settings.color || ((genomeColors?.[genome]) ? genomeColors[genome] : '#000');
            // Always apply the specific mode's visualization, only update color
            if (mode === 'outline') {
                pathEl.setAttribute('fill', 'none');
                pathEl.setAttribute('stroke', color);
            } else if (mode === 'filled') {
                pathEl.setAttribute('fill', color);
                pathEl.setAttribute('stroke', color);
            } else if (mode === 'heatmap') {
                if (document.getElementById(gradientIdLocal) || document.querySelector(`linearGradient[id="${CSS.escape(gradientIdLocal)}"]`)) {
                    pathEl.setAttribute('fill', `url(#${gradientIdLocal})`);
                } else {
                    pathEl.setAttribute('fill', color);
                }
                pathEl.setAttribute('stroke', color);
            }
        };

        // initial adjust
        adjustPreview();

        thumbDiv.appendChild(svg);
        thumbDiv.appendChild(lbl);

        // click handler - only update mode
        thumbDiv.addEventListener('click', () => {
            logActivity(`Changed display mode to "${mode}" for chromosome ${chromNameAttr} of genome ${genome}`);
            const modeUpdate = { mode };
            applySettingsWithScope(modeUpdate, genome, chromBase, selectedScope, chromEl);
            settings.mode = mode;
            refreshControls();
        });

        // store adjust function so colorpicker can update previews
        thumbDiv._adjustPreview = adjustPreview;

        thumbsContainer.appendChild(thumbDiv);
    });

    const modeRow = document.createElement('div');
    modeRow.className = 'display-setting-row';
    modeRow.appendChild(thumbsLabel);
    modeRow.appendChild(thumbsContainer);
    contextMenu.appendChild(modeRow);

	const sectionSeparator = document.createElement('div');
	sectionSeparator.className = 'menu-section-separator';
	contextMenu.appendChild(sectionSeparator);

    // Color picker
    const colorContainer = document.createElement('div');
    colorContainer.className = 'color-picker-container';
    colorContainer.classList.add('display-setting-row');

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.setAttribute('aria-label', 'Change chromosome color');
    colorPicker.value = settings.color || '#000000';
    const applySelectedColor = (e) => {
        const colorUpdate = { color: e.target.value };
        applySettingsWithScope(colorUpdate, genome, chromBase, selectedScope, chromEl);
        settings.color = e.target.value;
        refreshControls();
        // update thumbnails previews after applying
        try {
            const thumbs = contextMenu.querySelectorAll('.mode-thumb');
            thumbs.forEach(t => { if (t._adjustPreview) t._adjustPreview(); });
        } catch (err) {
            console.warn('Failed to update thumbnail previews after color change', err);
        }
    };
    // `input` updates the drawing while the native color picker is open.
    colorPicker.addEventListener('input', applySelectedColor);
    colorContainer.appendChild(colorLabel);
    colorContainer.appendChild(colorPicker);
    contextMenu.appendChild(colorContainer);

    const colorStatus = document.createElement('span');
    colorStatus.className = 'chrom-appearance-summary';
    colorContainer.appendChild(colorStatus);
    function refreshControls() {
        const colors = new Set();
        const activeModes = new Set();
        let heatmapAvailable = false;
        document.querySelectorAll('path.chrom').forEach(el => {
            const g = el.dataset.genome;
            const base = (el.dataset.chromName || '').replace(/_(ref|query)$/, '');
            if (!base || (selectedScope !== 'all' && g !== genome) ||
                (selectedScope === 'this' && base !== chromBase)) return;
            const fill = el.style.fill || el.getAttribute('fill') || '';
            activeModes.add(fill === 'none' ? 'outline' : fill.includes('gradient') ? 'heatmap' : 'filled');
            colors.add(getDisplayedChromosomeColor(el));
            if (document.getElementById(`gradient-${g}-${base}`)) heatmapAvailable = true;
        });
        thumbsContainer.querySelectorAll('.mode-thumb').forEach(button => {
            button.setAttribute('aria-pressed', String(activeModes.size === 1 && activeModes.has(button.dataset.mode)));
            if (button.dataset.mode === 'heatmap') {
                button.disabled = !heatmapAvailable;
                button.title = heatmapAvailable ? 'Chromosomes without heatmap data use a solid fill.' : 'No heatmap data available for this selection.';
            }
        });
        colorStatus.textContent = colors.size > 1 ? 'Multiple colors' : '';
        if (colors.size === 1) {
            settings.color = [...colors][0];
            colorPicker.value = settings.color;
        }
        thumbsContainer.querySelectorAll('.mode-thumb').forEach(button => button._adjustPreview());
    }
    refreshControls();

    document.body.appendChild(contextMenu);
    const menuBounds = contextMenu.getBoundingClientRect();
    contextMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - menuBounds.width - 8))}px`;
    contextMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - menuBounds.height - 8))}px`;

    // stop propagation from menu itself
    contextMenu.addEventListener('click', (e) => e.stopPropagation());
    contextMenu.addEventListener('pointerdown', (e) => e.stopPropagation());

    // Close when clicking outside
    _docClickHandler = function(e) {
        if (!contextMenu) return;
        if (!contextMenu.contains(e.target) && !e.target.closest('.chrom')) {
            closeContextMenu();
        }
    };
    document.addEventListener('click', _docClickHandler);
}

// Apply settings according to scope
function applySettingsWithScope(settings, genome, chromBase, scope, chromEl) {
    if (scope === 'this') {
        // compute a robust chrom base (avoid empty base which would match everything)
        let base = chromBase || '';
        const fullName = (chromEl && chromEl.dataset) ? chromEl.dataset.chromName || '' : '';
        if (!base) {
            // strip common suffixes
            base = fullName.replace(/_(ref|query)$/, '') || fullName;
        }
        if (!base) {
            console.warn('applySettingsWithScope: cannot determine chrom base for "this" scope — aborting to avoid global changes', { genome, chromBase, fullName });
            return;
        }
        const chromKeyThis = `${genome}|${base}`;
        // Initialize if needed
        if (!globalThis.chromDisplaySettings[chromKeyThis]) {
            const currentFill = chromEl?.style?.fill || chromEl?.getAttribute?.('fill') || '';
            globalThis.chromDisplaySettings[chromKeyThis] = {
                mode: globalThis.genomeDisplaySettings[genome]?.mode ||
                    (currentFill.includes('gradient') ? 'heatmap' : 'filled'),
                color: getDisplayedChromosomeColor(chromEl)
            };
        }
        // Update only the specific property (mode or color)
        if ('mode' in settings) {
            globalThis.chromDisplaySettings[chromKeyThis].mode = settings.mode;
        }
        if ('color' in settings) {
            globalThis.chromDisplaySettings[chromKeyThis].color = settings.color;
            updateChromosomeHeatmapColor(genome, base, settings.color);
        }
        // apply to this chrom instances
        applyChromosomeDisplaySettings(chromEl, globalThis.chromDisplaySettings[chromKeyThis], genome, base);
    } else if (scope === 'genome') {
        if (!globalThis.genomeDisplaySettings[genome]) {
            globalThis.genomeDisplaySettings[genome] = {
                mode: getCurrentGenomeMode(genome),
                color: genomeColors?.[genome] || '#000000'
            };
        }
        // Update only the specific property in genome settings
        if ('mode' in settings) {
            globalThis.genomeDisplaySettings[genome].mode = settings.mode;
        }
        if ('color' in settings) {
            globalThis.genomeDisplaySettings[genome].color = settings.color;
            document.querySelectorAll(`path.chrom[data-genome="${CSS.escape(genome)}"]`).forEach(el => {
                const name = el.dataset.chromName || '';
                const base = name.replace(/_(ref|query)$/, '') || name;
                updateChromosomeHeatmapColor(genome, base, settings.color);
            });
        }
        // apply to all chromosomes of this genome, respecting overrides
        const elems = document.querySelectorAll(`path.chrom[data-genome="${CSS.escape(genome)}"]`);
        elems.forEach(el => {
            const nameAttr = el.dataset.chromName || '';
            const base = nameAttr.replace(/_(ref|query)$/, '') || nameAttr.replace(/_(ref|query)$/, '');
            if (!base) return;
            // check for per-chrom override
            const chromKey = `${genome}|${base}`;
            const chromSettings = globalThis.chromDisplaySettings[chromKey];
            // Apply only the changed property, preserving other settings
            if (chromSettings) {
                // Chromosome has overrides
                if ('mode' in settings) {
                    chromSettings.mode = settings.mode;
                    applyChromosomeDisplaySettings(el, { mode: settings.mode, color: chromSettings.color }, genome, base);
                }
                if ('color' in settings) {
                    chromSettings.color = settings.color;
                    applyChromosomeDisplaySettings(el, { mode: chromSettings.mode, color: settings.color }, genome, base);
                }
            } else {
                // No overrides, apply genome settings
                const currentFill = el.style.fill || el.getAttribute('fill') || '';
                const effectiveSettings = {
                    ...globalThis.genomeDisplaySettings[genome],
                    ...(('color' in settings && !('mode' in settings) && currentFill.includes('gradient'))
                        ? { mode: 'heatmap' } : {})
                };
                applyChromosomeDisplaySettings(el, effectiveSettings, genome, base);
            }
        });
    } else if (scope === 'all') {
        // apply to all genomes - preserve per-chrom color overrides
        const modeOnlyUpdate = 'mode' in settings && !('color' in settings);
        if (Array.isArray(uniqueGenomes) && uniqueGenomes.length > 0) {
            uniqueGenomes.forEach(g => {
                const currentGenomeSettings = globalThis.genomeDisplaySettings[g] || {
                    mode: getCurrentGenomeMode(g),
                    color: genomeColors?.[g] || '#000000'
                };
                globalThis.genomeDisplaySettings[g] = {
                    ...currentGenomeSettings,
                    ...settings
                };
                const elems = document.querySelectorAll(`path.chrom[data-genome="${CSS.escape(g)}"]`);
                elems.forEach(el => {
                    const nameAttr = el.dataset.chromName || '';
                    const base = nameAttr.replace(/_(ref|query)$/, '') || nameAttr.replace(/_(ref|query)$/, '');
                    if (!base) return;
                    // check for per-chrom override
                    const chromKey = `${g}|${base}`;
                    const chromSettings = globalThis.chromDisplaySettings[chromKey];
                    // if this is a mode-only update and we have a per-chrom override, preserve its color
                    if (modeOnlyUpdate && chromSettings?.color) {
                        chromSettings.mode = settings.mode;
                        applyChromosomeDisplaySettings(el, { mode: settings.mode, color: chromSettings.color }, g, base);
                    } else if (chromSettings) {
                        Object.assign(chromSettings, settings);
                        applyChromosomeDisplaySettings(el, {
                            ...chromSettings,
                            ...settings
                        }, g, base);
                    } else {
                        const currentFill = el.style.fill || el.getAttribute('fill') || '';
                        const effectiveSettings = {
                            ...globalThis.genomeDisplaySettings[g],
                            ...(('color' in settings && !('mode' in settings) && currentFill.includes('gradient'))
                                ? { mode: 'heatmap' } : {})
                        };
                        applyChromosomeDisplaySettings(el, effectiveSettings, g, base);
                    }
                });
            });
        } else {
            // fallback: apply to all path.chrom
            document.querySelectorAll('path.chrom').forEach(el => {
                const g = el.dataset.genome;
                const nameAttr = el.dataset.chromName || '';
                const base = nameAttr.replace(/_(ref|query)$/, '') || nameAttr.replace(/_(ref|query)$/, '');
                if (!base) return;
                const currentGenomeSettings = globalThis.genomeDisplaySettings[g] || {
                    mode: getCurrentGenomeMode(g),
                    color: genomeColors?.[g] || '#000000'
                };
                globalThis.genomeDisplaySettings[g] = {
                    ...currentGenomeSettings,
                    ...settings
                };
                // check for per-chrom override
                const chromKey = `${g}|${base}`;
                const chromSettings = globalThis.chromDisplaySettings[chromKey];
                // if this is a mode-only update and we have a per-chrom override, preserve its color
                if (modeOnlyUpdate && chromSettings?.color) {
                    chromSettings.mode = settings.mode;
                    applyChromosomeDisplaySettings(el, { mode: settings.mode, color: chromSettings.color }, g, base);
                } else if (chromSettings) {
                    Object.assign(chromSettings, settings);
                    applyChromosomeDisplaySettings(el, {
                        ...chromSettings,
                        ...settings
                    }, g, base);
                } else {
                    const currentFill = el.style.fill || el.getAttribute('fill') || '';
                    const effectiveSettings = {
                        ...globalThis.genomeDisplaySettings[g],
                        ...(('color' in settings && !('mode' in settings) && currentFill.includes('gradient'))
                            ? { mode: 'heatmap' } : {})
                    };
                    applyChromosomeDisplaySettings(el, effectiveSettings, g, base);
                }
            });
        }
    }
}

// Appliquer les settings au DOM pour un chromosome donné
function applyChromosomeDisplaySettings(chromEl, settings, genome, chromBase) {
    try {
        if (!chromEl) return;
        // Ensure chromBase is robust; fall back to chromEl attribute if needed
        let base = chromBase || '';
        if (!base) {
            const nameAttr = chromEl.dataset.chromName || '';
            base = nameAttr.replace(/_(ref|query)$/, '') || nameAttr.replace(/_(ref|query)$/, '');
        }
        if (!base) {
            console.warn('applyChromosomeDisplaySettings: empty chromBase, aborting to avoid global application', { genome, chromBase });
            return;
        }
        const mode = settings.mode || 'filled';
        const color = settings.color || ((genomeColors?.[genome]) ? genomeColors[genome] : '#000000');
        const gradientId = `gradient-${genome}-${base}`;

        if (Object.prototype.hasOwnProperty.call(settings, 'color')) {
            updateChromosomeHeatmapColor(genome, base, color);
        }

        // Apply to all matching chromosome path elements (ref and query variants)
        const elems = Array.from(document.querySelectorAll('path.chrom')).filter(el =>
            el.dataset.genome === genome &&
            (el.dataset.chromName || '').replace(/_(ref|query)$/, '') === base);
        elems.forEach(el => {
            if (mode === 'outline') {
                el.style.fill = 'none';
                el.style.stroke = color;
            } else if (mode === 'filled') {
                el.style.fill = color;
                el.style.stroke = color;
            } else if (mode === 'heatmap') {
                if (document.getElementById(gradientId) || document.querySelector(`linearGradient[id="${CSS.escape(gradientId)}"]`)) {
                    el.style.fill = `url(#${gradientId})`;
                } else {
                    el.style.fill = color;
                }
                el.style.stroke = color;
            }
        });

        // Update chrom-controler items styles for this genome
        try {
            const perChromKey = `${genome}|${base}`;
            if (globalThis.chromDisplaySettings?.[perChromKey]) {
                // only update the specific chrom cell in the chrom-controler
                const id = `${genome}-${base}`;
                const item = document.querySelector(`#chrom-controler [data-id="${CSS.escape(id)}"]`);
                if (item) item.style.border = `2px solid ${color}`;
            } else if (globalThis.genomeDisplaySettings?.[genome]) {
                // genome-level setting: update all items for this genome
                const controlItems = document.querySelectorAll(`#chrom-controler [data-genome="${CSS.escape(genome)}"]`);
                controlItems.forEach(it => { it.style.border = `2px solid ${color}`; });
            } else {
                // fallback: try updating the specific item
                const id = `${genome}-${base}`;
                const item = document.querySelector(`#chrom-controler [data-id="${CSS.escape(id)}"]`);
                if (item) item.style.border = `2px solid ${color}`;
            }
        } catch (e) {
            console.warn('Failed to update chrom-controler item styles', e);
        }
    } catch (e) {
        console.warn('applyChromosomeDisplaySettings failed', e);
    }
}

// Sélectionner les bandes similaires dans un rayon donné
export function selectSimilarBands(sourceBand, distance) {
    const sourceType = sourceBand.dataset.type;
    const sourceRefNum = sourceBand.dataset.refNum;
    const sourceQueryNum = sourceBand.dataset.queryNum;
	const sourceRefGenome = sourceBand.dataset.refGenome;
	const sourceQueryGenome = sourceBand.dataset.queryGenome;

    selectedBands.clear();
    selectedBands.add(sourceBand);

    document.querySelectorAll('.band').forEach(band => {
        if (band === sourceBand) return;

        if (band.dataset.type === sourceType &&
            band.dataset.refNum === sourceRefNum &&
            band.dataset.queryNum === sourceQueryNum &&
            band.dataset.refGenome === sourceRefGenome &&
            band.dataset.queryGenome === sourceQueryGenome) {

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
        refStart: Number.parseInt(band.dataset.refStart),
        refEnd: Number.parseInt(band.dataset.refEnd),
        queryStart: Number.parseInt(band.dataset.queryStart),
        queryEnd: Number.parseInt(band.dataset.queryEnd)
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
            const t = band.dataset.type;
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
    const refGenome = firstBand.dataset.refGenome;
    const queryGenome = firstBand.dataset.queryGenome;
    const refChr = firstBand.dataset.ref;
    const queryChr = firstBand.dataset.query;

    // Créer un objet similaire à celui attendu par les fonctions existantes
    const mergedBand = {
        refChr,
        queryChr,
        refStart: minRefStart,
        refEnd: maxRefEnd,
        queryStart: minQueryStart,
        queryEnd: maxQueryEnd,
        type: firstBand.dataset.type
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
