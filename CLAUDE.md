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

### Railway Deployment
- Uses `railway.toml` for configuration
- Builds React app and serves via Express static middleware
- Environment variables: `NODE_ENV=production`
- Database path: `/data/checkin.db` (production) vs `./checkin.db` (development)

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

### Development
- `PORT=3001` (backend server port)
- `NODE_ENV=development`

### Production
- `NODE_ENV=production`
- Database path automatically set to `/data/checkin.db`
- Static files served from `client/build`

## Dependencies

### Critical Dependencies
- `sqlite3` - Database operations
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

### UI Enhancement & User Experience (Latest)
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