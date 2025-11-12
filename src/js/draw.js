import { showInfoPanel, showInfoUpdatedMessage, createDetailedTable, initializeTableFiltering, createTableBadges, createSummarySection, createZoomedSyntenyView, createOrthologsTable} from "./info.js";
import { refGenome, queryGenome, genomeColors, bandColorMode, genomeData, scale, allParsedData, isFirstDraw, downloadSvg, generateColor } from "./process.js";
import { anchorsFiles, bedFiles, jbrowseLinks } from "./form.js";
import { createContextMenu, createChromContextMenu, selectedBands, updateBandSelection, 
    selectSimilarBands, colorSelectedBands, updateInfoForSelectedBands } from './band-selection.js';

export let currentYOffset = 0; // Définir globalement

// Définir les defs pour chaque type
export const typeDefs = {
    'SYN': 'Syntenic region', 
    'SYNAL': 'Alignment in syntenic region',
    'INV': 'Inverted region',
    'INVAL': 'Alignment in inverted region',
    'INVTR': 'Inverted translocated region',
    'INVTRAL': 'Alignment in inverted translocated region',
    'INVDP': 'Inverted duplicated region',
    'INVDPAL': 'Alignment in inverted duplicated region',
    'TRANS': 'Translocated region',
    'TRANSAL': 'Alignment in translocated region',
    'DUP': 'Duplicated region',
    'DUPAL': 'Alignment in duplicated region',
    'NOTAL': 'Un-aligned region',
    'SNP': 'Single Nucleotide Polymorphism',
    'CPG': 'Copy gain in query',
    'CPL': 'Copy loss in query',
    'HDR': 'Highly diverged regions',
    'TDM': 'Tandem repeat',
    'INS': 'Insertion in query',
    'DEL': 'Deletion in query'
};

// Définir les couleurs pour chaque type
export const bandeTypeColors = {
    'SYN': '#d3d3d3', // gris clair
    'INV': '#ffa500', // orange
    'INVTR': '#008000', // vert
    'TRANS': '#008000', // vert
    'DUP': '#0000ff', // bleu
};

// Couleurs actuelles
export let currentBandTypeColors = { ...bandeTypeColors };

export const typeColors = {
    // Synténies (gris)
    'SYN': '#d3d3d3',
    'SYNAL': '#d3d3d3',
    'CPL': '#a0a0a0',
    
    // Inversions et combinaisons (nuances d'orange)
    'INV': '#ffa500',
    'INVAL': '#ffa500',
    'INVDP': 'linear-gradient(90deg, #ffa500, #4169e1)', // orange vers bleu
    'INVDPAL': 'linear-gradient(90deg, #ffa500, #4169e1)', 
    'INVTR': 'linear-gradient(90deg, #ffa500, #2e8b57)', // orange vers vert
    'INVTRAL': 'linear-gradient(90deg, #ffa500, #2e8b57)',

    // Translocations (vert)
    'TRANS': '#2e8b57',
    'TRANSAL': '#2e8b57',
    
    // Duplications (bleu)
    'DUP': '#4169e1',
    'DUPAL': '#4169e1',
    
    // HDR (violet)
    'HDR': '#9370db',
    
    // Autres modifications (rouge)
    'INS': '#dc143c',
    'DEL': '#b22222'
};

export function resetDrawGlobals() {
    currentYOffset = 0;
}
export let zoom; // Déclarer zoom ici pour l'utiliser dans d'autres fonctions

export function createGraphSection() {
    // Création du conteneur principal
    const graphSection = document.createElement('div');
    graphSection.setAttribute('id', 'graph-section');
    graphSection.style.cssText = `
        margin-top: 20px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 0 5px rgba(0,0,0,0.1);
    `;
    
    
    // Créer la barre d'en-tête
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
    title.textContent = 'Overview';
    title.style.margin = '0';
    headerBar.appendChild(title);

    // Ajout de l'icône de fermeture
    const chevronIcon = document.createElement('i');
    chevronIcon.className = 'fas fa-chevron-up';
    chevronIcon.style.color = '#666';
    headerBar.appendChild(chevronIcon);

    // Créer le conteneur pour le contenu
    const graphContent = document.createElement('div');
    graphContent.setAttribute('id', 'graph-content');
    graphContent.style.cssText = `
        background-color: #f5f5f5;
        border-radius: 0 0 8px 8px;
        transition: max-height 0.3s ease-out;
        overflow: hidden;
        max-height: 1000px;
        padding: 20px;
        width: 100%;          /* Prend toute la largeur de la fenêtre */
        margin-left: 50%;      /* Décale de 50% vers la droite */
        transform: translateX(-50%); /* Recentre en décalant de -50% */
        position: relative;    /* Nécessaire pour le positionnement */
    `;

    // Créer le conteneur pour la visualisation
    const vizContainer = document.createElement('div');
    vizContainer.setAttribute('id', 'viz-container');
    vizContainer.className = 'svg-container';
    vizContainer.style.cssText = `
        background-color: white;
        width: 100%;
        height: 600px;
        position: relative;
        overflow: hidden;
    `;

    // Créer l'élément SVG dès le début
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('id', 'viz');
    svg.setAttribute('viewBox', '0 0 1000 600'); // Vue initiale
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    
    // Créer le groupe pour le zoom
    const zoomGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    zoomGroup.setAttribute('id', 'zoomGroup');

    zoom = d3.zoom()
        .scaleExtent([0.5, 15]) // Définir les niveaux de zoom minimum et maximum
        .on("zoom", (event) => {
            // console.log("Zoom event triggered");
            // console.log(event.transform);
            d3.select('#zoomGroup').attr("transform", event.transform);
    });
    
    // Assembler les éléments SVG
    svg.appendChild(zoomGroup);
    vizContainer.appendChild(svg);

    // Créer le conteneur pour le spinner
    const spinnerContainer = document.createElement('div');
    spinnerContainer.setAttribute('id', 'spinner');
    spinnerContainer.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    `;

    // Ajouter les conteneurs au contenu
    graphContent.appendChild(vizContainer);
    graphContent.appendChild(spinnerContainer);

    // Event listener pour le pliage/dépliage
    headerBar.addEventListener('click', () => {
        if(graphContent.style.maxHeight === '0px') {
            graphContent.style.maxHeight = graphContent.scrollHeight + 'px';
            chevronIcon.className = 'fas fa-chevron-up';
        } else {
            graphContent.style.maxHeight = '0px';
            chevronIcon.className = 'fas fa-chevron-down';
        }
    });

    // Assemblage final
    graphSection.appendChild(headerBar);
    graphSection.appendChild(graphContent);

    return graphSection;
}

export function drawMiniChromosome(genome, svg, options = {}) {
    const width = 40;
    const height = 10;
    const radius = 2;

    // build path below

    // Ensure svg element has identifying attributes so it can be updated later
    try {
        svg.attr('class', (d, i, nodes) => {
            const existing = svg.attr('class') || '';
            return (existing + ' mini-chrom').trim();
        });
        svg.attr('data-genome', genome);
    } catch (e) {
        try {
            const node = svg.node ? svg.node() : svg;
            if (node && node.setAttribute) {
                node.setAttribute('class', (node.getAttribute('class') || '') + ' mini-chrom');
                node.setAttribute('data-genome', genome);
            }
        } catch (ee) {
            // noop
        }
    }

    // build path for mini chromosome with rounded ends
    let path = 'M' + 5 + ',' + 10;
    path += 'h' + width;
    path += 'a' + radius + ',' + radius + ' 0 0 1 ' + radius + ',' + radius;
    path += 'a' + radius + ',' + radius + ' 0 0 1 ' + -radius + ',' + radius;
    path += 'h' + -width;
    path += 'a' + radius + ',' + radius + ' 0 0 1 ' + -radius + ',' + -radius;
    path += 'a' + radius + ',' + radius + ' 0 0 1 ' + radius + ',' + -radius;
    path += 'Z';

    // Determine color/mode to render the mini chrom based on options or genome settings
    const genomeSetting = (window.genomeDisplaySettings && window.genomeDisplaySettings[genome]) ? window.genomeDisplaySettings[genome] : null;
    const mode = options.mode || (genomeSetting && genomeSetting.mode) || 'filled';
    const color = options.color || (genomeSetting && genomeSetting.color) || genomeColors[genome] || '#000000';
    const gradientId = `gradient-${genome}`;

    // Append path and apply styles according to mode
    try {
        const p = svg.append('path').attr('d', path).attr('class', 'mini-chrom-shape');
        if (mode === 'outline') {
            p.attr('fill', 'none').attr('stroke', color);
        } else if (mode === 'filled') {
            p.attr('fill', color).attr('stroke', color);
        } else if (mode === 'heatmap') {
            if (document.getElementById(gradientId) || document.querySelector(`linearGradient[id="${gradientId}"]`)) {
                p.attr('fill', `url(#${gradientId})`).attr('stroke', color);
            } else {
                p.attr('fill', color).attr('stroke', color);
            }
        } else {
            p.attr('fill', color).attr('stroke', color);
        }
    } catch (e) {
        // fallback if svg is not a d3 selection
        try {
            const node = svg.node ? svg.node() : svg;
            if (!node) return;
            const svgNs = 'http://www.w3.org/2000/svg';
            const pathEl = document.createElementNS(svgNs, 'path');
            pathEl.setAttribute('d', path);
            pathEl.setAttribute('class', 'mini-chrom-shape');
            if (mode === 'outline') {
                pathEl.setAttribute('fill', 'none');
                pathEl.setAttribute('stroke', color);
            } else if (mode === 'filled') {
                pathEl.setAttribute('fill', color);
                pathEl.setAttribute('stroke', color);
            } else if (mode === 'heatmap') {
                if (document.getElementById(gradientId) || document.querySelector(`linearGradient[id="${gradientId}"]`)) {
                    pathEl.setAttribute('fill', `url(#${gradientId})`);
                    pathEl.setAttribute('stroke', color);
                } else {
                    pathEl.setAttribute('fill', color);
                    pathEl.setAttribute('stroke', color);
                }
            } else {
                pathEl.setAttribute('fill', color);
                pathEl.setAttribute('stroke', color);
            }
            node.appendChild(pathEl);
        } catch (ee) {
            // noop
        }
    }
}

export function drawChromosomes(genomeData, maxLengths, refGenome, queryGenome, isFirstFile, scale) {
    console.log("Draw chromosomes"); 
    const svgGroup = d3.select('#zoomGroup');
    const height = 300;
    
    const margin = { top: 30, bottom: 30, left: 200, right: 200 };
    const yRefPosition = currentYOffset + margin.top + (height - margin.top - margin.bottom) / 4;
    const yQueryPosition = currentYOffset + margin.top + 3 * (height - margin.top - margin.bottom) / 4;

    const spaceBetween = 50;
    const totalLength = Object.values(maxLengths).reduce((a, b) => a + b, 0);
    const totalWidth = (totalLength / scale) + spaceBetween * (Object.keys(maxLengths).length) + margin.left + margin.right;

    d3.select('#viz')
        .attr('viewBox', `0 0 ${totalWidth} ${height}`)
        .attr('width', totalWidth);

    const radius = 5;
    let currentX = margin.left;
    const chromPositions = {};

    // Dessiner d'abord tous les chromosomes ref
    if (isFirstFile) {
        for (const chrom in genomeData[refGenome]) {
            // Défenses : si l'entrée est undefined, utiliser length=0 et name='-'
            const refData = genomeData[refGenome][chrom] || { length: 0, name: '-' };
            const refLen = (typeof refData.length === 'number') ? refData.length : 0;
            const refWidth = refLen / scale;
            const chromLen = (maxLengths[chrom] !== undefined) ? maxLengths[chrom] : refLen;
            const chromWidth = chromLen / scale;

            //si premier chromosome, affiche le nom du génome sur le coté gauche
            if(chrom === Object.keys(genomeData[refGenome])[0]) {
                svgGroup.append('text')
                    .attr('x', currentX - 10)
                    .attr('y', yRefPosition + radius * 2)
                    .attr('text-anchor', 'end')
                    .attr('class', 'chrom-title')
                    .attr("data-genome", refGenome)
                    .attr("data-chrom-name", refData.name || '-')
                    .attr("data-chrom-num", chrom)
                    .text(refGenome);
            }

            if (!isNaN(chromWidth) && chromWidth > 0 && refWidth > 0) {
                drawChromPathNoArm(currentX, yRefPosition, refWidth, radius, chrom,
                    (refData.name || '-') + "_ref", refGenome, svgGroup, scale);
                
                // Ajouter le nom du chromosome
                svgGroup.append('text')
                    .attr('x', currentX + chromWidth / 2)
                    .attr('y', yRefPosition - 10)
                    .attr('text-anchor', 'middle')
                    .attr('class', 'chrom-title')
                    .attr("data-genome", refGenome)
                    .attr("data-chrom-name", refData.name || '-')
                    .attr("data-chrom-num", chrom)
                    .text(refData.name);

                chromPositions[chrom] = {
                    refX: currentX,
                    refY: yRefPosition,
                    queryX: currentX,
                    queryY: yQueryPosition
                };

            }
            currentX += chromWidth + spaceBetween;

        }
    }

    // Réinitialiser currentX pour les chromosomes query
    currentX = margin.left;

    // Dessiner tous les chromosomes query
    for (const chrom in genomeData[queryGenome]) {
        const queryData = genomeData[queryGenome][chrom] || { length: 0, name: '-' };
        const queryLen = (typeof queryData.length === 'number') ? queryData.length : 0;
        const queryWidth = queryLen / scale;
        const chromLenForWidth = (maxLengths[chrom] !== undefined) ? maxLengths[chrom] : queryLen;
        const chromWidth = chromLenForWidth / scale || queryWidth;

        //si premier chromosome, affiche le nom du génome sur le coté gauche
        if(chrom === Object.keys(genomeData[queryGenome])[0]) {
            svgGroup.append('text')
                .attr('x', currentX - 10)
                .attr('y', yQueryPosition + radius * 2)
                .attr('text-anchor', 'end')
                .attr('class', 'chrom-title')
                .attr("data-genome", queryGenome)
                .attr("data-chrom-name", queryData.name || '-')
                .attr("data-chrom-num", chrom)
                .text(queryGenome);
        }
        if (!isNaN(chromWidth) && chromWidth > 0 && queryWidth > 0) {
            drawChromPathNoArm(currentX, yQueryPosition, queryWidth, radius, chrom,
                (queryData.name || '-') + "_query", queryGenome, svgGroup, scale);

            if (!chromPositions[chrom]) {
                chromPositions[chrom] = {
                    refX: currentX,
                    refY: yRefPosition,
                    queryX: currentX,
                    queryY: yQueryPosition
                };
            }

        }
        currentX += chromWidth + spaceBetween;

    }

    currentYOffset = yQueryPosition - 90;
    return chromPositions;
}

export function drawStackedChromosomes(genomeData, maxLengths, fileIndex, totalGenomes, scale) {
    console.log("Draw stacked chromosomes"); 
    const svgGroup = d3.select('#zoomGroup');
    const margin = { top: 30, bottom: 30, left: 50, right: 50 };
    const spaceBetween = 100;
    const totalSpaceBetween = totalGenomes * 100;
    const maxLength = Math.max(...Object.values(maxLengths));
    const totalWidth = (maxLength / scale) + margin.left + margin.right;

    const radius = 5;

    let currentX = margin.left;
    let currentY = margin.top + (fileIndex + 1) * spaceBetween;

    const chromPositions = {};

    for (const chrom in maxLengths) {
        const refData = genomeData[refGenome][chrom] || { length: 0, name: '-' };
        const queryData = genomeData[queryGenome][chrom] || { length: 0, name: '-' };
        const refLength = (typeof refData.length === 'number') ? refData.length : 0;
        const queryLength = (typeof queryData.length === 'number') ? queryData.length : 0;
        const refWidth = refLength / scale;
        const queryWidth = queryLength / scale;
        const chromWidth = (maxLengths[chrom] !== undefined ? maxLengths[chrom] : Math.max(refLength, queryLength)) / scale;

        if (!isNaN(chromWidth) && chromWidth > 0) {
            if (fileIndex === 0) {
                // Dessin chromosome référence
                drawChromPathNoArm(currentX, currentY, refWidth, radius, chrom, (refData.name || '-') + "_ref", refGenome, svgGroup, scale);
                // Label du chromosome (nom réel)
                svgGroup.append('text')
                    .attr('x', currentX + chromWidth / 2)
                    .attr('y', currentY - 10)
                    .attr('text-anchor', 'middle')
                    .text(refData.name || '-');
            }
            // Dessin chromosome query
            drawChromPathNoArm(currentX, currentY + spaceBetween, queryWidth, radius, chrom, (queryData.name || '-') + "_query", queryGenome, svgGroup, scale);

            // Stockage des positions avec le numéro du chromosome comme clé
            chromPositions[chrom] = {
                refX: currentX,
                queryX: currentX,
                refY: currentY,
                queryY: currentY + spaceBetween
            };

            currentY += totalSpaceBetween;
        } else {
            console.error(`Invalid chromosome width for ${chrom}: ${chromWidth}`);
        }
    }

    return chromPositions;
}




//dessin d'un chromosome sans bras
function drawChromPathNoArm(x, y, width, radius, chromNum, chromName, genome, svg, scale) {
    // Inclus la taille du radius dans le chromosome
    x = parseInt(x + radius);
    // Longueur des bras sans les radius
    width = parseInt(width - radius - radius);

    // Chemin premier bras
    let path = "M" + x + "," + y; // Déplacer vers
    path += "h" + width; // Ligne horizontale
    path += "a" + radius + "," + radius + " 0 0 1 " + radius + "," + radius; // Arc
    path += "a" + radius + "," + radius + " 0 0 1 " + -radius + "," + radius; // Arc
    path += "h" + -width; // Ligne horizontale
    path += "a" + radius + "," + radius + " 0 0 1 " + -radius + "," + -radius; // Arc
    path += "a" + radius + "," + radius + " 0 0 1 " + radius + "," + -radius; // Arc
    path += "Z";

    //ajoute un tooltip pour le chromosome
    const tip = d3.tip()
        .attr('class', 'd3-tip')
        .offset([-10, 0])
        .html(function (event, d) {
            return `
                <strong>Genome:</strong> <span>${genome}</span><br>
                <strong>Chromosome:</strong> <span>${chromName.split('_ref')[0].split('_query')[0]}</span><br>
            `;
        });

    svg.call(tip);

    const gradientId = `gradient-${genome}-${chromName.split('_ref')[0].split('_query')[0]}`; // Générer un ID de gradient unique

    // Déterminer la couleur selon le mode
    let chromColor;
    if (typeof bandColorMode !== 'undefined' && bandColorMode === 'byChrom') {
        // Utilise l'index du chromosome pour la couleur
        const chromIndex = parseInt(chromNum, 10) - 1;
        chromColor = generateColor(chromIndex >= 0 ? chromIndex : 0);
    } else {
        chromColor = genomeColors[genome];
    }

    // Determine initial fill/stroke according to any overrides (per-chrom or per-genome)
    const chromNameAttr = chromName || '';
    const chromBase = chromNameAttr.split('_ref')[0].split('_query')[0];
    const chromKey = `${genome}|${chromBase}`;

    let initFill = null;
    let initStroke = null;

    const override = (window.chromDisplaySettings && window.chromDisplaySettings[chromKey]) ? window.chromDisplaySettings[chromKey] : null;
    const genomeSetting = (window.genomeDisplaySettings && window.genomeDisplaySettings[genome]) ? window.genomeDisplaySettings[genome] : null;

    if (override) {
        const mode = override.mode || 'filled';
        const color = override.color || (genomeColors && genomeColors[genome]) || chromColor;
        const gId = `gradient-${genome}-${chromBase}`;
        if (mode === 'outline') {
            initFill = 'none';
            initStroke = color;
        } else if (mode === 'filled') {
            initFill = color;
            initStroke = color;
        } else if (mode === 'heatmap') {
            if (document.getElementById(gId) || document.querySelector(`linearGradient[id="${gId}"]`)) {
                initFill = `url(#${gId})`;
            } else {
                initFill = color;
            }
            initStroke = color;
        }
    } else if (genomeSetting) {
        const mode = genomeSetting.mode || 'filled';
        const color = genomeSetting.color || (genomeColors && genomeColors[genome]) || chromColor;
        const gId = `gradient-${genome}-${chromBase}`;
        if (mode === 'outline') {
            initFill = 'none';
            initStroke = color;
        } else if (mode === 'filled') {
            initFill = color;
            initStroke = color;
        } else if (mode === 'heatmap') {
            if (document.getElementById(gId) || document.querySelector(`linearGradient[id="${gId}"]`)) {
                initFill = `url(#${gId})`;
            } else {
                initFill = color;
            }
            initStroke = color;
        }
    } else {
        initStroke = chromColor;
        initFill = `url(#${gradientId})`;
    }

    svg.append("path")
        .attr("d", path)
        .attr("class", "chrom") // Ajoute une classe chrom
        .attr("data-genome", genome)
        .attr("data-chrom-name", chromName)
        .attr("data-chrom-num", chromNum)
        .style("stroke", initStroke)
        .style('fill', initFill)
        .on('click', function(event, d) {
            // Ouvrir le menu contextuel spécifique au chromosome
            console.log('Chromosome path clicked:', { genome, chromName });
            try {
                event.preventDefault();
                if (typeof createChromContextMenu !== 'function') {
                    console.error('createChromContextMenu is not a function (import may be undefined due to circular imports)');
                } else {
                    createChromContextMenu(event.clientX, event.clientY, this);
                }
            } catch (e) {
                console.warn('Failed to open chromosome context menu', e);
            }
        })
        .on('mouseover', function (event, d) {
            tip.show(event, d); // Afficher le tooltip
        })
        .on('mouseout', function (event, d) {
            tip.hide(event, d); // Masquer le tooltip
        });
}


function drawSNPDensityHeatmap(snpDensity, refLengths, chromPositions, binSize = 1000000) {
    const svgGroup = d3.select('#zoomGroup');
    const colorScale = d3.scaleSequential(d3.interpolateOrRd)
        .domain([0, d3.max(Object.values(snpDensity).flat())]);

    for (const chr in snpDensity) {
        const chrDensity = snpDensity[chr];
        const chrLength = refLengths[chr];
        const numBins = chrDensity.length;

        const x = chromPositions[chr].refX;
        const y = chromPositions[chr].refY;
        const width = chrLength / scale; // Same scaling as chromosomes
        const binWidth = width / numBins;
        const height = 10; // Height of the heatmap bar

        // Créer le gradient linéaire
        const gradientId = `grad-${chr}`;
        const gradient = svgGroup.append('defs').append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');

        chrDensity.forEach((density, i) => {
            gradient.append('stop')
                .attr('offset', `${(i + 1) * (100 / numBins)}%`)
                .attr('stop-color', colorScale(density));
        });

        // // Appliquer le gradient au chromosome
        // svgGroup.append('rect')
        //     .attr('x', x)
        //     .attr('y', y) // Position au-dessus du chromosome
        //     .attr('width', width)
        //     .attr('height', height)
        //     .attr('fill', `url(#${gradientId})`);
        
        //attribut le gradient au chromosome
        const monChromColor = d3.selectAll("#" + chr + "_ref.chrom");
        // Déterminer la couleur selon le mode
        let chromColor;
        if (typeof bandColorMode !== 'undefined' && bandColorMode === 'byChrom') {
            const chromIndex = parseInt(chr, 10) - 1;
            chromColor = generateColor(chromIndex >= 0 ? chromIndex : 0);
        } else {
            chromColor = genomeColors[refGenome];
        }
        monChromColor.style('stroke', chromColor);
        monChromColor.style('fill', `url(#${gradientId})`);
    }
}

export function drawCorrespondenceBands(data, chromPositions, isFirstFile, scale, mergeThreshold = 500000) {
    console.log("Draw correspondence bands");
    // console.log(mergeThreshold);
    const svgGroup = d3.select('#zoomGroup');

    // Types à merger
    const mergeTypes = ['INVTR', 'TRANS'];
    // Types à dessiner normalement
    const normalTypes = ['SYN', 'INV', 'DUP'];

    // Sépare les bandes à merger et les autres
    const bandsToMerge = data.filter(d => mergeTypes.includes(d.type));
    const bandsNormal = data.filter(d => normalTypes.includes(d.type));

   // Fusionne les bandes à merger en tenant compte des autres bandes
    const mergedBands = mergeBands(bandsToMerge, bandsNormal, mergeThreshold);

    // Concatène tout pour le dessin
    const allBands = bandsNormal.concat(mergedBands);    

    allBands.forEach(d => {
        drawOneBand(svgGroup, d, chromPositions, refGenome, queryGenome);
    });
}

function mergeBands(bandsToMerge, otherBands, threshold) {
    if (!bandsToMerge || bandsToMerge.length === 0 || threshold <= 0) return bandsToMerge;

    const merged = [];
    let current = null;

    for (const band of bandsToMerge) {
        if (!current) {
            current = { ...band };
            continue;
        }

        // Vérifie s'il y a des bandes d'autres types entre current et band
        const hasOtherBandsBetween = otherBands.some(other => 
            other.refChr === current.refChr &&
            other.queryChr === current.queryChr &&
            (other.refStart > current.refEnd &&
            other.refStart < band.refStart) ||
            (other.queryStart > current.queryEnd &&
            other.queryStart < band.queryStart)
        );

        const distRef = band.refStart - current.refEnd;
        const distQuery = current.queryStart - band.queryEnd;

        if (
            !hasOtherBandsBetween &&
            band.refChr === current.refChr &&
            band.queryChr === current.queryChr &&
            band.type === current.type &&
            distRef <= threshold &&
            distQuery <= threshold
        ) {
            // On fusionne en étendant current
            current.refStart = Math.min(current.refStart, current.refEnd, band.refStart, band.refEnd);
            current.refEnd = Math.max(current.refStart, current.refEnd, band.refStart, band.refEnd);
            current.queryStart = Math.min(current.queryStart, current.queryEnd, band.queryStart, band.queryEnd);
            current.queryEnd = Math.max(current.queryStart, current.queryEnd, band.queryStart, band.queryEnd);
        } else {
            // On ne peut pas fusionner : on sauvegarde current et on passe à band
            merged.push(current);
            current = { ...band };
        }
    }

    if (current) {
        merged.push(current);
    }

    // console.log(`Merged ${bandsToMerge.length} INVTR bands into ${merged.length} bands`);
    return merged;
}

function drawOneBand(svgGroup, d, chromPositions, refGenome, queryGenome) {
    // Ajouter un écouteur de clic sur le svg pour déselectionner
    d3.select('#viz').on('click', function(event) {
        if (event.target.tagName === 'svg') {
            selectedBands.clear();
            updateBandSelection();
        }
    });

    let display = 'null';
    //Si c'est un redraw alors on vérifie les filtres de bandes
    if(!isFirstDraw){
        if (!isBandVisible(d)) {
            console.log(`Band of type ${d.type} between ${d.refChr} and ${d.queryChr} is hidden by filter.`);
            display = 'none';
        }
    }
    
    let refChromNum = Object.values(genomeData[refGenome]).findIndex(item => item && item.name === d.refChr) + 1;
    let queryChromNum = Object.values(genomeData[queryGenome]).findIndex(item => item && item.name === d.queryChr) + 1;
    const refX = chromPositions[[refChromNum]]?.refX;
    const queryX = chromPositions[[queryChromNum]]?.queryX;

    let color;
    if (typeof bandColorMode !== 'undefined' && bandColorMode === 'byChrom') {
        // Utilise le numéro de chromosome de référence (refChromNum) pour choisir la couleur
        // refChromNum est 1-based ; generateColor attend un index, on met refChromNum-1
        // Si refChromNum est invalide, on retombe sur la couleur par type
        if (Number.isFinite(refChromNum) && refChromNum > 0) {
            color = generateColor(refChromNum - 1);
        } else {
            color = currentBandTypeColors[d.type] || '#ccc';
        }
    } else {
        // Mode par type (par défaut)
        color = currentBandTypeColors[d.type] || '#ccc';
    }
    // Tooltip
    const tip = d3.tip()
        .attr('class', 'd3-tip')
        .offset([-10, 0])
        .html(function (event, d) {
            return `
                <div style="min-width:220px; font-size:15px;">
                    <div style="margin-bottom:6px;">
                        <span style="font-weight:bold;">Ref</span> : 
                        <span>${d.refChr}</span> 
                        <span>[${d.refStart}..${d.refEnd}]</span>
                    </div>
                    <div style="margin-bottom:6px;">
                        <span style="font-weight:bold;">Query</span> : 
                        <span>${d.queryChr}</span> 
                        <span>[${d.queryStart}..${d.queryEnd}]</span>
                    </div>
                    <div>
                        <span style="font-weight:bold;">Type :</span> 
                        <span style="background:${color}; border-radius:6px; padding:2px 8px; margin-left:4px;">${d.type}</span>
                    </div>
                </div>
            `;
    });

    svgGroup.call(tip);

    if (refX !== undefined && queryX !== undefined) {

        const refStartX = refX + (d.refStart / scale);
        const refEndX = refX + (d.refEnd / scale);
        let queryStartX = queryX + (d.queryStart / scale);
        let queryEndX = queryX + (d.queryEnd / scale);
        // const color = currentBandTypeColors[d.type] || '#ccc'; // Utiliser la couleur définie ou gris clair par défaut

        const refY = chromPositions[[refChromNum]]?.refY + 10; // Ajuster pour aligner sur le chromosome de référence
        // const queryY = chromPositions[d.queryChr]?.queryY; // Ajuster pour aligner sur le chromosome de requête
        const queryY = chromPositions[[queryChromNum]]?.queryY; // Ajuster pour aligner sur le chromosome de requête

        // Inverser les positions queryStart et queryEnd pour les types d'inversion
        if (d.type === 'INV' || d.type === 'INVDPAL' || d.type === 'INVTR' || d.type === 'INVTRAL') {
            [queryStartX, queryEndX] = [queryEndX, queryStartX];
        }

        // Calculer la longueur de la bande
        const bandLength = d.refEnd - d.refStart;

        // Déterminer le type de bande (inter ou intra)
        // const bandPos = d.refChr === d.queryChr ? 'intra' : 'inter';
        const bandPos = refChromNum === queryChromNum ? 'intra' : 'inter';

        // Dessiner une bande courbée pour la correspondance
        const pathData = `
            M${refStartX},${refY}
            C${refStartX},${(refY + queryY) / 2} ${queryStartX},${(refY + queryY) / 2} ${queryStartX},${queryY}
            L${queryEndX},${queryY}
            C${queryEndX},${(refY + queryY) / 2} ${refEndX},${(refY + queryY) / 2} ${refEndX},${refY}
            Z
        `;

        svgGroup.append('path')
            .datum(d) // Associer les données à l'élément
            .attr('d', pathData)
            .attr('fill', color)
            .attr('opacity', 0.5)
            .attr('display', display) //gère le filtre isVisible
            .attr('class', 'band')
            .attr('data-length', bandLength) // Ajouter l'attribut de longueur
            .attr('data-pos', bandPos) // Ajouter l'attribut de position inter ou intra
            .attr('data-type', d.type) // Ajouter l'attribut de type de bande
            .attr('data-ref-genome', refGenome) // Ajouter l'attribut de génome
            .attr('data-ref', d.refChr) //ajoute l'attribut ref
            .attr('data-ref-num', refChromNum) // ajoute l'attribut ref-num
            .attr('data-query-num', queryChromNum) // ajoute l'attribut query
            .attr('data-query', d.queryChr) // ajoute l'attribut query
            .attr('data-query-genome', queryGenome) // ajoute l'attribut query-genome
            .attr('data-ref-start', d.refStart)
            .attr('data-ref-end', d.refEnd)
            .attr('data-query-start', d.queryStart)
            .attr('data-query-end', d.queryEnd)
            .on('mouseover', function (event, d) {
                d3.select(this).attr('opacity', 1); // Mettre en gras au survol
                tip.show(event, d); // Afficher le tooltip
            })
            .on('mouseout', function (event, d) {
                d3.select(this).attr('opacity', 0.5); // Réinitialiser après le survol
                tip.hide(event, d); // Masquer le tooltip
            })
            .on('click', async function (event, d) {
                if (event.ctrlKey || event.metaKey) {
                    // Multi-sélection avec Ctrl/Cmd
                    if (selectedBands.has(this)) {
                        selectedBands.delete(this);
                    } else {
                        selectedBands.add(this);
                    }
                    updateBandSelection();
                    if (selectedBands.size > 0) {
                        updateInfoForSelectedBands();
                    }
                } else {
                    // Clic normal : menu contextuel
                    event.preventDefault();
                    createContextMenu(event.clientX, event.clientY, this);
                    
                    // Sélection simple
                    selectedBands.clear();
                    selectedBands.add(this);
                    updateBandSelection();


                    // Cherche le bon jeu de données dans allParsedData
                    const parsedSet = allParsedData.find(set =>
                        set.refGenome === refGenome && set.queryGenome === queryGenome
                    );
                    if (!parsedSet) {
                        d3.select('#info').html('<p>No data found for this band.</p>');
                        return;
                    }
                    //affiche la section info
                    showInfoPanel();
                    showInfoUpdatedMessage()
                    const linesInRange = getLinesInRange(parsedSet.data, d.refChr, d.queryChr, d.refStart, d.refEnd, d.queryStart, d.queryEnd);
                    
                    // const tableHtml = await convertLinesToTableHtml(linesInRange, d.refStart, d.refEnd, d.queryStart, d.queryEnd, refGenome, queryGenome);               
                    // d3.select('#info').html(`${tableHtml}`);
                    
                    const summary = createSummarySection(linesInRange, d.refStart, d.refEnd, d.queryStart, d.queryEnd, refGenome, queryGenome);
                    d3.select('#summary').html(`<div class="summary-section"><h4>Summary</h4>${summary}</div>`);

                    const tableBadges = createTableBadges(linesInRange);
                    
                    const table = createDetailedTable(linesInRange, refGenome, queryGenome);
                    d3.select('#info').html(`${tableBadges}${table}`);

                    // Initialiser le filtrage après l'insertion dans le DOM
                    setTimeout(() => {
                        initializeTableFiltering();
                    }, 0);


                    // Récupérer les données d'anchors
                    const anchorsResult = await createAnchorsSection(linesInRange, d.refStart, d.refEnd, d.queryStart, d.queryEnd, refGenome, queryGenome);
                    // Afficher le HTML des anchors
                    const anchorsHtml = anchorsResult.html; 
                    d3.select('#orthology-table').html(`<br>${anchorsHtml}`);
                    // Utiliser les données pour créer la vue zoomée
                    const orthologPairs = anchorsResult.data;
                    createZoomedSyntenyView(orthologPairs, refGenome, queryGenome, d.refStart, d.refEnd, d.queryStart, d.queryEnd);
                    
                    //// Remove existing download button if it exists
                    const zoomedSynteny = document.getElementById('zoomed-synteny');

                    const existingDownloadButton = document.getElementById('download-anchor-svg');
                    if (existingDownloadButton) {
                        formContainer.removeChild(existingDownloadButton);
                    }

                    //download button for synteny svg
                    const buttonDiv = document.createElement('div');
                    const downloadAnchorSvgButton = document.createElement('button');
                    downloadAnchorSvgButton.id = 'download-anchor-svg';
                    downloadAnchorSvgButton.setAttribute('type', 'button');
                    downloadAnchorSvgButton.classList.add('btn-simple');
                    downloadAnchorSvgButton.textContent = 'Download SVG';
                    buttonDiv.appendChild(downloadAnchorSvgButton);
                    //append entre zoomedSynteny et orthology-table
                    zoomedSynteny.parentNode.insertBefore(buttonDiv, document.getElementById('orthology-table'));

                    const svgElement = document.getElementById('anchor-viz');
                    downloadAnchorSvgButton.addEventListener('click', function(event) {
                        event.preventDefault();
                        downloadSvg(svgElement);
                    });

                }
            });
        ;
    }else {
        console.error(`Invalid chromosome position for ref: ${d.refChr} or query: ${d.queryChr}`);
    }
}


export function getLinesInRange(parsedData, refChr, queryChr, refStart, refEnd, queryStart, queryEnd) {
    // console.log("getLinesInRange", refChr, queryChr, refStart, refEnd, queryStart, queryEnd);
    return parsedData.filter(d => d.refChr === refChr && d.queryChr === queryChr && d.refStart >= refStart && d.refEnd <= refEnd && d.queryStart >= queryStart && d.queryEnd <= queryEnd);
}


export async function createAnchorsSection(lines, refStart, refEnd, queryStart, queryEnd, refGenome, queryGenome) {
    const refChr = lines[0].refChr;
    const queryChr = lines[0].queryChr;

    try {
        // Récupère les data du fichier anchors correspondant aux coordonnées choisies
        const anchorFileName = refGenome + '_' + queryGenome + '.anchors';
        // Cherche le fichier dans anchorsFiles
        const anchorFile = anchorsFiles.find(file => file.name === anchorFileName);
        
        if (!anchorFile) {
            console.warn(`Anchors file ${anchorFileName} not found`);
            return { html: '<div class="anchors-refquery">Anchors file not found</div>', data: [] };
        }

        // Récupère les fichiers BED pour ref et query
        const refBedFile = bedFiles.find(file => file.name === refGenome + '.bed');
        const queryBedFile = bedFiles.find(file => file.name === queryGenome + '.bed');

        if (!refBedFile || !queryBedFile) {
            console.warn('Missing BED file');
            return { html: '<div class="anchors-refquery">Missing BED file</div>', data: [] };
        }

        // Récupère le contenu des fichiers
        const [anchorText, refBedText, queryBedText] = await Promise.all([
            anchorFile.text(),
            refBedFile.text(),
            queryBedFile.text()
        ]);

        // Parse les lignes des fichiers BED
        const refBedLines = refBedText.split('\n').filter(line => line.trim());
        const queryBedLines = queryBedText.split('\n').filter(line => line.trim());
        const anchorLines = anchorText.split('\n').filter(line => line.trim());

        // Filtre les gènes du BED ref dans la région d'intérêt
        const refGenesInRegion = refBedLines.filter(line => {
            const [chr, start, end] = line.split('\t');
            const geneStart = parseInt(start);
            const geneEnd = parseInt(end);
            
            // Vérifie si le gène est dans la région spécifiée
            return chr === refChr && 
                geneStart >= refStart && 
                geneEnd <= refEnd;
        });

        // Pour chaque gène du bed ref, cherche son orthologue dans le fichier anchors
        const orthologPairs = [];
        refGenesInRegion.forEach(refBedLine => {
            const [refChr, refStart, refEnd, refGeneName, refScore, refStrand] = refBedLine.split('\t');
            
            // Filtre les anchors pour ce gène
            const foundAnchors = anchorLines.filter(line => 
                line.split('\t')[0] === refGeneName
            );

            foundAnchors.forEach(anchorLine => {
                const [refAnchor, queryAnchor, score, score2] = anchorLine.split('\t');
                // Trouve les coordonnées du gène query correspondant
                const queryBedLine = queryBedLines.find(line => {
                    const bedQueryGeneName = line.split('\t')[3];
                    const cleanQueryAnchor = queryAnchor.trim().replace(/[\r\n]+/g, '');
                    return bedQueryGeneName === cleanQueryAnchor || bedQueryGeneName === queryAnchor;
                });
                
                if (queryBedLine) {
                    const [queryChr, queryStart, queryEnd, queryName, queryScore, queryStrand] = queryBedLine.split('\t');
                    orthologPairs.push({
                        ref: {
                            name: refGeneName,
                            chr: refChr,
                            start: parseInt(refStart),
                            end: parseInt(refEnd),
                            strand: refStrand || '+'
                        },
                        query: {
                            name: queryName,
                            chr: queryChr,
                            start: parseInt(queryStart),
                            end: parseInt(queryEnd),
                            strand: queryStrand || '+'
                        },
                        score: parseFloat(score) || 0,
                        anchorRef: refAnchor,
                        anchorQuery: queryAnchor
                    });
                }
            });
        });

        console.log('Paires orthologues trouvées:', orthologPairs);

        const orthologsHtml = createOrthologsTable(orthologPairs, refGenome, queryGenome );


        const anchorsHtml = `
            <div class="anchors-refquery">
                <h4 style="margin-bottom:10px;">Orthologs found: (${orthologPairs.length})</h4>
                ${orthologsHtml || '<div style="padding:10px; text-align:center; color:#666;">No orthologs found in this region</div>'}
            </div>
        `;

        // Retourner à la fois le HTML et les données
        return {
            html: anchorsHtml,
            data: orthologPairs
        };

    } catch (error) {
        console.error('Erreur dans createAnchorsSection:', error);
        return { 
            html: '<div class="anchors-refquery">Error while loading data</div>',
            data: []
        };
    }
}

function isBandVisible(d) {
    // Types visibles - vérifier si les éléments existent
    let selectedTypes = ['SYN', 'INV', 'TRANS', 'DUP', 'INVTR']; // Types par défaut
    const typeIcons = document.querySelectorAll('i[data-type]');
    if (typeIcons.length > 0) {
        selectedTypes = Array.from(typeIcons)
            .filter(icon => !icon.classList.contains('fa-eye-slash'))
            .map(icon => icon.getAttribute('data-type'));
    }

    // Dépendances de types
    const typeDependencies = {
        'INVTR': ['INV', 'TRANS'],
        'SYN': ['SYN'],
        'INV': ['INV'],
        'TRANS': ['TRANS'],
        'DUP': ['DUP']
    };

    // Chromosomes visibles - vérifier si les éléments existent
    let visibleChromosomes = [];
    const chromEyeIcons = document.querySelectorAll('i.chrom-eye-icon');
    if (chromEyeIcons.length > 0) {
        visibleChromosomes = Array.from(chromEyeIcons)
            .filter(icon => icon.classList.contains('fa-eye'))
            .map(icon => icon.getAttribute('data-chrom'));
    } else {
        // Si pas d'icônes, considérer tous les chromosomes comme visibles
        visibleChromosomes = Object.keys(genomeData[refGenome]).map(String);
    }

    // Inter/intra - vérifier si les éléments existent
    const intraFilter = document.getElementById('intrachromosomal-filter');
    const interFilter = document.getElementById('interchromosomal-filter');
    const showIntra = !intraFilter || !intraFilter.classList.contains('fa-eye-slash');
    const showInter = !interFilter || !interFilter.classList.contains('fa-eye-slash');

    // Slider - utiliser des valeurs par défaut si non définies
    const bandLength = d.refEnd - d.refStart;
    const min = window.sliderMinValue ?? 0;
    const max = window.sliderMaxValue ?? Infinity;

    // Numéros de chromosomes
    const refChromNum = Object.values(genomeData[refGenome]).findIndex(item => item && item.name === d.refChr) + 1;
    const queryChromNum = Object.values(genomeData[queryGenome]).findIndex(item => item && item.name === d.queryChr) + 1;

    // Vérifications
    const isVisibleChrom = chromEyeIcons.length === 0 || 
        (visibleChromosomes.includes(String(refChromNum)) && visibleChromosomes.includes(String(queryChromNum)));
    const isVisibleBandType = selectedTypes.some(type => type === d.type) ||
        (typeDependencies[d.type] && typeDependencies[d.type].every(parentType => selectedTypes.includes(parentType)));
    const bandPos = refChromNum === queryChromNum ? 'intra' : 'inter';
    const isVisibleBandPos = (bandPos === 'intra' && showIntra) || (bandPos === 'inter' && showInter);
    const isVisibleBandLength = bandLength >= min && bandLength <= max;

    return isVisibleChrom && isVisibleBandType && isVisibleBandPos && isVisibleBandLength;
}

export function updateBandColors() {
    // Recolor all existing bands according to current bandColorMode
    // Recolorer les bandes
    d3.selectAll('path.band').each(function() {
        const bandEl = d3.select(this);
        const type = bandEl.attr('data-type');
        const refNum = parseInt(bandEl.attr('data-ref-num'), 10);
        const refGenomeAttr = bandEl.attr('data-ref-genome') || refGenome;
        const refChrAttr = bandEl.attr('data-ref') || '';
        const chromKey = `${refGenomeAttr}|${refChrAttr}`;

        // Prefer per-chrom override if present
        // Only respect per-chrom overrides for band coloring when bandColorMode === 'byChrom'
        let chromOverride = null;
        if (typeof bandColorMode !== 'undefined' && bandColorMode === 'byChrom') {
            chromOverride = (window.chromDisplaySettings && window.chromDisplaySettings[chromKey] && window.chromDisplaySettings[chromKey].color) ? window.chromDisplaySettings[chromKey].color : null;
        }

        let newColor = null;
        if (chromOverride) {
            newColor = chromOverride;
        } else if (typeof bandColorMode !== 'undefined' && bandColorMode === 'byChrom') {
            if (!isNaN(refNum) && refNum > 0) {
                newColor = generateColor(refNum - 1);
            } else {
                newColor = currentBandTypeColors[type] || '#ccc';
            }
        } else {
            // default: color by type
            newColor = currentBandTypeColors[type] || '#ccc';
        }

        // Apply the color
        try { bandEl.attr('fill', newColor); } catch (e) { console.warn('Failed to set band color', e); }
    });

    // Recolorer les chromosomes
    d3.selectAll('path.chrom').each(function() {
        const chromEl = d3.select(this);
        const chromNum = chromEl.attr('data-chrom-num');
        const genome = chromEl.attr('data-genome');
        // Determine base color and mode, but allow per-chrom overrides (window.chromDisplaySettings)
        const chromNameAttr = chromEl.attr('data-chrom-name') || '';
        const chromBase = chromNameAttr.split('_ref')[0].split('_query')[0];
        const chromKey = `${genome}|${chromBase}`;

        let override = (window.chromDisplaySettings && window.chromDisplaySettings[chromKey]) ? window.chromDisplaySettings[chromKey] : null;
        let genomeSetting = (window.genomeDisplaySettings && window.genomeDisplaySettings[genome]) ? window.genomeDisplaySettings[genome] : null;

        if (override) {
            const mode = override.mode || 'filled';
            const color = override.color || (genomeColors && genomeColors[genome]) || '#000000';
            const gradientId = `gradient-${genome}-${chromBase}`;
            if (mode === 'outline') {
                chromEl.style('fill', 'none');
                chromEl.style('stroke', color);
            } else if (mode === 'filled') {
                chromEl.style('fill', color);
                chromEl.style('stroke', color);
            } else if (mode === 'heatmap') {
                if (document.getElementById(gradientId) || document.querySelector(`linearGradient[id="${gradientId}"]`)) {
                    chromEl.style('fill', `url(#${gradientId})`);
                } else {
                    chromEl.style('fill', color);
                }
                chromEl.style('stroke', color);
            }
        } else if (genomeSetting) {
            // Apply genome level settings
            const mode = genomeSetting.mode || 'filled';
            const color = genomeSetting.color || (genomeColors && genomeColors[genome]) || '#000000';
            const gradientId = `gradient-${genome}-${chromBase}`;
            if (mode === 'outline') {
                chromEl.style('fill', 'none');
                chromEl.style('stroke', color);
            } else if (mode === 'filled') {
                chromEl.style('fill', color);
                chromEl.style('stroke', color);
            } else if (mode === 'heatmap') {
                if (document.getElementById(gradientId) || document.querySelector(`linearGradient[id="${gradientId}"]`)) {
                    chromEl.style('fill', `url(#${gradientId})`);
                } else {
                    chromEl.style('fill', color);
                }
                chromEl.style('stroke', color);
            }
        } else {
            let chromColor;
            if (typeof bandColorMode !== 'undefined' && bandColorMode === 'byChrom') {
                const chromIndex = parseInt(chromNum, 10) - 1;
                chromColor = generateColor(chromIndex >= 0 ? chromIndex : 0);
            } else {
                chromColor = genomeColors[genome];
            }
            chromEl.style('stroke', chromColor);
        }
    });

    // Recolorer les gradients SNP
    d3.selectAll('linearGradient').each(function() {
        const gradEl = d3.select(this);
        const gradId = gradEl.attr('id');
        // On suppose que l'id contient le numéro du chromosome
        const match = gradId && gradId.match(/grad-(\d+)/);
        if (match) {
            const chromIndex = parseInt(match[1], 10) - 1;
            let chromColor;
            if (typeof bandColorMode !== 'undefined' && bandColorMode === 'byChrom') {
                chromColor = generateColor(chromIndex >= 0 ? chromIndex : 0);
            } else {
                chromColor = genomeColors[refGenome];
            }
            // On pourrait ici modifier les stops du gradient si besoin
            gradEl.selectAll('stop').attr('stop-color', chromColor);
        }
        //applique le gradient aux chromosomes
        const monChromColor = d3.selectAll("#" + match[1] + "_ref.chrom");
        monChromColor.style('stroke', chromColor);
        monChromColor.style('fill', `url(#${gradId})`);
    });

    // Recolorer les cases du chromcontroler
    const chromItems = document.querySelectorAll('#chrom-controler .chrom-item');
    chromItems.forEach((item, idx) => {
        let color;
        if (typeof bandColorMode !== 'undefined' && bandColorMode === 'byChrom') {
            color = generateColor(idx);
        } else {
            color = genomeColors[refGenome];
        }
        item.style.backgroundColor = color;
    });
}












