class VolumeChart {
  constructor(page) {
    this.page = page;
    this.canvas = page.getByRole('img', { name: 'Daily transaction volume chart' });
  }

  /** The data Chart.js is actually drawing, read from the live chart instance. */
  async renderedData() {
    return this.canvas.evaluate((canvas) => {
      // eslint-disable-next-line no-undef
      const chart = Chart.getChart(canvas);
      if (!chart) return null;
      return {
        labels: [...chart.data.labels],
        datasets: chart.data.datasets.map((d) => ({ label: d.label, type: d.type, data: [...d.data] })),
        width: canvas.width,
        height: canvas.height,
      };
    });
  }

  dataset(rendered, label) {
    const ds = rendered.datasets.find((d) => d.label === label);
    if (!ds) throw new Error(`Chart has no dataset "${label}". Found: ${rendered.datasets.map((d) => d.label).join(', ')}`);
    return ds;
  }
}

module.exports = { VolumeChart };
