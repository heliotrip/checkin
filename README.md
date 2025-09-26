# Checkin

A 1-1 check-in tracking application for monitoring team progress over time across five key categories: Overall, Wellbeing, Growth, Relationships, and Impact.

## Features

- **Anonymous Tracking**: Uses GUIDs to identify team members without storing personal information
- **Interactive Sliders**: Friendly draggable sliders for rating each category (1-10)
- **Historical Visualization**: Sparkline charts showing trends over time
- **Date-based Entries**: Track progress by date, with ability to enter historical data
- **CSV Data Editor**: Bulk edit historical data with CSV import/export functionality
- **Team Management**: Local name storage and ID sharing for easy team coordination
- **Recent IDs**: Unlimited history of all visited team member IDs for easy navigation
- **URL-based Sharing**: Share unique check-in URLs with team members
- **Dual Database Support**: SQLite for development/local deployments, Azure SQL Database for production cloud deployments
- **Persistent Storage**: SQLite with Docker volumes or Azure SQL Database with automatic failover

## Quick Start

### Local Development

1. Install dependencies:
```bash
npm run install-all
```

2. Start development servers:
```bash
npm run dev
```

This will start:
- Backend server on http://localhost:3001
- Frontend development server on http://localhost:3000

### Docker Deployment

1. Build and run with Docker Compose:
```bash
docker-compose up -d
```

The application will be available at http://localhost:3001

### Azure Container Apps Deployment (Recommended for Production)

For cloud-native deployments with high availability:

1. **Create Azure SQL Database**:
```bash
# Create resource group
az group create --name checkin-rg --location eastus

# Create SQL Server
az sql server create --name checkin-sql --resource-group checkin-rg \
  --location eastus --admin-user checkin_admin --admin-password YourSecurePassword123!

# Create database
az sql db create --server checkin-sql --resource-group checkin-rg \
  --name checkin --service-objective Basic

# Configure firewall for Azure services
az sql server firewall-rule create --server checkin-sql --resource-group checkin-rg \
  --name AllowAzure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

2. **Deploy to Container Apps**:
```bash
# Create Container Apps environment
az containerapp env create --name checkin-env --resource-group checkin-rg --location eastus

# Deploy with Azure SQL configuration
az containerapp create \
  --name checkin-app \
  --resource-group checkin-rg \
  --environment checkin-env \
  --image your-registry/checkin:latest \
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

**Benefits of Azure SQL Deployment:**
- Eliminates SQLite locking issues on shared persistent volumes
- Automatic scaling and high availability (99.9% SLA)
- Built-in backup and point-in-time restore
- Advanced security features and encryption

## Usage

### Basic Check-ins

1. Generate a new ID or use an existing one from the homepage
2. Navigate to your check-in page using the provided URL
3. Use the sliders to rate each category (1-10)
4. Save your check-in to view historical trends in the sparkline charts

### CSV Data Editor

For bulk data management:

1. From any check-in page, click "Edit Data"
2. View and edit all your historical data in CSV format
3. Download your data as a CSV file for external analysis
4. Upload CSV files to import historical data
5. Use the text editor for quick bulk edits

**CSV Format:**
```
date,overall,wellbeing,growth,relationships,impact
2025-01-01,5,5,5,5,5
2025-01-02,6,5,7,5,8
```

- Date format: YYYY-MM-DD
- Values: 1-10 (integers)
- Duplicate dates will cause save errors

### Team Management

- Assign names to team member IDs for easy identification
- Access unlimited history of all team member IDs in Recent IDs section
- Share URLs directly with team members
- Names are stored locally in your browser

## Database Configuration

The application supports dual database architectures:

### SQLite (Development/Local)
- **Default**: Automatically used when no Azure SQL credentials are provided
- **Local development**: Database stored at `./checkin.db`
- **Docker deployment**: Uses named volume (`checkin-data`) mounted to `/data/checkin.db`
- **Pros**: Simple setup, no external dependencies
- **Cons**: File locking issues on shared storage systems

### Azure SQL Database (Production)
- **Auto-detection**: Used when all Azure SQL environment variables are provided
- **Environment Variables**:
  - `AZURE_SQL_SERVER` - Server hostname (e.g., `myserver.database.windows.net`)
  - `AZURE_SQL_DATABASE` - Database name (e.g., `checkin`)
  - `AZURE_SQL_USERNAME` - Database username
  - `AZURE_SQL_PASSWORD` - Database password
- **Pros**: High availability, automatic scaling, no file locking issues
- **Recommended**: For production cloud deployments

## API Endpoints

### Core API
- `GET /api/generate-id` - Generate a new user GUID
- `GET /api/checkins/:userId` - Get all check-ins for a user
- `GET /api/checkins/:userId/:date` - Get check-in for specific user and date
- `POST /api/checkins` - Create or update a check-in
- `PUT /api/checkins/:userId/bulk` - Replace all check-ins for a user with provided data
- `DELETE /api/checkins/:userId/bulk` - Delete all check-ins for a user

### Health Check & Monitoring
- `GET /health` - Basic health check (returns 200 OK regardless of database status)
- `GET /ready` - Readiness probe (returns 200 only when database is ready)

**Docker Health Checks:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1
```

**Kubernetes Probes:**
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /ready
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Technology Stack

- **Frontend**: React, Material-UI, Chart.js
- **Backend**: Node.js, Express
- **Database**: SQLite (development) / Azure SQL Database (production)
- **Security**: Helmet.js, rate limiting, input validation, CORS protection
- **Testing**: Playwright (cross-browser end-to-end testing)
- **Deployment**: Docker, Docker Compose, Azure Container Apps

## Testing

Run the test suite with:

```bash
npm test                 # Run all tests headlessly
npm run test:headed      # Run tests with browser UI
npm run test:ui          # Interactive test runner
npm run test:report      # View HTML test reports
```

The test suite includes stable end-to-end tests covering core functionality across Chromium, Firefox, and WebKit browsers.

## Releases & Versioning

This project follows [semantic versioning](https://semver.org/) and uses automated Docker builds with proper version tags.

### Creating a Release

Use the provided release script to create tagged releases:

```bash
# Create a patch release (1.0.0 -> 1.0.1)
npm run release:patch

# Create a minor release (1.0.0 -> 1.1.0)
npm run release:minor

# Create a major release (1.0.0 -> 2.0.0)
npm run release:major

# Or use the script directly for custom versions
./scripts/release.sh patch 1.2.3
```

### Docker Images

Each release automatically publishes multi-architecture Docker images to GitHub Container Registry:

- `ghcr.io/heliotrip/checkin:latest` - Latest stable release
- `ghcr.io/heliotrip/checkin:1.2.3` - Specific version
- `ghcr.io/heliotrip/checkin:1.2` - Minor version series
- `ghcr.io/heliotrip/checkin:1` - Major version series
- `ghcr.io/heliotrip/checkin:main` - Main branch builds
- `ghcr.io/heliotrip/checkin:dev` - Development builds

**Supported Architectures:**
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64/AArch64)

All images are signed with [Cosign](https://github.com/sigstore/cosign) for supply chain security.

## Authors

Chris Nuzum @heliotrip
Enzo Nuzum @spiritrover
