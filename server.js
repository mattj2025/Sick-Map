const DB_PATH = './ili_data.db';

const COLORS = [
  '#e6194b', // red
  '#3cb44b', // green
  '#4363d8', // blue
  '#f58231', // orange
  '#911eb4', // purple
  '#46f0f0', // cyan
  '#f032e6', // magenta
  '#bcf60c', // lime
  '#fabebe', // pink
  '#008080'  // teal
];


const {
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement
} = require('chart.js');

const { Canvas } = require('skia-canvas');
const fsp = require('node:fs/promises');

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());


const { Legend, Title, Tooltip } = require('chart.js');

Chart.register(
  CategoryScale,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Legend,   // << add this
  Title,    // optional
  Tooltip   // optional
);


app.get('/chart.png', async (req, res) => {
  try {
    const states = req.query.states
      ? req.query.states.split(',').map(s => s.trim().toLowerCase())
      : [];

    if (!states.length) {
      return res.status(400).send('No states provided');
    }

    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);

    const sql = `
      SELECT epiweek, region, ili
      FROM ili_data
      WHERE region IN (${states.map(() => '?').join(',')})
      ORDER BY epiweek
    `;

    const rows = await new Promise((resolve, reject) => {
      db.all(sql, states, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    db.close();

    // const weeks = [...new Set(rows.map(r => r.epiweek))].sort();
    const weeks = generateWeeks(201040, 202553);

    const weekIndex = new Map();
    weeks.forEach((w, i) => weekIndex.set(w, i));

    const byState = {};
    for (const state of states) {
      byState[state] = new Array(weeks.length).fill(null);
    }

    rows.forEach(r => {
      const i = weekIndex.get(r.epiweek);
      byState[r.region][i] = Number(r.ili);
    });

    const avg = weeks.map((_, i) => {
      let sum = 0, count = 0;
      for (const state of states) {
        const v = byState[state][i];
        if (v != null) {
          sum += Number(v);
          count++;
        }
      }
      return count ? sum / count : null;
    });

    const datasets = [
      ...states.map((state, idx) => ({
        label: state,
        data: byState[state],
        borderColor: COLORS[idx % COLORS.length],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        spanGaps: true
      })),
      {
        label: 'Average',
        data: avg,
        borderColor: '#000000',
        borderDash: [2, 2],
        borderWidth: 2,
        pointRadius: 0,
        spanGaps: true
      }
    ];

    const prettyWeeks = weeks.map(w => {
      const year = Math.floor(w / 100);
      const week = w % 100;
      return `${year} – ${week}`;
    });

    const canvas = new Canvas(1200, 500);
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: prettyWeeks,
        datasets
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: false,
              font: { size: 12 }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Epiweek' },
            ticks: {
              callback: function (value, index, ticks) {
                const label = this.getLabelForValue(value);
                if (label.endsWith(' 1')) {
                  return label.substring(0,4);
                } else {
                  return null;
                }
              },
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0
            },
            y: { title: { display: true, text: 'ILI' } }
          }
        }
      }
    });



    const png = await canvas.toBuffer('png', { matte: 'white' });
    chart.destroy();

    res.type('png').send(png);

  } catch (err) {
    console.error(err);
    res.status(500).send('Chart error');
  }
});



app.get('/state-data', (req, res) => {
  const requestedWeek = parseInt(req.query.week, 10);

  if (!requestedWeek) {
    return res.status(400).send('Missing or invalid week parameter');
  }

  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, err => {
    if (err) {
      console.error(err.message);
      return res.status(500).send(err.message);
    }
  });

  const sql = `
    SELECT d.region, d.ili
    FROM ili_data d
    JOIN (
      SELECT region, MAX(epiweek) AS epiweek
      FROM ili_data
      WHERE epiweek <= ?
      GROUP BY region
    ) latest
    ON d.region = latest.region
    AND d.epiweek = latest.epiweek
  `;

  db.all(sql, [requestedWeek], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send(err.message);
    }

    const stateData = {};
    rows.forEach(row => {
      stateData[row.region.toUpperCase()] = row.ili;
    });

    res.json(stateData);
  });

  db.close();
});

app.get('/available-weeks', (req, res) => {
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, err => {
    if (err) {
      console.error(err.message);
      return res.status(500).send(err.message);
    }
  });

  db.all(
    'SELECT DISTINCT epiweek FROM ili_data ORDER BY epiweek',
    [],
    (err, rows) => {
      if (err) {
        console.error(err.message);
        return res.status(500).send(err.message);
      }

      const weeks = rows.map(r => r.epiweek);
      res.json(weeks);
    }
  );

  db.close();
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

function generateWeeks(start, end) {
  const weeks = [];
  let year = Math.floor(start / 100);
  let week = start % 100;

  const endYear = Math.floor(end / 100);
  const endWeek = end % 100;

  while (year < endYear || (year === endYear && week <= endWeek)) {
    weeks.push(year * 100 + week);

    week++;
    if (week > 52) { // adjust to 53 if necessary for your data
      week = 1;
      year++;
    }
  }

  return weeks;
}
