import { typeColors, typeDefs } from "./draw.js";
import { genomeColors } from "./process.js";
import { jbrowseLinks } from "./form.js";

export function createInfoPanel() {
    const container = document.createElement('div');
    container.setAttribute('id', 'info-panel');
	container.style.cssText = `
		margin-top: 20px;
	`

    // Header
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

    const title = document.createElement('h4');
    title.textContent = 'Info';
    title.style.margin = '0';
    headerBar.appendChild(title);

    const chevronIcon = document.createElement('i');
    chevronIcon.className = 'fas fa-chevron-up';
    chevronIcon.style.color = '#666';
    headerBar.appendChild(chevronIcon);

    // Contenu déroulant
    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = `
        background-color: white;
        overflow: hidden;
        max-height: 1000px;
        transition: max-height 0.3s ease-out;
    `;

    headerBar.addEventListener('click', (event) => {
        event.preventDefault();
        const isCollapsed = contentWrapper.style.maxHeight === '0px';
        contentWrapper.style.maxHeight = isCollapsed ? '1000px' : '0px';
        chevronIcon.className = isCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    });

    // Conteneur principal
    const panelContainer = document.createElement('div');
    panelContainer.style.cssText = `
        padding: 20px;
        background-color: #f5f5f5;
        border-radius: 0 0 8px 8px;
    `;

    // Barre d'onglets horizontale
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
		background-color: white;
		border-radius: 5px;
		box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 5px;
    `;
	// style="padding: 15px; background-color: white; border-radius: 5px; box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 5px;"

    const menuItems = [
        { id: 'details', icon: 'fas fa-info-circle', text: 'Block details' },
        { id: 'anchors', icon: 'fas fa-project-diagram', text: 'Synteny' }
    ];

    const tabs = {};

    menuItems.forEach(item => {
        const tab = document.createElement('div');
        tab.setAttribute('data-option', item.id);
        tab.style.cssText = `
            padding: 10px 15px;
            cursor: pointer;
            border-radius: 5px;
            background-color: transparent;
            color: #000;
            transition: all 0.3s ease;
            font-weight: 500;
        `;
        tab.innerHTML = `<i class="${item.icon}"></i> ${item.text}`;

        tab.addEventListener('click', () => {
            // Reset tabs
            Object.values(tabs).forEach(t => {
                t.style.backgroundColor = 'transparent';
                t.style.color = '#000';
            });
            // Activate current tab
            tab.style.backgroundColor = 'black';
            tab.style.color = 'white';
            // Display content
            showInfoSection(item.id);
        });

        tabs[item.id] = tab;
        tabBar.appendChild(tab);
    });

    // Zone de contenu principale
    const contentBox = document.createElement('div');
    contentBox.style.cssText = `
        background-color: white;
        border-radius: 5px;
        padding: 15px;
        box-shadow: 0 0 5px rgba(0,0,0,0.1);
        overflow: hidden;
    `;

    const anchorsDiv = document.createElement('div');
    anchorsDiv.setAttribute('id', 'anchors');
    anchorsDiv.style.display = 'none';

    const anchorsDrawDiv = document.createElement('div');
    anchorsDrawDiv.setAttribute('id', 'zoomed-synteny');
    anchorsDiv.appendChild(anchorsDrawDiv);

    const anchorsTableDiv = document.createElement('div');
    anchorsTableDiv.setAttribute('id', 'orthology-table');
    anchorsDiv.appendChild(anchorsTableDiv);

    const infoDiv = document.createElement('div');
    infoDiv.setAttribute('id', 'info');
    infoDiv.style.display = 'none';

    const summaryDiv  = document.createElement('div');
    summaryDiv.setAttribute('id', 'summary')

    contentBox.appendChild(summaryDiv);
    contentBox.appendChild(anchorsDiv);
    contentBox.appendChild(infoDiv);

    // Switch content
    function showInfoSection(option) {
        anchorsDiv.style.display = 'none';
        infoDiv.style.display = 'none';
        if (option === 'anchors') anchorsDiv.style.display = 'block';
        else if (option === 'details') infoDiv.style.display = 'block';
    }

    // Assemblage final
    panelContainer.appendChild(tabBar);
    panelContainer.appendChild(contentBox);
    contentWrapper.appendChild(panelContainer);
    container.appendChild(headerBar);
    container.appendChild(contentWrapper);

    // Onglet par défaut
    tabs['details'].style.backgroundColor = 'black';
    tabs['details'].style.color = 'white';
    showInfoSection('details');

    return container;
}



// Ajouter une nouvelle fonction pour rendre visible le panel
export function showInfoPanel() {
    const panelContent = document.getElementById('info-panel-content');
    if (panelContent) {
        panelContent.style.maxHeight = '2000px';
        // Mettre à jour l'icône du bouton
        const hideButton = document.querySelector('#info-panel button');
        if (hideButton) {
            hideButton.innerHTML = '<i class="fas fa-chevron-up"></i>';
        }
    }
}

//function qui fait apparaitre un message sur le coté pour dire que la section info a été mise à jour
export function showInfoUpdatedMessage(message = "Info section updated") {
    // Vérifie si un message existe déjà
    let existingMsg = document.getElementById('info-update-toast');
    if (existingMsg) {
        existingMsg.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'info-update-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 70%;
        right: 30px;
        background: black;
		border-right: 4px solid #ffa500;
        color: #fff;
        padding: 12px 24px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        font-size: 1rem;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
    `;
    document.body.appendChild(toast);

    // Animation d'apparition
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);

    // Disparition après 2 secondes
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2000);
}


export function createDetailedTable(lines, refGenome, queryGenome) {
    const headers = [
        { key: 'refChr', label: 'Ref chr' },
        { key: 'refStart', label: 'Ref start' },
        { key: 'refEnd', label: 'Ref end' },
        { key: 'refJBrowse', label: '' },   
        { key: 'queryChr', label: 'Query chr' },
        { key: 'queryStart', label: 'Query start' },
        { key: 'queryEnd', label: 'Query end' },
        { key: 'queryJBrowse', label: '' } ,
        { key: 'type', label: 'Type' }
        
    ];

    const headerHtml = headers
        .map(header => `<th>${header.label}</th>`)
        .join('');

    const rowsHtml = lines.map(line => {
        const background = typeColors[line.type] || '#ccc';
        const hasGradient = background.includes('gradient');
        
        let style;
        if (hasGradient) {
            // Extraire les deux couleurs du gradient
            const colors = background.match(/#[0-9a-f]{6}/g);
            const color1 = hexToRgba(colors[0], 0.3);
            const color2 = hexToRgba(colors[1], 0.3);
            style = `background: linear-gradient(90deg, ${color1}, ${color2})`;
        } else {
            style = `background-color: ${background}30`;
        }
            
        // Construction des liens JBrowse
        let refLink = '', queryLink = '';
        if (typeof jbrowseLinks !== "undefined") {
            // console.log(jbrowseLinks, refGenome, queryGenome);
            // Génère l'URL avec la position pour la ref
            const refBase = jbrowseLinks[refGenome];
            if (refBase) {
                const refLoc = `${line.refChr}:${line.refStart}..${line.refEnd}`;
                const refUrl = refBase.includes('?') 
                    ? `${refBase}&loc=${refLoc}` 
                    : `${refBase}?loc=${refLoc}`;
                refLink = `<a href="${refUrl}" target="_blank" title="Go to JBrowse">
                    <i class="fas fa-external-link-alt"></i>
                </a>`;
            }
            // Génère l'URL avec la position pour la query
            const queryBase = jbrowseLinks[queryGenome];
            if (queryBase) {
                const queryLoc = `${line.queryChr}:${line.queryStart}..${line.queryEnd}`;
                const queryUrl = queryBase.includes('?') 
                    ? `${queryBase}&loc=${queryLoc}` 
                    : `${queryBase}?loc=${queryLoc}`;
                queryLink = `<a href="${queryUrl}" target="_blank" title="Go to JBrowse">
                    <i class="fas fa-external-link-alt"></i>
                </a>`;
            }
        }

        const rowHtml = [
            `<td class="table-cell">${line.refChr}</td>`,
            `<td class="table-cell">${line.refStart}</td>`,
            `<td class="table-cell">${line.refEnd}</td>`,
            `<td class="table-cell">${refLink}</td>`,
            `<td class="table-cell">${line.queryChr}</td>`,
            `<td class="table-cell">${line.queryStart}</td>`,
            `<td class="table-cell">${line.queryEnd}</td>`,
            `<td class="table-cell">${queryLink}</td>`,
            `<td class="table-cell">${line.type}</td>`

        ].join('');
            
        return `
            <tr style="${style}">
                ${rowHtml}
            </tr>
        `;
    }).join('');

    return `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead class="thead-light">
                    <tr>${headerHtml}</tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function initializeTableFiltering() {
    const badges = document.querySelectorAll('.type-badge');
    const tableRows = document.querySelectorAll('tbody tr');
    
    badges.forEach(badge => {
        badge.addEventListener('click', () => {
            // Basculer l'état actif du badge
            const isActive = badge.dataset.active === 'true';
            badge.dataset.active = !isActive;
            
            // Récupérer tous les types actifs
            const activeTypes = [...badges]
                .filter(b => b.dataset.active === 'true')
                .map(b => b.dataset.type);
            
            // Filtrer les lignes du tableau
            tableRows.forEach(row => {
                const rowType = row.querySelector('td:last-child').textContent;
                row.style.display = activeTypes.includes(rowType) ? '' : 'none';
            });
        });
    });
}

export function createSummarySection(lines, refStart, refEnd, queryStart, queryEnd, refGenome, queryGenome) {
    if (!lines || lines.length === 0) return '';

    // Affichage ref/query sans tirets
    const refLabel = refGenome.replace(/-/g, ' ');
    const queryLabel = queryGenome.replace(/-/g, ' ');

    // Génère les liens JBrowse pour la ref et la query (sur la région sélectionnée)
    let refJBrowseLink = '', queryJBrowseLink = '';
    if (typeof jbrowseLinks !== "undefined") {
        const refBase = jbrowseLinks[refGenome];
        if (refBase) {
            const refLoc = `${lines[0].refChr}:${refStart}..${refEnd}`;
            const refUrl = refBase.includes('?')
                ? `${refBase}&loc=${refLoc}`
                : `${refBase}?loc=${refLoc}`;
            refJBrowseLink = `<a href="${refUrl}" target="_blank" title="See reference region in JBrowse" class="jbrowse-link">
                <i class="fas fa-external-link-alt"></i>
            </a>`;
        }
        const queryBase = jbrowseLinks[queryGenome];
        if (queryBase) {
            const queryLoc = `${lines[0].queryChr}:${queryStart}..${queryEnd}`;
            const queryUrl = queryBase.includes('?')
                ? `${queryBase}&loc=${queryLoc}`
                : `${queryBase}?loc=${queryLoc}`;
            queryJBrowseLink = `<a href="${queryUrl}" target="_blank" title="See query region in JBrowse" class="jbrowse-link">
                <i class="fas fa-external-link-alt"></i>
            </a>`;
        }
    }

    // Bloc résumé ergonomique
    const summaryHtml = `
        <div class="summary-refquery" style="display:flex; gap:10em; align-items:center; margin-bottom:8px;">
            <div>
                <b>Ref :</b> ${refLabel}<br>
                <b>Chr:</b> ${lines[0].refChr}<br>
                <b>Pos:</b> ${refStart}..${refEnd} ${refJBrowseLink}
            </div>
            <div>
                <b>Query :</b> ${queryLabel}<br>
                <b>Chr:</b> ${lines[0].queryChr}<br>
                <b>Pos:</b> ${queryStart}..${queryEnd} ${queryJBrowseLink}
            </div>
        </div>
    `;

    return `${summaryHtml}`;
}

export function createTableBadges(lines) {
    // Comptage des types
    const typeCounts = {};
    lines.forEach(d => {
        typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
    });

    // Conteneur pour la définition
    const definitionHtml = `
        <div id="type-definition" style="
            min-height: 50px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            transition: opacity 0.2s;
            opacity: 0;
        ">
        </div>
    `;

    // Badges
    const typeCountsHtml = Object.keys(typeColors)
        .filter(type => typeCounts[type])
        .map(type => {
            const count = typeCounts[type];
            const background = typeColors[type] || '#ccc';
            const style = background.includes('gradient') 
                ? `background: ${background}` 
                : `background-color: ${background}`;
            const definition = typeDefs[type] || '';
            
            return `
                <div class="type-badge" 
                    data-type="${type}" 
                    data-active="true" 
                    data-definition="${definition}"
                    style="${style};"
                    onmouseover="document.getElementById('type-definition').innerHTML = this.dataset.definition; document.getElementById('type-definition').style.opacity = '1';"
                    onmouseout="document.getElementById('type-definition').innerHTML = ''; document.getElementById('type-definition').style.opacity = '0.7';"
                >
                    <span class="type-label">${type}</span>
                    <span class="type-count">${count}</span>
                </div>
            `;
        }).join('');

    return `        
        <div><p style="margin-top:20px; margin-bottom:6px;">Click on the badges to filter the table</p></div>

        <div class="type-badges-container" style="margin-top:8px;">
            ${typeCountsHtml}
        </div>

        ${definitionHtml}
    `;
}

//////////////////////////////////////////////////
// ORTHOLOGS
/////////////////////////////////////////////////

export function createZoomedSyntenyView(orthologPairs, refGenome, queryGenome, refStart, refEnd, queryStart, queryEnd) {
    
    // Vérifier si on a des données
    if (!orthologPairs || orthologPairs.length === 0) {
        d3.select('#zoomed-synteny').html('<div>No orthologs found</div>');
        return;
    }

    // Configuration du dessin
    const margin = { top: 10, right: 30, bottom: 0, left: 30 };
    const width = 1200 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;
    const chromosomeHeight = 10;
    const geneHeight = 10;
    const refY = 50;
    const queryY = 200;

    // Créer le conteneur SVG avec style centré
    const svg = d3.select('#zoomed-synteny')
        .html('') // Nettoyer le contenu précédent
        .style('display', 'flex')
        .style('justify-content', 'center')
        .style('align-items', 'center')
        .append('svg')
        .attr('id', 'anchor-viz')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Échelles pour positionner les gènes
    const refScale = d3.scaleLinear()
        .domain([refStart, refEnd])
        .range([0, width]);

    const queryScale = d3.scaleLinear()
        .domain([queryStart, queryEnd])
        .range([0, width]);

    // Dessiner les chromosomes de référence
    g.append('rect')
        .attr('x', 0)
        .attr('y', refY - chromosomeHeight/2)
        .attr('width', width)
        .attr('height', chromosomeHeight)
        .attr('stroke', genomeColors[refGenome] || '#666')
        .attr('stroke-width', 2)
        .attr('opacity', 0.7)
        .attr('fill', 'white')
        .attr('rx', 5);

    // Label chromosome ref
    g.append('text')
        .attr('x', 0)
        .attr('y', refY - 45)
        .attr('font-weight', 'bold')
        //ajoute une majuscule au premier caractère du nom du génome
        .text(`${refGenome.charAt(0).toUpperCase() + refGenome.slice(1)} - ${orthologPairs[0].ref.chr}`);

    // Dessiner le chromosome query
    g.append('rect')
        .attr('x', 0)
        .attr('y', queryY - chromosomeHeight/2)
        .attr('width', width)
        .attr('height', chromosomeHeight)
        .attr('stroke', genomeColors[queryGenome] || '#666')
        .attr('stroke-width', 2)
        .attr('opacity', 0.7)
        .attr('fill', 'white')
        .attr('rx', 5);

    // Label chromosome query
    g.append('text')
        .attr('x', 0)
        .attr('y', queryY + 55)
        .attr('font-weight', 'bold')
        //ajoute une majuscule au premier caractère du nom du génome
        .text(`${queryGenome.charAt(0).toUpperCase() + queryGenome.slice(1)} - ${orthologPairs[0].query.chr}`);

    // Créer un tooltip
    let tooltip = d3.select('.gene-tooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
            .attr('class', 'gene-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('visibility', 'hidden')
            .style('z-index', '1000');
    }

    // Dessiner les genes et les connection
    orthologPairs.forEach((d, i) => {
        drawGene(g, d.ref, refScale, refY, geneHeight, genomeColors[refGenome], 'black', tooltip, 'ref');
        drawGene(g, d.query, queryScale, queryY, geneHeight, genomeColors[queryGenome], 'black', tooltip, 'query');
        drawConnection(g, d.ref, d.query, refScale, queryScale, refY, queryY, geneHeight, d.score, tooltip);

    });


    // Ajouter des échelles de coordonnées
    const refAxis = d3.axisTop(refScale)
        .tickSize(5)
        .tickFormat(d => (d / 1000000).toFixed(1) + 'Mb');
    
    g.append('g')
        .attr('class', 'ref-axis')
        .attr('transform', `translate(0, ${refY - chromosomeHeight/2 - 10})`)
        .call(refAxis);

    const queryAxis = d3.axisBottom(queryScale)
        .tickSize(5)
        .tickFormat(d => (d / 1000000).toFixed(1) + 'Mb');
    
    g.append('g')
        .attr('class', 'query-axis')
        .attr('transform', `translate(0, ${queryY + chromosomeHeight/2 + 10})`)
        .call(queryAxis);

    // Ajouter une légende
    const legend = g.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 160}, 20)`);

    return svg.node();
}


function drawGene(g, geneData, scale, y, geneHeight, color, strokeColor, tooltip, position = 'ref') {
    const x = scale(geneData.start);
    const geneWidth = Math.max(3, scale(geneData.end) - scale(geneData.start));
    const strand = geneData.strand || '+';

    const gene = g.append('g').attr('class', `${position}-gene`);

    const arrowSize = Math.min(5, geneWidth / 3);
    const points = strand === '+' || strand === '1'
        ? [
            [x, y - geneHeight/2],
            [x + geneWidth - arrowSize, y - geneHeight/2],
            [x + geneWidth, y],
            [x + geneWidth - arrowSize, y + geneHeight/2],
            [x, y + geneHeight/2]
        ]
        : [
            [x + arrowSize, y - geneHeight/2],
            [x + geneWidth, y - geneHeight/2],
            [x + geneWidth, y + geneHeight/2],
            [x + arrowSize, y + geneHeight/2],
            [x, y]
        ];

    gene.append('polygon')
        .attr('points', points.map(p => p.join(',')).join(' '))
        .attr('fill', color)
        .attr('opacity', 0.7)
        .attr('stroke', strokeColor)
        .attr('stroke-width', 1);

    // Tooltip
    gene.style('cursor', 'pointer')
        .on('mouseover', function(event) {
            tooltip.style('visibility', 'visible')
                .html(`<strong>${geneData.name}</strong><br>
                    ${geneData.chr}:${geneData.start.toLocaleString()}-${geneData.end.toLocaleString()}<br>
                    Strand: ${strand}`);
        })
        .on('mousemove', function(event) {
            tooltip.style('top', (event.pageY + 10) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', function() {
            tooltip.style('visibility', 'hidden');
        });
}



function drawConnection(g, refGene, queryGene, refScale, queryScale, refY, queryY, geneHeight, score, tooltip) {
    const refStartX = refScale(refGene.start);
    const refEndX = refScale(refGene.end);
    const queryStartX = queryScale(queryGene.start);
    const queryEndX = queryScale(queryGene.end);

    const refBottom = refY + geneHeight/2;      // Bas du gène de référence
    const queryTop = queryY - geneHeight/2;                  // Haut du gène query

    const midY = (refBottom + queryTop) / 2;

    const pathData = `
        M${refStartX},${refBottom}
        C${refStartX},${midY} ${queryStartX},${midY} ${queryStartX},${queryTop}
        L${queryEndX},${queryTop}
        C${queryEndX},${midY} ${refEndX},${midY} ${refEndX},${refBottom}
        Z
    `;

    const bandId = `conn-${CSS.escape(refGene.name)}-${CSS.escape(queryGene.name)}`;

    g.append('path')
        .attr('class', 'ortholog-connection')
        .attr('id', bandId) // Ajoute un ID unique pour chaque bande pour le survol
        .attr('d', pathData)
        .attr('fill', '#ccc')
        .attr('opacity', 0.5)
        .style('cursor', 'pointer')
        .on('mouseover', function() {
            d3.select(this).attr('opacity', 1);
            tooltip.style('visibility', 'visible')
                .html(`<strong>Orthologs</strong><br>
                    ${refGene.name} ↔ ${queryGene.name}<br>
                    Score: ${score.toFixed(3)}`);
        })
        .on('mousemove', function(event) {
            tooltip.style('top', (event.pageY + 10) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.5);
            tooltip.style('visibility', 'hidden');
        });
}



// Fonction pour highlight des bandes entre les genes orthologues au survol du tableau
function highlightBand(bandId) {
    // Sauvegarde l'opacité d'origine
    const band = d3.select(`#${CSS.escape(bandId)}`);
    if (!band.empty()) {
        band
            .style('opacity', 1)
            .raise(); // Amène la bande au premier plan
    }
}

function unhighlightBand(bandId) {
    const band = d3.select(`#${CSS.escape(bandId)}`);
    if (!band.empty()) {
        band
            .style('opacity', 0.5)
    }
}

export function createOrthologsTable(orthologPairs, refGenome, queryGenome) {
    const headers = [
        { key: 'refName', label: 'Ref gene' },
        { key: 'refPos', label: 'Ref position' },
        { key: 'refLink', label: '' },
        { key: 'queryName', label: 'Query gene' },
        { key: 'queryPos', label: 'Query position' },
        { key: 'queryLink', label: '' },
        { key: 'score', label: 'Score' }
    ];

    const headerHtml = headers
        .map(h => `<th>${h.label}</th>`)
        .join('');

    const rowsHtml = orthologPairs.map((pair, i) => {
        const isEven = i % 2 === 0;
        const backgroundColor = isEven ? '#f9f9f9' : '#ffffff';
        // ID unique pour chaque bande pour le survol
        const bandId = `conn-${CSS.escape(pair.ref.name)}-${CSS.escape(pair.query.name)}`;

        // liens JBrowse (si dispo)
        let refLink = '', queryLink = '';
        if (typeof jbrowseLinks !== "undefined") {
            const refBase = jbrowseLinks[refGenome];
            const queryBase = jbrowseLinks[queryGenome];

            if (refBase) {
                const refLoc = `${pair.ref.chr}:${pair.ref.start}..${pair.ref.end}`;
                const refUrl = refBase.includes('?')
                    ? `${refBase}&loc=${refLoc}`
                    : `${refBase}?loc=${refLoc}`;
                refLink = `<a href="${refUrl}" target="_blank" title="Go to JBrowse">
                    <i class="fas fa-external-link-alt"></i>
                </a>`;
            }

            if (queryBase) {
                const queryLoc = `${pair.query.chr}:${pair.query.start}..${pair.query.end}`;
                const queryUrl = queryBase.includes('?')
                    ? `${queryBase}&loc=${queryLoc}`
                    : `${queryBase}?loc=${queryLoc}`;
                queryLink = `<a href="${queryUrl}" target="_blank" title="Go to JBrowse">
                    <i class="fas fa-external-link-alt"></i>
                </a>`;
            }
        }

        return `
            <tr style="background-color:${backgroundColor};"
                data-band-id="${bandId}">
                <td>${pair.ref.name}</td>
                <td>${pair.ref.chr}:${pair.ref.start.toLocaleString()}-${pair.ref.end.toLocaleString()}</td>
                <td>${refLink}</td>
                <td>${pair.query.name}</td>
                <td>${pair.query.chr}:${pair.query.start.toLocaleString()}-${pair.query.end.toLocaleString()}</td>
                <td>${queryLink}</td>
                <td>${pair.score}</td>
            </tr>
        `;
    }).join('');

    // Ajoute les event listeners après avoir inséré le tableau
    setTimeout(() => {
        document.querySelectorAll('tr[data-band-id]').forEach(row => {
            const bandId = row.dataset.bandId;
            row.addEventListener('mouseover', () => highlightBand(bandId));
            row.addEventListener('mouseout', () => unhighlightBand(bandId));
        });
    }, 0);

    return `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead class="thead-light">
                    <tr>${headerHtml}</tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}




