const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { DatabaseFactory } = require('./database');

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
    console.log('Verified write access to /data directory');
    console.log(`Database will be created at: ${productionPath}`);

    // Debug: Show filesystem info about /data
    try {
      const stats = fs.statSync('/data');
      console.log(`/data directory stats: uid=${stats.uid}, gid=${stats.gid}, mode=${stats.mode.toString(8)}`);
    } catch (e) {
      console.warn('Could not get /data stats:', e.message);
    }

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

// Database initialization state
let database = null;
let isDbReady = false;
let isDbInitializing = false;
let dbInitPromise = null;
let requestQueue = [];
let isContainerReady = false;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Lazy database initialization - called on first API request
async function initializeDatabaseLazy() {
  if (isDbReady) return database;

  // If already initializing, wait for it to complete
  if (isDbInitializing && dbInitPromise) {
    return dbInitPromise;
  }

  isDbInitializing = true;
  console.log('Starting lazy database initialization...');

  dbInitPromise = (async () => {
    const maxRetries = 10;
    const baseDelay = 1000; // 1 second

    for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
      try {
        console.log(`Attempting to initialize database (attempt ${retryCount + 1}/${maxRetries + 1})`);

        // Ensure the directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
          console.log(`Created database directory: ${dbDir}`);
        }

        // Create database connection
        db = await new Promise((resolve, reject) => {
          const database = new sqlite3.Database(dbPath, (err) => {
            if (err) {
              console.error('Error opening database:', err.message);
              reject(err);
            } else {
              console.log(`Connected to SQLite database at ${dbPath}`);

              // Debug: Check if database file was created and show /data contents
              try {
                if (fs.existsSync(dbPath)) {
                  const dbStats = fs.statSync(dbPath);
                  console.log(`Database file created: size=${dbStats.size} bytes, uid=${dbStats.uid}, gid=${dbStats.gid}`);
                } else {
                  console.log('Database file does not exist yet');
                }

                // Show all files in /data directory
                const dataFiles = fs.readdirSync('/data');
                console.log(`Files in /data directory: ${dataFiles.join(', ')}`);
              } catch (e) {
                console.warn('Could not check database file stats:', e.message);
              }

              resolve(database);
            }
          });
        });

        // Configure database
        await new Promise((resolve, reject) => {
          db.serialize(() => {
            let completed = 0;
            const total = 3; // DELETE journal mode, busy timeout, table creation + write test
            let hasError = false;

            function checkCompletion() {
              completed++;
              if (completed === total && !hasError) {
                console.log('Database configuration completed successfully');
                resolve();
              }
            }

            // Set DELETE journal mode for better container platform compatibility
            db.run('PRAGMA journal_mode = DELETE', (err) => {
              if (err) {
                console.error('Error setting DELETE journal mode:', err.message);
                hasError = true;
                reject(err);
                return;
              }
              console.log('SQLite DELETE journal mode enabled for container compatibility');
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

        // Debug: Show final database file info
        try {
          if (fs.existsSync(dbPath)) {
            const dbStats = fs.statSync(dbPath);
            console.log(`Final database file: ${dbPath}, size=${dbStats.size} bytes`);

            // Show all files in /data directory after initialization
            const dataFiles = fs.readdirSync('/data');
            console.log(`Final /data contents: ${dataFiles.join(', ')}`);
          }
        } catch (e) {
          console.warn('Could not check final database stats:', e.message);
        }

        isDbReady = true;
        isDbInitializing = false;

        // Process queued requests
        await processQueuedRequests();

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
        } else {
          console.error('Max retries exceeded. Database initialization failed.');
          isDbInitializing = false;
          throw error;
        }
      }
    }
  })();

  return dbInitPromise;
}

// Process queued requests after database initialization
async function processQueuedRequests() {
  console.log(`Processing ${requestQueue.length} queued requests...`);

  for (const queuedRequest of requestQueue) {
    try {
      await queuedRequest.handler();
      console.log('Processed queued request successfully');
    } catch (error) {
      console.error('Error processing queued request:', error.message);
      queuedRequest.reject(error);
    }
  }

  requestQueue = [];
  console.log('Finished processing queued requests');
}

// Middleware to handle database initialization and request queuing
async function ensureDatabaseReady(req, res, next) {
  if (isDbReady && db) {
    // Database is ready, proceed normally
    return next();
  }

  if (!isDbInitializing) {
    // Start lazy initialization on first request
    console.log('Database not initialized, starting lazy initialization...');
    initializeDatabaseLazy().catch(error => {
      console.error('Database initialization failed:', error.message);
    });
  }

  if (isDbInitializing) {
    // Queue this request to be processed after initialization
    console.log('Queueing request during database initialization...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Database initialization timeout'));
      }, 60000); // 1 minute timeout

      requestQueue.push({
        handler: async () => {
          clearTimeout(timeout);
          res.locals.isQueuedRequest = true;
          next();
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeout);
          res.status(503).json({
            error: 'Database initialization failed',
            details: error.message
          });
          reject(error);
        }
      });
    });
  }

  // Fallback - should not reach here
  return res.status(503).json({
    error: 'Database not ready. Please try again in a moment.',
    ready: false
  });
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

// Health check endpoint - shows database status
app.get('/health', (req, res) => {
  if (isDbReady && db) {
    // Database is fully ready - do connectivity test
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
        database: 'ready',
        timestamp: new Date().toISOString()
      });
    });
  } else if (isDbInitializing) {
    // Database is initializing - container is working but not fully ready
    res.json({
      status: 'healthy',
      database: 'initializing',
      queuedRequests: requestQueue.length,
      timestamp: new Date().toISOString()
    });
  } else if (isContainerReady) {
    // Container is ready but database not yet initialized
    res.json({
      status: 'healthy',
      database: 'not_initialized',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      database: 'not_ready',
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness check endpoint - for container orchestration (fast startup)
app.get('/ready', (req, res) => {
  if (isContainerReady) {
    // Container can accept traffic even if database isn't ready yet
    res.json({
      ready: true,
      database: isDbReady ? 'ready' : (isDbInitializing ? 'initializing' : 'not_initialized'),
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString()
    });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Fast container startup - no database initialization
async function startServer() {
  try {
    console.log('Starting server with fast readiness approach...');

    // Only verify filesystem access, not database initialization
    console.log('Container readiness check completed - filesystem access verified');
    isContainerReady = true;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
      console.log(`Ready check available at http://localhost:${PORT}/ready`);
      console.log('Database will be initialized on first API request (lazy initialization)');
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  gracefulShutdown();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  gracefulShutdown();
});

function gracefulShutdown() {
  console.log('Starting graceful shutdown...');

  // Close database connection if it exists
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
      process.exit(0);
    });
  } else {
    console.log('No database connection to close');
    process.exit(0);
  }

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log('Forcing exit after timeout');
    process.exit(1);
  }, 10000);
}

startServer();