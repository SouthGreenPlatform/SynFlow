import { refGenome, queryGenome, genomeColors, genomeData, scale } from "./process.js";

export let currentYOffset = 0; // Définir globalement

export function resetDrawGlobals() {
    currentYOffset = 0;
}

export function drawMiniChromosome(genome, svg) {
    const width = 40;
    const height = 10;
    const radius = 2;

    // Chemin pour le mini chromosome avec des bouts arrondis
    // Chemin premier bras
    let path = "M" + 5 + "," + 10; // Déplacer vers x y
    path += "h" + width; // Ligne horizontale
    path += "a" + radius + "," + radius + " 0 0 1 " + radius + "," + radius; // Arc
    path += "a" + radius + "," + radius + " 0 0 1 " + -radius + "," + radius; // Arc
    path += "h" + -width; // Ligne horizontale
    path += "a" + radius + "," + radius + " 0 0 1 " + -radius + "," + -radius; // Arc
    path += "a" + radius + "," + radius + " 0 0 1 " + radius + "," + -radius; // Arc
    path += "Z";

    svg.append("path")
        .attr("d", path)
        .attr("fill", "rgba(0, 0, 0, 0)")
        .style("fill-opacity", "0")
        .attr("stroke", genomeColors[genome]);
}

export function drawChromosomes(genomeData, maxLengths, refGenome, queryGenome, isFirstFile, scale) {
    console.log("Draw chromosomes"); 
    console.log(refGenome, queryGenome);

    const svgGroup = d3.select('#zoomGroup');
    const width = +d3.select('#viz').attr('width');
    const height = 300;
    
    const margin = { top: 30, bottom: 30, left: 50, right: 50 };
    const yRefPosition = currentYOffset + margin.top + (height - margin.top - margin.bottom) / 4;
    const yQueryPosition = currentYOffset + margin.top + 3 * (height - margin.top - margin.bottom) / 4;

    const spaceBetween = 50;
    const totalLength = Object.values(maxLengths).reduce((a, b) => a + b, 0);
    const totalWidth = (totalLength / scale) + spaceBetween * (Object.keys(maxLengths).length) + margin.left + margin.right;

    // d3.select('#viz').attr('width', totalWidth);

    const radius = 5; // Exemple de radius pour les extrémités des chromosomes, moitié de la hauteur

    let currentX = margin.left; // Position de départ en X
    const chromPositions = {};
    console.log(genomeData);
    console.log(genomeData[refGenome]);
    for (const chrom in genomeData[refGenome]) {
        //chrom est le numéro du chromosome ex: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
        const refWidth = (genomeData[refGenome][chrom].length || 0) / scale;
        const queryWidth = (genomeData[queryGenome][chrom].length || 0) / scale;
        const chromWidth = maxLengths[chrom] / scale;

        // console.log(chrom, refWidth, queryWidth, chromWidth);

        if (!isNaN(chromWidth) && chromWidth > 0) {
            if (isFirstFile) {
                drawChromPathNoArm(currentX, yRefPosition, refWidth, radius, chrom, genomeData[refGenome][chrom].name + "_ref", refGenome, svgGroup, scale);
                // Ajouter les noms des chromosomes
                if (isFirstFile) {
                    svgGroup.append('text')
                        .attr('x', currentX + chromWidth / 2)
                        .attr('y', yRefPosition - 10) // Position au-dessus des chromosomes de référence
                        .attr('text-anchor', 'middle')
                        .text(genomeData[refGenome][chrom].name);
                }
            }
            drawChromPathNoArm(currentX, yQueryPosition, queryWidth, radius, chrom, genomeData[queryGenome][chrom].name + "_query", queryGenome, svgGroup, scale);

            //change le format de chromPositions pour integrer le numéro du chromosome
            // ancien format = {chromName: {refX: currentX, queryX: currentX, refY: yRefPosition, queryY: yQueryPosition}}
            // nouveau format = {chromNum: {refX: currentX, queryX: currentX, refY: yRefPosition, queryY: yQueryPosition}}
            chromPositions[chrom] = { refX: currentX, queryX: currentX, refY: yRefPosition, queryY: yQueryPosition };
            currentX += chromWidth + spaceBetween; // Ajouter un espace entre les chromosomes
        } else {
            console.error(`Invalid chromosome width for ${genomeData[refGenome][chrom].name}: ${chromWidth}`);
        }
    }

    currentYOffset = yQueryPosition - 90; // Mettre à jour la position Y pour le fichier suivant
    // console.log(chromPositions);
    return chromPositions; // Retourner les positions des chromosomes
}

export function drawStackedChromosomes(genomeData, maxLengths, fileIndex, totalGenomes, scale) {
    console.log("Draw stacked chromosomes"); 
    const svgGroup = d3.select('#zoomGroup');
    const margin = { top: 30, bottom: 30, left: 50, right: 50 };
    const spaceBetween = 100;
    const totalSpaceBetween = totalGenomes * 100;
    const maxLength = Math.max(...Object.values(maxLengths));
    const totalWidth = (maxLength / scale) + margin.left + margin.right;
    // d3.select('#viz').attr('width', totalWidth);

    const radius = 5; // Exemple de radius pour les extrémités des chromosomes, moitié de la hauteur

    let currentX = margin.left; // Position de départ en X
    let currentY = margin.top + (fileIndex+1) * spaceBetween; //position de départ en Y

    const chromPositions = {};

    let chromNum = 0;
    for (const chromName in maxLengths) {
        chromNum++;
        const refLength = genomeData[refGenome][chromName].length;
        const queryLength = genomeData[queryGenome][chromName].length;
        const refWidth = (refLength || 0) / scale;
        const queryWidth = (queryLength || 0) / scale;
        const chromWidth = maxLengths[chromName] / scale;

        if (!isNaN(chromWidth) && chromWidth > 0) {
            if (fileIndex == 0) { // si c'est le premier fichier on dessine la ref, sinon elle est dejà dessinée
                //chr ref
                drawChromPathNoArm(currentX, currentY, refWidth, radius,chromNum, chromName + "_ref", refGenome, svgGroup, scale);
                // Ajouter les noms des chromosomes
                svgGroup.append('text')
                    .attr('x', currentX + chromWidth / 2)
                    .attr('y', currentY - 10) // Position au-dessus des chromosomes de référence
                    .attr('text-anchor', 'middle')
                    .text(chromName);
            }
            //chr query
            drawChromPathNoArm(currentX, currentY+spaceBetween , queryWidth, radius, chromNum, chromName + "_query", queryGenome, svgGroup, scale);

            chromPositions[chromName] = { refX: currentX, queryX: currentX, refY: currentY, queryY: currentY+spaceBetween };
            currentY += totalSpaceBetween;

        } else {
            console.error(`Invalid chromosome width for ${chromName}: ${chromWidth}`);
        }
    }

    currentY += totalSpaceBetween; // Mettre à jour la position Y pour le fichier suivant
    return chromPositions; // Retourner les positions des chromosomes
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

    svg.append("path")
        .attr("d", path)
        .attr("class", "chrom") // Ajoute une classe chrom
        .attr("id", chromName)
        .attr("chromNum", chromNum)
        .style("stroke", genomeColors[genome]) // Utiliser la couleur du génome
        .style("fill", "rgba(0, 0, 0, 0)")
        .style("fill-opacity", "0");
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
        monChromColor.style('fill', null); // Supprimer le style existant
        monChromColor.style('fill', `url(#${gradientId})`);
    }
}

export function drawCorrespondenceBands(data, chromPositions, isFirstFile, scale) {
    console.log("Draw correspondence bands");
    const svgGroup = d3.select('#zoomGroup');

    // console.log(chromPositions);

    // Définir les couleurs pour chaque type
    const typeColors = {
        'SYN': '#d3d3d3', // gris clair
        'INV': '#ffa500', // orange
        'INVTR': '#ffa500', // orange
        'TRANS': '#008000', // vert
        'DUP': '#0000ff', // bleu
    };

    // Filtrer les types ne se terminant pas par "AL"
    // console.log(data.length);
    const allowedTypes = ['SYN', 'INV', 'TRANS', 'DUP']; // Types à afficher
    const filteredData = data.filter(d => allowedTypes.includes(d.type)); // Filtrer les lignes invalides et les types non désirés
    // console.log(filteredData.length);
    // console.log(filteredData);
    // Configuration du tooltip
    const tip = d3.tip()
        .attr('class', 'd3-tip')
        .offset([-10, 0])
        .html(function (event, d) {
            return `
                <strong>Ref Chr:</strong> <span>${d.refChr}</span><br>
                <strong>Ref Start:</strong> <span>${d.refStart}</span><br>
                <strong>Ref End:</strong> <span>${d.refEnd}</span><br>
                <strong>Query Chr:</strong> <span>${d.queryChr}</span><br>
                <strong>Query Start:</strong> <span>${d.queryStart}</span><br>
                <strong>Query End:</strong> <span>${d.queryEnd}</span><br>
                <strong>Type:</strong> <span>${d.type}</span>
            `;
        });

    svgGroup.call(tip);

    filteredData.forEach(d => {
        
        // Récupère l'index du chromosome name d.refChr dans le genomeData
        // genomeData[refGenome] = {1: {name: "chr1", length: 249250621}, 2: {name: "chr2", length: 243199373}, ...}
        let refChromNum = Object.values(genomeData[refGenome]).findIndex(item => item.name === d.refChr) +1;

        //recupère l'index du chromosome name d.queryChr dans le genomeData
        let queryChromNum = Object.values(genomeData[queryGenome]).findIndex(item => item.name === d.queryChr) +1;
        const refX = chromPositions[[refChromNum]]?.refX;
        // const queryX = chromPositions[d.queryChr]?.queryX;
        const queryX = chromPositions[[queryChromNum]]?.queryX;

        if (refX !== undefined && queryX !== undefined) {
            const refStartX = refX + (d.refStart / scale);
            const refEndX = refX + (d.refEnd / scale);
            let queryStartX = queryX + (d.queryStart / scale);
            let queryEndX = queryX + (d.queryEnd / scale);
            const color = typeColors[d.type] || '#ccc'; // Utiliser la couleur définie ou gris clair par défaut

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
            const bandPos = d.refChr === d.queryChr ? 'intra' : 'inter';

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
                .attr('class', 'band')
                .attr('data-length', bandLength) // Ajouter l'attribut de longueur
                .attr('data-pos', bandPos) // Ajouter l'attribut de position inter ou intra
                .attr('data-type', d.type) // Ajouter l'attribut de type de bande
                .attr('data-ref', d.refChr) //ajoute l'attribut ref
                .attr('data-ref-num', refChromNum) // ajoute l'attribut ref-num
                .attr('data-query-num', queryChromNum) // ajoute l'attribut query
                .attr('data-query', d.queryChr) // ajoute l'attribut query
                .on('mouseover', function (event, d) {
                    d3.select(this).attr('opacity', 1); // Mettre en gras au survol
                    tip.show(event, d); // Afficher le tooltip
                })
                .on('mouseout', function (event, d) {
                    d3.select(this).attr('opacity', 0.5); // Réinitialiser après le survol
                    tip.hide(event, d); // Masquer le tooltip
                })
                .on('click', function (event, d) {
                    // Récupérer les lignes du fichier correspondant aux positions refStart et refEnd
                    const linesInRange = getLinesInRange(window.fullParsedData, d.refChr, d.refStart, d.refEnd);
                    const tableHtml = convertLinesToTableHtml(linesInRange);

                    // Afficher les informations dans la div #info
                    d3.select('#info').html(`
                        <br>${tableHtml}
                    `);
                });
        } else {
            console.error(`Invalid chromosome position for ref: ${d.refChr} or query: ${d.queryChr}`);
        }
    });
}


function getLinesInRange(parsedData, refChr, refStart, refEnd) {
    return parsedData.filter(d => d.refChr === refChr && d.refStart >= refStart && d.refEnd <= refEnd);
}

function convertLinesToTableHtml(lines) {
    if (lines.length === 0) return "<p>Aucune donnée disponible</p>";

    // Calculer le nombre de chaque type dans les lignes filtrées
    const typeCounts = {};
    lines.forEach(d => {
        if (typeCounts[d.type]) {
            typeCounts[d.type]++;
        } else {
                typeCounts[d.type] = 1;
        }
    });
    const typeCountsHtml = Object.keys(typeCounts).map(type => {
        return `<strong>${type}:</strong>${typeCounts[type]}<br>`;
    }).join('');
    
    const headers = Object.keys(lines[0]);
    const headerHtml = headers.map(header => `<th>${header}</th>`).join('');
    const rowsHtml = lines.map(line => {
        const rowHtml = headers.map(header => `<td class="table-cell">${line[header]}</td>`).join('');
        return `<tr>${rowHtml}</tr>`;
    }).join('');

    return `
        ${typeCountsHtml}
        <table class="table table-striped">
            <thead>
                <tr>${headerHtml}</tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;
}