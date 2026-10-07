import { logActivity, showNotification } from "../src/js/main.js";

// Déclarer la variable socket globalement pour qu'elle soit accessible partout dans le script
let socket = null;
export { socket };
let servicesData = {}; // Contiendra les services et databases
let databasesData = {}; // Stocke les databases séparément
let serviceName = ""; // Nom du service sélectionné

function setJobConsoleLoading(isLoading, message = "Analysis is starting...") {
	const wrapper = document.getElementById("console-wrapper");
	if (!wrapper) return;
	let loading = document.getElementById("job-console-spinner");
	if (!isLoading) { loading?.remove(); return; }
	if (!loading) {
		loading = document.createElement("div");
		loading.id = "job-console-spinner";
		loading.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px;color:#084298;background:#eaf3ff;border:1px solid #9ec5fe;border-radius:5px;font-weight:bold;";
		const indicator = document.createElement("span");
		indicator.style.cssText = "width:16px;height:16px;border:3px solid #9ec5fe;border-top-color:#084298;border-radius:50%;animation:job-console-spin .8s linear infinite;";
		const text = document.createElement("span");
		const style = document.createElement("style");
		style.textContent = "@keyframes job-console-spin { to { transform: rotate(360deg); } }";
		loading.append(indicator, text, style);
		wrapper.appendChild(loading);
	}
	loading.querySelector("span:nth-child(2)").textContent = message;
}

function setSubmitButtonLoading(isLoading) {
	const button = document.getElementById("submitBtn");
	if (!button) return;
	button.disabled = isLoading;
	button.textContent = isLoading ? "Submitting..." : "Submit";
	button.style.opacity = isLoading ? "0.5" : "1";
	button.style.cursor = isLoading ? "not-allowed" : "pointer";
}

function resetJobSubmission() {
	setJobConsoleLoading(false);
	setSubmitButtonLoading(false);
}

/**
 * Fonction pour initier toolkit
 * @param {boolean} generateSelect - Booléen pour déterminer si l'on génère le selecteur de service ou pas
 * @param {string} serviceName - Nom du service sélectionné, si pas de selecteur
 *
 * Exécute les étapes suivantes :
 * 1. Charge le script Socket.IO
 * 2. Initialise la connexion Socket.IO
 * 3. Charge le JSON avec les services et les bases de données
 * 4. Selon generateSelect, génère le formulaire ou appelle la fonction populateServiceSelect
 */
export function initToolkit(generateSelect, serviceName) {
	const loadingIndicator = document.createElement("div");
	loadingIndicator.id = "loadingIndicator";
	loadingIndicator.style.position = "fixed";
	loadingIndicator.style.top = "50%";
	loadingIndicator.style.left = "50%";
	loadingIndicator.style.transform = "translate(-50%, -50%)";
	loadingIndicator.style.fontSize = "18px";
	loadingIndicator.style.fontWeight = "bold";
	loadingIndicator.style.color = "#333";
	loadingIndicator.style.backgroundColor = "#fff";
	loadingIndicator.style.padding = "20px";
	loadingIndicator.style.borderRadius = "10px";
	loadingIndicator.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.2)";
	loadingIndicator.style.fontFamily = "Montserrat, sans-serif"; // Ajouter une police moderne
	loadingIndicator.textContent = "Loading toolkit...";
	const toolkitContainer = document.getElementById("toolkitContainer");
	toolkitContainer.appendChild(loadingIndicator);

	console.log("1Initializing toolkit...");
	// Charger et initialiser Socket.IO
	loadSocketIOScript()
		.then(() => {
			console.log("2Socket.IO chargé avec succès.");
			initSocketConnection(); // Initialiser la connexion après le chargement
		})
		.then(() => {
			console.log("3Loading services...");
			// Charger le JSON avec les services et les bases de données
			return loadServices();
		})
		.then(() => {
			if (generateSelect) {
				console.log("4Generating select...");
				// Appeler la fonction populateServiceSelect aprés le chargement
				populateServiceSelect();
				loadingIndicator.remove(); // Supprimer le message de chargement
			} else {
				console.log("5Generating form...");
				generateForm(serviceName);
				loadingIndicator.remove(); // Supprimer le message de chargement
			}
		})
		.catch((error) => {
			console.error("Error initializing toolkit:", error);
			loadingIndicator.remove(); // Supprimer le message de chargement
		});
}

/**
 * Fonction pour injecter le script Socket.IO dans le document si ce n'est pas déja fait
 * @return {Promise} Une promesse qui se résout lorsque le script est chargé
 */
export function loadSocketIOScript() {
	// Vérifie si Socket.IO est déjà chargé
	if (typeof io !== "undefined") {
		console.log("Socket.IO déjà chargé.");
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		const script = document.createElement("script");

		// URL du script Socket.IO
		script.src = "https://cdn.socket.io/4.0.0/socket.io.min.js";

		// Fonction callback pour lorsque le script est chargé
		script.onload = () => resolve();

		// Fonction callback pour lorsque le script n'a pas pu être chargé
		script.onerror = () =>
			reject(new Error("Erreur lors du chargement de Socket.IO"));

		// Ajouter le script au document
		document.head.appendChild(script);
	});
}

const backendURL = globalThis.location.origin;

/**
 * Fonction pour initialiser la connexion Socket.IO après le chargement du script si elle n'était pas déjà établie
 * @return {void} N'a pas de valeur de retour
 */
export function initSocketConnection() {
	if (socket) {
		console.log("Connexion Socket.IO déjà établie.");
		return;
	}

	console.log("Initialisation de la connexion Socket.IO...");
	// Créer la connexion Socket.IO
	socket = io(backendURL, { transports: ["websocket"] });

	// Envoyer les infos du client au serveur
	socket.emit("clientInfo", { url: globalThis.location.href });

	// Écouter les messages du serveur
		socket.on("consoleMessage", function (message) {
		// Ajouter le message à la console
		addToConsole(`<pre>${message}<pre>`);

		// Le serveur n'expose pas d'événement d'erreur dédié. On relaie donc
		// les erreurs connues vers l'interface qui affiche l'état du job.
		const errorMessage = String(message);
		if (/\b(error|erreur|failed|failure)\b/i.test(errorMessage)) {
			resetJobSubmission();
			const event = new CustomEvent("JobErrorEvent", {
				detail: errorMessage,
			});
			document.dispatchEvent(event);
		}
	});

	// Gérer les erreurs de connexion
	socket.on("connect_error", (error) => {
		// Afficher l'erreur de connexion
		showNotification('Unable to connect to the analysis server. Please refresh the page.', 'error');
		console.error("Erreur de connexion à Socket.IO :", error);
	});

	socket.on("toolkitPath", (data) => {
		// Créer et déclencher un événement personnalisé
		const event = new CustomEvent("ToolkitPathEvent", { detail: data });
		document.dispatchEvent(event);
	});

	socket.on("outputResult", (data) => {
		resetJobSubmission();
		console.log(`${data}`);
		const event = new CustomEvent("ToolkitResultEvent", { detail: data });
		document.dispatchEvent(event);
	});

	socket.on("outputResultOpal", (data) => {
		resetJobSubmission();
		console.log(`${data}`);
		const toolkitID = String(data).split("/").filter(Boolean).pop();
		if (!toolkitID) return;
		const event = new CustomEvent("ToolkitResultEvent", { detail: toolkitID });
		document.dispatchEvent(event);
	});

}

const config = {
	development: {
		servicesPath: "/synflow/toolkit/services.json",
	},
	production: {
		servicesPath: "/toolkit/services.json",
	},
};

function getEnvironmentConfig() {
	// Détection de l'environnement basée sur l'URL
	const isDevelopment = globalThis.location.hostname.includes("dev-");
	return isDevelopment ? config.development : config.production;
}

function getSelectOptions(field) {
	if (field.options) {
		return field.options;
	}
	if (field.optionsSource) {
		return databasesData[field.optionsSource] || [];
	}
	return [];
}

function createFieldElements(field) {
	const labelContainer = document.createElement("div");
	labelContainer.style.display = "flex";
	labelContainer.style.alignItems = "center";
	labelContainer.style.gap = "5px";

	const label = document.createElement("label");
	label.textContent = field.label;
	label.htmlFor = field.name;
	labelContainer.appendChild(label);

	if (field.tooltip) {
		const tooltipIcon = document.createElement("span");
		tooltipIcon.innerHTML = "?";
		tooltipIcon.style.cursor = "help";
		tooltipIcon.style.backgroundColor = "#f0f0f0";
		tooltipIcon.style.borderRadius = "50%";
		tooltipIcon.style.width = "16px";
		tooltipIcon.style.height = "16px";
		tooltipIcon.style.display = "inline-flex";
		tooltipIcon.style.justifyContent = "center";
		tooltipIcon.style.alignItems = "center";
		tooltipIcon.style.fontSize = "12px";
		tooltipIcon.style.position = "relative";

		const tooltipText = document.createElement("div");
		tooltipText.textContent = field.tooltip;
		tooltipText.style.visibility = "hidden";
		tooltipText.style.backgroundColor = "black";
		tooltipText.style.color = "white";
		tooltipText.style.padding = "5px 10px";
		tooltipText.style.borderRadius = "6px";
		tooltipText.style.position = "absolute";
		tooltipText.style.zIndex = "1";
		tooltipText.style.width = "200px";
		tooltipText.style.left = "25px";
		tooltipText.style.top = "-5px";
		tooltipText.style.fontSize = "12px";

		const showTooltip = () => (tooltipText.style.visibility = "visible");
		const hideTooltip = () => (tooltipText.style.visibility = "hidden");

		tooltipIcon.addEventListener("mouseover", showTooltip);
		tooltipIcon.addEventListener("mouseout", hideTooltip);
		tooltipIcon.addEventListener("click", (e) => {
			e.stopPropagation();
			if (tooltipText.style.visibility === "visible") {
				hideTooltip();
			} else {
				showTooltip();
			}
		});

		document.addEventListener("click", hideTooltip);

		tooltipIcon.appendChild(tooltipText);
		labelContainer.appendChild(tooltipIcon);
	}

	let input;
	if (field.type === "select") {
		input = document.createElement("select");
		input.name = field.name;

		const options = getSelectOptions(field);
		if (Array.isArray(options)) {
			options.forEach((optionValue) => {
				const option = document.createElement("option");
				if (typeof optionValue === "string") {
					option.value = optionValue;
					option.textContent = optionValue;
				} else if (typeof optionValue === "object" && optionValue !== null) {
					option.value = optionValue.value;
					option.textContent = optionValue.label || optionValue.value;
				}
				input.appendChild(option);
			});
		} else if (options && typeof options === "object") {
			Object.keys(options).forEach((optionKey) => {
				const option = document.createElement("option");
				option.value = optionKey;
				option.textContent = optionKey;
				input.appendChild(option);
			});
		}

		if (field.default) {
			input.value = field.default;
		}
	} else if (field.type === "text") {
		input = document.createElement("input");
		input.type = "text";
		input.name = field.name;
		input.value = field.default || "";
	} else if (field.type === "boolean") {
		input = document.createElement("input");
		input.type = "checkbox";
		input.name = field.name;
		input.checked = field.default === true || field.default === "true";
	} else if (field.type === "file") {
		input = document.createElement("input");
		input.type = "file";
		input.name = field.name;
	} else if (field.type === "file[]") {
		input = document.createElement("input");
		input.type = "file";
		input.name = field.name;
		input.multiple = true;
		if (field.accept) {
			input.accept = field.accept;
		}
	} else {
		input = document.createElement("input");
		input.type = "text";
		input.name = field.name;
		input.value = field.default || "";
	}

	if (field.required) {
		input.required = true;
	}

	return { labelContainer, input };
}

/**
 * Loads the services and databases from the specified JSON file.
 * @return {Promise<void>} A promise that resolves when the services and databases are loaded.
 */
export function loadServices() {
	return new Promise((resolve, reject) => {
		const { servicesPath } = getEnvironmentConfig();

		fetch(servicesPath)
			.then((response) => response.json())
			.then((data) => {
				servicesData = data.services;
				databasesData = data.databases;
				console.log("Services chargés depuis:", servicesPath);
				resolve();
			})
			.catch((error) => {
				console.error("Erreur lors du chargement des services:", error);
				reject(error);
			});
	});
}

/**
 * Génère le menu déroulant des services
 * @return {void} N'a pas de valeur de retour
 */
export function populateServiceSelect() {
	console.log("populateServiceSelect() called");
	const toolkitContainer = document.getElementById("toolkitContainer");

	// Crée le select element
	const serviceSelect = document.createElement("select");
	serviceSelect.id = "serviceSelect";
	serviceSelect.innerHTML = '<option value="">--Select a service--</option>'; // Reset de la liste

	// Loop through the services and create an option for each one
	console.log("servicesData:", servicesData);
	for (const serviceKey in servicesData) {
		console.log("serviceKey:", serviceKey);
		const option = document.createElement("option");
		option.value = serviceKey;
		option.textContent = servicesData[serviceKey].label;
		serviceSelect.appendChild(option);
	}

	// Ajoutez l'événement onchange
	serviceSelect.onchange = function () {
		const selectedService = serviceSelect.value;
		console.log("selectedService:", selectedService);
		// Faites quelque chose lorsque l'utilisateur sélectionne un nouveau service
		console.log(`Service sélectionné : ${selectedService}`);
		generateForm(selectedService);
	};

	// Append the select element to the DOM
	toolkitContainer.appendChild(serviceSelect);
	console.log("serviceSelect appended to toolkitContainer");
}

// Fonction pour générer le formulaire en fonction du service sélectionné
/**
 * Génère le formulaire en fonction du service sélectionné
 * @param {string} selectedService Le nom du service sélectionné
 * @return {void} N'a pas de valeur de retour
 */
export function generateForm(selectedService) {
	const toolkitContainer = document.getElementById("toolkitContainer");
	serviceName = selectedService;

	// Vérifier si le conteneur du formulaire existe déjà
	let formContainer = document.getElementById("formContainer");

	if (!formContainer) {
		formContainer = document.createElement("div");
		formContainer.id = "formContainer";
		toolkitContainer.appendChild(formContainer);
	}

	// Vérifier si la console existe déjà
	let consoleDiv = document.getElementById("console");

	if (!consoleDiv) {
		consoleDiv = document.createElement("div");
		consoleDiv.id = "console";
		toolkitContainer.appendChild(consoleDiv);
	}

	// On vide le conteneur du formulaire à chaque fois
	formContainer.innerHTML = "";
	consoleDiv.innerHTML = "<p>Console :</p>";

	if (selectedService && servicesData[selectedService]) {
		const service = servicesData[selectedService];
		const fields = service.arguments.inputs;
		const workflowField = fields.find(
			(field) =>
				field.optionsSource &&
				databasesData[field.optionsSource] &&
				!Array.isArray(databasesData[field.optionsSource]),
		);
		const advancedDefinitions = workflowField
			? databasesData[workflowField.optionsSource]
			: null;
		let workflowSelect = null;

		const renderAdvanced = (workflowName, advancedContainer) => {
			advancedContainer.innerHTML = "";
			if (
				!advancedDefinitions ||
				!workflowName ||
				!advancedDefinitions[workflowName] ||
				!Array.isArray(advancedDefinitions[workflowName].advanced)
			) {
				const noAdvanced = document.createElement("p");
				noAdvanced.textContent = "Aucun paramètre avancé pour ce workflow.";
				noAdvanced.style.margin = "0";
				advancedContainer.appendChild(noAdvanced);
				return;
			}

			advancedDefinitions[workflowName].advanced.forEach((field) => {
				const { labelContainer, input } = createFieldElements(field);
				advancedContainer.appendChild(labelContainer);
				advancedContainer.appendChild(input);
				advancedContainer.appendChild(document.createElement("br"));
			});
		};

		// Générer les champs dynamiquement
		let fastaInput = null;
		let gffInput = null;

		fields.forEach((field) => {
			const { labelContainer, input } = createFieldElements(field);
			formContainer.appendChild(labelContainer);
			formContainer.appendChild(input);
			formContainer.appendChild(document.createElement("br"));

			//if field is required, add a star after the label
			if (field.required) {
				const star = document.createElement("span");
				star.textContent = " *";
				star.style.color = "black";
				labelContainer.appendChild(star);
			}

			// Stocker les références aux inputs file[] pour validation FASTA/GFF
			if (field.type === "file[]") {
				if (field.name === "inputs") fastaInput = input;
				if (field.name === "gff") gffInput = input;
			}

			if (workflowField && field.name === workflowField.name) {
				workflowSelect = input;
				workflowSelect.addEventListener("change", () => {
					const advancedContainer =
						document.getElementById("advancedContainer");
					if (
						advancedContainer &&
						advancedContainer.style.display === "block"
					) {
						renderAdvanced(workflowSelect.value, advancedContainer);
					}
				});
			}
		});

		// Fonction de validation complète (extensions + correspondance FASTA/GFF)
		function validateAllFiles() {
			const errorDiv = document.getElementById("file-validation-error");
			const submitBtn = document.getElementById("submitBtn");
			const messages = [];

			// Validation extensions FASTA
			if (fastaInput && fastaInput.files.length > 0) {
				const validExts = [".fasta", ".fsa", ".fa", ".fna", ".faa"];
				const invalid = Array.from(fastaInput.files).filter(
					(f) => !validExts.some((ext) => f.name.toLowerCase().endsWith(ext)),
				);
				if (invalid.length > 0) {
					messages.push(
						`Invalid FASTA extension(s): ${invalid.map((f) => f.name).join(", ")}<br>Allowed: ${validExts.join(", ")}`,
					);
				}
			}

			// Validation extensions GFF
			if (gffInput && gffInput.files.length > 0) {
				const validExts = [".gff", ".gff3"];
				const invalid = Array.from(gffInput.files).filter(
					(f) => !validExts.some((ext) => f.name.toLowerCase().endsWith(ext)),
				);
				if (invalid.length > 0) {
					messages.push(
						`Invalid GFF extension(s): ${invalid.map((f) => f.name).join(", ")}<br>Allowed: ${validExts.join(", ")}`,
					);
				}
			}

			// Validation : au moins 2 fichiers FASTA
			if (fastaInput && fastaInput.files.length > 0 && fastaInput.files.length < 2) {
				messages.push("Please select at least 2 FASTA files for comparison.");
			}

			// Validation : taille totale maximale (500 MB)
			const MAX_TOTAL_SIZE = 500 * 1024 * 1024;
			let totalSize = 0;
			if (fastaInput) totalSize += Array.from(fastaInput.files).reduce((sum, f) => sum + f.size, 0);
			if (gffInput) totalSize += Array.from(gffInput.files).reduce((sum, f) => sum + f.size, 0);
			if (totalSize > MAX_TOTAL_SIZE) {
				messages.push(`Total file size exceeds 500 MB limit (${(totalSize / (1024 * 1024)).toFixed(1)} MB).`);
			}

			// Validation : format FASTA basique (header >)
			if (fastaInput) {
				for (const file of fastaInput.files) {
					const text = file.name.endsWith('.gz') ? '' : file.slice(0, 4096).text();
					if (text && typeof text.then === 'function') {
						text.then((content) => {
							if (!content.trim().startsWith('>')) {
								showNotification(`${file.name} does not appear to be a valid FASTA file.`, 'warning');
							}
						}).catch(() => {});
					}
				}
			}

			// Validation correspondance FASTA/GFF (seulement si les deux sont fournis)
			if (
				fastaInput &&
				gffInput &&
				fastaInput.files.length > 0 &&
				gffInput.files.length > 0
			) {
				const getBaseName = (filename) => filename.replace(/\.[^/.]+$/, "");
				const fastaNames = Array.from(fastaInput.files).map((f) =>
					getBaseName(f.name),
				);
				const gffNames = Array.from(gffInput.files).map((f) =>
					getBaseName(f.name),
				);
				const unmatchedFasta = fastaNames.filter(
					(name) => !gffNames.includes(name),
				);
				const unmatchedGff = gffNames.filter(
					(name) => !fastaNames.includes(name),
				);
				if (unmatchedFasta.length > 0) {
					messages.push(`FASTA without GFF: ${unmatchedFasta.join(", ")}`);
				}
				if (unmatchedGff.length > 0) {
					messages.push(`GFF without FASTA: ${unmatchedGff.join(", ")}`);
				}
			}

			// Affichage résultat
			if (messages.length > 0) {
				let fullMsg =
					"File validation errors. Please fix the following issues:\n\n" +
					messages.join("\n\n");
				if (
					messages.some(
						(m) =>
							m.includes("FASTA without GFF") ||
							m.includes("GFF without FASTA"),
					)
				) {
					fullMsg +=
						"\n\nEach FASTA file must have a corresponding GFF file with the same base name (case-sensitive).\nExample: refgenome.fasta ↔ refgenome.gff";
				}

				if (!errorDiv) {
					const newErrorDiv = document.createElement("div");
					newErrorDiv.id = "file-validation-error";
					newErrorDiv.style.color = "red";
					newErrorDiv.style.margin = "10px 0";
					newErrorDiv.style.padding = "8px";
					newErrorDiv.style.backgroundColor = "#fff3cd";
					newErrorDiv.style.border = "1px solid #ffc107";
					newErrorDiv.style.borderRadius = "4px";
					newErrorDiv.style.fontSize = "0.9em";
					formContainer.insertBefore(newErrorDiv, submitBtn);
				}
				const currentErrorDiv = document.getElementById(
					"file-validation-error",
				);
				currentErrorDiv.innerHTML = fullMsg.replace(/\n/g, "<br>");
				currentErrorDiv.style.display = "block";
				currentErrorDiv.style.color = "red";
				submitBtn.disabled = true;
				submitBtn.style.opacity = "0.5";
				submitBtn.style.cursor = "not-allowed";
			} else {
				if (errorDiv) errorDiv.style.display = "none";
				submitBtn.disabled = false;
				submitBtn.style.opacity = "1";
				submitBtn.style.cursor = "pointer";
			}
		}

		// Ajouter les event listeners sur les inputs file[]
		if (fastaInput) fastaInput.addEventListener("change", validateAllFiles);
		if (gffInput) gffInput.addEventListener("change", validateAllFiles);

		if (advancedDefinitions) {
			const advancedText = document.createElement("p");
			advancedText.textContent = "Advanced parameters ▼";
			advancedText.style.cursor = "pointer";
			advancedText.style.fontWeight = "bold";
			advancedText.style.margin = "10px 0 5px 0";
			advancedText.id = "advancedToggle";

			const advancedContainer = document.createElement("div");
			advancedContainer.id = "advancedContainer";
			advancedContainer.className = "advanced-container";
			advancedContainer.style.display = "none";

			advancedText.onclick = () => {
				const advancedContainer = document.getElementById("advancedContainer");
				const isHidden = advancedContainer.style.display === "none";
				advancedContainer.style.display = isHidden ? "block" : "none";
				advancedText.textContent = isHidden
					? "Advanced parameters ▲"
					: "Advanced parameters ▼";
				if (isHidden && workflowSelect) {
					renderAdvanced(workflowSelect.value, advancedContainer);
				}
			};
			formContainer.appendChild(advancedText);
			formContainer.appendChild(advancedContainer);
		}

		// Div d'erreur pour la validation FASTA/GFF (avant le bouton submit)
		const errorDiv = document.createElement("div");
		errorDiv.id = "file-validation-error";
		errorDiv.style.display = "none";
		formContainer.appendChild(errorDiv);

		// Bouton Submit
		const submitButton = document.createElement("button");
		submitButton.id = "submitBtn";
		submitButton.textContent = "Submit";
		submitButton.onclick = (event) => {
			if (submitButton.disabled) {
				event.preventDefault();
				return;
			}
			logActivity("Submitting toolkit form");
			event.preventDefault();

			//check if all required fields are filled
			const requiredFields = formContainer.querySelectorAll(
				"input[required], select[required]",
			);
			for (const field of requiredFields) {
				if (
					(field.type === "file" && field.files.length === 0) ||
					(field.type !== "file" && !field.value)
				) {
					showNotification(`Please fill the required field: ${field.name}`, 'warning');
					return;
				}
			}

			// Validation finale avant soumission
			validateAllFiles();
			const errorDiv = document.getElementById("file-validation-error");
			if (errorDiv && errorDiv.style.display !== "none") {
				showNotification("Please fix the file validation errors before submitting.", 'warning');
				return;
			}

			addToConsole("Sending files...");
			setSubmitButtonLoading(true);
			showNotification("Your analysis has been submitted and is starting.", "info");
			document.dispatchEvent(new CustomEvent("JobSubmittedEvent"));
			submitForm();
			console.log("Bouton cliqué !");
		};
		formContainer.appendChild(submitButton);
	}
}

/**
 * Ajouter un message à la console HTML
 * @param {string} message - Le message à ajouter
 */
function addToConsole(message) {
	const consoleDiv = document.getElementById("console");
	const messageElement = document.createElement("p");

	// Utilisation de innerHTML pour que les balises HTML (comme <pre>) soient interprétées
	// Par exemple, si le message est "<pre>hello</pre>", cela ajoutera un élément <pre> contenant le texte "hello" au messageElement
	messageElement.innerHTML = message;

	// Ajouter le messageElement à la fin de la consoleDiv
	consoleDiv.appendChild(messageElement);

	// Faire défiler vers le bas pour afficher le dernier message
	// La propriété scrollHeight contient la hauteur totale de l'élément, y compris la partie qui est hors de l'écran
	// La propriété scrollTop définit la position de défaut du scroll, à 0,0
	consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

/**
 * Fonction pour soumettre le formulaire avec les fichiers via FormData
 *
 * @returns {void} N'a pas de valeur de retour
 */
function submitForm() {
	const serviceSelect = document.getElementById("serviceSelect");
	let selectedService;

	if (serviceSelect) {
		selectedService = serviceSelect.value;
		console.log(`Service sélectionné : ${selectedService}`);
	} else {
		selectedService = serviceName;
		console.log(`Service sélectionné : ${selectedService}`);
	}

	const serviceData = servicesData[selectedService];
	const formContainer = document.getElementById("formContainer");

	const formData = new FormData();

	Array.from(formContainer.querySelectorAll("input, select")).forEach(
		(input) => {
			if (input.type === "file" && input.files.length > 0) {
				if (input.multiple) {
					//Boucle sur chaque fichier pour les champs multi-fichier
					Array.from(input.files).forEach((file) => {
						formData.append(input.name, file);
					});
				} else {
					// Champ fichier simple : on ajoute le fichier unique
					formData.append(input.name, input.files[0]);
				}
			} else {
				formData.append(input.name, input.value);
			}
		},
	);

	// Envoyer les fichiers et paramètres via fetch
	fetch(`${backendURL}/upload`, {
		method: "POST",
		body: formData,
	})
		.then((response) => {
			if (!response.ok) {
				return response.json().then((data) => {
					const errorMsg = data.message || "Upload failed";
					showNotification(`Upload failed: ${errorMsg}`, 'error');
					resetJobSubmission();
					addToConsole(`UPLOAD: ${errorMsg}`);
					console.error("Cannot upload:", data);
					throw new Error(errorMsg);
				});
			}
			return response.json();
		})
		.then((data) => {
			addToConsole("Files uploaded successfully:");
			addToConsole(JSON.stringify(data, null, 2));
			showNotification("Files uploaded successfully. Analysis is starting...", 'success');
			try {
				socket.emit("runService", selectedService, serviceData, data);
			} catch (error) {
				showNotification("Error running service: " + error.message, 'error');
				addToConsole("Error running service: " + error.message);
			}
		})
		.catch((error) => {
			showNotification(`Connection error: ${error.message}`, 'error');
			resetJobSubmission();
			addToConsole(`Connection error: ${error.message}`);
		});
}
