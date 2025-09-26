# Claude Code Project Context - Checkin

## Project Overview

Checkin is a 1-1 check-in tracking application for monitoring team progress over time across five key categories: Overall, Wellbeing, Growth, Relationships, and Impact. Originally started as "trendster" but renamed to "checkin" during development.

### Key Features
- Anonymous GUID-based user tracking (no personal data stored)
- Interactive slider-based ratings (1-10 scale)
- Historical sparkline visualizations using Chart.js
- CSV data editor for bulk import/export
- Team management with local name storage
- Recent IDs with unlimited history for team navigation
- URL-based sharing for team coordination
- Docker deployment with persistent SQLite storage
- Playwright test suite for cross-browser testing

## Architecture

### Frontend (`/client`)
- **React** with Material-UI components
- **React Router** for navigation between pages
- **Chart.js** for sparkline visualizations
- **CSS Grid** layout (not Material-UI Grid - this was a critical fix)

### Backend (`/server`)
- **Node.js/Express** API server
- **SQLite** database with persistent storage
- **UUID** for anonymous user identification

### Database Schema
```sql
CREATE TABLE checkins (
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
);
```

## Key Files & Components

### Frontend Components
- **`client/src/App.js`** - Main routing, Chart.js registration
- **`client/src/HomePage.js`** - Landing page with ID generation and team management
- **`client/src/CheckinPage.js`** - Core check-in interface with sliders and sparklines
- **`client/src/DataEditor.js`** - CSV bulk data editor with import/export

### Backend
- **`server/index.js`** - Express server with all API endpoints and database setup

### Configuration
- **`package.json`** - Root package with scripts for running client/server
- **`client/package.json`** - React app dependencies
- **`docker-compose.yml`** - Production deployment configuration
- **`Dockerfile`** - Multi-stage build for production

## Development Workflow

### Local Development
```bash
# Install all dependencies
npm run install-all

# Start both servers (frontend on :3000, backend on :3001)
npm run dev

# Start backend only
npm start

# Build for production
npm run build
```

### Docker Deployment
```bash
# Build and run
docker-compose up -d

# App available at http://localhost:3001
```

## API Endpoints

### Core Operations
- `GET /api/generate-id` - Generate new user GUID
- `GET /api/checkins/:userId` - Get all user check-ins
- `GET /api/checkins/:userId/:date` - Get specific check-in
- `POST /api/checkins` - Create/update check-in

### Bulk Operations
- `PUT /api/checkins/:userId/bulk` - Replace all user data with CSV import
- `DELETE /api/checkins/:userId/bulk` - Delete all user data

## Critical Implementation Notes

### Layout Issues Fixed
- **NEVER use Material-UI Grid for the main layout** - Use CSS Grid instead
- The CheckinPage uses `gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }` for responsive layout
- Material-UI Grid caused initial display bugs showing 5-in-a-row instead of 2-column layout

### Database Constraints
- UNIQUE constraint on (user_id, date) prevents duplicate entries
- CSV imports will fail with 500 error if duplicate dates exist
- Always validate CSV data for unique dates before bulk operations

### State Management
- User names stored in localStorage as JSON: `checkin-id-names`
- Anonymous GUIDs stored in localStorage: `checkin-user-id`
- No React state management library needed - component state sufficient

### React Hooks Dependencies
- Avoid complex useCallback/useEffect dependency chains
- Keep useEffect dependencies simple to prevent infinite loops
- The project had issues with circular dependencies that were resolved by simplifying hooks

## Data Flow

### Check-in Process
1. User navigates to /:userId (or generates new ID)
2. CheckinPage loads historical data via GET /api/checkins/:userId
3. User adjusts sliders and saves via POST /api/checkins
4. Sparklines update automatically with new data
5. Data persists in SQLite with Docker volume mount

### CSV Data Editor
1. User clicks "Edit Data" from CheckinPage
2. DataEditor loads at /:userId/data
3. Displays current data as editable CSV
4. Supports file upload/download
5. Bulk save via PUT /api/checkins/:userId/bulk replaces ALL user data

## Deployment Notes

### Azure Container Apps Deployment (Recommended)

#### Prerequisites
1. Azure SQL Database (Basic/Standard tier minimum)
2. Azure Container Registry or Docker Hub
3. Azure Container Apps environment

#### Step 1: Create Azure SQL Database
```bash
# Create resource group
az group create --name checkin-rg --location eastus

# Create SQL Server
az sql server create --name checkin-sql --resource-group checkin-rg --location eastus --admin-user checkin_admin --admin-password YourSecurePassword123!

# Create database
az sql db create --server checkin-sql --resource-group checkin-rg --name checkin --service-objective Basic

# Configure firewall (allow Azure services)
az sql server firewall-rule create --server checkin-sql --resource-group checkin-rg --name AllowAzure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

#### Step 2: Build and Push Container
```bash
# Build for Azure
docker build -t checkin:latest .

# Tag and push to registry
docker tag checkin:latest youracr.azurecr.io/checkin:latest
docker push youracr.azurecr.io/checkin:latest
```

#### Step 3: Deploy Container App with Secrets
```bash
# Create Container Apps environment
az containerapp env create --name checkin-env --resource-group checkin-rg --location eastus

# Create Container App with database secrets
az containerapp create \
  --name checkin-app \
  --resource-group checkin-rg \
  --environment checkin-env \
  --image youracr.azurecr.io/checkin:latest \
  --target-port 3001 \
  --ingress external \
  --secrets azure-sql-server="checkin-sql.database.windows.net" \
             azure-sql-database="checkin" \
             azure-sql-username="checkin_admin" \
             azure-sql-password="YourSecurePassword123!" \
  --env-vars AZURE_SQL_SERVER=secretref:azure-sql-server \
             AZURE_SQL_DATABASE=secretref:azure-sql-database \
             AZURE_SQL_USERNAME=secretref:azure-sql-username \
             AZURE_SQL_PASSWORD=secretref:azure-sql-password \
             NODE_ENV=production \
             ALLOWED_ORIGINS="https://your-domain.com"
```

#### Benefits of Azure SQL Deployment
- **No persistent volume issues** - eliminates SQLite locking on shared storage
- **Automatic scaling** - Azure SQL handles concurrent connections
- **Built-in backup** - Point-in-time restore available
- **High availability** - 99.9% SLA with automatic failover
- **Security** - Built-in encryption, firewall, threat detection

### Railway Deployment (SQLite)
- Uses `railway.toml` for configuration
- Builds React app and serves via Express static middleware
- Environment variables: `NODE_ENV=production`
- Database: Uses SQLite with local volume mounting

### File Structure Requirements
- `client/public` folder MUST exist for React build
- Custom SVG icons replace default React logos
- Cache-busting parameters on icons (e.g., `favicon.svg?v=2`)

## Testing & Quality

### Manual Testing Checklist
- [ ] ID generation and URL sharing works
- [ ] Slider interactions save correctly
- [ ] Sparklines display historical trends with data points and hover tooltips
- [ ] Category descriptions appear on hover without layout shifts
- [ ] CSV editor loads existing data
- [ ] CSV upload/download functions
- [ ] Name assignment and local storage
- [ ] Docker deployment with data persistence
- [ ] All automated tests pass: `npm test`

### Known Issues
- CSV validation only checks format, not business logic
- LocalStorage data not synced across devices
- No user authentication (by design)

## Common Development Tasks

### Adding New Features
1. Update database schema in `server/index.js` if needed
2. Add API endpoints for new data operations
3. Create React components in `client/src/`
4. Update routing in `App.js`
5. Test locally with `npm run dev`
6. Update README.md with new features

### Debugging Database Issues
```bash
# Access SQLite database directly
sqlite3 checkin.db
.tables
.schema checkins
SELECT * FROM checkins LIMIT 5;
```

### Icon/Branding Updates
- Update `client/public/manifest.json`
- Replace SVG files in `client/public/`
- Add cache-busting parameters to force refresh
- Test across different browsers and devices

## Environment Variables

### Database Configuration (Optional - Azure SQL Database)
- `AZURE_SQL_SERVER` - Azure SQL Server hostname (e.g., `myserver.database.windows.net`)
- `AZURE_SQL_DATABASE` - Database name (e.g., `checkin`)
- `AZURE_SQL_USERNAME` - Database username (e.g., `checkin_admin`)
- `AZURE_SQL_PASSWORD` - Database password (store in Azure Container Apps secrets)

### Security Configuration
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins for production (e.g., `https://mydomain.com,https://www.mydomain.com`)

### Development
- `PORT=3001` (backend server port)
- `NODE_ENV=development`
- No Azure SQL variables → Automatically uses SQLite at `./checkin.db`

### Production (SQLite)
- `NODE_ENV=production`
- No Azure SQL variables → Uses SQLite at `/data/checkin.db` (requires persistent volume)

### Production (Azure SQL)
- `NODE_ENV=production`
- All 4 Azure SQL variables set → Uses Azure SQL Database
- No persistent volume required

## Dependencies

### Critical Dependencies
- `sqlite3` - SQLite database operations (local/development)
- `mssql` - Azure SQL Database operations (cloud production)
- `helmet` - Security headers and protection
- `express-rate-limit` - Rate limiting and abuse prevention
- `uuid` - GUID generation
- `express` - Web server
- `react-router-dom` - Frontend routing
- `@mui/material` - UI components
- `chart.js` and `react-chartjs-2` - Sparkline charts

### Development Tools
- `concurrently` - Run client/server simultaneously
- `@playwright/test` - Cross-browser end-to-end testing
- Docker and docker-compose for deployment

## Future Considerations

### Potential Enhancements
- Export to other formats (PDF, Excel)
- Email/Slack integration for check-in reminders
- Team dashboard with aggregated views
- Mobile app using React Native
- Real-time collaboration features

### Technical Debt
- Expand test coverage beyond core functionality
- Implement error boundaries in React
- Add database migrations system
- Consider moving to PostgreSQL for production scale
- Add API rate limiting and security headers

## Recent Enhancements

### Dual Database Support & Security (Latest)
- **Azure SQL Database support** alongside SQLite for cloud deployments
- **Automatic database selection** based on environment variables (Azure credentials → Azure SQL, otherwise SQLite)
- **Database abstraction layer** with DatabaseFactory pattern for seamless switching
- **Enhanced security** with Helmet.js, rate limiting, input validation, and XSS protection
- **Production-ready deployment** for Azure Container Apps with secrets management
- **Solves persistent volume issues** - no more SQLite locking problems on Azure File Storage

### UI Enhancement & User Experience
- **Enhanced sparklines** with visible data points and hover tooltips showing exact values and dates
- **Category descriptions** with contextual help that appears on hover without layout shifts
- **Improved category design** with icons (🎯 Overall, 🌱 Wellbeing, 📈 Growth, 👥 Relationships, ⚡ Impact)
- **Better slider UX** with inline emoji indicators (😞 😊) and descriptive category text
- **Last check-in date display** for better user context
- **Refined descriptions** focused on actionable, descriptive language rather than questions

### Playwright Test Suite
- **Comprehensive cross-browser testing** with Playwright covering 15 tests
- **Core functionality coverage**: Homepage, Checkin Page, Recent IDs functionality
- **Multi-browser support**: Chromium, Firefox, WebKit
- **Test scripts**: `npm test`, `npm run test:headed`, `npm run test:ui`, `npm run test:report`
- **Robust test selectors** using `getByRole` for better maintainability
- Configuration in `playwright.config.js`

### Recent IDs Enhancement
- Removed 5-item limit from Recent IDs section in `client/src/HomePage.js:70`
- Users can now access unlimited history of all visited team member IDs
- Enhances team coordination by providing easy access to all team members
- To mnimize unnecessary CI runs, don't automatically push changes after every check-in.