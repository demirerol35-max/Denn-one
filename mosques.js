/* Deen One — nearby mosques, OpenStreetMap data. Opening the dedicated section initiates a GPS request. */
(() => {
  // Set to the deployed HTTPS Cloudflare Worker URL; empty keeps OpenStreetMap only.
  const GOOGLE_PLACES_ENDPOINT = '';
  const DIRECTORY_URL = './data/mosques.json';
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
  const cache = new Map();
  let directoryPromise = null;
  function directory() {
    if (!directoryPromise) directoryPromise = fetch(DIRECTORY_URL).then(r => {
      if (!r.ok) throw Error('Directory unavailable'); return r.json();
    }).then(v => Array.isArray(v.places) ? v.places : []).catch(() => []);
    return directoryPromise;
  }
  function asElements(places) {
    return places.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.name)
      .map(p => ({lat:p.lat,lon:p.lon,tags:{name:p.name,'addr:full':p.address||''}}));
  }
  function mergeData(data, curated) {
    return {elements:[...asElements(curated),...(data.elements||[])]};
  }
  try {
    const stored=JSON.parse(localStorage.getItem('deen-mosques-cache-v1')||'[]');
    for(const entry of stored) if(entry && entry.key && entry.data && Date.now()-entry.at<7*86400000) cache.set(entry.key,{at:entry.at,data:entry.data});
  } catch (_) {}
  let lastSuccessful = null;
  const addressCache = new Map();

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
  function showPlaces(data, lat, lon, source = 'osm') {
    results.replaceChildren();
    const unique = new Map();
    for (const item of (source === 'google' ? (data.places || []).map(p => ({lat:p.lat,lon:p.lon,tags:{name:p.name,'addr:full':p.address}})) : data.elements || [])) {
      const pLat = item.lat ?? item.center?.lat, pLon = item.lon ?? item.center?.lon;
      if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) continue;
      const tags = item.tags || {};
      const name = tags['name:fr'] || tags.name || tags['name:tr'] || tags['official_name'] || tags['operator'] || 'Mosquée';
      const distance = distanceKm(lat, lon, pLat, pLon);
      if (distance > Number(radius.value)/1000) continue;
      const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
      const key = normalized + ':' + Math.round(pLat*1000) + ':' + Math.round(pLon*1000);
      const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
      const town = [tags['addr:postcode'], tags['addr:city'] || tags['addr:town'] || tags['addr:village']].filter(Boolean).join(' ');
      const address = [street, town].filter(Boolean).join(', ') ||
        tags['addr:full'] || tags['contact:street'] || tags['contact:address'] || '';
      if (!unique.has(key) || (address && !unique.get(key).address))
        unique.set(key, {name, distance, lat:pLat, lon:pLon, address});
    }
    const places = [...unique.values()].sort((a,b)=>a.distance-b.distance).slice(0,30);
    if (!places.length) { message('Aucune mosquée trouvée dans ce rayon. Essaie un rayon plus grand.'); return; }
    if(source === 'osm') lastSuccessful = {data, lat, lon, at:Date.now()};
    message(places.length + ' mosquée(s) trouvée(s). ' + (source === 'google' ? 'Données Google Places — Google Maps.' : 'Données OpenStreetMap, à vérifier avant de te déplacer.'));
    for (const place of places) {
      const article = document.createElement('a');
      article.className = 'card';
      article.href = directionsUrl(place.lat,place.lon);
      article.target = '_blank';
      article.rel = 'noopener noreferrer';
      article.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:10px;text-decoration:none;color:inherit';
      const symbol=document.createElement('span');symbol.textContent='🕌';symbol.style.fontSize='24px';
      const info=document.createElement('div');info.style.flex='1';
      const heading = document.createElement('strong');
      heading.textContent = place.name;
      const details = document.createElement('p');
      details.className = 'note';
      details.textContent = place.address || 'Adresse à rechercher…';
      // Avoid dozens of reverse-geocoding requests on every search.

      info.append(heading,details);
      const distanceLabel=document.createElement('span');distanceLabel.textContent=place.distance.toFixed(1)+' km ↗';
      distanceLabel.style.whiteSpace='nowrap';
      article.append(symbol,info,distanceLabel);
      results.append(article);
    }
  }
  // Nominatim public API: conservative, sequential reverse lookup (max 1 req/sec).
  // A nearby road address is not necessarily the mosque's postal address:
  // display it as an approximate location rather than claiming certainty.
  const reverseQueue = [];
  let reverseRunning = false;
  async function enrichAddress(place, node) {
    const key = place.lat.toFixed(5)+','+place.lon.toFixed(5);
    if (addressCache.has(key)) {
      node.textContent = addressCache.get(key);
      return;
    }
    if (reverseQueue.length >= 8) { node.textContent='Adresse non disponible — voir Google Maps'; return; }
    reverseQueue.push({place,node,key});
    if (reverseRunning) return;
    reverseRunning = true;
    while (reverseQueue.length) {
      const item = reverseQueue.shift();
      if (!item.node.isConnected) continue;
      try {
        const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat='+
          encodeURIComponent(item.place.lat)+'&lon='+encodeURIComponent(item.place.lon);
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const a = data.address || {};
          const street = [a.house_number,a.road||a.pedestrian||a.footway].filter(Boolean).join(' ');
          const town = [a.postcode,a.city||a.town||a.village||a.municipality].filter(Boolean).join(' ');
          const address = [street,town].filter(Boolean).join(', ');
          if (address) {
            const label='Adresse approximative : '+address;
            addressCache.set(item.key,label);
            if(item.node.isConnected) item.node.textContent=label;
          } else if(item.node.isConnected) item.node.textContent='Adresse non disponible — voir Google Maps';
        } else if(item.node.isConnected) item.node.textContent='Adresse non disponible — voir Google Maps';
      } catch (_) {
        if(item.node.isConnected) item.node.textContent='Adresse non disponible — voir Google Maps';
      }
      if (reverseQueue.length) await new Promise(resolve=>setTimeout(resolve,1200));
    }
    reverseRunning = false;
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
    if (lastSuccessful && distanceKm(lat,lon,lastSuccessful.lat,lastSuccessful.lon)>2) lastSuccessful=null;
    if (!lastSuccessful) results.replaceChildren();
    const cacheKey=[lat.toFixed(2),lon.toFixed(2),radius.value].join(':');
    const saved=cache.get(cacheKey);
    const curated = await directory();
    if (activeController !== controller) return;
    const curatedNearby = curated.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && distanceKm(lat,lon,p.lat,p.lon)<=Number(radius.value)/1000);
    if(curatedNearby.length){showPlaces(mergeData({elements:[]},curatedNearby),lat,lon);message('Annuaire Deen One disponible. Recherche OpenStreetMap en cours…');}
    if(GOOGLE_PLACES_ENDPOINT && curatedNearby.length < 5){
      try {
        let client=localStorage.getItem('deen-mosques-client-id');
        if(!client){client='anon_'+Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem('deen-mosques-client-id',client);}
        const response=await fetch(GOOGLE_PLACES_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({lat,lon,radius:Number(radius.value),client}),signal:controller.signal});
        if(response.ok){const data=await response.json();
          if(activeController!==controller)return;
          if(Array.isArray(data.places)&&data.places.length){showPlaces(data,lat,lon,'google');activeController=null;return;}
        }
      }catch(_){if(controller.signal.aborted)return;}
      // Quota exceeded, empty response, or provider offline: use OSM below.
    }
    if(saved && Date.now()-saved.at<30*60*1000){showPlaces(mergeData(saved.data,curatedNearby),lat,lon);activeController=null;return;}
    if(!saved){for(const [key,v] of cache){if(key.startsWith(lat.toFixed(2)+':'+lon.toFixed(2)+':') && v.data && Date.now()-v.at<7*86400000){showPlaces(mergeData(v.data,curatedNearby),lat,lon);message('Dernière liste disponible. Actualisation en cours…');break;}}}
    if(saved) {showPlaces(mergeData(saved.data,curatedNearby),lat,lon);message('Dernière liste disponible. Actualisation en cours…');}
    message(lastSuccessful ? 'Actualisation des mosquées en cours…' : 'Recherche des mosquées à proximité…');
    const around='(around:'+Number(radius.value)+','+lat+','+lon+')';
    const query = '[out:json][timeout:12];(nwr["amenity"="place_of_worship"]["religion"="muslim"]'+around+';nwr["building"="mosque"]'+around+');out center;';
    try {
      let data = null;
      const endpoints = [
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass-api.de/api/interpreter',
        'https://overpass.private.coffee/api/interpreter'
      ];
      // Query the independent endpoints concurrently; return the first valid
      // result rather than waiting 8.5 seconds for each server in sequence.
      const requests = endpoints.map(async endpoint => {
        const attempt = new AbortController();
        const abort = () => attempt.abort();
        controller.signal.addEventListener('abort',abort,{once:true});
        const timeout = setTimeout(()=>attempt.abort(),9000);
        try {
          const response = await fetch(endpoint+'?data='+encodeURIComponent(query),{
            signal:attempt.signal,headers:{Accept:'application/json'}
          });
          if(!response.ok) throw new Error('HTTP '+response.status);
          const candidate=await response.json();
          if(!Array.isArray(candidate.elements)) throw new Error('Invalid response');
          return candidate;
        } finally {
          clearTimeout(timeout);
          controller.signal.removeEventListener('abort',abort);
        }
      });
      try { data = await Promise.any(requests); } catch (_) { data = null; }
      if (!data) {
        const simple='[out:json][timeout:15];nwr["amenity"="place_of_worship"]["religion"="muslim"]'+around+';out center;';
        const attempts=endpoints.map(async endpoint=>{
          const c=new AbortController();
          const timer=setTimeout(()=>c.abort(),8000);
          try {
            const response=await fetch(endpoint+'?data='+encodeURIComponent(simple),{signal:c.signal});
            if(!response.ok) throw new Error('HTTP '+response.status);
            const value=await response.json();
            if(!Array.isArray(value.elements)) throw new Error('Invalid response');
            return value;
          } finally {clearTimeout(timer);}
        });
        try {data=await Promise.any(attempts);} catch (_) {}
      }
      if (!data) throw new Error('Aucun serveur disponible');
      if (activeController === controller) {cache.set(cacheKey,{at:Date.now(),data});
        try { localStorage.setItem('deen-mosques-cache-v1',JSON.stringify([...cache].slice(-12).map(([key,v])=>({key,at:v.at,data:v.data})))); } catch (_) {}
        showPlaces(mergeData(data,curatedNearby),lat,lon);}
    } catch (error) {
      if (activeController === controller)
        { message((lastSuccessful || saved) ? 'Service temporairement indisponible : dernière liste conservée.' : 'La liste est indisponible pour le moment. Tu peux réessayer.'); if (!lastSuccessful && !saved) { const link=document.createElement('a'); link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('mosquée près de '+lat+','+lon);link.target='_blank';link.rel='noopener noreferrer';link.textContent='🕌 Voir les mosquées sur Google Maps ↗';results.replaceChildren(link); } }
    } finally {
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
  // Simple contribution flow without GitHub login. No backend is available yet:
  // open the user's mail app; never claim a suggestion was submitted automatically.
  const suggestLink=root.querySelector('#mosque-suggest-link');
  const suggestName=root.querySelector('#mosque-suggest-name');
  const suggestAddress=root.querySelector('#mosque-suggest-address');
  const suggestStatus=root.querySelector('#mosque-suggest-status');
  const suggestLocation=root.querySelector('#mosque-suggest-location');
  const suggestSubmit=root.querySelector('#mosque-suggest-submit');
  if(suggestLocation && suggestLink){
    suggestLocation.addEventListener('click',()=>{
      if(!navigator.geolocation){suggestStatus.textContent='GPS indisponible.';return;}
      suggestStatus.textContent='Recherche de ta position…';
      navigator.geolocation.getCurrentPosition(p=>{
        suggestLink.value=p.coords.latitude.toFixed(6)+', '+p.coords.longitude.toFixed(6);
        suggestStatus.textContent='Position ajoutée. Vérifie que la mosquée se trouve bien à cet emplacement.';
      },()=>{suggestStatus.textContent='Localisation refusée ou indisponible. Colle un lien Maps ou une adresse.';},
      {enableHighAccuracy:true,timeout:12000});
    });
    suggestSubmit.addEventListener('click',async()=>{
      const name=suggestName.value.trim(),link=suggestLink.value.trim(),address=suggestAddress.value.trim();
      if(name.length<3 || (!link && !address)){
        suggestStatus.textContent='Indique le nom de la mosquée et au moins un emplacement ou une adresse.';return;
      }
      if(window.deenCloud?.suggest){
        suggestStatus.textContent='Envoi de la proposition…';
        try{const submitted=await window.deenCloud.suggest(name,link||address,address);
          if(submitted.ok){suggestStatus.textContent='Proposition reçue ! Elle sera examinée avant publication.';suggestLink.value='';suggestName.value='';suggestAddress.value='';return;}
          suggestStatus.textContent=submitted.error||'Envoi impossible.';
        }catch(_){suggestStatus.textContent='Envoi impossible pour le moment.';}
        return;
      }
      const body=['Proposition de mosquée pour Deen One','','Nom : '+name,
        'Emplacement / lien : '+(link||'Non fourni'),'Adresse / ville : '+(address||'Non fournie'),
        '','Merci de vérifier les informations avant publication.'].join('\\n');
      const url='mailto:?subject='+encodeURIComponent('Deen One - proposition de mosquée')+
        '&body='+encodeURIComponent(body);
      suggestStatus.textContent='Ton application e-mail va s’ouvrir. Il faudra choisir un destinataire et confirmer l’envoi. La réception directe par Deen One nécessite encore un service de collecte.';
      window.location.href=url;
    });
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
