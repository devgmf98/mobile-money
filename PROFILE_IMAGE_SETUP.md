# Profile Image Upload - Fix & Troubleshooting

## Error: "data too long for column 'profileImage' at row 1"

This error means the database column `profileImage` is too small to store the base64-encoded image data.

## Solution - Database Migration

### Quick Fix (Recommended)

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Run the migration script:**
   ```bash
   node scripts/migrate_profile_image.js
   ```

3. **Restart your backend server** (stop and start it)

### Verify the Fix

Check if the column was successfully updated:

```sql
-- In MySQL client/CLI
DESC Users;
-- Look for profileImage column - should show LONGTEXT type
```

Or check with query:
```sql
SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='Users' AND COLUMN_NAME='profileImage';
-- Should return: longtext
```

## Frontend Compression Settings (Already Optimized)

Images are now compressed to extreme levels:
- **Dimensions:** 200×200 pixels max (or 150×150 for secondary compression)
- **JPEG Quality:** 0.2 (20%) or 0.1 (10%) for secondary
- **Max Size Limit:** 500KB in base64 (~375KB binary)

This produces tiny images (typically 30-100KB).

## Testing the Fix

After running the migration and restarting:

1. Go to **Profile page**
2. Click **"📁 Choose from Files"**
3. Select a small image (JPG, PNG < 5MB)
4. Wait for upload confirmation

Or test with **"📸 Take Selfie"** button

## If Error Still Occurs

### Check 1: Verify Migration Ran
```bash
# Watch console output when running:
node scripts/migrate_profile_image.js
# Should show: "✓ Successfully migrated profileImage column to LONGTEXT"
```

### Check 2: Restart Backend Was Done
Stop the running backend server and restart it. The model changes only apply on server startup.

### Check 3: Database State
If all else fails, manually run in MySQL:
```sql
ALTER TABLE Users MODIFY COLUMN profileImage LONGTEXT;
```

Then restart backend server.

## Workaround (If Migration Fails)

Use a **very small, simple image:**
- Size: Less than 100KB
- Dimensions: Small (like 100×100)
- Type: Solid color JPEG (simpler to compress)

The frontend will compress it down further automatically.

## Support

If the error persists after following these steps, contact your admin with these details:
- Screenshot of error message
- Confirmation that migration script was run
- Confirmation that backend was restarted
- Database name and server info
