/* Deen One — nearby mosques, OpenStreetMap data. Opening the dedicated section initiates a GPS request. */
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
  let lastPosition = null;
  let lastSearchAt = 0;
  let gpsPending = false;

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
  function directionsUrl(lat, lon) {
    return 'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(lat + ',' + lon);
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
      link.textContent = 'Voir sur la carte ↗';
      const directions = document.createElement('a');
      directions.href = directionsUrl(place.lat, place.lon);
      directions.target = '_blank';
      directions.rel = 'noopener noreferrer';
      directions.textContent = 'Itinéraire ↗';
      directions.style.marginLeft = '16px';
      article.append(heading, details, link, directions);
      results.append(article);
    }
  }
  async function search(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      message('Coordonnées invalides. Choisis une ville ou réessaie le GPS.'); return;
    }
    lastPosition = {lat, lon};
    lastSearchAt = Date.now();
    if (activeController) activeController.abort();
    const controller = new AbortController();
    activeController = controller;
    results.replaceChildren();
    message('Recherche des mosquées à proximité…');
    const timeout = setTimeout(() => controller.abort(), 18000);
    const query = '[out:json][timeout:12];(nwr["amenity"="place_of_worship"]["religion"="muslim"](around:' +
      Number(radius.value) + ',' + lat + ',' + lon + ');nwr["building"="mosque"](around:' +
      Number(radius.value) + ',' + lat + ',' + lon + '););out center;';
    try {
      let data = null;
      for (const endpoint of ['https://overpass.kumi.systems/api/interpreter', 'https://overpass.nchc.org.tw/api/interpreter', 'https://overpass-api.de/api/interpreter']) {
        try {
          const response = await fetch(endpoint, {
            method:'POST', body:new URLSearchParams({data:query}), signal:controller.signal
          });
          if (!response.ok) continue;
          data = await response.json();
          break;
        } catch (error) {
          if (controller.signal.aborted) throw error;
        }
      }
      if (!data) throw new Error('Aucun serveur disponible');
      if (activeController === controller) showPlaces(data,lat,lon);
    } catch (error) {
      if (activeController === controller)
        message('Le service cartographique ne répond pas. Réessaie ou utilise la recherche par ville.');
    } finally {
      clearTimeout(timeout);
      if (activeController === controller) activeController = null;
    }
  }
  function locate() {
    if (gpsPending) return;
    if (!navigator.geolocation) {
      message('GPS non disponible. Utilise la recherche par ville.');
      return;
    }
    gpsPending = true;
    message('Recherche automatique des mosquées : localisation en cours…');
    navigator.geolocation.getCurrentPosition(
      p => { gpsPending = false; search(p.coords.latitude, p.coords.longitude); },
      () => { gpsPending = false; message('Localisation indisponible ou refusée. Saisis une ville ci-dessus.'); },
      {enableHighAccuracy:false, timeout:12000, maximumAge:60000}
    );
  }
  gps.addEventListener('click', locate);
  radius.addEventListener('change', () => { if (lastPosition) search(lastPosition.lat, lastPosition.lon); });
  // The page is a single-page app. Observe its hidden state rather than
  // relying on document load or the browser hash to detect navigation.
  const observer = new MutationObserver(() => {
    if (root.hidden) return;
    if (!lastPosition || Date.now() - lastSearchAt > 5 * 60 * 1000) locate();
  });
  observer.observe(root, {attributes:true, attributeFilter:['hidden']});
  if (!root.hidden) locate();
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
