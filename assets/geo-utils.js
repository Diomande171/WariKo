/**
 * geo-utils.js
 * Calcul de distance pour WariKo — formule à vol d'oiseau (Haversine)
 * × coefficient correcteur. Aucune dépendance externe (OSRM écarté).
 */

// Une route réelle est toujours plus longue qu'une ligne droite.
// 1.3 est une valeur raisonnable pour un réseau routier urbain
// abidjanais peu direct.
const COEFFICIENT_ROUTE = 1.3;

function coordonneesValides(lat, lng) {
    return (
        typeof lat === "number" && typeof lng === "number" &&
        !Number.isNaN(lat) && !Number.isNaN(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180
    );
}

/**
 * Distance à vol d'oiseau entre deux points GPS, en km (Haversine).
 */
function distanceVolOiseau(lat1, lng1, lat2, lng2) {
    if (!coordonneesValides(lat1, lng1) || !coordonneesValides(lat2, lng2)) {
        throw new Error("Coordonnées GPS invalides");
    }

    const R = 6371; // rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Distance "routière estimée" utilisée pour la facturation :
 * vol d'oiseau × coefficient, arrondie à 2 décimales.
 * À utiliser UNIQUEMENT pour boutique → client (jamais livreur → boutique).
 */
function distanceLivraisonKm(latBoutique, lngBoutique, latClient, lngClient) {
    const distanceDirecte = distanceVolOiseau(latBoutique, lngBoutique, latClient, lngClient);
    return Math.round(distanceDirecte * COEFFICIENT_ROUTE * 100) / 100;
}

window.GeoUtils = {
    COEFFICIENT_ROUTE,
    coordonneesValides,
    distanceVolOiseau,
    distanceLivraisonKm
};
