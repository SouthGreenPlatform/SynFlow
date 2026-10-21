import { createForm, showForm } from './form.js';
import { createControlPanel } from './legend.js';
import { createGraphSection } from './draw.js';
import { setupAnalytics } from './analytics.js';
import { createInfoPanel } from './info.js';
import { parseUrlState } from './url-state.mjs';
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
    const detail = event.error || event.message || event.target?.src || event.target?.href || 'Unknown window error';
    console.error('Unexpected window error:', detail);
    logActivity('Unexpected window error: ' + detail);
});

window.addEventListener('unhandledrejection', (event) => {
    const detail = event.reason || 'Unknown promise rejection';
    console.error('Unhandled promise rejection:', detail);
    logActivity('Unhandled promise rejection: ' + detail);
});

document.addEventListener('DOMContentLoaded', async () => {
    const mainContainer = document.getElementById('main-container');
    const urlState = parseUrlState(globalThis.location.search);
    const toolkitId = urlState.toolkitId;
    const visualizationRequested =
        urlState.study !== null ||
        urlState.accessions !== null ||
        urlState.error !== null;
    const visualizationLinkRequested =
        urlState.accessions !== null || urlState.error !== null;

    let canonicalStudy = null;
    if (!toolkitId) {
        canonicalStudy = await checkStudyParam(urlState.study, visualizationLinkRequested);
    }

    if (toolkitId && visualizationRequested) {
        showNotification(
            'The "id" URL parameter takes precedence; "study" and "accessions" were ignored.',
            'warning',
        );
    } else if (!toolkitId && urlState.error) {
        showNotification(urlState.error.message, 'error');
    }

    const navigationState = {
        toolkitId,
        study: toolkitId ? null : canonicalStudy,
        accessions: toolkitId || !canonicalStudy ? null : urlState.accessions,
    };

    const form = await createForm(navigationState);
    mainContainer.appendChild(form);
    mainContainer.appendChild(createControlPanel());
    mainContainer.appendChild(createGraphSection());
    mainContainer.appendChild(createInfoPanel());

    if (toolkitId) {
        await showForm('ftp', navigationState);
        checkToolkitParam(toolkitId);
    } else {
        await showForm('existing', navigationState);
    }

    initializeSocketIfAvailable();
});

async function initializeSocketIfAvailable() {
    try {
        if (['localhost', '127.0.0.1'].includes(globalThis.location.hostname)) {
            const response = await fetch('/socket.io/?EIO=4&transport=polling', {
                cache: 'no-store',
            });
            if (!response.ok) return;
        }

        await toolkit.loadSocketIOScript();
        toolkit.initSocketConnection();
    } catch (error) {
        console.error('Erreur lors du chargement du script Socket.IO :', error);
    }
}

function checkToolkitParam(toolkitId) {
    if (!toolkitId) return;

    console.log('Toolkit ID trouvé dans l\'URL :', toolkitId);

    const url = toolkit.getToolkitResultFolderURL(toolkitId);
    console.log('URL des fichiers FTP :', url);

    const menuColumn = document.querySelector('[data-option="ftp"]');
    if (menuColumn) {
        document.querySelectorAll('[data-option]').forEach((item) => {
            item.style.backgroundColor = 'transparent';
            item.style.color = '#000';
        });
        menuColumn.style.backgroundColor = 'black';
        menuColumn.style.color = 'white';
    }

    const ftpInput = document.getElementById('ftp-input');
    if (ftpInput) ftpInput.value = url;

    const fetchButton = document.getElementById('fetch-ftp-button');
    if (fetchButton) fetchButton.click();
}

async function checkStudyParam(study, visualizationLinkRequested = false) {
    if (!study) return null;

    console.log('Study ID trouvé dans l\'URL :', study);

    try {
        const response = await fetch('public/data/config.json');
        if (!response.ok) throw new Error('Failed to fetch config');
        const dirs = await response.json();
        if (!Array.isArray(dirs)) throw new Error('Invalid config catalog');

        const studyEntry = dirs.find(({ organism }) =>
            typeof organism === 'string' &&
            organism.toLowerCase() === study.toLowerCase()
        );

        if (!studyEntry) {
            showNotification(
                visualizationLinkRequested
                    ? `Study "${study}" is not available. The visualization link was not opened.`
                    : `Study "${study}" not found in available studies. Reverting to normal mode.`,
                'warning',
            );
            logActivity(`Invalid study parameter: ${study}`);
            return null;
        }

        return studyEntry.organism;
    } catch (error) {
        console.error('Error validating study parameter:', error);
        showNotification(
            visualizationLinkRequested
                ? 'Available studies could not be loaded. The visualization link was not opened.'
                : 'Available studies could not be loaded. Reverting to normal mode.',
            'warning',
        );
        return null;
    }
}
