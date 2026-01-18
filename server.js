const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());

const DB_PATH = './ili_data.db';

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
