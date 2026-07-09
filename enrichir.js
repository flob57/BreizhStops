const fileInput = document.getElementById("csvFile");
const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");

const API_URL = "https://api-adresse.data.gouv.fr/reverse/";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(";").map(h => h.trim());

  const rows = lines.slice(1).map(line => {
    const values = line.split(";");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim() : "";
    });
    return row;
  });

  return { headers, rows };
}

function toCSV(headers, rows) {
  const escapeValue = value => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [];
  csvLines.push(headers.join(";"));

  rows.forEach(row => {
    csvLines.push(headers.map(h => escapeValue(row[h])).join(";"));
  });

  return csvLines.join("\n");
}

async function getCommune(lat, lon) {
  const url = `${API_URL}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&type=municipality`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {
        commune: "",
        code_insee: "",
        departement: "",
        region: "",
        erreur: `HTTP ${response.status}`
      };
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return {
        commune: "",
        code_insee: "",
        departement: "",
        region: "",
        erreur: "Aucun résultat"
      };
    }

    const props = data.features[0].properties || {};

    return {
      commune: props.city || props.name || "",
      code_insee: props.citycode || "",
      departement: props.context ? props.context.split(",")[0].trim() : "",
      region: props.context ? props.context.split(",").slice(-1)[0].trim() : "",
      erreur: ""
    };

  } catch (error) {
    return {
      commune: "",
      code_insee: "",
      departement: "",
      region: "",
      erreur: error.message
    };
  }
}

function downloadCSV(content, filename) {
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

startBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    alert("Choisis d'abord ton fichier CSV.");
    return;
  }

  statusEl.textContent = "Lecture du fichier...";

  const text = await file.text();
  const { headers, rows } = parseCSV(text);

  const requiredColumns = ["stop_id", "stop_name", "stop_lat", "stop_lon"];

  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      alert(`Colonne manquante : ${col}`);
      return;
    }
  }

  const newHeaders = [...headers];

  ["commune", "code_insee", "departement", "region", "erreur_geocodage"].forEach(col => {
    if (!newHeaders.includes(col)) {
      newHeaders.push(col);
    }
  });

  startBtn.disabled = true;

  const cache = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const lat = row.stop_lat;
    const lon = row.stop_lon;
    const key = `${lat},${lon}`;

    statusEl.textContent = `Traitement ${i + 1} / ${rows.length} : ${row.stop_name || ""}`;

    let info;

    if (cache.has(key)) {
      info = cache.get(key);
    } else {
      info = await getCommune(lat, lon);
      cache.set(key, info);

      // Petite pause volontaire pour ne pas brutaliser l'API publique.
      await sleep(120);
    }

    row.commune = info.commune;
    row.code_insee = info.code_insee;
    row.departement = info.departement;
    row.region = info.region;
    row.erreur_geocodage = info.erreur;
  }

  const output = toCSV(newHeaders, rows);

  downloadCSV(output, "stops_bretagne_communes.csv");

  statusEl.textContent = "Terminé ✅ Le fichier enrichi a été téléchargé.";
  startBtn.disabled = false;
});
