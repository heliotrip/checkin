const sqlite3 = require('sqlite3').verbose();
const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class DatabaseAdapter {
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  async getCheckins(userId) {
    throw new Error('getCheckins() must be implemented by subclass');
  }

  async getCheckin(userId, date) {
    throw new Error('getCheckin() must be implemented by subclass');
  }

  async createOrUpdateCheckin(userId, date, values) {
    throw new Error('createOrUpdateCheckin() must be implemented by subclass');
  }

  async bulkReplaceCheckins(userId, checkinData) {
    throw new Error('bulkReplaceCheckins() must be implemented by subclass');
  }

  async deleteAllCheckins(userId) {
    throw new Error('deleteAllCheckins() must be implemented by subclass');
  }

  async close() {
    throw new Error('close() must be implemented by subclass');
  }
}

class SQLiteAdapter extends DatabaseAdapter {
  constructor(dbPath) {
    super();
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      // Ensure the directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`Created database directory: ${dbDir}`);
      }

      // Create database connection
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening SQLite database:', err.message);
          return reject(err);
        }
        console.log(`Connected to SQLite database at ${this.dbPath}`);
      });

      // Configure SQLite for better Azure compatibility if needed
      this.db.configure('busyTimeout', 30000);

      // Set journal mode for container compatibility
      this.db.run('PRAGMA journal_mode=DELETE', (err) => {
        if (err) {
          console.error('Error setting journal mode:', err.message);
          return reject(err);
        }
        console.log('SQLite DELETE journal mode enabled for container compatibility');
      });

      // Create tables
      this.db.run(`CREATE TABLE IF NOT EXISTS checkins (
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
          console.error('Error creating SQLite table:', err.message);
          return reject(err);
        }
        console.log('SQLite database initialized successfully');
        resolve();
      });
    });
  }

  async getCheckins(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM checkins WHERE user_id = ? ORDER BY date ASC',
        [userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  async getCheckin(userId, date) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM checkins WHERE user_id = ? AND date = ?',
        [userId, date],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
  }

  async createOrUpdateCheckin(userId, date, values) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO checkins
         (id, user_id, date, overall, wellbeing, growth, relationships, impact)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, date, values.overall, values.wellbeing, values.growth, values.relationships, values.impact],
        function(err) {
          if (err) return reject(err);
          resolve({ id, userId, date, ...values });
        }
      );
    });
  }

  async bulkReplaceCheckins(userId, checkinData) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Delete existing data for this user
        this.db.run('DELETE FROM checkins WHERE user_id = ?', [userId], (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            return reject(err);
          }
        });

        // Insert new data
        const stmt = this.db.prepare(`
          INSERT INTO checkins (id, user_id, date, overall, wellbeing, growth, relationships, impact)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const row of checkinData) {
          stmt.run(
            uuidv4(), userId, row.date,
            row.overall, row.wellbeing, row.growth, row.relationships, row.impact
          );
        }

        stmt.finalize((err) => {
          if (err) {
            this.db.run('ROLLBACK');
            return reject(err);
          }

          this.db.run('COMMIT', (err) => {
            if (err) return reject(err);
            resolve({ inserted: checkinData.length });
          });
        });
      });
    });
  }

  async deleteAllCheckins(userId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM checkins WHERE user_id = ?', [userId], function(err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes });
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) return reject(err);
          console.log('SQLite database connection closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

class AzureSQLAdapter extends DatabaseAdapter {
  constructor(config) {
    super();
    this.config = {
      server: config.server,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: true, // Use encryption
        enableArithAbort: true,
        trustServerCertificate: false
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };
    this.pool = null;
  }

  async initialize() {
    try {
      console.log(`Connecting to Azure SQL Database: ${this.config.server}/${this.config.database}`);
      this.pool = await sql.connect(this.config);

      // Create table if it doesn't exist
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='checkins' AND xtype='U')
        CREATE TABLE checkins (
          id NVARCHAR(36) PRIMARY KEY,
          user_id NVARCHAR(36) NOT NULL,
          date DATE NOT NULL,
          overall INT NOT NULL,
          wellbeing INT NOT NULL,
          growth INT NOT NULL,
          relationships INT NOT NULL,
          impact INT NOT NULL,
          created_at DATETIME2 DEFAULT GETDATE(),
          CONSTRAINT UQ_checkins_user_date UNIQUE(user_id, date)
        )
      `);

      console.log('Azure SQL Database initialized successfully');
    } catch (err) {
      console.error('Error initializing Azure SQL Database:', err.message);
      throw err;
    }
  }

  async getCheckins(userId) {
    try {
      const result = await this.pool.request()
        .input('userId', sql.NVarChar, userId)
        .query('SELECT * FROM checkins WHERE user_id = @userId ORDER BY date ASC');

      return result.recordset.map(row => ({
        id: row.id,
        user_id: row.user_id,
        date: row.date.toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        overall: row.overall,
        wellbeing: row.wellbeing,
        growth: row.growth,
        relationships: row.relationships,
        impact: row.impact,
        created_at: row.created_at
      }));
    } catch (err) {
      console.error('Error getting checkins:', err.message);
      throw err;
    }
  }

  async getCheckin(userId, date) {
    try {
      const result = await this.pool.request()
        .input('userId', sql.NVarChar, userId)
        .input('date', sql.Date, date)
        .query('SELECT * FROM checkins WHERE user_id = @userId AND date = @date');

      if (result.recordset.length === 0) return null;

      const row = result.recordset[0];
      return {
        id: row.id,
        user_id: row.user_id,
        date: row.date.toISOString().split('T')[0],
        overall: row.overall,
        wellbeing: row.wellbeing,
        growth: row.growth,
        relationships: row.relationships,
        impact: row.impact,
        created_at: row.created_at
      };
    } catch (err) {
      console.error('Error getting checkin:', err.message);
      throw err;
    }
  }

  async createOrUpdateCheckin(userId, date, values) {
    try {
      const id = uuidv4();
      await this.pool.request()
        .input('id', sql.NVarChar, id)
        .input('userId', sql.NVarChar, userId)
        .input('date', sql.Date, date)
        .input('overall', sql.Int, values.overall)
        .input('wellbeing', sql.Int, values.wellbeing)
        .input('growth', sql.Int, values.growth)
        .input('relationships', sql.Int, values.relationships)
        .input('impact', sql.Int, values.impact)
        .query(`
          MERGE checkins AS target
          USING (SELECT @id as id, @userId as user_id, @date as date,
                        @overall as overall, @wellbeing as wellbeing, @growth as growth,
                        @relationships as relationships, @impact as impact) AS source
          ON target.user_id = source.user_id AND target.date = source.date
          WHEN MATCHED THEN
            UPDATE SET overall = source.overall, wellbeing = source.wellbeing,
                      growth = source.growth, relationships = source.relationships,
                      impact = source.impact
          WHEN NOT MATCHED THEN
            INSERT (id, user_id, date, overall, wellbeing, growth, relationships, impact)
            VALUES (source.id, source.user_id, source.date, source.overall,
                   source.wellbeing, source.growth, source.relationships, source.impact);
        `);

      return { id, userId, date, ...values };
    } catch (err) {
      console.error('Error creating/updating checkin:', err.message);
      throw err;
    }
  }

  async bulkReplaceCheckins(userId, checkinData) {
    const transaction = new sql.Transaction(this.pool);

    try {
      await transaction.begin();

      // Delete existing data for this user
      await transaction.request()
        .input('userId', sql.NVarChar, userId)
        .query('DELETE FROM checkins WHERE user_id = @userId');

      // Insert new data
      for (const row of checkinData) {
        await transaction.request()
          .input('id', sql.NVarChar, uuidv4())
          .input('userId', sql.NVarChar, userId)
          .input('date', sql.Date, row.date)
          .input('overall', sql.Int, row.overall)
          .input('wellbeing', sql.Int, row.wellbeing)
          .input('growth', sql.Int, row.growth)
          .input('relationships', sql.Int, row.relationships)
          .input('impact', sql.Int, row.impact)
          .query(`
            INSERT INTO checkins (id, user_id, date, overall, wellbeing, growth, relationships, impact)
            VALUES (@id, @userId, @date, @overall, @wellbeing, @growth, @relationships, @impact)
          `);
      }

      await transaction.commit();
      return { inserted: checkinData.length };
    } catch (err) {
      await transaction.rollback();
      console.error('Error bulk replacing checkins:', err.message);
      throw err;
    }
  }

  async deleteAllCheckins(userId) {
    try {
      const result = await this.pool.request()
        .input('userId', sql.NVarChar, userId)
        .query('DELETE FROM checkins WHERE user_id = @userId');

      return { deleted: result.rowsAffected[0] };
    } catch (err) {
      console.error('Error deleting checkins:', err.message);
      throw err;
    }
  }

  async close() {
    try {
      if (this.pool) {
        await this.pool.close();
        console.log('Azure SQL Database connection closed');
      }
    } catch (err) {
      console.error('Error closing Azure SQL Database connection:', err.message);
      throw err;
    }
  }
}

class DatabaseFactory {
  static create() {
    // Check for Azure SQL Database credentials
    const azureConfig = {
      server: process.env.AZURE_SQL_SERVER,
      database: process.env.AZURE_SQL_DATABASE,
      username: process.env.AZURE_SQL_USERNAME,
      password: process.env.AZURE_SQL_PASSWORD
    };

    // If all Azure SQL credentials are present, use Azure SQL
    if (azureConfig.server && azureConfig.database && azureConfig.username && azureConfig.password) {
      console.log('Using Azure SQL Database');
      return new AzureSQLAdapter(azureConfig);
    }

    // Otherwise, fall back to SQLite
    console.log('Using SQLite database');
    const dbPath = process.env.NODE_ENV === 'production' ? '/data/checkin.db' : './checkin.db';
    return new SQLiteAdapter(dbPath);
  }
}

module.exports = { DatabaseFactory, DatabaseAdapter, SQLiteAdapter, AzureSQLAdapter };