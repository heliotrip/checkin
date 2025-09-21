# Checkin

A 1-1 check-in tracking application for monitoring team progress over time across five key categories: Overall, Wellbeing, Growth, Relationships, and Impact.

## Features

- **Anonymous Tracking**: Uses GUIDs to identify team members without storing personal information
- **Interactive Sliders**: Friendly draggable sliders for rating each category (1-10)
- **Historical Visualization**: Sparkline charts showing trends over time
- **Date-based Entries**: Track progress by date, with ability to enter historical data
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

## Data Persistence

The application uses SQLite for data storage. In Docker deployments, data is persisted using a named volume (`checkin-data`) mounted to `/data` in the container.

## API Endpoints

- `GET /api/generate-id` - Generate a new user GUID
- `GET /api/checkins/:userId` - Get all check-ins for a user
- `GET /api/checkins/:userId/:date` - Get check-in for specific user and date
- `POST /api/checkins` - Create or update a check-in

## Technology Stack

- **Frontend**: React, Material-UI, Chart.js
- **Backend**: Node.js, Express
- **Database**: SQLite
- **Deployment**: Docker, Docker Compose