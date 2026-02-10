export function setupAnalytics() {
    // Initialisation des analytics
    let analyticsData = {
        features: {},
        sessionStart: new Date(),
        interactions: 0
    };

    // Suivi des fonctionnalités utilisées
    function trackFeatureUsage(featureName) {
        if (!analyticsData.features[featureName]) {
            analyticsData.features[featureName] = 0;
        }
        analyticsData.features[featureName]++;
        analyticsData.interactions++;
    }

    // Création du bouton de feedback
    function addFeedbackButton() {
        const feedbackButton = document.createElement('button');
        feedbackButton.innerHTML = '<i class="fas fa-comment-alt"></i> Feedback';
        feedbackButton.classList.add('feedback-button');
        feedbackButton.onclick = showFeedbackForm;
        
        document.querySelector('#main-container').appendChild(feedbackButton);
    }

    // Formulaire de feedback
    function showFeedbackForm() {
        const modal = document.createElement('div');
        modal.className = 'feedback-modal';
        modal.innerHTML = `
            <div class="feedback-content">
                <h3>Tell us what you think! <span class="close-feedback">&times;</span></h3>
                <form id="feedback-form">
                    <div class="rating">
                        <span>Satisfaction :</span>
                        <div class="stars">
                            ${Array(5).fill().map((_, i) => 
                                `<i class="far fa-star" data-rating="${i + 1}"></i>`
                            ).join('')}
                        </div>
                    </div>
                    <div class="feedback-field">
                        <label>How can we improve?</label>
                        <textarea placeholder="Your suggestions..."></textarea>
                    </div>
                    <button type="submit" class="submit-feedback">Send</button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Gestion des événements
        modal.querySelector('.close-feedback').onclick = () => modal.remove();
        
        // Gestion des étoiles
        const stars = modal.querySelectorAll('.stars i');
        stars.forEach(star => {
            star.onclick = () => {
                const rating = star.dataset.rating;
                stars.forEach(s => {
                    if (s.dataset.rating <= rating) {
                        s.classList.remove('far');
                        s.classList.add('fas');
                    } else {
                        s.classList.remove('fas');
                        s.classList.add('far');
                    }
                });
            };
        });

        // Soumission du formulaire
        modal.querySelector('#feedback-form').onsubmit = (e) => {
            e.preventDefault();
            const rating = modal.querySelectorAll('.fas.fa-star').length;
            const feedback = modal.querySelector('textarea').value;
            
            // Envoyer les données
            submitFeedback({
                rating,
                feedback,
                analytics: analyticsData
            });

            // Fermer le modal avec message de remerciement
            modal.innerHTML = `
                <div class="feedback-content">
                    <h3>Merci pour votre retour !</h3>
                    <p>Vos commentaires nous aident à améliorer SynFlow.</p>
                </div>
            `;
            setTimeout(() => modal.remove(), 2000);
        };
    }

	function submitFeedback(data) {
		try {
			// Préparer le contenu de l'email
			const subject = `SynFlow Feedback - Note: ${data.rating}/5`;
			const body = `
	Feedback :
	${data.feedback}

	Analytics :
	- Session started : ${data.analytics.sessionStart}
	- Number of interactions : ${data.analytics.interactions}
	- Features used :
	${Object.entries(data.analytics.features)
		.map(([feature, count]) => `  * ${feature}: ${count} times`)
		.join('\n')}
	`;
			
			// Créer l'URL mailto
			const mailtoUrl = `mailto:marilyne.summo@cirad.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
			
			// Ouvrir le client mail par défaut
			globalThis.location.href = mailtoUrl;

			return true;
		} catch (error) {
			console.error('Erreur lors de l\'envoi du feedback:', error);
			return false;
		}
	}

    // Ajout des écouteurs d'événements pour le tracking
    document.addEventListener('click', e => {
        const feature = e.target.closest('[data-feature]');
        if (feature) {
            trackFeatureUsage(feature.dataset.feature);
        }
    });

    // Initialisation
    addFeedbackButton();
}