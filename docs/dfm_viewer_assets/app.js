const CSV_PATH = "dfm_viewer_assets/data/sres_viewer_data.csv";
const SUMMARY_PATH = "dfm_viewer_assets/data/sres_viewer_summary.txt";
const IMAGE_MANIFEST_PATH = "dfm_viewer_assets/data/image_manifest.txt";
const IMAGE_BASE_PATH = "dfm_viewer_assets/images";

const DETAIL_FIELDS = [
  { key: "frame", label: "Frame" },
  { key: "Miller", label: "Miller" },
  { key: "asu", label: "ASU" },
  { key: "Resolution", label: "Resolution", decimals: 4 },
  { key: "zobs", label: "zobs", decimals: 2 },
  { key: "xobs", label: "xobs", decimals: 2 },
  { key: "yobs", label: "yobs", decimals: 2 },
  { key: "Fo^2_raw", label: "Fo^2 raw", decimals: 2 },
  { key: "Fo^2_scaled", label: "Fo^2 scaled", decimals: 2 },
  { key: "Fo^2_sigma_raw", label: "sigma raw", decimals: 2 },
  { key: "Fo^2_sigma_scaled", label: "sigma scaled", decimals: 2 },
  { key: "Fc^2", label: "Fc^2", decimals: 2 },
  { key: "SRES", label: "SRES", decimals: 4 },
  { key: "absSRES", label: "|SRES|", decimals: 4 },
];

const appState = {
  rows: [],
  columns: [],
  numericColumns: [],
  imageIndex: new Map(),
  selectedRowIndex: null,
  pinnedRowIndex: null,
  plotHandlersBound: false,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  collectElements();
  bindUi();
  initialize().catch((error) => {
    console.error(error);
    setStatus("error", "Could not initialize the static viewer.");
    elements.summaryText.textContent = String(error);
    elements.selectionTitle.textContent = "Viewer failed to load";
  });
});

function collectElements() {
  elements.plot = document.getElementById("plot");
  elements.xAxisSelect = document.getElementById("xAxisSelect");
  elements.yAxisSelect = document.getElementById("yAxisSelect");
  elements.searchForm = document.getElementById("searchForm");
  elements.searchInput = document.getElementById("searchInput");
  elements.clearPinButton = document.getElementById("clearPinButton");
  elements.statusBadge = document.getElementById("statusBadge");
  elements.statusText = document.getElementById("statusText");
  elements.rowsStat = document.getElementById("rowsStat");
  elements.framesStat = document.getElementById("framesStat");
  elements.imagesStat = document.getElementById("imagesStat");
  elements.peakStat = document.getElementById("peakStat");
  elements.selectionTitle = document.getElementById("selectionTitle");
  elements.frameImage = document.getElementById("frameImage");
  elements.imageFallback = document.getElementById("imageFallback");
  elements.infoGrid = document.getElementById("infoGrid");
  elements.openImageLink = document.getElementById("openImageLink");
  elements.summaryText = document.getElementById("summaryText");
}

function bindUi() {
  elements.xAxisSelect.addEventListener("change", () => {
    renderPlot();
    refreshSelection();
  });

  elements.yAxisSelect.addEventListener("change", () => {
    renderPlot();
    refreshSelection();
  });

  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    performSearch();
  });

  elements.clearPinButton.addEventListener("click", () => {
    appState.pinnedRowIndex = null;
    setStatus("ready", "Pin cleared. Hover to inspect or search to pin a reflection.");
    refreshSelection();
  });
}

async function initialize() {
  setStatus("loading", "Fetching CSV, image index, and summary...");

  const [csvData, manifestText, summaryText] = await Promise.all([
    loadCsv(CSV_PATH),
    fetchText(IMAGE_MANIFEST_PATH),
    fetchText(SUMMARY_PATH),
  ]);

  appState.rows = csvData.rows;
  appState.columns = csvData.columns;
  appState.numericColumns = csvData.numericColumns;
  appState.imageIndex = parseImageManifest(manifestText);

  elements.summaryText.textContent = summaryText.trim();

  populateAxisSelects();
  updateDatasetStats();

  const defaultIndex = chooseDefaultRowIndex();
  appState.selectedRowIndex = defaultIndex;
  appState.pinnedRowIndex = defaultIndex;

  renderPlot();
  renderSelection(defaultIndex, "Pinned default outlier");

  setStatus(
    "ready",
    `Loaded ${formatInteger(appState.rows.length)} rows and ${formatInteger(appState.imageIndex.size)} indexed images.`
  );
}

function loadCsv(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          reject(new Error(results.errors[0].message));
          return;
        }

        const columns = results.meta.fields || [];
        const rawRows = results.data || [];
        const numericColumns = inferNumericColumns(rawRows, columns);
        const rows = rawRows.map((row, index) => normalizeRow(row, numericColumns, index));
        resolve({ rows, columns, numericColumns });
      },
      error: reject,
    });
  });
}

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path}: ${response.status}`);
  }
  return response.text();
}

function inferNumericColumns(rows, columns) {
  return columns.filter((column) => {
    let nonEmpty = 0;
    let numeric = 0;
    for (const row of rows) {
      const value = row[column];
      if (value == null || value === "") {
        continue;
      }
      nonEmpty += 1;
      if (Number.isFinite(Number(value))) {
        numeric += 1;
      }
    }
    return nonEmpty > 0 && numeric / nonEmpty >= 0.98;
  });
}

function normalizeRow(row, numericColumns, index) {
  const normalized = { _rowIndex: index };
  for (const [key, value] of Object.entries(row)) {
    if (numericColumns.includes(key)) {
      const numberValue = Number(value);
      normalized[key] = Number.isFinite(numberValue) ? numberValue : null;
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

function parseImageManifest(text) {
  const index = new Map();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const fileName of lines) {
    const match = fileName.match(/(\d+)(?!.*\d)/);
    if (!match) {
      continue;
    }
    index.set(Number(match[1]), fileName);
  }
  return index;
}

function populateAxisSelects() {
  const xColumns = appState.numericColumns;
  const yColumns = appState.numericColumns.filter((column) => column !== "frame");

  fillSelect(elements.xAxisSelect, xColumns, "zobs");
  fillSelect(elements.yAxisSelect, yColumns, "SRES");
}

function fillSelect(selectElement, columns, preferred) {
  selectElement.innerHTML = "";
  for (const column of columns) {
    const option = document.createElement("option");
    option.value = column;
    option.textContent = column;
    if (column === preferred) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  }
  if (!columns.includes(preferred) && columns.length > 0) {
    selectElement.value = columns[0];
  }
}

function chooseDefaultRowIndex() {
  let bestIndex = 0;
  let bestValue = -Infinity;
  appState.rows.forEach((row, index) => {
    const candidate = Number.isFinite(row.absSRES) ? row.absSRES : Math.abs(row.SRES || 0);
    if (candidate > bestValue) {
      bestValue = candidate;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function updateDatasetStats() {
  const uniqueFrames = new Set(appState.rows.map((row) => row.frame).filter((frame) => Number.isFinite(frame)));
  const peak = appState.rows.reduce((current, row) => {
    const value = Number.isFinite(row.absSRES) ? row.absSRES : -Infinity;
    return value > current ? value : current;
  }, -Infinity);

  elements.rowsStat.textContent = formatInteger(appState.rows.length);
  elements.framesStat.textContent = formatInteger(uniqueFrames.size);
  elements.imagesStat.textContent = formatInteger(appState.imageIndex.size);
  elements.peakStat.textContent = Number.isFinite(peak) ? formatNumber(peak, 3) : "n/a";
}

function renderPlot() {
  const xColumn = elements.xAxisSelect.value;
  const yColumn = elements.yAxisSelect.value;
  const colors = appState.rows.map((row) => row.absSRES ?? Math.abs(row[yColumn] ?? 0));

  const trace = {
    type: "scattergl",
    mode: "markers",
    x: appState.rows.map((row) => row[xColumn]),
    y: appState.rows.map((row) => row[yColumn]),
    customdata: appState.rows.map((row) => [row._rowIndex, row.frame, row.Miller || row.hkl || ""]),
    hovertemplate:
      "<b>%{customdata[2]}</b><br>" +
      `Frame=%{customdata[1]}<br>${xColumn}=%{x:.4f}<br>${yColumn}=%{y:.4f}<extra></extra>`,
    marker: {
      size: 7,
      opacity: 0.78,
      color: colors,
      colorscale: [
        [0, "#1f6f73"],
        [0.45, "#f0b15d"],
        [1, "#cc5a34"],
      ],
      colorbar: {
        title: "|SRES|",
        thickness: 14,
        outlinewidth: 0,
      },
      line: {
        width: 0.25,
        color: "rgba(255,255,255,0.4)",
      },
    },
  };

  const selectedTrace = buildSelectedTrace();

  const layout = {
    title: {
      text: `${yColumn} vs ${xColumn}`,
      x: 0.02,
      xanchor: "left",
      font: {
        family: "Fraunces, serif",
        size: 28,
        color: "#16313c",
      },
    },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(255,253,248,0.72)",
    margin: { l: 70, r: 30, t: 70, b: 68 },
    xaxis: {
      title: xColumn,
      gridcolor: "rgba(22, 49, 60, 0.08)",
      zerolinecolor: "rgba(22, 49, 60, 0.14)",
    },
    yaxis: {
      title: yColumn,
      gridcolor: "rgba(22, 49, 60, 0.08)",
      zerolinecolor: "rgba(22, 49, 60, 0.14)",
    },
    hovermode: "closest",
    font: {
      family: "Space Grotesk, sans-serif",
      color: "#16313c",
    },
    showlegend: false,
  };

  Plotly.react(elements.plot, [trace, selectedTrace], layout, {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  });

  if (!appState.plotHandlersBound) {
    elements.plot.on("plotly_hover", (event) => {
      const rowIndex = extractRowIndex(event);
      if (rowIndex == null) {
        return;
      }
      renderSelection(rowIndex, appState.pinnedRowIndex === rowIndex ? "Pinned selection" : "Hover preview");
    });

    elements.plot.on("plotly_unhover", () => {
      if (appState.pinnedRowIndex != null) {
        renderSelection(appState.pinnedRowIndex, "Pinned selection");
      }
    });

    elements.plot.on("plotly_click", (event) => {
      const rowIndex = extractRowIndex(event);
      if (rowIndex == null) {
        return;
      }
      appState.pinnedRowIndex = rowIndex;
      renderSelection(rowIndex, "Pinned from plot");
      setStatus("ready", `Pinned frame ${formatInteger(appState.rows[rowIndex].frame)}.`);
    });

    appState.plotHandlersBound = true;
  }
}

function buildSelectedTrace() {
  const row = appState.selectedRowIndex == null ? null : appState.rows[appState.selectedRowIndex];
  const xColumn = elements.xAxisSelect.value;
  const yColumn = elements.yAxisSelect.value;

  return {
    type: "scatter",
    mode: "markers",
    x: row ? [row[xColumn]] : [],
    y: row ? [row[yColumn]] : [],
    hoverinfo: "skip",
    marker: {
      size: 16,
      color: "#fff6f1",
      line: {
        width: 3,
        color: "#cc5a34",
      },
      symbol: "circle",
    },
  };
}

function refreshSelection() {
  const rowIndex = appState.pinnedRowIndex ?? appState.selectedRowIndex ?? chooseDefaultRowIndex();
  renderSelection(rowIndex, appState.pinnedRowIndex != null ? "Pinned selection" : "Active selection");
}

function renderSelection(rowIndex, label) {
  if (rowIndex == null || !appState.rows[rowIndex]) {
    return;
  }

  appState.selectedRowIndex = rowIndex;
  updateSelectedTrace();

  const row = appState.rows[rowIndex];
  const xColumn = elements.xAxisSelect.value;
  const yColumn = elements.yAxisSelect.value;
  const imageUrl = getImageUrl(row.frame);
  const titleBits = [row.Miller || row.hkl || "Reflection", `frame ${formatInteger(row.frame)}`];
  if (Number.isFinite(row[yColumn])) {
    titleBits.push(`${yColumn} ${formatNumber(row[yColumn], 4)}`);
  }

  elements.selectionTitle.textContent = titleBits.join(" • ");
  renderInfoGrid(row, xColumn, yColumn, imageUrl);
  setImageStage(imageUrl);

  if (label) {
    const imageText = imageUrl ? "image ready" : "no image for this frame";
    setStatus("ready", `${label}: ${row.Miller || row.hkl || "reflection"} on frame ${formatInteger(row.frame)} (${imageText}).`);
  }
}

function updateSelectedTrace() {
  if (appState.selectedRowIndex == null || !appState.rows[appState.selectedRowIndex]) {
    return;
  }

  const row = appState.rows[appState.selectedRowIndex];
  const xColumn = elements.xAxisSelect.value;
  const yColumn = elements.yAxisSelect.value;

  Plotly.restyle(
    elements.plot,
    {
      x: [[row[xColumn]]],
      y: [[row[yColumn]]],
    },
    [1]
  );
}

function renderInfoGrid(row, xColumn, yColumn, imageUrl) {
  elements.infoGrid.innerHTML = "";

  const dynamicFields = [
    { key: xColumn, label: `${xColumn} (x)`, decimals: 4 },
    { key: yColumn, label: `${yColumn} (y)`, decimals: 4 },
    ...DETAIL_FIELDS.filter((field) => field.key !== xColumn && field.key !== yColumn),
    { key: "_image", label: "Image", value: imageUrl ? imageUrl.split("/").pop() : "Not found" },
  ];

  for (const field of dynamicFields) {
    const item = document.createElement("div");
    item.className = "info-item";

    const term = document.createElement("dt");
    term.textContent = field.label;

    const description = document.createElement("dd");
    description.textContent =
      field.value != null ? field.value : formatFieldValue(row[field.key], field.decimals);

    item.appendChild(term);
    item.appendChild(description);
    elements.infoGrid.appendChild(item);
  }
}

function setImageStage(imageUrl) {
  if (imageUrl) {
    elements.frameImage.src = imageUrl;
    elements.frameImage.hidden = false;
    elements.imageFallback.hidden = true;
    elements.openImageLink.href = imageUrl;
    elements.openImageLink.classList.remove("disabled");
  } else {
    elements.frameImage.removeAttribute("src");
    elements.frameImage.hidden = true;
    elements.imageFallback.hidden = false;
    elements.openImageLink.href = "#";
    elements.openImageLink.classList.add("disabled");
  }
}

function getImageUrl(frame) {
  if (!Number.isFinite(frame)) {
    return null;
  }
  const fileName = appState.imageIndex.get(Number(frame));
  if (!fileName) {
    return null;
  }
  return `${IMAGE_BASE_PATH}/${encodeURIComponent(fileName)}`;
}

function performSearch() {
  const query = elements.searchInput.value.trim();
  if (!query) {
    setStatus("alert", "Enter a frame number or HKL text to search.");
    return;
  }

  const rowIndex = findRowIndex(query);
  if (rowIndex == null) {
    setStatus("alert", `No reflection matched "${query}".`);
    return;
  }

  appState.pinnedRowIndex = rowIndex;
  renderSelection(rowIndex, "Pinned from search");
}

function findRowIndex(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/^-?\d+$/.test(normalized)) {
    const targetFrame = Number(normalized);
    const frameMatch = appState.rows.findIndex((row) => row.frame === targetFrame);
    if (frameMatch >= 0) {
      return frameMatch;
    }
  }

  return appState.rows.findIndex((row) => {
    const haystacks = [row.Miller, row.hkl, row.asu].filter(Boolean).map((value) => String(value).toLowerCase());
    return haystacks.some((value) => value.includes(normalized));
  });
}

function extractRowIndex(event) {
  const point = event && event.points && event.points[0];
  if (!point || !point.customdata) {
    return null;
  }
  const rowIndex = Number(point.customdata[0]);
  return Number.isInteger(rowIndex) ? rowIndex : null;
}

function formatFieldValue(value, decimals = 4) {
  if (value == null || value === "") {
    return "n/a";
  }
  if (typeof value === "number") {
    return formatNumber(value, decimals);
  }
  return String(value);
}

function formatNumber(value, decimals = 4) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  const absolute = Math.abs(value);
  if (absolute >= 10000 || (absolute > 0 && absolute < 0.001)) {
    return value.toExponential(Math.max(1, decimals - 1));
  }

  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

function formatInteger(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  return new Intl.NumberFormat("en-US").format(value);
}

function setStatus(kind, message) {
  const className = kind === "error" || kind === "alert" ? "alert" : kind === "ready" ? "ready" : "loading";
  elements.statusBadge.className = `status-badge ${className}`;
  elements.statusBadge.textContent =
    className === "ready" ? "Viewer ready" : className === "alert" ? "Check selection" : "Loading dataset";
  elements.statusText.textContent = message;
}
