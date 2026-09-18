/**
 * livraison-tracker.js
 * Partage GPS (côté livreur) + réception temps réel (côté client/vendeur)
 * + aide à l'affichage Leaflet. Nécessite geo-utils.js chargé avant,
 * et une variable globale `supabaseClient` déjà initialisée sur la page.
 */

// ============================================================
// PARTIE 1 — Partage GPS (côté livreur)
// ============================================================

let watchId = null;
let dernierePositionEnvoyee = null;
let dernierEnvoiTimestamp = 0;
let livraisonActiveId = null;

const DISTANCE_MIN_MAJ_METRES = 30;   // ne renvoyer que si déplacement > 30m
const INTERVALLE_MAX_MAJ_MS = 15000;  // ou après 15s même sans déplacement significatif
const INTERVALLE_MIN_MAJ_MS = 4000;   // jamais plus souvent que toutes les 4s

/**
 * Démarre le partage GPS pour une livraison active.
 * onError(message) affiche les erreurs à l'écran.
 * onPositionEnvoyee(lat, lng) est appelé après chaque écriture réussie.
 */
function demarrerPartageGPS(livraisonId, onError, onPositionEnvoyee) {
    if (!navigator.geolocation) {
        onError("La géolocalisation n'est pas disponible sur cet appareil.");
        return;
    }

    if (watchId !== null) {
        arreterPartageGPS();
    }

    livraisonActiveId = livraisonId;

    watchId = navigator.geolocation.watchPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const precision = position.coords.accuracy;

            if (!GeoUtils.coordonneesValides(lat, lng)) return;
            if (precision && precision > 100) return; // GPS trop imprécis

            const maintenant = Date.now();
            const tempsEcoule = maintenant - dernierEnvoiTimestamp;

            if (tempsEcoule < INTERVALLE_MIN_MAJ_MS) return;

            if (dernierePositionEnvoyee) {
                const distanceParcourue = GeoUtils.distanceVolOiseau(
                    dernierePositionEnvoyee.lat, dernierePositionEnvoyee.lng, lat, lng
                ) * 1000; // en mètres

                const deplacementSuffisant = distanceParcourue >= DISTANCE_MIN_MAJ_METRES;

                if (!deplacementSuffisant && tempsEcoule < INTERVALLE_MAX_MAJ_MS) return;
            }

            const { error } = await supabaseClient
                .from("livraisons")
                .update({ livreur_lat: lat, livreur_lng: lng })
                .eq("id", livraisonActiveId);

            if (error) {
                onError("Erreur d'envoi de la position : " + error.message);
                return;
            }

            dernierePositionEnvoyee = { lat, lng };
            dernierEnvoiTimestamp = maintenant;

            if (onPositionEnvoyee) onPositionEnvoyee(lat, lng);
        },
        (erreur) => {
            switch (erreur.code) {
                case erreur.PERMISSION_DENIED:
                    onError("Autorisez la localisation pour continuer la livraison.");
                    break;
                case erreur.POSITION_UNAVAILABLE:
                    onError("Position GPS indisponible. Vérifiez que la localisation est activée.");
                    break;
                case erreur.TIMEOUT:
                    onError("Le signal GPS met du temps à répondre.");
                    break;
                default:
                    onError("Erreur de géolocalisation.");
            }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    window.addEventListener("offline", () => {
        onError("Connexion perdue — la position sera renvoyée dès le retour du réseau.");
    });

    window.addEventListener("online", () => {
        dernierEnvoiTimestamp = 0; // force l'envoi du prochain point GPS reçu
    });
}

/**
 * Arrête le partage GPS. À appeler dès que le statut passe à
 * livree / annulee / echec / expiree, ou en quittant la page.
 */
function arreterPartageGPS() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    livraisonActiveId = null;
    dernierePositionEnvoyee = null;
    dernierEnvoiTimestamp = 0;
}


// ============================================================
// PARTIE 2 — Réception temps réel (côté client / vendeur)
// ============================================================

let canalRealtime = null;

/**
 * Écoute les mises à jour d'une livraison précise en temps réel.
 * onMiseAJour(livraison) est appelé à chaque changement de ligne.
 * Retourne une fonction de nettoyage (à appeler en quittant la page).
 */
function suivreLivraisonRealtime(livraisonId, onMiseAJour) {
    arreterSuiviRealtime();

    canalRealtime = supabaseClient
        .channel("livraison-" + livraisonId)
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "livraisons",
                filter: "id=eq." + livraisonId
            },
            (payload) => onMiseAJour(payload.new)
        )
        .subscribe();

    return arreterSuiviRealtime;
}

function arreterSuiviRealtime() {
    if (canalRealtime) {
        supabaseClient.removeChannel(canalRealtime);
        canalRealtime = null;
    }
}


// ============================================================
// PARTIE 3 — Aide à l'affichage (Leaflet)
// ============================================================

/**
 * Déplace un marqueur Leaflet progressivement (interpolation simple)
 * plutôt que de le faire sauter brutalement à chaque nouvelle position.
 */
function animerMarqueur(marqueur, latDepart, lngDepart, latArrivee, lngArrivee, dureeMs = 1000) {
    const debut = performance.now();

    function etape(tempsActuel) {
        const progression = Math.min((tempsActuel - debut) / dureeMs, 1);
        const lat = latDepart + (latArrivee - latDepart) * progression;
        const lng = lngDepart + (lngArrivee - lngDepart) * progression;

        marqueur.setLatLng([lat, lng]);

        if (progression < 1) requestAnimationFrame(etape);
    }

    requestAnimationFrame(etape);
}

const STATUTS_TERMINES = ["livree", "annulee", "echec", "expiree"];

function livraisonEstTerminee(statut) {
    return STATUTS_TERMINES.includes(statut);
}

window.LivraisonTracker = {
    demarrerPartageGPS,
    arreterPartageGPS,
    suivreLivraisonRealtime,
    arreterSuiviRealtime,
    animerMarqueur,
    livraisonEstTerminee
};
