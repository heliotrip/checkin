#!/bin/bash
set -e

echo "Docker entrypoint: Checking /data directory permissions..."

# Check if we're running as root (needed to fix permissions)
if [ "$(id -u)" = "0" ]; then
    echo "Running as root, checking /data permissions..."

    # Ensure /data directory exists
    if [ ! -d "/data" ]; then
        echo "Creating /data directory..."
        mkdir -p /data
    fi

    # Check if node user can write to /data (test as node user using gosu)
    if ! gosu node test -w /data; then
        echo "Fixing /data directory permissions for node user..."
        chown node:node /data
        chmod 755 /data

        # Verify the fix worked
        if ! gosu node test -w /data; then
            echo "ERROR: Failed to fix /data permissions"
            echo "The node user still cannot write to /data"
            exit 1
        fi

        echo "Successfully fixed /data directory permissions"
    else
        echo "/data directory is writable by node user"
    fi

    # Also fix ownership of any existing files in /data
    if [ "$(find /data -type f ! -user node | wc -l)" -gt 0 ]; then
        echo "Fixing ownership of existing files in /data..."
        chown -R node:node /data
        echo "Fixed ownership of existing files in /data"
    else
        echo "All files in /data are already owned by node user"
    fi

    # Switch to node user and execute the application
    echo "Switching to node user and starting application..."
    exec gosu node "$@"
else
    # We're already running as non-root user
    echo "Running as non-root user: $(whoami)"

    # Test if we can write to /data
    if [ ! -w "/data" ]; then
        echo "ERROR: /data directory is not writable by current user"
        echo "This container must be started with proper volume permissions"
        echo "or run as root initially to fix permissions"
        exit 1
    fi

    echo "/data is writable, proceeding with application startup..."
    exec "$@"
fi