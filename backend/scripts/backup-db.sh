#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/superkafe-db"
CONTAINER_NAME="mongodb-v2"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.gz"
RETENTION_DAYS=7

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Execute mongodump inside the container and output to gzip
echo "Starting backup of container $CONTAINER_NAME to $BACKUP_FILE..."
docker exec $CONTAINER_NAME mongodump --archive --gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup completed successfully!"
else
    echo "Backup failed!"
    exit 1
fi

# Cleanup old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Cleanup completed."
