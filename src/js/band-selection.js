import { globalMaxChromosomeLengths, allParsedData, genomeColors, bandColorMode, uniqueGenomes } from './process.js';
import { showInfoPanel, showInfoUpdatedMessage } from './info.js';
import { getLinesInRange, createAnchorsSection, updateBandColors, drawMiniChromosome } from './draw.js';
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
        initialX = e.clientX - parseFloat(contextMenu.style.left);
        initialY = e.clientY - parseFloat(contextMenu.style.top);
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
        // Try to scroll to the Info panel and activate the "details" tab.
        const panel = document.getElementById('info-panel') || document.getElementById('info-panel-content') || document.getElementById('info');
        if (panel) {
            try { panel.scrollIntoView({ behavior: 'smooth' }); } catch (e) { /* ignore */ }
            const detailsTab = panel.querySelector('[data-option="details"]');
            if (detailsTab) detailsTab.click();
        } else if (typeof showInfoPanel === 'function') {
            // fallback: try to open the panel (may create it or reveal it)
            try { showInfoPanel(); } catch (e) { /* noop */ }
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
        // Scroll to the Info panel and activate the "anchors" (synteny) tab if available.
        const panel = document.getElementById('info-panel') || document.getElementById('info-panel-content') || document.getElementById('info');
        if (panel) {
            try { panel.scrollIntoView({ behavior: 'smooth' }); } catch (e) { /* ignore */ }
            const anchorsTab = panel.querySelector('[data-option="anchors"]');
            if (anchorsTab) anchorsTab.click();
        } else if (typeof showInfoPanel === 'function') {
            try { showInfoPanel(); } catch (e) { /* noop */ }
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
    // console.log('createChromContextMenu called', { x, y, chromEl });

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
        initialX = e.clientX - parseFloat(contextMenu.style.left);
        initialY = e.clientY - parseFloat(contextMenu.style.top);
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

    const genome = chromEl.getAttribute('data-genome');
    const chromNameAttr = chromEl.getAttribute('data-chrom-name') || '';
    const chromBase = chromNameAttr.split('_ref')[0].split('_query')[0];

	// Ajouter le titre
	const title = document.createElement('div');
	title.className = 'context-menu-item';
	title.style.marginBottom = '8px';
	title.style.marginRight = '24px'; // espace pour le bouton close
	title.textContent = `${genome} - ${chromNameAttr}`;
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

    // Assurer les objets de settings
    if (!window.genomeDisplaySettings) window.genomeDisplaySettings = {};
    if (!window.chromDisplaySettings) window.chromDisplaySettings = {};
    if (!window.genomeDisplaySettings[genome]) window.genomeDisplaySettings[genome] = { mode: 'filled', color: (genomeColors && genomeColors[genome]) ? genomeColors[genome] : '#000000' };

    const chromKey = `${genome}|${chromBase}`;
    if (!window.chromDisplaySettings[chromKey]) {
        window.chromDisplaySettings[chromKey] = {
            mode: window.genomeDisplaySettings[genome].mode || 'filled',
            color: (window.chromDisplaySettings[chromKey] && window.chromDisplaySettings[chromKey].color) || (window.genomeDisplaySettings[genome].color || ((genomeColors && genomeColors[genome]) ? genomeColors[genome] : '#000000'))
        };
    }

    const settings = window.chromDisplaySettings[chromKey];

    // Modes disponibles - inclure heatmap seulement si un gradient existe
    const modes = ['outline', 'filled'];
    const gradientId = `gradient-${genome}-${chromBase}`;
    const hasHeatmap = !!document.getElementById(gradientId) || !!document.querySelector(`linearGradient[id="${gradientId}"]`);
    if (hasHeatmap) modes.push('heatmap');

	//Label des modes
	const modesLabel = document.createElement('div');
	modesLabel.className = 'context-menu-item';
	modesLabel.style.marginBottom = '6px';
	modesLabel.textContent = 'Display Modes';
	contextMenu.appendChild(modesLabel);

    // Scope selector: this chromosome / all chromosomes of genome / all chromosomes of all genomes
    const scopeLabel = document.createElement('div');
    scopeLabel.className = 'context-menu-item';
    scopeLabel.style.marginBottom = '6px';
    scopeLabel.textContent = 'Apply to:';
    contextMenu.appendChild(scopeLabel);

    const scopeOptions = ['this', 'genome', 'all'];
    const scopeContainer = document.createElement('div');
    scopeContainer.style.marginLeft = '20px';
    scopeContainer.style.marginBottom = '8px';
    scopeOptions.forEach(opt => {
        const lbl = document.createElement('label');
        lbl.style.display = 'block';
        const r = document.createElement('input');
        r.type = 'radio';
        r.name = `chrom-scope-${chromKey}`;
        r.value = opt;
        r.checked = opt === 'this';
        lbl.appendChild(r);
        lbl.appendChild(document.createTextNode(` ${opt === 'this' ? 'This chromosome' : (opt === 'genome' ? 'All chromosomes of this genome' : 'All chromosomes of all genomes')}`));
        scopeContainer.appendChild(lbl);
    });
    contextMenu.appendChild(scopeContainer);

    // Replace simple radio buttons by clickable mini-chromosome thumbnails for better UX
    const thumbsLabel = document.createElement('div');
    thumbsLabel.className = 'context-menu-item';
    thumbsLabel.style.marginBottom = '6px';
    thumbsLabel.textContent = 'Display Preview:';
    contextMenu.appendChild(thumbsLabel);

    const thumbsContainer = document.createElement('div');
    thumbsContainer.style.display = 'flex';
    thumbsContainer.style.gap = '8px';
    thumbsContainer.style.marginLeft = '20px';
    thumbsContainer.style.marginBottom = '8px';

    // Helper to update visual selection on thumbnails
    function updateThumbSelectionUI() {
        Array.from(thumbsContainer.querySelectorAll('.mode-thumb')).forEach(t => {
            if (t.getAttribute('data-mode') === settings.mode) {
                t.style.outline = '2px solid black';
                t.style.borderRadius = '4px';
            } else {
                t.style.outline = 'none';
            }
        });
    }

    modes.forEach(mode => {
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'mode-thumb';
        thumbDiv.setAttribute('data-mode', mode);
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
            const color = settings.color || ((genomeColors && genomeColors[genome]) ? genomeColors[genome] : '#000');
            // Always apply the specific mode's visualization, only update color
            if (mode === 'outline') {
                pathEl.setAttribute('fill', 'none');
                pathEl.setAttribute('stroke', color);
            } else if (mode === 'filled') {
                pathEl.setAttribute('fill', color);
                pathEl.setAttribute('stroke', color);
            } else if (mode === 'heatmap') {
                if (document.getElementById(gradientIdLocal) || document.querySelector(`linearGradient[id="${gradientIdLocal}"]`)) {
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
            const selectedScope = contextMenu.querySelector(`input[name="chrom-scope-${chromKey}"]:checked`).value;
            const modeUpdate = { mode };
            applySettingsWithScope(modeUpdate, genome, chromBase, selectedScope, chromEl);
            // update UI selection after applying
            updateThumbSelectionUI();
        });

        // store adjust function so colorpicker can update previews
        thumbDiv._adjustPreview = adjustPreview;

        thumbsContainer.appendChild(thumbDiv);
    });

    contextMenu.appendChild(thumbsContainer);

    // Update selection highlight initially
    setTimeout(() => {
        const first = thumbsContainer.querySelector('.mode-thumb');
        if (first) updateThumbSelectionUI();
    }, 0);

    // Color picker
	const colorContainer = document.createElement('div');
    colorContainer.className = 'color-picker-container';

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color: ';
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = settings.color || '#000000';
    colorPicker.addEventListener('change', (e) => {
        const colorUpdate = { color: e.target.value };
        const selectedScope = contextMenu.querySelector(`input[name="chrom-scope-${chromKey}"]:checked`).value;
        applySettingsWithScope(colorUpdate, genome, chromBase, selectedScope, chromEl);
        // update thumbnails previews after applying
        try {
            const thumbs = contextMenu.querySelectorAll('.mode-thumb');
            thumbs.forEach(t => { if (t._adjustPreview) t._adjustPreview(); });
        } catch (err) {
            // noop
        }
    });
    colorContainer.appendChild(colorLabel);
	colorContainer.appendChild(colorPicker);
    contextMenu.appendChild(colorContainer);

    document.body.appendChild(contextMenu);

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
    const chromKeyLocal = `${genome}|${chromBase}`;
    if (scope === 'this') {
        // compute a robust chrom base (avoid empty base which would match everything)
        let base = chromBase || '';
        const fullName = (chromEl && chromEl.getAttribute) ? chromEl.getAttribute('data-chrom-name') || '' : '';
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
        if (!window.chromDisplaySettings[chromKeyThis]) {
            window.chromDisplaySettings[chromKeyThis] = {
                mode: window.genomeDisplaySettings[genome].mode || 'filled',
                color: window.genomeDisplaySettings[genome].color || '#000000'
            };
        }
        // Update only the specific property (mode or color)
        if ('mode' in settings) {
            window.chromDisplaySettings[chromKeyThis].mode = settings.mode;
        }
        if ('color' in settings) {
            window.chromDisplaySettings[chromKeyThis].color = settings.color;
        }
        // apply to this chrom instances
        applyChromosomeDisplaySettings(chromEl, window.chromDisplaySettings[chromKeyThis], genome, base);
    } else if (scope === 'genome') {
        // Update only the specific property in genome settings
        if ('mode' in settings) {
            window.genomeDisplaySettings[genome].mode = settings.mode;
        }
        if ('color' in settings) {
            window.genomeDisplaySettings[genome].color = settings.color;
        }
        // apply to all chromosomes of this genome, respecting overrides
        const elems = document.querySelectorAll(`path.chrom[data-genome="${genome}"]`);
        elems.forEach(el => {
            const nameAttr = el.getAttribute('data-chrom-name') || '';
            const base = nameAttr.split('_ref')[0].split('_query')[0] || nameAttr.replace(/_(ref|query)$/, '');
            if (!base) return;
            // check for per-chrom override
            const chromKey = `${genome}|${base}`;
            const chromSettings = window.chromDisplaySettings[chromKey];
            // Apply only the changed property, preserving other settings
            if (chromSettings) {
                // Chromosome has overrides
                if ('mode' in settings) {
                    applyChromosomeDisplaySettings(el, { mode: settings.mode, color: chromSettings.color }, genome, base);
                }
                if ('color' in settings) {
                    applyChromosomeDisplaySettings(el, { mode: chromSettings.mode, color: settings.color }, genome, base);
                }
            } else {
                // No overrides, apply genome settings
                applyChromosomeDisplaySettings(el, settings, genome, base);
            }
        });
    } else if (scope === 'all') {
        // apply to all genomes - preserve per-chrom color overrides
        const modeOnlyUpdate = 'mode' in settings && !('color' in settings);
        if (Array.isArray(uniqueGenomes) && uniqueGenomes.length > 0) {
            uniqueGenomes.forEach(g => {
                window.genomeDisplaySettings[g] = Object.assign({}, settings);
                const elems = document.querySelectorAll(`path.chrom[data-genome="${g}"]`);
                elems.forEach(el => {
                    const nameAttr = el.getAttribute('data-chrom-name') || '';
                    const base = nameAttr.split('_ref')[0].split('_query')[0] || nameAttr.replace(/_(ref|query)$/, '');
                    if (!base) return;
                    // check for per-chrom override
                    const chromKey = `${g}|${base}`;
                    const chromSettings = window.chromDisplaySettings[chromKey];
                    // if this is a mode-only update and we have a per-chrom override, preserve its color
                    if (modeOnlyUpdate && chromSettings && chromSettings.color) {
                        applyChromosomeDisplaySettings(el, { mode: settings.mode, color: chromSettings.color }, g, base);
                    } else {
                        applyChromosomeDisplaySettings(el, settings, g, base);
                    }
                });
            });
        } else {
            // fallback: apply to all path.chrom
            document.querySelectorAll('path.chrom').forEach(el => {
                const g = el.getAttribute('data-genome');
                const nameAttr = el.getAttribute('data-chrom-name') || '';
                const base = nameAttr.split('_ref')[0].split('_query')[0] || nameAttr.replace(/_(ref|query)$/, '');
                if (!base) return;
                window.genomeDisplaySettings[g] = Object.assign({}, settings);
                // check for per-chrom override
                const chromKey = `${g}|${base}`;
                const chromSettings = window.chromDisplaySettings[chromKey];
                // if this is a mode-only update and we have a per-chrom override, preserve its color
                if (modeOnlyUpdate && chromSettings && chromSettings.color) {
                    applyChromosomeDisplaySettings(el, { mode: settings.mode, color: chromSettings.color }, g, base);
                } else {
                    applyChromosomeDisplaySettings(el, settings, g, base);
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
            const nameAttr = chromEl.getAttribute && chromEl.getAttribute('data-chrom-name') ? chromEl.getAttribute('data-chrom-name') : '';
            base = nameAttr.split('_ref')[0].split('_query')[0] || nameAttr.replace(/_(ref|query)$/, '');
        }
        if (!base) {
            console.warn('applyChromosomeDisplaySettings: empty chromBase, aborting to avoid global application', { genome, chromBase });
            return;
        }
        const mode = settings.mode || 'filled';
        const color = settings.color || ((genomeColors && genomeColors[genome]) ? genomeColors[genome] : '#000000');
        const gradientId = `gradient-${genome}-${base}`;

        // Apply to all matching chromosome path elements (ref and query variants)
    const selector = `path.chrom[data-genome="${genome}"][data-chrom-name^="${base}"]`;
        const elems = document.querySelectorAll(selector);
        elems.forEach(el => {
            if (mode === 'outline') {
                el.style.fill = 'none';
                el.style.stroke = color;
            } else if (mode === 'filled') {
                el.style.fill = color;
                el.style.stroke = color;
            } else if (mode === 'heatmap') {
                if (document.getElementById(gradientId) || document.querySelector(`linearGradient[id="${gradientId}"]`)) {
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
            if (window.chromDisplaySettings && window.chromDisplaySettings[perChromKey]) {
                // only update the specific chrom cell in the chrom-controler
                const id = `${genome}-${base}`;
                const item = document.querySelector(`#chrom-controler [data-id="${id}"]`);
                if (item) item.style.border = `2px solid ${color}`;
            } else if (window.genomeDisplaySettings && window.genomeDisplaySettings[genome]) {
                // genome-level setting: update all items for this genome
                const controlItems = document.querySelectorAll(`#chrom-controler [data-genome="${genome}"]`);
                controlItems.forEach(it => { it.style.border = `2px solid ${color}`; });
            } else {
                // fallback: try updating the specific item
                const id = `${genome}-${base}`;
                const item = document.querySelector(`#chrom-controler [data-id="${id}"]`);
                if (item) item.style.border = `2px solid ${color}`;
            }
        } catch (e) {
            // noop
        }
    } catch (e) {
        console.warn('applyChromosomeDisplaySettings failed', e);
    }
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