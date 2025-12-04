const driver = window.driver.js.driver;

let driverObj = driver();

driverObj = driver({
	showProgress: true,
	showButtons: ['next', 'previous', 'close'],
	steps: [
		{ element: '.header-logo', popover: { title: 'Welcome to SynFlow', description: 'Let\'s get started with a quick tour of SynFlow.', side: "left", align: 'start' }},
		{ element: '.menu-section', popover: { title: 'Input Selection', description: 'SynFlow offers multiple entry points: browsing precomputed datasets, uploading user-provided SyRi outputs, or running an integrated workflow to produce and visualize structural variations on the fly. ', side: "left", align: 'start' }},
		{ 
			element: '[data-option="existing"]', 
			popover: { 
				title: 'Existing Files', 
				description: 'Here you can browse in precomputed analyses on several organisms', 
				side: "bottom", 
				align: 'start' 
			}
		},
		{ 
			element: '#remote-folder-select', 
			popover: { 
				title: 'Select study', 
				description: 'Choose an organism you want to explore.', 
				side: "left", 
				align: 'start' 
			}
		},
		{ element: '#existing-files-list', 
			popover: { title: 'Select accessions', 
			description: 'Select at least 2 accessions you want to compare.',
			side: "top", 
			align: 'start' },
			onHighlighted: (element) => {
				//select les deux premier de la liste #existing-files-list				
				setTimeout(() => {
					const items = element.querySelectorAll('.genome-item');
					if (items.length >= 2) {
						items[0].click();
						items[1].click();
					}
				}, 500);
			}
		},
		{ 
		element: '#submit-existing', 
			popover: { 
				title: 'Draw', 
				description: 'Click here to draw the comparison.', 
				side: "right", 
				align: 'start',
				onNextClick: () => {
					// Quand on clique sur Next, on clique d'abord sur draw
					const drawButton = document.querySelector('#submit-existing');
					drawButton.click();
					// Puis on continue normalement (pas besoin de moveNext, il est appelé automatiquement)
				}
			},
			onHighlighted: (element) => {
				// Quand on clique sur le bouton draw, on passe à l'étape suivante
				const onDrawClick = () => {
					driverObj.moveNext();
				};
				
				element.addEventListener('click', onDrawClick, { once: true });
				
				// Nettoyage
				return () => {
					element.removeEventListener('click', onDrawClick);
				};
			}
		},

		{ element: '#control-panel-content', popover: { title: 'Control Panel', description: 'Use the control panel to customize your visualization options.', side: "left", align: 'start' }},
		{ element: '#chrom-control-content', popover: { title: 'Chromosome layout', description: 'Here you can reorder chromosomes by switching their positions. You can also click on chromosome to hide them in the visualization area.', side: "top", align: 'start' }},
		{ element: '#viz', popover: { title: 'Visualization Area', description: 'This area displays the visualization results. You can click on a chromosome or a band to open contextual menus for more options.', side: "top", align: 'start' }},
		{ element: '#info-panel', popover: { title: 'Info Section', description: 'Info panel provides additional details and synteny view for the selected band.', side: "top", align: 'start' }},
		{ popover: { title: 'Thank You', description: 'Now feel free to explore SynFlow on your own!' } }
	]
});

const tourButton = document.createElement('button');
tourButton.innerText = 'Start SynFlow Tour';
tourButton.style.position = 'fixed';
tourButton.style.top = '20px';
tourButton.style.right = '20px';
tourButton.style.padding = '10px 15px';
tourButton.style.backgroundColor = 'black';
tourButton.style.color = '#fff';
tourButton.style.border = 'none';
tourButton.style.borderRadius = '20px';
tourButton.style.cursor = 'pointer';
tourButton.style.zIndex = '1000';

tourButton.addEventListener('click', () => {
	driverObj.drive();
});
document.body.appendChild(tourButton);