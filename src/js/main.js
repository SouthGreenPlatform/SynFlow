import { createForm, showForm } from './form.js';
import { createControlPanel } from './legend.js';
import { createGraphSection } from './draw.js';
import { setupAnalytics } from './analytics.js';
import { createInfoPanel } from './info.js';
import * as toolkit from '../../toolkit/toolkit.js';
// console.log("syri");
// Définir le comportement de zoom
// export const zoom = d3.zoom()
//     .scaleExtent([0.1, 10]) // Définir les niveaux de zoom minimum et maximum
//     .on("zoom", (event) => {
//     d3.select('#zoomGroup').attr("transform", event.transform);
// });

document.addEventListener('DOMContentLoaded', () => {

    const mainContainer = document.getElementById('main-container');
    createForm().then(form => {                 
        mainContainer.appendChild(form);
        mainContainer.appendChild(createControlPanel());
        mainContainer.appendChild(createGraphSection());
        mainContainer.appendChild(createInfoPanel());

        checkToolkitParam(); // Vérifie les paramètres du toolkit dans l'URL
    });

    setupAnalytics();

});

function checkToolkitParam() {
    //check si l'url contient un toolkitID exemple :
    // https://synflow.southgreen.fr/?id=toolkit_jD1prpcgQajoO2umAAAV
    // https://dev-visusnp.southgreen.fr/synflow/?id=toolkit_aryvzv9jHAIWUBSVAAZ4
    const urlParams = new URLSearchParams(window.location.search);
    const toolkitID = urlParams.get('id');
    if (toolkitID) {
        console.log('Toolkit ID trouvé dans l\'URL :', toolkitID);

        const currentHost = window.location.hostname;
        let url;
        if (currentHost === 'localhost') {
            // En local → serveur sur port 8080
            url = `http://localhost:8080/data/comparisons/${toolkitID}`;
        } else {
            // En prod → garde l’URL d’origine
            url = `https://synflow.southgreen.fr/tmp/toolkit_run/${toolkitID}`;
        }

        console.log('URL des fichiers FTP :', url);

        // Sélectionne et affiche l'onglet 'ftp'
        const menuColumn = document.querySelector('[data-option="ftp"]');
        console.log('menuColumn :', menuColumn);
        
        showForm("ftp")
        if (menuColumn) menuColumn.click();

        // Met à jour le champ de saisie FTP
        const ftpInput = document.getElementById('ftp-input');
        console.log('ftpInput :', ftpInput);
        ftpInput.value = url;

        //clique sur fetch files
        const fetchButton = document.getElementById('fetch-ftp-button');
        if (fetchButton) fetchButton.click();
    }       
}
