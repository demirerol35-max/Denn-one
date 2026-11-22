/* Deen One — nearby mosques, OpenStreetMap data; location is requested only by the user. */
(() => {
  const root = document.getElementById('mosques');
  if (!root) return;
  const status = root.querySelector('#mosque-status');
  const results = root.querySelector('#mosque-results');
  const radius = root.querySelector('#mosque-radius');
  const gps = root.querySelector('#mosque-gps');
  const city = root.querySelector('#mosque-city');
  const searchCity = root.querySelector('#mosque-city-search');
  let activeController = null;

  function message(value) { status.textContent = value; }
  function distanceKm(lat1, lon1, lat2, lon2) {
    const rad = Math.PI / 180;
    const a = Math.sin((lat2-lat1)*rad/2)**2 +
      Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function mapsUrl(lat, lon) {
    return 'https://www.openstreetmap.org/?mlat=' + encodeURIComponent(lat) +
      '&mlon=' + encodeURIComponent(lon) + '#map=17/' +
      encodeURIComponent(lat) + '/' + encodeURIComponent(lon);
  }
  function showPlaces(data, lat, lon) {
    results.replaceChildren();
    const unique = new Map();
    for (const item of data.elements || []) {
      const pLat = item.lat ?? item.center?.lat, pLon = item.lon ?? item.center?.lon;
      if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) continue;
      const tags = item.tags || {};
      const name = tags['name:fr'] || tags.name || 'Mosquée';
      const distance = distanceKm(lat, lon, pLat, pLon);
      if (distance > Number(radius.value)/1000) continue;
      const key = item.type + '/' + item.id;
      unique.set(key, {name, distance, lat:pLat, lon:pLon, address:
        [tags['addr:street'],tags['addr:housenumber'],tags['addr:city']].filter(Boolean).join(' ')});
    }
    const places = [...unique.values()].sort((a,b)=>a.distance-b.distance).slice(0,30);
    if (!places.length) { message('Aucune mosquée trouvée dans ce rayon. Essaie un rayon plus grand.'); return; }
    message(places.length + ' mosquée(s) trouvée(s). Données OpenStreetMap, à vérifier avant de te déplacer.');
    for (const place of places) {
      const article = document.createElement('article');
      article.className = 'card';
      article.style.marginBottom = '10px';
      const heading = document.createElement('strong');
      heading.textContent = '🕌 ' + place.name;
      const details = document.createElement('p');
      details.className = 'note';
      details.textContent = place.distance.toFixed(1) + ' km à vol d’oiseau' +
        (place.address ? ' · ' + place.address : '');
      const link = document.createElement('a');
      link.href = mapsUrl(place.lat, place.lon);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Itinéraire / carte ↗';
      article.append(heading, details, link);
      results.append(article);
    }
  }
  async function search(lat, lon) {
    if (activeController) activeController.abort();
    const controller = new AbortController();
    activeController = controller;
    results.replaceChildren();
    message('Recherche des mosquées à proximité…');
    const timeout = setTimeout(() => controller.abort(), 18000);
    const query = '[out:json][timeout:15];(nwr["amenity"="place_of_worship"]["religion"="muslim"](around:' +
      Number(radius.value) + ',' + lat + ',' + lon + '););out center;';
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method:'POST', body:new URLSearchParams({data:query}), signal:controller.signal
      });
      if (!response.ok) throw new Error('Service temporairement indisponible');
      const data = await response.json();
      if (activeController === controller) showPlaces(data,lat,lon);
    } catch (error) {
      if (activeController === controller)
        message('Recherche indisponible pour le moment. Vérifie la connexion puis réessaie.');
    } finally {
      clearTimeout(timeout);
      if (activeController === controller) activeController = null;
    }
  }
  gps.addEventListener('click', () => {
    if (!navigator.geolocation) { message('GPS non disponible sur cet appareil. Utilise la recherche par ville.'); return; }
    message('En attente de ton autorisation de localisation…');
    navigator.geolocation.getCurrentPosition(
      p => search(p.coords.latitude,p.coords.longitude),
      () => message('Localisation refusée ou indisponible. Tu peux rechercher une ville.'),
      {enableHighAccuracy:false, timeout:12000, maximumAge:60000}
    );
  });
  searchCity.addEventListener('click', async () => {
    const value = city.value.trim();
    if (value.length < 2) { message('Indique une ville et, si nécessaire, un pays.'); return; }
    message('Recherche de la ville…');
    try {
      const response = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
        encodeURIComponent(value), {headers:{'Accept':'application/json'}});
      if (!response.ok) throw new Error('Geocoding failed');
      const places = await response.json();
      if (!places.length) { message('Ville introuvable. Précise le pays.'); return; }
      await search(Number(places[0].lat),Number(places[0].lon));
    } catch (_) { message('Impossible de rechercher cette ville actuellement.'); }
  });
})();
