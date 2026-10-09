/* global Chart */
// Daily volume trend: bars = completed volume (USD), line = number of completed transfers.
let chart;

export function renderVolumeChart(canvas, series) {
  const data = {
    labels: series.map((d) => d.date.slice(5)), // MM-DD
    datasets: [
      { type: 'bar', label: 'Volume (USD)', data: series.map((d) => d.volume), backgroundColor: '#5b7fe8', borderRadius: 4, yAxisID: 'y' },
      { type: 'line', label: 'Transfers', data: series.map((d) => d.count), borderColor: '#e08a00', backgroundColor: '#e08a00', tension: 0.3, pointRadius: 2, yAxisID: 'y1' },
    ],
  };
  if (chart) {
    chart.data = data;
    chart.update();
    return chart;
  }
  chart = new Chart(canvas, {
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'USD' } },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Transfers' } },
      },
    },
  });
  return chart;
}
