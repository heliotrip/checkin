#!/bin/bash

# Checkin Release Script
# Creates a semantic version tag and pushes it to trigger Docker builds

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're on main branch and clean
check_git_status() {
    print_status "Checking git status..."

    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        print_error "You must be on the main branch to create a release"
        exit 1
    fi

    if [ -n "$(git status --porcelain)" ]; then
        print_error "Working directory is not clean. Please commit or stash changes."
        exit 1
    fi

    print_status "Pulling latest changes from origin..."
    git pull origin main
}

# Get the latest version tag
get_latest_version() {
    local latest_tag=$(git tag -l "v*" | sort -V | tail -n1)
    if [ -z "$latest_tag" ]; then
        echo "0.0.0"
    else
        echo "$latest_tag" | sed 's/^v//'
    fi
}

# Increment version based on type
increment_version() {
    local version=$1
    local type=$2

    IFS='.' read -ra VERSION_PARTS <<< "$version"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}

    case $type in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch")
            patch=$((patch + 1))
            ;;
    esac

    echo "$major.$minor.$patch"
}

# Main release function
create_release() {
    local release_type=$1
    local custom_version=$2

    check_git_status

    if [ -n "$custom_version" ]; then
        # Use custom version
        new_version=$custom_version
        print_status "Using custom version: v$new_version"
    else
        # Calculate next version
        current_version=$(get_latest_version)
        new_version=$(increment_version "$current_version" "$release_type")
        print_status "Current version: v$current_version"
        print_status "New version: v$new_version"
    fi

    # Confirm release
    echo
    print_warning "This will:"
    echo "  1. Create git tag: v$new_version"
    echo "  2. Push the tag to origin"
    echo "  3. Trigger GitHub Actions to build and publish Docker images with tags:"
    echo "     - ghcr.io/heliotrip/checkin:$new_version"
    echo "     - ghcr.io/heliotrip/checkin:$(echo $new_version | cut -d. -f1-2)"
    echo "     - ghcr.io/heliotrip/checkin:$(echo $new_version | cut -d. -f1) (if not v0.x.x)"
    echo "     - ghcr.io/heliotrip/checkin:latest"
    echo
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Release cancelled"
        exit 0
    fi

    # Create and push tag
    print_status "Creating tag v$new_version..."
    git tag -a "v$new_version" -m "Release v$new_version

🚀 Release v$new_version

This release includes:
- Emoji slider handles with 1-10 emotional scale
- Dual database support (SQLite + Azure SQL)
- Enhanced security with rate limiting and input validation
- Compact UI layout optimizations
- Health check endpoints for container orchestration
- Cross-browser testing with Playwright

Docker images available at:
- ghcr.io/heliotrip/checkin:$new_version
- ghcr.io/heliotrip/checkin:latest

🤖 Generated with automated release script"

    print_status "Pushing tag to origin..."
    git push origin "v$new_version"

    print_success "Release v$new_version created successfully!"
    print_status "GitHub Actions will now build and publish the Docker images."
    print_status "Monitor the build at: https://github.com/heliotrip/checkin/actions"
}

# Display usage information
usage() {
    echo "Usage: $0 [patch|minor|major] [custom_version]"
    echo
    echo "Release types:"
    echo "  patch    Increment patch version (1.0.0 -> 1.0.1)"
    echo "  minor    Increment minor version (1.0.0 -> 1.1.0)"
    echo "  major    Increment major version (1.0.0 -> 2.0.0)"
    echo
    echo "Examples:"
    echo "  $0 patch           # Create a patch release"
    echo "  $0 minor           # Create a minor release"
    echo "  $0 major           # Create a major release"
    echo "  $0 patch 1.2.3     # Create release v1.2.3 (custom version)"
    echo
    echo "Current version: v$(get_latest_version)"
}

# Parse command line arguments
if [ $# -eq 0 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

release_type=$1
custom_version=$2

# Validate release type
if [[ "$release_type" != "patch" && "$release_type" != "minor" && "$release_type" != "major" ]]; then
    print_error "Invalid release type: $release_type"
    usage
    exit 1
fi

# Validate custom version format if provided
if [ -n "$custom_version" ]; then
    if ! echo "$custom_version" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
        print_error "Invalid version format: $custom_version (expected: X.Y.Z)"
        exit 1
    fi
fi

# Create the release
create_release "$release_type" "$custom_version"