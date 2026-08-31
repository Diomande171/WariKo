// assets/position.js
// Script partagé de géolocalisation pour WariKo.
// Exige la position GPS de l'utilisateur avant une action clé
// (commande, demande de prestation, achat).
//
// Utilisation :
//   try {
//     const position = await exigerPosition();
//     // position.lat, position.lng disponibles
//   } catch (err) {
//     // err.message : message d'erreur à afficher à l'utilisateur
//   }

function exigerPosition() {
    return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                });
            },
            (err) => {
                let message = "Impossible d'obtenir ta position.";

                if (err.code === err.PERMISSION_DENIED) {
                    message = "Active la localisation dans les réglages pour continuer.";
                } else if (err.code === err.POSITION_UNAVAILABLE) {
                    message = "Position indisponible pour le moment. Réessaie.";
                } else if (err.code === err.TIMEOUT) {
                    message = "La demande de localisation a expiré. Réessaie.";
                }

                reject(new Error(message));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    });
}

// Vérifie si la position a déjà été partagée récemment (utilisé par le bandeau de rappel).
// Retourne true/false sans déclencher de popup de permission.
async function positionDejaPartagee() {
    if (!("permissions" in navigator)) {
        return false;
    }

    try {
        const statut = await navigator.permissions.query({ name: "geolocation" });
        return statut.state === "granted";
    } catch (e) {
        return false;
    }
}
