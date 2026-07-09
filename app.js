let stops = [];
let routeStops = [];
let currentResults = [];
let map;
let markersLayer;
let markerById = new Map();

const searchInput = document.getElementById("search");
const resultsEl = document.getElementById("results");
const counterEl = document.getElementById("counter");
const routeListEl = document.getElementById("routeList");
const openRouteBtn = document.getElementById("openRoute");
const clearRouteBtn = document.getElementById("clearRoute");
const networkFilter = document.getElementById("networkFilter");
const cityFilter = document.getElementById("cityFilter");
const statusEl = document.getElementById("status");

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function initMap() {
  map = L.map("map").setView([48.2, -3.2], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

async function loadStops() {
  statusEl.textContent = "Chargement des arrêts...";

  const response = await fetch("data/stops.json");
  stops = await response.json();

  initMap();
  updateLinkedFilters();
  refreshSearch();

  statusEl.textContent = `${stops.length} arrêts chargés`;
}

function fillSelect(select, defaultLabel, values, selectedValue) {
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  select.appendChild(defaultOption);

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (selectedValue && values.includes(selectedValue)) {
    select.value = selectedValue;
  } else {
    select.value = "";
  }
}

function updateLinkedFilters() {
  const selectedNetwork = networkFilter.value;
  const selectedCity = cityFilter.value;

  const availableCities = [...new Set(
    stops
      .filter(stop => !selectedNetwork || stop.reseau === selectedNetwork)
      .map(stop => stop.commune)
      .filter(Boolean)
  )].sort();

  const availableNetworks = [...new Set(
    stops
      .filter(stop => !selectedCity || stop.commune === selectedCity)
      .map(stop => stop.reseau)
      .filter(Boolean)
  )].sort();

  fillSelect(cityFilter, "Toutes les communes", availableCities, selectedCity);
  fillSelect(networkFilter, "Tous les réseaux", availableNetworks, selectedNetwork);
}

function refreshSearch() {
  updateLinkedFilters();

  const query = normalize(searchInput.value.trim());
  const selectedNetwork = networkFilter.value;
  const selectedCity = cityFilter.value;
  const words = query.split(/\s+/).filter(Boolean);

  const matches = stops.filter(stop => {
    if (selectedNetwork && stop.reseau !== selectedNetwork) return false;
    if (selectedCity && stop.commune !== selectedCity) return false;

    if (words.length === 0) {
      return selectedNetwork || selectedCity;
    }

    const haystack = normalize(
      `${stop.nom || ""} ${stop.commune || ""} ${stop.reseau || ""}`
    );

    return words.every(word => haystack.includes(word));
  });

  currentResults = matches.slice(0, 100);

  displayResults(currentResults, matches.length);
  displayMarkers(currentResults);
}

function displayResults(results, total) {
  counterEl.textContent = `${total} résultat(s). ${
    total > results.length ? "Affichage des 100 premiers." : ""
  }`;

  if (results.length === 0) {
    resultsEl.innerHTML = "<p>Aucun arrêt trouvé.</p>";
    markersLayer.clearLayers();
    return;
  }

  resultsEl.innerHTML = results.map((stop, index) => `
    <div class="result">
      <strong>🚏 ${stop.nom || "Arrêt sans nom"}</strong>

      <div class="meta">
        📍 ${stop.commune || "Commune inconnue"}
        ${stop.reseau ? ` — 🚌 ${stop.reseau}` : ""}
      </div>

      <button onclick="zoomToStop(${index})">Voir sur la carte</button>

      <a class="map-link" target="_blank" href="https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}">
        Google Maps
      </a>

      <button onclick="addToRoute(${index})">Ajouter</button>
    </div>
  `).join("");
}

function displayMarkers(results) {
  markersLayer.clearLayers();
  markerById.clear();

  const bounds = [];

  results.forEach(stop => {
    if (!stop.lat || !stop.lon) return;

    const marker = L.marker([stop.lat, stop.lon]);

    marker.bindPopup(`
      <div class="popup-title">🚏 ${stop.nom || "Arrêt sans nom"}</div>
      <div>📍 ${stop.commune || "Commune inconnue"}</div>
      <div>🚌 ${stop.reseau || "Réseau inconnu"}</div>
      <br>
      <a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}">
        Google Maps
      </a>
      <br><br>
      <button onclick="addStopById('${String(stop.id).replace(/'/g, "\\'")}')">
        Ajouter à l’itinéraire
      </button>
    `);

    marker.addTo(markersLayer);
    markerById.set(String(stop.id), marker);
    bounds.push([stop.lat, stop.lon]);
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 16);
  } else if (bounds.length > 1 && results.length <= 100) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

function zoomToStop(index) {
  const stop = currentResults[index];
  if (!stop) return;

  map.setView([stop.lat, stop.lon], 16);

  const marker = markerById.get(String(stop.id));
  if (marker) {
    marker.openPopup();
  }
}

function addToRoute(index) {
  const stop = currentResults[index];
  if (!stop) return;

  addStop(stop);
}

function addStopById(id) {
  const stop = stops.find(s => String(s.id) === String(id));
  if (!stop) return;

  addStop(stop);
}

function addStop(stop) {
  const alreadyAdded = routeStops.some(s => String(s.id) === String(stop.id));

  if (!alreadyAdded) {
    routeStops.push(stop);
    updateRoute();
  }
}

function updateRoute() {
  if (routeStops.length === 0) {
    routeListEl.className = "empty";
    routeListEl.innerHTML = "Aucun arrêt ajouté.";
    openRouteBtn.disabled = true;
    return;
  }

  routeListEl.className = "";

  routeListEl.innerHTML = routeStops.map((stop, index) => `
    <div class="route-item">
      ${index + 1}. <strong>${stop.nom}</strong><br>
      ${stop.commune || ""}
      <br>
      <button class="secondary" onclick="removeFromRoute(${index})">
        Retirer
      </button>
    </div>
  `).join("");

  openRouteBtn.disabled = routeStops.length < 2;
}

function removeFromRoute(index) {
  routeStops.splice(index, 1);
  updateRoute();
}

function openGoogleRoute() {
  if (routeStops.length < 2) return;

  const points = routeStops.map(stop => `${stop.lat},${stop.lon}`);
  const url = `https://www.google.com/maps/dir/${points.join("/")}`;

  window.open(url, "_blank");
}

searchInput.addEventListener("input", refreshSearch);

networkFilter.addEventListener("change", () => {
  refreshSearch();
});

cityFilter.addEventListener("change", () => {
  refreshSearch();
});

openRouteBtn.addEventListener("click", openGoogleRoute);

clearRouteBtn.addEventListener("click", () => {
  routeStops = [];
  updateRoute();
});

loadStops();
