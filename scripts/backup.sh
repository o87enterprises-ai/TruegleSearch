#!/bin/bash
echo "=== Qwen Project Backup System ==="
echo ""

cd ~/qwen-experiment-project

# Create timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="$HOME/qwen-backups"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "1. Committing changes to Git..."
git add .
git commit -m "Backup: $TIMESTAMP" 2>/dev/null || echo "   No changes to commit"

echo "2. Creating local backup..."
BACKUP_FILE="$BACKUP_DIR/qwen_project_$TIMESTAMP.tar.gz"
tar -czf "$BACKUP_FILE" \
    --exclude="node_modules" \
    --exclude=".git" \
    --exclude="dist" \
    --exclude="*.log" \
    .

echo "   ✅ Backup created: $BACKUP_FILE"
echo "   Size: $(du -h "$BACKUP_FILE" | cut -f1)"

echo ""
echo "3. Checking GitHub connection..."
if git remote get-url origin > /dev/null 2>&1; then
    echo "   GitHub remote configured"
    read -p "   Push to GitHub? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push origin main && echo "   ✅ Pushed to GitHub" || echo "   ❌ Failed to push"
    fi
else
    echo "   ⚠️  GitHub not configured"
    echo "   Run: git remote add origin https://github.com/TruegleAi/qwen-experiment-project.git"
fi

echo ""
echo "4. Cleaning old backups (keeping last 10)..."
ls -t "$BACKUP_DIR"/qwen_project_*.tar.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null

echo ""
echo "Recent backups:"
ls -lt "$BACKUP_DIR"/qwen_project_*.tar.gz 2>/dev/null | head -5 | awk '{print "   " $6 " " $7 " " $8 " " $9}'

echo ""
echo "✅ Backup completed at $(date)"
