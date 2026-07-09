const fileInput = document.getElementById("csvFile");
const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");

const API_URL = "https://geo.api.gouv.fr/communes";

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

  return [
    headers.join(";"),
    ...rows.map(row => headers.map(h => escapeValue(row[h])).join(";"))
  ].join("\n");
}

async function getCommune(lat, lon) {
  const url = `${API_URL}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&fields=nom,code,departement,region&format=json`;

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

    if (!data || data.length === 0) {
      return {
        commune: "",
        code_insee: "",
        departement: "",
        region: "",
        erreur: "Aucun résultat"
      };
    }

    const c = data[0];

    return {
      commune: c.nom || "",
      code_insee: c.code || "",
      departement: c.departement?.nom || "",
      region: c.region?.nom || "",
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

  const newHeaders = [...headers];

  ["commune", "code_insee", "departement", "region", "erreur_geocodage"].forEach(col => {
    if (!newHeaders.includes(col)) {
      newHeaders.push(col);
    }
  });

  startBtn.disabled = true;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    statusEl.textContent = `Traitement ${i + 1} / ${rows.length} : ${row.stop_name}`;

    const info = await getCommune(row.stop_lat, row.stop_lon);

    row.commune = info.commune;
    row.code_insee = info.code_insee;
    row.departement = info.departement;
    row.region = info.region;
    row.erreur_geocodage = info.erreur;

    await sleep(120);
  }

  const output = toCSV(newHeaders, rows);

  downloadCSV(output, "stops_bretagne_communes.csv");

  statusEl.textContent = "Terminé ✅ Le fichier enrichi a été téléchargé.";
  startBtn.disabled = false;
});
