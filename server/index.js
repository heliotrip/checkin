const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const dbPath = process.env.NODE_ENV === 'production' ? '/data/checkin.db' : './checkin.db';
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    overall INTEGER NOT NULL,
    wellbeing INTEGER NOT NULL,
    growth INTEGER NOT NULL,
    relationships INTEGER NOT NULL,
    impact INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
  )`);
});

app.get('/api/checkins/:userId', (req, res) => {
  const { userId } = req.params;

  db.all(
    'SELECT * FROM checkins WHERE user_id = ? ORDER BY date ASC',
    [userId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

app.get('/api/checkins/:userId/:date', (req, res) => {
  const { userId, date } = req.params;

  db.get(
    'SELECT * FROM checkins WHERE user_id = ? AND date = ?',
    [userId, date],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row || null);
    }
  );
});

app.post('/api/checkins', (req, res) => {
  const { userId, date, overall, wellbeing, growth, relationships, impact } = req.body;

  if (!userId || !date || overall == null || wellbeing == null || growth == null || relationships == null || impact == null) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const id = uuidv4();

  db.run(
    `INSERT OR REPLACE INTO checkins
     (id, user_id, date, overall, wellbeing, growth, relationships, impact)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, date, overall, wellbeing, growth, relationships, impact],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id: this.lastID || id,
        userId,
        date,
        overall,
        wellbeing,
        growth,
        relationships,
        impact
      });
    }
  );
});

app.put('/api/checkins/:userId/bulk', (req, res) => {
  const { userId } = req.params;
  const { data } = req.body;


  if (!Array.isArray(data)) {
    res.status(400).json({ error: 'Data must be an array' });
    return;
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run('DELETE FROM checkins WHERE user_id = ?', [userId], (err) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: 'Failed to clear existing data: ' + err.message });
        return;
      }

      if (data.length === 0) {
        db.run('COMMIT');
        res.json({ message: 'All data deleted successfully' });
        return;
      }

      let completed = 0;
      let hasError = false;

      data.forEach((row) => {
        const id = uuidv4();
        db.run(
          `INSERT INTO checkins
           (id, user_id, date, overall, wellbeing, growth, relationships, impact)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, userId, row.date, row.overall, row.wellbeing, row.growth, row.relationships, row.impact],
          (err) => {
            if (err && !hasError) {
              hasError = true;
              db.run('ROLLBACK');
              res.status(500).json({ error: 'Failed to insert data: ' + err.message });
              return;
            }

            completed++;
            if (completed === data.length && !hasError) {
              db.run('COMMIT');
              res.json({ message: `Successfully saved ${data.length} records` });
            }
          }
        );
      });
    });
  });
});

app.delete('/api/checkins/:userId/bulk', (req, res) => {
  const { userId } = req.params;

  db.run('DELETE FROM checkins WHERE user_id = ?', [userId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: `Deleted ${this.changes} records` });
  });
});

app.get('/api/generate-id', (req, res) => {
  const newId = uuidv4();
  res.json({ userId: newId });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});