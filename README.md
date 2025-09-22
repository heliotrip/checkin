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
- **Persistent Storage**: SQLite database with Docker volume for data persistence

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

## Data Persistence

The application uses SQLite for data storage. In Docker deployments, data is persisted using a named volume (`checkin-data`) mounted to `/data` in the container.

## API Endpoints

- `GET /api/generate-id` - Generate a new user GUID
- `GET /api/checkins/:userId` - Get all check-ins for a user
- `GET /api/checkins/:userId/:date` - Get check-in for specific user and date
- `POST /api/checkins` - Create or update a check-in
- `PUT /api/checkins/:userId/bulk` - Replace all check-ins for a user with provided data
- `DELETE /api/checkins/:userId/bulk` - Delete all check-ins for a user

## Technology Stack

- **Frontend**: React, Material-UI, Chart.js
- **Backend**: Node.js, Express
- **Database**: SQLite
- **Testing**: Playwright (cross-browser end-to-end testing)
- **Deployment**: Docker, Docker Compose

## Testing

Run the test suite with:

```bash
npm test                 # Run all tests headlessly
npm run test:headed      # Run tests with browser UI
npm run test:ui          # Interactive test runner
npm run test:report      # View HTML test reports
```

The test suite includes stable end-to-end tests covering core functionality across Chromium, Firefox, and WebKit browsers.

## Authors

Chris Nuzum @heliotrip
Enzo Nuzum @spiritrover
