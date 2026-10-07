import { createForm, showForm } from './form.js';
import { createControlPanel } from './legend.js';
import { createGraphSection } from './draw.js';
import { setupAnalytics } from './analytics.js';
import { createInfoPanel } from './info.js';
import * as toolkit from '../../toolkit/toolkit.js';
import { socket } from '../../toolkit/toolkit.js';

// Fonction utilitaire pour logger et émettre vers le serveur
export function logActivity(message) {
    // Console log local
    console.log(message);
    
    // Émettre vers le serveur si socket est connecté
    if (socket) {
        socket.emit('logMessage', message);
    }
}

export function sendMetric(metric) {
    // Console log local
    console.info('Sending metric to server:', metric);
    
    // Émettre vers le serveur si socket est connecté
    if (socket) {
        socket.emit('metric', metric);
    }
}

// Système de notifications toast
const notifications = [];

export function showNotification(message, type = 'error', duration = 10000) {
    const container = getNotificationContainer();
    const toast = createToastElement(message, type);
    container.appendChild(toast);
    notifications.push(toast);

    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }
}

function getNotificationContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
            font-family: inherit;
        `;
        document.body.appendChild(container);
    }
    return container;
}

function createToastElement(message, type) {
    const toast = document.createElement('div');
    const colors = {
        error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
        warning: { bg: '#fff3cd', border: '#ffeeba', text: '#856404' },
        info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' },
        success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' }
    };
    const color = colors[type] || colors.error;

    toast.style.cssText = `
        background-color: ${color.bg};
        color: ${color.text};
        border: 1px solid ${color.border};
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: flex-start;
        gap: 10px;
        word-break: break-word;
        animation: slideInToast 0.3s ease-out;
    `;

    const icon = getToastIcon(type);
    const messageDiv = document.createElement('div');
    messageDiv.style.flex = '1';
    messageDiv.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        color: ${color.text};
        padding: 0 0 0 8px;
    `;
    closeBtn.addEventListener('click', () => removeToast(toast));

    toast.appendChild(icon);
    toast.appendChild(messageDiv);
    toast.appendChild(closeBtn);

    return toast;
}

function getToastIcon(type) {
    const span = document.createElement('span');
    span.style.cssText = 'font-size: 18px; line-height: 1;';
    const icons = {
        error: '✕',
        warning: '⚠',
        info: 'ℹ',
        success: '✓'
    };
    span.textContent = icons[type] || icons.error;
    return span;
}

function removeToast(toast) {
    if (!toast || !toast.parentElement) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
        const index = notifications.indexOf(toast);
        if (index > -1) notifications.splice(index, 1);
    }, 300);
}

// Ajouter le style d'animation
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes slideInToast {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
    }
`;
document.head.appendChild(toastStyle);

// Gestion globale des erreurs
window.addEventListener('error', (event) => {
    showNotification('An unexpected error occurred. Please refresh the page.', 'error');
    logActivity('Unexpected error: ' + event.message);
});

window.addEventListener('unhandledrejection', (event) => {
    showNotification('An unexpected error occurred. Please refresh the page.', 'error');
    logActivity('Unhandled promise rejection: ' + event.reason);
});

document.addEventListener('DOMContentLoaded', async () => {

    const mainContainer = document.getElementById('main-container');
    const study = await checkStudyParam(); // Vérifie les paramètres de l'étude dans l'URL

    createForm(study).then(form => {                 
        mainContainer.appendChild(form);
        mainContainer.appendChild(createControlPanel());
        mainContainer.appendChild(createGraphSection());
        mainContainer.appendChild(createInfoPanel());

        //waiting for the form to be created before checking the URL
        setTimeout(() => {
            checkToolkitParam(); // Vérifie les paramètres du toolkit dans l'URL
        }, 500);
        //  
    });

    setupAnalytics();

    //connection au serveur node pour les logs
    toolkit.loadSocketIOScript().then(() => {
        toolkit.initSocketConnection();
        // Attendre un peu pour que la connexion s'établisse
        setTimeout(() => {
            // Envoyer les infos du client au serveur
            logActivity('Connected.');
        }, 100);  // Petit délai pour éviter l'erreur
    }).catch(error => {
        console.error('Erreur lors du chargement du script Socket.IO :', error);
    });
});

function checkToolkitParam() {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const toolkitID = urlParams.get('id');
    if (toolkitID) {
        console.log('Toolkit ID trouvé dans l\'URL :', toolkitID);

        const url = new URL(
            `/data/comparisons/${encodeURIComponent(toolkitID)}/`,
            globalThis.location.origin,
        ).toString();
        console.log('URL des fichiers FTP :', url);

        // Sélectionne et affiche l'onglet 'ftp'
        const menuColumn = document.querySelector('[data-option="ftp"]');
        console.log('menuColumn :', menuColumn);

        showForm("ftp");
        if (menuColumn) menuColumn.click();

        // Met à jour le champ de saisie FTP
        const ftpInput = document.getElementById('ftp-input');
        console.log('ftpInput :', ftpInput);
        ftpInput.value = url;

        // clique sur fetch files
        const fetchButton = document.getElementById('fetch-ftp-button');
        if (fetchButton) fetchButton.click();
    }
}

async function checkStudyParam() {
    //check si l'url contient un studyID exemple :
    // https://synflow.southgreen.fr/?study=study_12345
    const urlParams = new URLSearchParams(globalThis.location.search);
    const study = urlParams.get('study');
    if (study) {
        console.log('Study ID trouvé dans l\'URL :', study);
        
        // Vérifier que le study existe dans config.json
        try {
            const response = await fetch('public/data/config.json');
            if (!response.ok) throw new Error('Failed to fetch config');
            const dirs = await response.json();
            
            const studyExists = dirs.some(({organism}) => 
                organism.toLowerCase() === study.toLowerCase()
            );
            
            if (!studyExists) {
                showNotification(`Study "${study}" not found in available studies. Reverting to normal mode.`, 'warning');
                logActivity(`Invalid study parameter: ${study}`);
                return null; // Retourner null pour mode normal
            }
        } catch (error) {
            console.error('Error validating study parameter:', error);
            return null; // En cas d'erreur, mode normal
        }
    }
    return study;       
}
