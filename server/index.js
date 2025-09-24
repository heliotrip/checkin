const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Determine database path - must be persistent in production
function getDatabasePath() {
  if (process.env.NODE_ENV !== 'production') {
    return './checkin.db';
  }

  // In production, MUST use /data (persistent volume)
  const productionPath = '/data/checkin.db';

  // Verify we can write to the mounted directory
  try {
    const testFile = '/data/.write-test';
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('Verified write access to persistent volume at /data');
    return productionPath;
  } catch (error) {
    console.error('CRITICAL: Cannot write to /data directory in production!');
    console.error('This will result in data loss as container filesystem is ephemeral.');
    console.error('Error:', error.message);
    console.error('Ensure the /data volume is mounted with proper permissions.');
    console.error('Container will now exit to prevent data loss.');

    // Exit immediately to prevent running with ephemeral storage
    process.exit(1);
  }
}

const dbPath = getDatabasePath();

// Database initialization with retry logic
let db = null;
let isDbReady = false;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function initializeDatabase(retryCount = 0) {
  const maxRetries = 10;
  const baseDelay = 1000; // 1 second

  try {
    console.log(`Attempting to initialize database (attempt ${retryCount + 1}/${maxRetries + 1})`);

    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`Created database directory: ${dbDir}`);
    }

    // Create database connection with timeout
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        throw err;
      }
      console.log(`Connected to SQLite database at ${dbPath}`);
    });

    // Configure database for better concurrency and performance
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        let completed = 0;
        const total = 3; // WAL mode, busy timeout, table creation + write test
        let hasError = false;

        function checkCompletion() {
          completed++;
          if (completed === total && !hasError) {
            console.log('Database configuration completed successfully');
            isDbReady = true;
            resolve();
          }
        }

        // Try to enable WAL mode for better concurrency (non-critical)
        db.run('PRAGMA journal_mode = WAL', (err) => {
          if (err) {
            console.warn('Could not set WAL mode (non-critical):', err.message);
            console.log('Continuing with default journal mode');
          } else {
            console.log('SQLite WAL mode enabled');
          }
          checkCompletion();
        });

        // Set busy timeout to 30 seconds
        db.run('PRAGMA busy_timeout = 30000', (err) => {
          if (err) {
            console.error('Error setting busy timeout:', err.message);
            hasError = true;
            reject(err);
            return;
          }
          console.log('SQLite busy timeout set to 30 seconds');
          checkCompletion();
        });

        // Create table (critical)
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
        )`, (err) => {
          if (err) {
            console.error('Error creating table:', err.message);
            hasError = true;
            reject(err);
            return;
          }
          console.log('Database table initialized successfully');

          // Test actual database write capability
          const testId = 'test-write-capability-' + Date.now();
          db.run(`INSERT INTO checkins (id, user_id, date, overall, wellbeing, growth, relationships, impact)
                   VALUES (?, 'test-user', '1900-01-01', 1, 1, 1, 1, 1)`, [testId], (err) => {
            if (err) {
              console.error('CRITICAL: Database is read-only - cannot perform write operations!');
              console.error('Error:', err.message);
              console.error('This indicates a filesystem or database permission issue.');
              console.error('Container will now exit to prevent false operation.');
              hasError = true;
              reject(new Error('Database write test failed: ' + err.message));
              return;
            }

            // Clean up test record
            db.run(`DELETE FROM checkins WHERE id = ?`, [testId], (err) => {
              if (err) {
                console.warn('Could not clean up test record, but write test passed:', err.message);
              }
              console.log('Database write test passed successfully');
              checkCompletion();
            });
          });
        });
      });
    });

    console.log('Database initialization completed successfully');
    return db;

  } catch (error) {
    console.error(`Database initialization failed (attempt ${retryCount + 1}):`, error.message);

    if (db) {
      db.close();
      db = null;
    }

    if (retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
      console.log(`Retrying in ${delay}ms...`);
      await sleep(delay);
      return initializeDatabase(retryCount + 1);
    } else {
      console.error('Max retries exceeded. Database initialization failed.');
      throw error;
    }
  }
}

// Middleware to check database readiness
function ensureDatabaseReady(req, res, next) {
  if (!isDbReady || !db) {
    return res.status(503).json({
      error: 'Database not ready. Please try again in a moment.',
      ready: false
    });
  }
  next();
}

app.get('/api/checkins/:userId', ensureDatabaseReady, (req, res) => {
  const { userId } = req.params;

  db.all(
    'SELECT * FROM checkins WHERE user_id = ? ORDER BY date ASC',
    [userId],
    (err, rows) => {
      if (err) {
        console.error(`Error fetching checkins for user ${userId}:`, err.message);
        res.status(500).json({ error: 'Failed to fetch check-ins', details: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

app.get('/api/checkins/:userId/:date', ensureDatabaseReady, (req, res) => {
  const { userId, date } = req.params;

  db.get(
    'SELECT * FROM checkins WHERE user_id = ? AND date = ?',
    [userId, date],
    (err, row) => {
      if (err) {
        console.error(`Error fetching checkin for user ${userId} on ${date}:`, err.message);
        res.status(500).json({ error: 'Failed to fetch check-in', details: err.message });
        return;
      }
      res.json(row || null);
    }
  );
});

app.post('/api/checkins', ensureDatabaseReady, (req, res) => {
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
        console.error(`Error saving checkin for user ${userId} on ${date}:`, err.message);
        res.status(500).json({ error: 'Failed to save check-in', details: err.message });
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

app.put('/api/checkins/:userId/bulk', ensureDatabaseReady, (req, res) => {
  const { userId } = req.params;
  const { data } = req.body;

  if (!Array.isArray(data)) {
    res.status(400).json({ error: 'Data must be an array' });
    return;
  }

  console.log(`Starting bulk update for user ${userId} with ${data.length} records`);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run('DELETE FROM checkins WHERE user_id = ?', [userId], (err) => {
      if (err) {
        console.error(`Error clearing existing data for user ${userId}:`, err.message);
        db.run('ROLLBACK');
        res.status(500).json({ error: 'Failed to clear existing data', details: err.message });
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
              console.error(`Error inserting bulk data for user ${userId}:`, err.message);
              db.run('ROLLBACK');
              res.status(500).json({ error: 'Failed to insert data', details: err.message });
              return;
            }

            completed++;
            if (completed === data.length && !hasError) {
              db.run('COMMIT');
              console.log(`Successfully saved ${data.length} records for user ${userId}`);
              res.json({ message: `Successfully saved ${data.length} records` });
            }
          }
        );
      });
    });
  });
});

app.delete('/api/checkins/:userId/bulk', ensureDatabaseReady, (req, res) => {
  const { userId } = req.params;

  db.run('DELETE FROM checkins WHERE user_id = ?', [userId], function(err) {
    if (err) {
      console.error(`Error deleting data for user ${userId}:`, err.message);
      res.status(500).json({ error: 'Failed to delete records', details: err.message });
      return;
    }
    console.log(`Deleted ${this.changes} records for user ${userId}`);
    res.json({ message: `Deleted ${this.changes} records` });
  });
});

app.get('/api/generate-id', (req, res) => {
  const newId = uuidv4();
  res.json({ userId: newId });
});

// Health check endpoint
app.get('/health', (req, res) => {
  if (isDbReady && db) {
    // Quick database connectivity test
    db.get('SELECT 1 as test', (err, row) => {
      if (err) {
        console.error('Health check database query failed:', err.message);
        res.status(503).json({
          status: 'unhealthy',
          database: 'error',
          error: err.message,
          timestamp: new Date().toISOString()
        });
        return;
      }
      res.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      database: 'not_ready',
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness check endpoint (for container orchestration)
app.get('/ready', (req, res) => {
  if (isDbReady && db) {
    res.json({ ready: true, timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({ ready: false, timestamp: new Date().toISOString() });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Initialize database and start server
async function startServer() {
  try {
    console.log('Starting server initialization...');
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
      console.log(`Ready check available at http://localhost:${PORT}/ready`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();