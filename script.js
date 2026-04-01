const units = {
  si: {
    force: "N",
    length: "mm",
    stress: "MPa",
    zimmerli: {
      unpeened: { ssa: 241, ssm: 379 },
      peened: { ssa: 398, ssm: 534 }
    }
  },
  english: {
    force: "lbf",
    length: "in",
    stress: "ksi",
    zimmerli: {
      unpeened: { ssa: 35.0, ssm: 55.0 },
      peened: { ssa: 57.5, ssm: 77.5 }
    }
  }
};

const form = document.querySelector("#spring-form");
const message = document.querySelector("#message");
const waveCanvas = document.querySelector("#waveCanvas");
const waveCtx = waveCanvas.getContext("2d");
const goodmanCanvas = document.querySelector("#goodmanCanvas");
const goodmanCtx = goodmanCanvas.getContext("2d");

const dom = {
  unitSystem: document.querySelector("#unitSystem"),
  surfaceCondition: document.querySelector("#surfaceCondition"),
  wireDiameter: document.querySelector("#wireDiameter"),
  meanDiameter: document.querySelector("#meanDiameter"),
  forceMin: document.querySelector("#forceMin"),
  forceMax: document.querySelector("#forceMax"),
  sut: document.querySelector("#sut"),
  cycles: document.querySelector("#cycles"),
  wireUnitLabel: document.querySelector("#wireUnitLabel"),
  coilUnitLabel: document.querySelector("#coilUnitLabel"),
  forceMinUnitLabel: document.querySelector("#forceMinUnitLabel"),
  forceMaxUnitLabel: document.querySelector("#forceMaxUnitLabel"),
  sutUnitLabel: document.querySelector("#sutUnitLabel"),
  resultIndex: document.querySelector("#resultIndex"),
  resultKb: document.querySelector("#resultKb"),
  resultSse: document.querySelector("#resultSse"),
  resultTauMean: document.querySelector("#resultTauMean"),
  resultTauAlt: document.querySelector("#resultTauAlt"),
  resultSsu: document.querySelector("#resultSsu"),
  resultGoodmanUsage: document.querySelector("#resultGoodmanUsage"),
  resultSafetyFactor: document.querySelector("#resultSafetyFactor"),
  zimmerliData: document.querySelector("#zimmerliData"),
  chartSubtitle: document.querySelector("#chartSubtitle"),
  goodmanSubtitle: document.querySelector("#goodmanSubtitle")
};

function updateUnitLabels() {
  const system = units[dom.unitSystem.value];
  dom.wireUnitLabel.textContent = `d (${system.length})`;
  dom.coilUnitLabel.textContent = `D (${system.length})`;
  dom.forceMinUnitLabel.textContent = `Fmin (${system.force})`;
  dom.forceMaxUnitLabel.textContent = `Fmax (${system.force})`;
  dom.sutUnitLabel.textContent = `Sut (${system.stress})`;
}

function readNumber(input) {
  return Number.parseFloat(input.value);
}

function formatValue(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function calculateResults() {
  const unitSystem = dom.unitSystem.value;
  const surfaceCondition = dom.surfaceCondition.value;
  const system = units[unitSystem];

  const d = readNumber(dom.wireDiameter);
  const D = readNumber(dom.meanDiameter);
  const forceMin = readNumber(dom.forceMin);
  const forceMax = readNumber(dom.forceMax);
  const sut = readNumber(dom.sut);
  const cycles = Math.max(1, Math.min(8, Math.round(readNumber(dom.cycles) || 2)));

  if ([d, D, forceMin, forceMax, sut].some((value) => !Number.isFinite(value))) {
    throw new Error("Please enter valid numeric values in every field.");
  }

  if (d <= 0 || D <= 0 || sut <= 0) {
    throw new Error("Wire diameter, mean diameter, and tensile strength must be greater than zero.");
  }

  if (forceMax < forceMin) {
    throw new Error("Maximum force must be greater than or equal to minimum force.");
  }

  const C = D / d;
  if (C <= 0.75) {
    throw new Error("Spring index C = D/d must be greater than 0.75 for the Bergstrasser factor.");
  }

  const kb = (4 * C + 2) / (4 * C - 3);
  const forceMean = (forceMax + forceMin) / 2;
  const forceAlt = (forceMax - forceMin) / 2;

  const stressBase = (8 * D) / (Math.PI * Math.pow(d, 3));
  const tauMean = kb * stressBase * forceMean;
  const tauAlt = kb * stressBase * forceAlt;

  const zimmerli = system.zimmerli[surfaceCondition];
  const ssu = 0.67 * sut;
  const denominator = 1 - zimmerli.ssm / ssu;

  if (denominator <= 0) {
    throw new Error("Computed Sse is not valid because Ssu must be greater than Zimmerli's Ssm. Increase Sut.");
  }

  const sse = zimmerli.ssa / denominator;
  const goodmanUsage = tauAlt / sse + tauMean / ssu;
  const safetyFactor = goodmanUsage > 0 ? 1 / goodmanUsage : Number.POSITIVE_INFINITY;

  return {
    unitSystem,
    surfaceCondition,
    system,
    C,
    kb,
    forceMean,
    forceAlt,
    tauMean,
    tauAlt,
    ssu,
    sse,
    goodmanUsage,
    safetyFactor,
    zimmerli,
    cycles
  };
}

function updateResults(results) {
  const stressUnit = results.system.stress;
  const forceUnit = results.system.force;
  dom.resultIndex.textContent = formatValue(results.C, 2);
  dom.resultKb.textContent = formatValue(results.kb, 3);
  dom.resultSse.textContent = `${formatValue(results.sse, 2)} ${stressUnit}`;
  dom.resultTauMean.textContent = `${formatValue(results.tauMean, 2)} ${stressUnit}`;
  dom.resultTauAlt.textContent = `${formatValue(results.tauAlt, 2)} ${stressUnit}`;
  dom.resultSsu.textContent = `${formatValue(results.ssu, 2)} ${stressUnit}`;
  dom.resultGoodmanUsage.textContent = formatValue(results.goodmanUsage, 3);
  dom.resultSafetyFactor.textContent = Number.isFinite(results.safetyFactor)
    ? formatValue(results.safetyFactor, 2)
    : "Infinity";
  dom.zimmerliData.textContent =
    `${capitalize(results.surfaceCondition)}: Ssa = ${formatValue(results.zimmerli.ssa, 1)} ${stressUnit}, ` +
    `Ssm = ${formatValue(results.zimmerli.ssm, 1)} ${stressUnit}`;
  dom.chartSubtitle.textContent =
    `Force waveform: Fm = ${formatValue(results.forceMean, 2)} ${forceUnit}, Fa = ${formatValue(results.forceAlt, 2)} ${forceUnit}`;
  dom.goodmanSubtitle.textContent =
    `Design point (${formatValue(results.tauMean, 2)}, ${formatValue(results.tauAlt, 2)}) ${stressUnit}; usage = ${formatValue(results.goodmanUsage, 3)}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function drawWave(results) {
  const width = waveCanvas.width;
  const height = waveCanvas.height;
  const padding = { top: 32, right: 32, bottom: 50, left: 70 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const minForce = results.forceMean - results.forceAlt;
  const maxForce = results.forceMean + results.forceAlt;
  const span = Math.max(maxForce - minForce, 1e-6);
  const yMin = minForce - span * 0.2;
  const yMax = maxForce + span * 0.2;
  const cycles = results.cycles;

  waveCtx.clearRect(0, 0, width, height);

  waveCtx.fillStyle = "#fffdfa";
  waveCtx.fillRect(0, 0, width, height);

  waveCtx.strokeStyle = "rgba(31, 36, 48, 0.1)";
  waveCtx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (plotHeight / 4) * i;
    waveCtx.beginPath();
    waveCtx.moveTo(padding.left, y);
    waveCtx.lineTo(width - padding.right, y);
    waveCtx.stroke();
  }

  for (let i = 0; i <= cycles; i += 1) {
    const x = padding.left + (plotWidth / cycles) * i;
    waveCtx.beginPath();
    waveCtx.moveTo(x, padding.top);
    waveCtx.lineTo(x, height - padding.bottom);
    waveCtx.stroke();
  }

  waveCtx.strokeStyle = "rgba(23, 93, 92, 0.35)";
  waveCtx.lineWidth = 2;
  const meanY = mapToY(results.forceMean, yMin, yMax, padding, plotHeight);
  waveCtx.beginPath();
  waveCtx.moveTo(padding.left, meanY);
  waveCtx.lineTo(width - padding.right, meanY);
  waveCtx.stroke();

  waveCtx.strokeStyle = "#bb4d00";
  waveCtx.lineWidth = 4;
  waveCtx.beginPath();

  const points = Math.max(300, cycles * 180);
  for (let i = 0; i <= points; i += 1) {
    const t = (i / points) * cycles * Math.PI * 2;
    const x = padding.left + (i / points) * plotWidth;
    const force = results.forceMean + results.forceAlt * Math.sin(t);
    const y = mapToY(force, yMin, yMax, padding, plotHeight);
    if (i === 0) {
      waveCtx.moveTo(x, y);
    } else {
      waveCtx.lineTo(x, y);
    }
  }
  waveCtx.stroke();

  waveCtx.fillStyle = "#1f2430";
  waveCtx.font = "16px Segoe UI";
  waveCtx.fillText(`Force (${results.system.force})`, 16, 24);
  waveCtx.fillText("Time", width - 72, height - 16);

  waveCtx.fillStyle = "#5f6675";
  waveCtx.font = "14px Segoe UI";
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (plotHeight / 4) * i;
    const value = yMax - ((y - padding.top) / plotHeight) * (yMax - yMin);
    waveCtx.fillText(formatValue(value, 1), 12, y + 5);
  }

  for (let i = 0; i <= cycles; i += 1) {
    const x = padding.left + (plotWidth / cycles) * i;
    waveCtx.fillText(formatValue(i, 0), x - 4, height - 20);
  }
}

function mapToY(value, yMin, yMax, padding, plotHeight) {
  return padding.top + ((yMax - value) / (yMax - yMin)) * plotHeight;
}

function drawGoodman(results) {
  const width = goodmanCanvas.width;
  const height = goodmanCanvas.height;
  const padding = { top: 28, right: 34, bottom: 58, left: 72 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xMax = Math.max(results.ssu, results.tauMean * 1.2, 1);
  const yMax = Math.max(results.sse, results.tauAlt * 1.2, 1);

  goodmanCtx.clearRect(0, 0, width, height);
  goodmanCtx.fillStyle = "#fffdfa";
  goodmanCtx.fillRect(0, 0, width, height);

  goodmanCtx.strokeStyle = "rgba(31, 36, 48, 0.1)";
  goodmanCtx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = padding.top + (plotHeight / 5) * i;
    goodmanCtx.beginPath();
    goodmanCtx.moveTo(padding.left, y);
    goodmanCtx.lineTo(width - padding.right, y);
    goodmanCtx.stroke();
  }
  for (let i = 0; i <= 5; i += 1) {
    const x = padding.left + (plotWidth / 5) * i;
    goodmanCtx.beginPath();
    goodmanCtx.moveTo(x, padding.top);
    goodmanCtx.lineTo(x, height - padding.bottom);
    goodmanCtx.stroke();
  }

  const mapX = (value) => padding.left + (value / xMax) * plotWidth;
  const mapY = (value) => padding.top + ((yMax - value) / yMax) * plotHeight;

  goodmanCtx.strokeStyle = "#186b69";
  goodmanCtx.lineWidth = 4;
  goodmanCtx.beginPath();
  goodmanCtx.moveTo(mapX(0), mapY(results.sse));
  goodmanCtx.lineTo(mapX(results.ssu), mapY(0));
  goodmanCtx.stroke();

  goodmanCtx.fillStyle = "rgba(24, 107, 105, 0.12)";
  goodmanCtx.beginPath();
  goodmanCtx.moveTo(mapX(0), mapY(0));
  goodmanCtx.lineTo(mapX(0), mapY(results.sse));
  goodmanCtx.lineTo(mapX(results.ssu), mapY(0));
  goodmanCtx.closePath();
  goodmanCtx.fill();

  goodmanCtx.fillStyle = "#bb4d00";
  goodmanCtx.beginPath();
  goodmanCtx.arc(mapX(results.tauMean), mapY(results.tauAlt), 7, 0, 2 * Math.PI);
  goodmanCtx.fill();

  goodmanCtx.fillStyle = "#1f2430";
  goodmanCtx.font = "16px Segoe UI";
  goodmanCtx.fillText(`Mean shear stress, tau_m (${results.system.stress})`, width / 2 - 160, height - 16);
  goodmanCtx.save();
  goodmanCtx.translate(20, height / 2 + 110);
  goodmanCtx.rotate(-Math.PI / 2);
  goodmanCtx.fillText(`Alternating shear stress, tau_a (${results.system.stress})`, 0, 0);
  goodmanCtx.restore();

  goodmanCtx.font = "13px Segoe UI";
  goodmanCtx.fillStyle = "#5f6675";
  for (let i = 0; i <= 5; i += 1) {
    const xValue = (xMax / 5) * i;
    const x = padding.left + (plotWidth / 5) * i;
    goodmanCtx.fillText(formatValue(xValue, 1), x - 14, height - 34);
  }
  for (let i = 0; i <= 5; i += 1) {
    const yValue = (yMax / 5) * i;
    const y = mapY(yValue);
    goodmanCtx.fillText(formatValue(yValue, 1), 14, y + 4);
  }

  goodmanCtx.fillStyle = "#1f2430";
  goodmanCtx.fillText(`Sse=${formatValue(results.sse, 1)}`, mapX(0) + 8, mapY(results.sse) - 8);
  goodmanCtx.fillText(`Ssu=${formatValue(results.ssu, 1)}`, mapX(results.ssu) - 72, mapY(0) - 8);
  goodmanCtx.fillText("Design point", mapX(results.tauMean) + 10, mapY(results.tauAlt) - 10);
}

function handleCalculation(event) {
  if (event) {
    event.preventDefault();
  }

  try {
    updateUnitLabels();
    const results = calculateResults();
    updateResults(results);
    drawWave(results);
    drawGoodman(results);
    message.textContent = "Calculation completed.";
  } catch (error) {
    message.textContent = error.message;
  }
}

dom.unitSystem.addEventListener("change", () => {
  updateUnitLabels();
  handleCalculation();
});

dom.surfaceCondition.addEventListener("change", handleCalculation);
form.addEventListener("submit", handleCalculation);
[
  dom.wireDiameter,
  dom.meanDiameter,
  dom.forceMin,
  dom.forceMax,
  dom.sut,
  dom.cycles
].forEach((input) => {
  input.addEventListener("input", handleCalculation);
});

updateUnitLabels();
handleCalculation();
