const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { DatabaseFactory } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Required for React
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for React/MUI
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 API requests per windowMs
  message: {
    error: 'Too many API requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 write operations per windowMs
  message: {
    error: 'Too many write requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);
app.use('/api', apiLimiter);

// Body parsing with size limits
app.use(bodyParser.json({
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Store raw body for potential CSRF verification
    req.rawBody = buf;
  }
}));

app.use(bodyParser.urlencoded({
  limit: '10mb',
  extended: true
}));

// Database instance and state management
let database = null;
let isDbReady = false;
let isDbInitializing = false;
let dbInitPromise = null;
let requestQueue = [];

// Only perform /data directory verification for SQLite in production
async function verifyDataDirectoryIfNeeded() {
  // If we're using Azure SQL, skip the /data directory checks
  const hasAzureConfig = process.env.AZURE_SQL_SERVER &&
                        process.env.AZURE_SQL_DATABASE &&
                        process.env.AZURE_SQL_USERNAME &&
                        process.env.AZURE_SQL_PASSWORD;

  if (hasAzureConfig) {
    console.log('Using Azure SQL Database - skipping /data directory verification');
    return;
  }

  // Only verify /data in production for SQLite
  if (process.env.NODE_ENV === 'production') {
    try {
      const testFile = '/data/.write-test';
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log('Verified write access to /data directory for SQLite');
    } catch (error) {
      console.error('CRITICAL: Cannot write to /data directory in production!');
      console.error('This will result in data loss as container filesystem is ephemeral.');
      console.error('Error:', error.message);
      console.error('Ensure the /data volume is mounted with proper permissions.');
      process.exit(1);
    }
  }
}

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

        // Create database adapter using factory
        database = DatabaseFactory.create();

        // Initialize the database
        await database.initialize();

        // Test the connection with a simple query
        console.log('Testing database connection...');
        const testResult = await database.getCheckins('test-connection-check');
        console.log('Database connection test successful');

        isDbReady = true;
        isDbInitializing = false;

        // Process any queued requests
        await processQueuedRequests();

        console.log('Database initialization completed successfully');
        return database;

      } catch (error) {
        console.error(`Database initialization failed (attempt ${retryCount + 1}):`, error.message);

        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await sleep(delay);
        } else {
          console.error('Database initialization failed after all retries');
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
  if (requestQueue.length === 0) return;

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
  if (isDbReady && database) {
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
}

// Apply database middleware to all API routes
app.use('/api', ensureDatabaseReady);

// Health check endpoint (doesn't require database)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: isDbReady ? 'ready' : 'initializing'
  });
});

// Ready check endpoint (requires database to be ready)
app.get('/ready', async (req, res) => {
  try {
    if (!isDbReady || !database) {
      return res.status(503).json({
        status: 'not ready',
        reason: 'Database not initialized'
      });
    }

    // Test database connection
    await database.getCheckins('readiness-check');

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      reason: error.message
    });
  }
});

// Generate a new user ID
app.get('/api/generate-id', (req, res) => {
  const userId = uuidv4();
  res.json({ userId });
});

// Get all checkins for a user
app.get('/api/checkins/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const checkins = await database.getCheckins(userId);
    res.json(checkins);
  } catch (error) {
    console.error('Error getting checkins:', error.message);
    res.status(500).json({ error: 'Failed to retrieve checkins' });
  }
});

// Get a specific checkin for a user and date
app.get('/api/checkins/:userId/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;
    const checkin = await database.getCheckin(userId, date);

    // Return null for non-existent checkins (not a 404 error)
    // This maintains compatibility with the frontend logic
    res.json(checkin);
  } catch (error) {
    console.error('Error getting checkin:', error.message);
    res.status(500).json({ error: 'Failed to retrieve checkin' });
  }
});

// Input validation and sanitization
function validateAndSanitizeInput(req, res, next) {
  // Validate UUID format for userId parameters
  if (req.params.userId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.userId)) {
    return res.status(400).json({ error: 'Invalid userId format' });
  }

  // Validate date format (YYYY-MM-DD)
  if (req.params.date && !/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // Sanitize strings to prevent potential issues
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
        // Basic XSS prevention - remove HTML tags
        req.body[key] = req.body[key].replace(/<[^>]*>/g, '');
      }
    }
  }

  next();
}

// Apply input validation to API routes
app.use('/api', validateAndSanitizeInput);

// Create or update a checkin
app.post('/api/checkins', strictLimiter, async (req, res) => {
  try {
    const { userId, date, overall, wellbeing, growth, relationships, impact } = req.body;

    // Validate required fields
    if (!userId || !date || overall === undefined || wellbeing === undefined ||
        growth === undefined || relationships === undefined || impact === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate UUID format for userId
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return res.status(400).json({ error: 'Invalid userId format' });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate date is not in the future (allow today)
    const inputDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    if (inputDate > today) {
      return res.status(400).json({ error: 'Date cannot be in the future' });
    }

    // Validate values are within range (1-10)
    const values = { overall, wellbeing, growth, relationships, impact };
    for (const [key, value] of Object.entries(values)) {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) {
        return res.status(400).json({
          error: `Invalid ${key} value. Must be an integer between 1 and 10.`
        });
      }
    }

    const result = await database.createOrUpdateCheckin(userId, date, values);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating/updating checkin:', error.message);
    res.status(500).json({ error: 'Failed to save checkin' });
  }
});

// Bulk replace all checkins for a user (used by CSV import)
app.put('/api/checkins/:userId/bulk', strictLimiter, async (req, res) => {
  try {
    const { userId } = req.params;
    const { data } = req.body;

    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Data must be an array' });
    }

    const result = await database.bulkReplaceCheckins(userId, data);
    res.json(result);
  } catch (error) {
    console.error('Error bulk replacing checkins:', error.message);
    res.status(500).json({ error: 'Failed to bulk update checkins' });
  }
});

// Delete all checkins for a user
app.delete('/api/checkins/:userId/bulk', strictLimiter, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await database.deleteAllCheckins(userId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting checkins:', error.message);
    res.status(500).json({ error: 'Failed to delete checkins' });
  }
});

// Serve React static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  try {
    if (database) {
      console.log('Closing database connection...');
      await database.close();
    }

    console.log('Database connection closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
async function startServer() {
  try {
    // Verify data directory if needed (only for SQLite in production)
    await verifyDataDirectoryIfNeeded();

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

startServer();