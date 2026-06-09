import { PAL } from './constants.js';
import { $ } from './utils.js';

Chart.defaults.font = { family: "'JetBrains Mono',monospace", size: 11 };
Chart.defaults.color = '#88889a';

const charts = {};

export function mkChart(id, cfg) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  const ctx = $(id);
  if (!ctx) return;
  charts[id] = new Chart(ctx, cfg);
}

export function destroyAll() {
  Object.keys(charts).forEach(k => { charts[k].destroy(); delete charts[k]; });
}

const gridColor = 'rgba(255,255,255,0.04)';
const noLegend = { legend: { display: false } };
const noXGrid = { x: { grid: { display: false } } };
const yGrid = { y: { grid: { color: gridColor } } };
const autoSkip = { ticks: { autoSkip: true, maxTicksLimit: 18 } };

export function barChart(id, labels, data, colors) {
  mkChart(id, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors || PAL.slice(0,labels.length).map(c=>c+'88'), borderRadius: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: noLegend, scales: { ...noXGrid, ...yGrid } },
  });
}

export function hBarChart(id, labels, data) {
  mkChart(id, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: PAL.slice(0,labels.length).map(c=>c+'88'), borderRadius: 5 }] },
    options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins: noLegend, scales: { x: { grid:{ color:gridColor } }, y: { grid:{ display:false } } } },
  });
}

export function lineChart(id, labels, datasets) {
  mkChart(id, {
    type: 'line',
    data: { labels, datasets },
    options: { responsive:true, maintainAspectRatio:false, plugins: noLegend, scales: { x: { grid:{ color:gridColor }, ...autoSkip }, ...yGrid } },
  });
}

export function multiLineChart(id, labels, datasets, legendPos) {
  mkChart(id, {
    type: 'line',
    data: { labels, datasets },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position: legendPos||'top', labels:{ boxWidth:9, padding:8 } } }, scales: { x: { grid:{ color:gridColor }, ...autoSkip }, ...yGrid } },
  });
}

export function doughnutChart(id, labels, data) {
  mkChart(id, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: PAL.slice(0, labels.length), borderWidth: 0 }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'62%', plugins:{ legend:{ position:'right', labels:{ boxWidth:9, padding:8 } } } },
  });
}

export function stackedBarChart(id, labels, datasets) {
  mkChart(id, {
    type: 'bar',
    data: { labels, datasets },
    options: { responsive:true, maintainAspectRatio:false, plugins: noLegend, scales: { x: { stacked:true, grid:{ display:false }, ...autoSkip }, y: { stacked:true, grid:{ color:gridColor } } } },
  });
}
