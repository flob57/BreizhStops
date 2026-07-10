let stops = [];
let routeStops = [];
let currentResults = [];

let selectedStartStop = null;
let currentPosition = null;

let map;
let markersLayer;
let markerById = new Map();

const searchInput = document.getElementById("search");
const resultsEl = document.getElementById("results");
const counterEl = document.getElementById("counter");

const routeListEl = document.getElementById("routeList");
const openRouteBtn = document.getElementById("openRoute");
const openInRouteBtn = document.getElementById("openInRoute");
const exportGpxBtn = document.getElementById("exportGpx");
const optimizeRouteBtn = document.getElementById("optimizeRoute");
const clearRouteBtn = document.getElementById("clearRoute");

const networkFilter = document.getElementById("networkFilter");
const cityFilter = document.getElementById("cityFilter");
const statusEl = document.getElementById("status");

const startStopArea = document.getElementById("startStopArea");
const startStopSearch = document.getElementById("startStopSearch");
const startStopResults = document.getElementById("startStopResults");
const selectedStartStopEl = document.getElementById("selectedStartStop");
const locationStatus = document.getElementById("locationStatus");

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDepartureMode() {
  return document.querySelector(
    'input[name="departureMode"]:checked'
  ).value;
}

function initMap() {
  map = L.map("map").setView([48.2, -3.2], 8);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }
  ).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

async function loadStops() {
  try {
    statusEl.textContent = "Chargement des arrêts...";

    const response = await fetch("./data/stops.json", {
  cache: "no-store"
});

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }

    stops = await response.json();

    initMap();
    LinkedFilters();
    refreshSearch();
    updateRoute();

    statusEl.textContent = `${stops.length} arrêts chargés`;
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Erreur de chargement";
    resultsEl.innerHTML =
      "<p>Impossible de charger les arrêts.</p>";
  }
}

function fillSelect(
  select,
  defaultLabel,
  values,
  selectedValue
) {
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
      .filter(stop =>
        !selectedNetwork ||
        stop.reseau === selectedNetwork
      )
      .map(stop => stop.commune)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "fr"));

  const availableNetworks = [...new Set(
    stops
      .filter(stop =>
        !selectedCity ||
        stop.commune === selectedCity
      )
      .map(stop => stop.reseau)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "fr"));

  fillSelect(
    cityFilter,
    "Toutes les communes",
    availableCities,
    selectedCity
  );

  fillSelect(
    networkFilter,
    "Tous les réseaux",
    availableNetworks,
    selectedNetwork
  );
}

function refreshSearch() {
  updateLinkedFilters();

  const query = normalize(searchInput.value.trim());
  const selectedNetwork = networkFilter.value;
  const selectedCity = cityFilter.value;
  const words = query.split(/\s+/).filter(Boolean);

  const matches = stops.filter(stop => {
    if (
      selectedNetwork &&
      stop.reseau !== selectedNetwork
    ) {
      return false;
    }

    if (
      selectedCity &&
      stop.commune !== selectedCity
    ) {
      return false;
    }

    if (words.length === 0) {
      return Boolean(selectedNetwork || selectedCity);
    }

    const haystack = normalize(
      `${stop.nom || ""} ` +
      `${stop.commune || ""} ` +
      `${stop.reseau || ""}`
    );

    return words.every(word =>
      haystack.includes(word)
    );
  });

  currentResults = matches.slice(0, 100);

  displayResults(currentResults, matches.length);
  displayMarkers(currentResults);
}

function displayResults(results, total) {
  counterEl.textContent =
    `${total} résultat(s). ` +
    `${total > results.length
      ? "Affichage des 100 premiers."
      : ""}`;

  if (results.length === 0) {
    resultsEl.innerHTML =
      "<p>Aucun arrêt trouvé.</p>";

    markersLayer.clearLayers();
    return;
  }

  resultsEl.innerHTML = results.map(
    (stop, index) => `
      <div class="result">

        <strong>
          🚏 ${escapeHtml(
            stop.nom || "Arrêt sans nom"
          )}
        </strong>

        <div class="meta">
          📍 ${escapeHtml(
            stop.commune || "Commune inconnue"
          )}

          ${stop.reseau
            ? ` — 🚌 ${escapeHtml(stop.reseau)}`
            : ""}
        </div>

        <button onclick="zoomToStop(${index})">
          Voir sur la carte
        </button>

        <a
          class="map-link"
          target="_blank"
          rel="noopener"
          href="https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}"
        >
          Google Maps
        </a>

        <button onclick="addToRoute(${index})">
          Ajouter
        </button>

      </div>
    `
  ).join("");
}

function displayMarkers(results) {
  markersLayer.clearLayers();
  markerById.clear();

  const bounds = [];

  results.forEach(stop => {
    if (
      !Number.isFinite(Number(stop.lat)) ||
      !Number.isFinite(Number(stop.lon))
    ) {
      return;
    }

    const marker = L.marker([
      Number(stop.lat),
      Number(stop.lon)
    ]);

    marker.bindPopup(`
      <div class="popup-title">
        🚏 ${escapeHtml(
          stop.nom || "Arrêt sans nom"
        )}
      </div>

      <div>
        📍 ${escapeHtml(
          stop.commune || "Commune inconnue"
        )}
      </div>

      <div>
        🚌 ${escapeHtml(
          stop.reseau || "Réseau inconnu"
        )}
      </div>

      <br>

      <a
        target="_blank"
        rel="noopener"
        href="https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}"
      >
        Google Maps
      </a>

      <br><br>

      <button
        onclick="addStopById('${String(stop.id)
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")}')"
      >
        Ajouter à l’itinéraire
      </button>
    `);

    marker.addTo(markersLayer);

    markerById.set(
      String(stop.id),
      marker
    );

    bounds.push([
      Number(stop.lat),
      Number(stop.lon)
    ]);
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 16);
  } else if (
    bounds.length > 1 &&
    results.length <= 100
  ) {
    map.fitBounds(bounds, {
      padding: [40, 40]
    });
  }
}

function zoomToStop(index) {
  const stop = currentResults[index];

  if (!stop) return;

  map.setView(
    [Number(stop.lat), Number(stop.lon)],
    16
  );

  const marker = markerById.get(
    String(stop.id)
  );

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
  const stop = stops.find(
    item => String(item.id) === String(id)
  );

  if (!stop) return;

  addStop(stop);
}

function addStop(stop) {
  const alreadyAdded = routeStops.some(
    item =>
      String(item.id) === String(stop.id)
  );

  if (!alreadyAdded) {
    routeStops.push(stop);
    updateRoute();
  }
}

function removeFromRoute(index) {
  routeStops.splice(index, 1);
  updateRoute();
}

function moveRouteStop(index, direction) {
  const targetIndex = index + direction;

  if (
    targetIndex < 0 ||
    targetIndex >= routeStops.length
  ) {
    return;
  }

  const temporary = routeStops[index];
  routeStops[index] = routeStops[targetIndex];
  routeStops[targetIndex] = temporary;

  updateRoute();
}

function updateRoute() {
  if (routeStops.length === 0) {
    routeListEl.className = "empty";
    routeListEl.innerHTML =
      "Aucun arrêt ajouté.";
  } else {
    routeListEl.className = "";

    routeListEl.innerHTML = routeStops.map(
      (stop, index) => `
        <div class="route-item">

          ${index + 1}.
          <strong>
            ${escapeHtml(stop.nom)}
          </strong>

          <br>

          ${escapeHtml(stop.commune || "")}

          <div class="route-item-buttons">

            <button
              onclick="moveRouteStop(${index}, -1)"
              ${index === 0 ? "disabled" : ""}
              title="Monter"
            >
              ↑
            </button>

            <button
              onclick="moveRouteStop(${index}, 1)"
              ${index === routeStops.length - 1
                ? "disabled"
                : ""}
              title="Descendre"
            >
              ↓
            </button>

            <button
              class="secondary"
              onclick="removeFromRoute(${index})"
            >
              Retirer
            </button>

          </div>

        </div>
      `
    ).join("");
  }

  const enoughStops = routeStops.length >= 2;

  optimizeRouteBtn.disabled = !enoughStops;
  openRouteBtn.disabled = !enoughStops;
  openInRouteBtn.disabled = !enoughStops;
  exportGpxBtn.disabled = !enoughStops;
}

function handleDepartureModeChange() {
  const mode = getDepartureMode();

  if (mode === "stop") {
    startStopArea.classList.remove("hidden");

    locationStatus.textContent =
      "Choisis l’arrêt qui doit rester en première position.";
  } else {
    startStopArea.classList.add("hidden");
    startStopResults.innerHTML = "";

    if (mode === "current") {
      locationStatus.textContent =
        "La position sera demandée lors de la création de l’itinéraire.";
    }

    if (mode === "automatic") {
      locationStatus.textContent =
        "L’ordre complet, y compris le premier arrêt, sera optimisé.";
    }
  }
}

function searchStartStops() {
  const query = normalize(
    startStopSearch.value.trim()
  );

  if (query.length < 2) {
    startStopResults.innerHTML = "";
    return;
  }

  const words = query.split(/\s+/);

  const matches = stops
    .filter(stop => {
      const haystack = normalize(
        `${stop.nom || ""} ` +
        `${stop.commune || ""} ` +
        `${stop.reseau || ""}`
      );

      return words.every(word =>
        haystack.includes(word)
      );
    })
    .slice(0, 8);

  startStopResults.innerHTML = matches.map(
    stop => `
      <div
        class="start-result"
        onclick="selectStartStop('${String(stop.id)
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")}')"
      >
        <strong>
          ${escapeHtml(stop.nom)}
        </strong>

        <br>

        ${escapeHtml(stop.commune || "")}

        ${stop.reseau
          ? ` — ${escapeHtml(stop.reseau)}`
          : ""}
      </div>
    `
  ).join("");
}

function selectStartStop(id) {
  const stop = stops.find(
    item => String(item.id) === String(id)
  );

  if (!stop) return;

  selectedStartStop = stop;

  selectedStartStopEl.innerHTML = `
    <div class="selected-start">

      <strong>Départ sélectionné :</strong>

      <br>

      🚏 ${escapeHtml(stop.nom)}

      <br>

      📍 ${escapeHtml(stop.commune || "")}

      <br><br>

      <button
        class="secondary"
        onclick="clearSelectedStartStop()"
      >
        Modifier
      </button>

    </div>
  `;

  startStopResults.innerHTML = "";
  startStopSearch.value = "";
}

function clearSelectedStartStop() {
  selectedStartStop = null;
  selectedStartStopEl.innerHTML = "";
  startStopSearch.focus();
}

function distanceKm(pointA, pointB) {
  const earthRadius = 6371;

  const lat1 = Number(pointA.lat) * Math.PI / 180;
  const lat2 = Number(pointB.lat) * Math.PI / 180;

  const deltaLat =
    (Number(pointB.lat) - Number(pointA.lat)) *
    Math.PI / 180;

  const deltaLon =
    (Number(pointB.lon) - Number(pointA.lon)) *
    Math.PI / 180;

  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(deltaLon / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(value),
      Math.sqrt(1 - value)
    )
  );
}

function routeDistance(points) {
  let total = 0;

  for (let index = 0; index < points.length - 1; index++) {
    total += distanceKm(
      points[index],
      points[index + 1]
    );
  }

  return total;
}

function nearestNeighbour(start, points) {
  const remaining = [...points];
  const ordered = [];
  let current = start;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    remaining.forEach((point, index) => {
      const distance = distanceKm(
        current,
        point
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const next = remaining.splice(
      nearestIndex,
      1
    )[0];

    ordered.push(next);
    current = next;
  }

  return ordered;
}

function improveWithTwoOpt(points) {
  if (points.length < 4) {
    return points;
  }

  let improved = [...points];
  let changed = true;
  let passes = 0;

  while (changed && passes < 20) {
    changed = false;
    passes += 1;

    for (
      let start = 1;
      start < improved.length - 2;
      start++
    ) {
      for (
        let end = start + 1;
        end < improved.length - 1;
        end++
      ) {
        const candidate = [
          ...improved.slice(0, start),
          ...improved
            .slice(start, end + 1)
            .reverse(),
          ...improved.slice(end + 1)
        ];

        if (
          routeDistance(candidate) <
          routeDistance(improved)
        ) {
          improved = candidate;
          changed = true;
        }
      }
    }
  }

  return improved;
}

function optimizeWithFixedStart(start, points) {
  const withoutStart = points.filter(
    point =>
      !point.id ||
      String(point.id) !== String(start.id)
  );

  const ordered = nearestNeighbour(
    start,
    withoutStart
  );

  return improveWithTwoOpt([
    start,
    ...ordered
  ]);
}

function optimizeWithoutFixedStart(points) {
  if (points.length < 2) {
    return [...points];
  }

  let bestRoute = null;
  let bestDistance = Infinity;

  points.forEach(candidateStart => {
    const remaining = points.filter(
      point =>
        String(point.id) !==
        String(candidateStart.id)
    );

    const candidate = improveWithTwoOpt([
      candidateStart,
      ...nearestNeighbour(
        candidateStart,
        remaining
      )
    ]);

    const distance = routeDistance(candidate);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestRoute = candidate;
    }
  });

  return bestRoute || [...points];
}

async function getCurrentPositionPoint() {
  if (currentPosition) {
    return currentPosition;
  }

  if (!navigator.geolocation) {
    throw new Error(
      "La géolocalisation n’est pas disponible sur cet appareil."
    );
  }

  locationStatus.textContent =
    "Recherche de la position actuelle...";

  const position = await new Promise(
    (resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    }
  );

  currentPosition = {
    id: "__current_position__",
    nom: "Ma position actuelle",
    commune: "",
    reseau: "",
    lat: position.coords.latitude,
    lon: position.coords.longitude
  };

  locationStatus.textContent =
    `Position détectée : ` +
    `${currentPosition.lat.toFixed(5)}, ` +
    `${currentPosition.lon.toFixed(5)}`;

  return currentPosition;
}

async function buildOrderedRoute(optimize = true) {
  if (routeStops.length < 2) {
    throw new Error(
      "Ajoute au moins deux arrêts."
    );
  }

  const mode = getDepartureMode();

  if (mode === "current") {
    const start = await getCurrentPositionPoint();

    if (!optimize) {
      return [start, ...routeStops];
    }

    return optimizeWithFixedStart(
      start,
      routeStops
    );
  }

  if (mode === "stop") {
    if (!selectedStartStop) {
      throw new Error(
        "Choisis d’abord l’arrêt de départ."
      );
    }

    if (!optimize) {
      const remaining = routeStops.filter(
        stop =>
          String(stop.id) !==
          String(selectedStartStop.id)
      );

      return [
        selectedStartStop,
        ...remaining
      ];
    }

    return optimizeWithFixedStart(
      selectedStartStop,
      routeStops
    );
  }

  if (optimize) {
    return optimizeWithoutFixedStart(
      routeStops
    );
  }

  return [...routeStops];
}

async function optimizeRoute() {
  try {
    const ordered = await buildOrderedRoute(true);

    const mode = getDepartureMode();

    routeStops = ordered.filter(
      point =>
        point.id !== "__current_position__" &&
        (
          mode !== "stop" ||
          String(point.id) !==
          String(selectedStartStop?.id)
        )
    );

    updateRoute();

    alert(
      "L’ordre des étapes a été optimisé."
    );
  } catch (error) {
    alert(error.message);
  }
}

async function openGoogleRoute() {
  try {
    const points = await buildOrderedRoute(true);

    const origin = points[0];
    const destination =
      points[points.length - 1];

    const waypoints = points.slice(1, -1);

    const parameters = new URLSearchParams({
      api: "1",
      origin: `${origin.lat},${origin.lon}`,
      destination:
        `${destination.lat},${destination.lon}`,
      travelmode: "driving"
    });

    if (waypoints.length > 0) {
      parameters.set(
        "waypoints",
        waypoints
          .map(point =>
            `${point.lat},${point.lon}`
          )
          .join("|")
      );
    }

    window.open(
      `https://www.google.com/maps/dir/?${parameters.toString()}`,
      "_blank",
      "noopener"
    );
  } catch (error) {
    alert(error.message);
  }
}

async function openInRoute() {
  try {
    const mode = getDepartureMode();

    const points = await buildOrderedRoute(
      mode !== "automatic"
    );

    const locations = points.map(point => {
      const name = encodeURIComponent(
        point.nom || "Étape"
      );

      return (
        `loc=${name}/` +
        `${Number(point.lat)}/` +
        `${Number(point.lon)}`
      );
    });

    const action =
      mode === "automatic"
        ? "action=opt&"
        : "";

    const url =
      `inroute://coordinates?` +
      action +
      locations.join("&");

    window.location.href = url;
  } catch (error) {
    alert(error.message);
  }
}

function escapeXml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createGpx(points) {
  const routePoints = points.map((point, index) => {
    const name = point.nom || `Étape ${index + 1}`;
    const descriptionParts = [];

    if (point.commune) {
      descriptionParts.push(point.commune);
    }

    if (point.reseau) {
      descriptionParts.push(`Réseau ${point.reseau}`);
    }

    const description = descriptionParts.join(" — ");

    return `
    <rtept lat="${Number(point.lat)}" lon="${Number(point.lon)}">
      <name>${escapeXml(name)}</name>
      <desc>${escapeXml(description)}</desc>
    </rtept>`;
  }).join("");

  const creationDate = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx
  version="1.1"
  creator="BreizhStops"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
>
  <metadata>
    <name>Itinéraire BreizhStops</name>
    <desc>Itinéraire personnalisé créé avec BreizhStops</desc>
    <time>${creationDate}</time>
  </metadata>

  <rte>
    <name>Itinéraire BreizhStops</name>
    <desc>${points.length} points</desc>
    ${routePoints}
  </rte>
</gpx>`;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob(
    [content],
    { type: mimeType }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function createGpxFilename() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `breizhstops-${year}-${month}-${day}-${hours}${minutes}.gpx`;
}

async function exportGpx() {
  try {
    const points = await buildOrderedRoute(true);

    const gpxContent = createGpx(points);
    const filename = createGpxFilename();

    downloadFile(
      gpxContent,
      filename,
      "application/gpx+xml;charset=utf-8"
    );
  } catch (error) {
    alert(error.message);
  }
}
document
  .querySelectorAll(
    'input[name="departureMode"]'
  )
  .forEach(input => {
    input.addEventListener(
      "change",
      handleDepartureModeChange
    );
  });

searchInput.addEventListener(
  "input",
  refreshSearch
);

networkFilter.addEventListener(
  "change",
  refreshSearch
);

cityFilter.addEventListener(
  "change",
  refreshSearch
);

startStopSearch.addEventListener(
  "input",
  searchStartStops
);

optimizeRouteBtn.addEventListener(
  "click",
  optimizeRoute
);

openRouteBtn.addEventListener(
  "click",
  openGoogleRoute
);

openInRouteBtn.addEventListener(
  "click",
  openInRoute
);

exportGpxBtn.addEventListener(
  "click",
  exportGpx
);

clearRouteBtn.addEventListener(
  "click",
  () => {
    routeStops = [];
    selectedStartStop = null;
    currentPosition = null;

    startStopSearch.value = "";
    startStopResults.innerHTML = "";
    selectedStartStopEl.innerHTML = "";

    locationStatus.textContent =
      "La position sera demandée lors de la création de l’itinéraire.";

    updateRoute();
  }
);

handleDepartureModeChange();
loadStops();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register(
        "/service-worker.js"
      );

      console.log(
        "Service worker BreizhStops enregistré."
      );
    } catch (error) {
      console.error(
        "Impossible d’enregistrer le service worker :",
        error
      );
    }
  });
}
