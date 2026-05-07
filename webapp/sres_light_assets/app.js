const DATA_PATH = "sres_light_assets/data/sres_frame_sres.csv";

const DETAIL_FIELDS = [
  ["frame", "Frame"],
  ["SRES", "SRES"],
  ["absSRES", "|SRES|"],
  ["Miller", "Miller"],
  ["asu", "ASU"],
  ["Resolution", "Resolution"],
  ["zobs", "zobs"],
  ["Fo^2_scaled", "Fo^2 scaled"],
  ["Fo^2_sigma_scaled", "sigma scaled"],
  ["Fc^2", "Fc^2"],
];

const state = {
  rows: [],
  visibleRows: [],
  pinnedIndex: null,
  activeIndex: null,
  handlersBound: false,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  elements.plot = document.getElementById("plot");
  elements.rowsStat = document.getElementById("rowsStat");
  elements.framesStat = document.getElementById("framesStat");
  elements.minStat = document.getElementById("minStat");
  elements.maxAbsStat = document.getElementById("maxAbsStat");
  elements.statusBadge = document.getElementById("statusBadge");
  elements.statusText = document.getElementById("statusText");
  elements.searchForm = document.getElementById("searchForm");
  elements.searchInput = document.getElementById("searchInput");
  elements.outlierToggle = document.getElementById("outlierToggle");
  elements.selectionTitle = document.getElementById("selectionTitle");
  elements.selectionSubtitle = document.getElementById("selectionSubtitle");
  elements.detailGrid = document.getElementById("detailGrid");

  elements.searchForm.addEventListener("submit", onSearch);
  elements.outlierToggle.addEventListener("change", () => {
    updateVisibleRows();
    renderPlot();
    syncSelectionAfterFilter();
  });

  initialize().catch((error) => {
    console.error(error);
    setStatus("alert", "Could not load the reduced SRES dataset.");
    elements.selectionTitle.textContent = "Load failed";
    elements.selectionSubtitle.textContent = String(error);
  });
});

async function initialize() {
  setStatus("loading", "Reading CSV and building plot...");
  const rows = await loadCsv(DATA_PATH);
  state.rows = rows;
  updateVisibleRows();
  updateStats();

  const defaultIndex = indexOfLargestAbs(rows);
  state.pinnedIndex = defaultIndex;
  state.activeIndex = defaultIndex;

  renderPlot();
  renderDetails(defaultIndex, "Pinned default outlier");
  setStatus("ready", `Loaded ${formatInteger(rows.length)} reflections from the reduced CSV.`);
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

        const rows = (results.data || []).map((row, index) => ({
          _index: index,
          frame: toNumber(row.frame),
          SRES: toNumber(row.SRES),
          absSRES: toNumber(row.absSRES),
          Miller: row.Miller || "",
          asu: row.asu || "",
          Resolution: toNumber(row.Resolution),
          zobs: toNumber(row.zobs),
          "Fo^2_scaled": toNumber(row["Fo^2_scaled"]),
          "Fo^2_sigma_scaled": toNumber(row["Fo^2_sigma_scaled"]),
          "Fc^2": toNumber(row["Fc^2"]),
        }));
        resolve(rows.filter((row) => Number.isFinite(row.frame) && Number.isFinite(row.SRES)));
      },
      error: reject,
    });
  });
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function updateVisibleRows() {
  state.visibleRows = elements.outlierToggle.checked
    ? state.rows.filter((row) => Number.isFinite(row.absSRES) && row.absSRES >= 3)
    : state.rows.slice();
}

function updateStats() {
  const frames = state.rows.map((row) => row.frame);
  const minSres = Math.min(...state.rows.map((row) => row.SRES));
  const maxAbs = Math.max(...state.rows.map((row) => row.absSRES ?? Math.abs(row.SRES)));

  elements.rowsStat.textContent = formatInteger(state.rows.length);
  elements.framesStat.textContent = `${formatInteger(Math.min(...frames))} to ${formatInteger(Math.max(...frames))}`;
  elements.minStat.textContent = formatNumber(minSres, 3);
  elements.maxAbsStat.textContent = formatNumber(maxAbs, 3);
}

function renderPlot() {
  const plotRows = state.visibleRows;
  const trace = {
    type: "scattergl",
    mode: "markers",
    x: plotRows.map((row) => row.frame),
    y: plotRows.map((row) => row.SRES),
    customdata: plotRows.map((row) => [row._index, row.Miller]),
    hovertemplate:
      "<b>%{customdata[1]}</b><br>" +
      "frame=%{x}<br>" +
      "SRES=%{y:.4f}<extra></extra>",
    marker: {
      size: 7,
      opacity: 0.75,
      color: plotRows.map((row) => row.absSRES ?? Math.abs(row.SRES)),
      colorscale: [
        [0, "#1f6c72"],
        [0.5, "#f0b15d"],
        [1, "#bb5a2a"],
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

  Plotly.react(
    elements.plot,
    [trace, selectedTrace],
    {
      title: {
        text: elements.outlierToggle.checked ? "SRES vs frame for |SRES| ≥ 3" : "SRES vs frame",
        x: 0.02,
        xanchor: "left",
        font: {
          family: "Georgia, serif",
          size: 28,
          color: "#17323a",
        },
      },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(255,252,247,0.86)",
      margin: { l: 72, r: 26, t: 72, b: 64 },
      xaxis: {
        title: "frame",
        gridcolor: "rgba(23, 50, 58, 0.08)",
        zerolinecolor: "rgba(23, 50, 58, 0.14)",
      },
      yaxis: {
        title: "SRES",
        gridcolor: "rgba(23, 50, 58, 0.08)",
        zerolinecolor: "rgba(23, 50, 58, 0.14)",
      },
      hovermode: "closest",
      showlegend: false,
      shapes: [
        {
          type: "line",
          xref: "paper",
          x0: 0,
          x1: 1,
          y0: 0,
          y1: 0,
          line: {
            color: "rgba(23, 50, 58, 0.28)",
            width: 1.2,
            dash: "dot",
          },
        },
      ],
      font: {
        family: "Avenir Next, Avenir, sans-serif",
        color: "#17323a",
      },
    },
    {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d"],
    }
  );

  if (!state.handlersBound) {
    elements.plot.on("plotly_hover", (event) => {
      const rowIndex = readRowIndex(event);
      if (rowIndex == null) {
        return;
      }
      state.activeIndex = rowIndex;
      renderDetails(rowIndex, state.pinnedIndex === rowIndex ? "Pinned selection" : "Hover preview");
    });

    elements.plot.on("plotly_unhover", () => {
      if (state.pinnedIndex != null) {
        state.activeIndex = state.pinnedIndex;
        renderDetails(state.pinnedIndex, "Pinned selection");
      }
    });

    elements.plot.on("plotly_click", (event) => {
      const rowIndex = readRowIndex(event);
      if (rowIndex == null) {
        return;
      }
      state.pinnedIndex = rowIndex;
      state.activeIndex = rowIndex;
      renderDetails(rowIndex, "Pinned from plot");
      setStatus("ready", `Pinned ${state.rows[rowIndex].Miller || "reflection"} at frame ${formatInteger(state.rows[rowIndex].frame)}.`);
    });

    state.handlersBound = true;
  }
}

function buildSelectedTrace() {
  const selected = state.activeIndex == null ? null : state.rows[state.activeIndex];
  if (!selected || !rowIsVisible(selected)) {
    return {
      type: "scatter",
      mode: "markers",
      x: [],
      y: [],
      hoverinfo: "skip",
    };
  }

  return {
    type: "scatter",
    mode: "markers",
    x: [selected.frame],
    y: [selected.SRES],
    hoverinfo: "skip",
    marker: {
      size: 16,
      color: "#fff5ef",
      line: {
        width: 3,
        color: "#bb5a2a",
      },
    },
  };
}

function rowIsVisible(row) {
  if (!elements.outlierToggle.checked) {
    return true;
  }
  return Number.isFinite(row.absSRES) && row.absSRES >= 3;
}

function syncSelectionAfterFilter() {
  const pinned = state.pinnedIndex == null ? null : state.rows[state.pinnedIndex];
  if (pinned && rowIsVisible(pinned)) {
    state.activeIndex = state.pinnedIndex;
    renderDetails(state.pinnedIndex, "Pinned selection");
    return;
  }

  const fallback = state.visibleRows.length > 0 ? state.visibleRows[0]._index : null;
  state.activeIndex = fallback;
  state.pinnedIndex = fallback;
  if (fallback != null) {
    renderDetails(fallback, "Pinned after filter");
    setStatus("ready", `Showing ${formatInteger(state.visibleRows.length)} reflections after filtering.`);
  } else {
    elements.selectionTitle.textContent = "No reflections match this filter";
    elements.selectionSubtitle.textContent = "Try turning off the outlier-only filter.";
    elements.detailGrid.innerHTML = "";
    setStatus("alert", "No rows match the current filter.");
  }
}

function renderDetails(rowIndex, subtitle) {
  const row = state.rows[rowIndex];
  if (!row) {
    return;
  }

  updateSelectedTrace(row);

  elements.selectionTitle.textContent = `${row.Miller || "Reflection"} • frame ${formatInteger(row.frame)}`;
  elements.selectionSubtitle.textContent = subtitle;
  elements.detailGrid.innerHTML = "";

  for (const [key, label] of DETAIL_FIELDS) {
    const item = document.createElement("div");
    item.className = "detail-item";

    const term = document.createElement("dt");
    term.textContent = label;

    const description = document.createElement("dd");
    description.textContent = formatValue(key, row[key]);

    item.appendChild(term);
    item.appendChild(description);
    elements.detailGrid.appendChild(item);
  }
}

function updateSelectedTrace(row) {
  if (!row || !rowIsVisible(row)) {
    Plotly.restyle(elements.plot, { x: [[]], y: [[]] }, [1]);
    return;
  }

  Plotly.restyle(elements.plot, { x: [[row.frame]], y: [[row.SRES]] }, [1]);
}

function onSearch(event) {
  event.preventDefault();
  const query = elements.searchInput.value.trim().toLowerCase();
  if (!query) {
    setStatus("alert", "Enter a frame number or Miller index.");
    return;
  }

  let match = null;
  if (/^-?\d+$/.test(query)) {
    const frame = Number(query);
    match = state.visibleRows.find((row) => row.frame === frame) || null;
  }

  if (!match) {
    match = state.visibleRows.find((row) => (row.Miller || "").toLowerCase().includes(query)) || null;
  }

  if (!match) {
    setStatus("alert", `No visible reflection matched "${query}".`);
    return;
  }

  state.pinnedIndex = match._index;
  state.activeIndex = match._index;
  renderDetails(match._index, "Pinned from search");
  setStatus("ready", `Pinned ${match.Miller || "reflection"} from search.`);
}

function readRowIndex(event) {
  const point = event && event.points && event.points[0];
  if (!point || !point.customdata) {
    return null;
  }
  const index = Number(point.customdata[0]);
  return Number.isInteger(index) ? index : null;
}

function indexOfLargestAbs(rows) {
  let bestIndex = 0;
  let bestValue = -Infinity;
  rows.forEach((row, index) => {
    const value = row.absSRES ?? Math.abs(row.SRES);
    if (value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function formatValue(key, value) {
  if (value == null || value === "") {
    return "n/a";
  }
  if (typeof value === "string") {
    return value;
  }
  if (key === "frame") {
    return formatInteger(value);
  }
  if (key === "SRES" || key === "absSRES" || key === "Resolution" || key === "zobs") {
    return formatNumber(value, 4);
  }
  return formatNumber(value, 2);
}

function formatNumber(value, decimals) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  const abs = Math.abs(value);
  if (abs >= 10000 || (abs > 0 && abs < 0.001)) {
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
  const cls = kind === "ready" ? "ready" : kind === "alert" ? "alert" : "loading";
  elements.statusBadge.className = `status-badge ${cls}`;
  elements.statusBadge.textContent = cls === "ready" ? "Ready" : cls === "alert" ? "Check" : "Loading";
  elements.statusText.textContent = message;
}
