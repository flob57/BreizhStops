let stops = [];
let routeStops = [];

const searchInput = document.getElementById("search");
const resultsEl = document.getElementById("results");
const routeListEl = document.getElementById("routeList");
const openRouteBtn = document.getElementById("openRoute");
const clearRouteBtn = document.getElementById("clearRoute");

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

  resultsEl.innerHTML = `<p>${stops.length} arrêts chargés. Commence à taper pour rechercher.</p>`;
}

function searchStops(query) {
  const q = normalize(query.trim());

  if (q.length < 2) {
    resultsEl.innerHTML = "<p>Entre au moins 2 caractères.</p>";
    return;
  }

  const words = q.split(/\s+/);

  const matches = stops
    .filter(stop => {
      const haystack = normalize(
        `${stop.nom || ""} ${stop.commune || ""} ${stop.reseau || ""}`
      );
      return words.every(word => haystack.includes(word));
    })
    .slice(0, 50);

  displayResults(matches);
}

function displayResults(results) {
  if (results.length === 0) {
    resultsEl.innerHTML = "<p>Aucun arrêt trouvé.</p>";
    return;
  }

  resultsEl.innerHTML = results.map((stop, index) => `
    <div class="result">
      <strong>${stop.nom || "Arrêt sans nom"}</strong>
      <div class="meta">
        📍 ${stop.commune || "Commune inconnue"}
        ${stop.reseau ? ` — 🚌 ${stop.reseau}` : ""}
      </div>

      <a class="map-link" target="_blank" href="https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}">
        Google Maps
      </a>

      <button onclick="addToRoute(${index})" data-stop-id="${stop.id}">
        Ajouter
      </button>
    </div>
  `).join("");

  window.currentResults = results;
}

function addToRoute(index) {
  const stop = window.currentResults[index];

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

searchInput.addEventListener("input", () => {
  searchStops(searchInput.value);
});

openRouteBtn.addEventListener("click", openGoogleRoute);

clearRouteBtn.addEventListener("click", () => {
  routeStops = [];
  updateRoute();
});

loadStops();
