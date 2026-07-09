let stops = [];
let routeStops = [];
let currentResults = [];

const searchInput = document.getElementById("search");
const resultsEl = document.getElementById("results");
const counterEl = document.getElementById("counter");
const routeListEl = document.getElementById("routeList");
const openRouteBtn = document.getElementById("openRoute");
const clearRouteBtn = document.getElementById("clearRoute");
const networkFilter = document.getElementById("networkFilter");
const cityFilter = document.getElementById("cityFilter");

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function loadStops() {
  resultsEl.innerHTML = "<p>Chargement des arrêts...</p>";

  const response = await fetch("data/stops.json");
  stops = await response.json();

  populateFilters();

  resultsEl.innerHTML = `<p>${stops.length} arrêts chargés. Commence à taper pour rechercher.</p>`;
}

function populateFilters() {
  const networks = [...new Set(stops.map(s => s.reseau).filter(Boolean))].sort();
  const cities = [...new Set(stops.map(s => s.commune).filter(Boolean))].sort();

  networks.forEach(network => {
    const option = document.createElement("option");
    option.value = network;
    option.textContent = network;
    networkFilter.appendChild(option);
  });

  cities.forEach(city => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    cityFilter.appendChild(option);
  });
}

function refreshSearch() {
  const query = normalize(searchInput.value.trim());
  const selectedNetwork = networkFilter.value;
  const selectedCity = cityFilter.value;

  const words = query.split(/\s+/).filter(Boolean);

  let matches = stops.filter(stop => {
    if (selectedNetwork && stop.reseau !== selectedNetwork) return false;
    if (selectedCity && stop.commune !== selectedCity) return false;

    if (words.length === 0) return selectedNetwork || selectedCity;

    const haystack = normalize(
      `${stop.nom || ""} ${stop.commune || ""} ${stop.reseau || ""}`
    );

    return words.every(word => haystack.includes(word));
  });

  currentResults = matches.slice(0, 80);
  displayResults(currentResults, matches.length);
}

function displayResults(results, total) {
  counterEl.textContent = `${total} résultat(s) trouvé(s). ${total > results.length ? "Affichage des 80 premiers." : ""}`;

  if (results.length === 0) {
    resultsEl.innerHTML = "<p>Aucun arrêt trouvé.</p>";
    return;
  }

  resultsEl.innerHTML = results.map((stop, index) => `
    <div class="result">
      <strong>🚏 ${stop.nom || "Arrêt sans nom"}</strong>

      <div class="meta">
        📍 ${stop.commune || "Commune inconnue"}
        ${stop.reseau ? ` — 🚌 ${stop.reseau}` : ""}
      </div>

      <a class="map-link" target="_blank" href="https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}">
        Google Maps
      </a>

      <button onclick="addToRoute(${index})">
        Ajouter à l’itinéraire
      </button>
    </div>
  `).join("");
}

function addToRoute(index) {
  const stop = currentResults[index];
  if (!stop) return;

  const alreadyAdded = routeStops.some(s => s.id === stop.id);

  if (!alreadyAdded) {
    routeStops.push(stop);
    updateRoute();
  }
}

function updateRoute() {
  if (routeStops.length === 0) {
    routeListEl.className = "route-list empty";
    routeListEl.innerHTML = "Aucun arrêt ajouté.";
    openRouteBtn.disabled = true;
    return;
  }

  routeListEl.className = "route-list";
  routeListEl.innerHTML = routeStops.map((stop, index) => `
    <div class="route-item">
      ${index + 1}. <strong>${stop.nom}</strong><br>
      ${stop.commune || ""}
      <br>
      <button class="secondary" onclick="removeFromRoute(${index})">Retirer</button>
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
networkFilter.addEventListener("change", refreshSearch);
cityFilter.addEventListener("change", refreshSearch);

openRouteBtn.addEventListener("click", openGoogleRoute);

clearRouteBtn.addEventListener("click", () => {
  routeStops = [];
  updateRoute();
});

loadStops();
