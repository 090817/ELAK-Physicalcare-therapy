/** ECharts 封装：Apple Health 风格折线图。 */

export function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function shortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

const instances = new Set();

export function disposeCharts() {
  instances.forEach((c) => c.dispose());
  instances.clear();
}

export function lineChart(el, { dates, values, color, unit = "" }) {
  const chart = echarts.init(el, null, { renderer: "canvas" });
  instances.add(chart);

  const data = values.map((v) => (typeof v === "number" && !isNaN(v) ? v : null));

  chart.setOption({
    animationDuration: 450,
    grid: { left: 46, right: 16, top: 14, bottom: 26 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(28,28,30,0.92)",
      borderWidth: 0,
      padding: [6, 10],
      textStyle: { color: "#fff", fontSize: 12 },
      axisPointer: { lineStyle: { color: hexToRgba(color, 0.5) } },
      formatter: (ps) => {
        const p = ps[0];
        if (p.value == null) return `${p.axisValue}<br/>—`;
        return `${p.axisValue}<br/><b>${p.value}</b>${unit ? " " + unit : ""}`;
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: dates.map(shortDate),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "#8e8e93",
        fontSize: 10,
        interval: Math.max(0, Math.ceil(dates.length / 5) - 1),
      },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: "rgba(60,60,67,0.08)" } },
      axisLabel: { color: "#8e8e93", fontSize: 10 },
    },
    series: [
      {
        type: "line",
        data,
        smooth: 0.36,
        symbol: "none",
        lineStyle: { width: 2.5, color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexToRgba(color, 0.26) },
            { offset: 1, color: hexToRgba(color, 0.01) },
          ]),
        },
      },
    ],
  });

  return chart;
}

/** 迷你趋势线（内联 SVG）。 */
export function sparkline(values, color, w = 120, h = 30) {
  const vals = values.filter((v) => typeof v === "number" && !isNaN(v));
  if (vals.length < 2) return "";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const step = w / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, h - 3 - ((v - min) / range) * (h - 6)]);
  const d = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

window.addEventListener("resize", () => instances.forEach((c) => c.resize()));
