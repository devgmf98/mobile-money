# Profile Image Database Migration Fix

## Problem
- The database `profileImage` column was too small to store base64-encoded images
- Error: "data too long for column 'profileImage' at row 1"

## Solution

### Step 1: Run the Migration Script
If you have an existing database with the Users table, run this command from the backend directory:

```bash
node scripts/migrate_profile_image.js
```

This will alter the existing table column from VARCHAR(255) to LONGTEXT, allowing it to store large base64 images.

### Step 2: Backend Model Updated
The backend User model has been updated to use `DataTypes.TEXT('long')` to properly reflect the LONGTEXT column type.

### Step 3: Database Schema Updated
For new installations, the `database_setup.sql` file now uses LONGTEXT for the profileImage column.

### Step 4: Frontend Compression Enhanced
The frontend now compresses images more aggressively:
- Maximum dimensions: 400x400 pixels (profile pictures don't need to be large)
- JPEG quality: 0.4 (40% quality, similar to a compressed photo)
- If still too large (>500KB), compresses to 0.2 quality
- This results in base64 strings typically under 200-400KB

## After Running the Migration

1. Stop your backend server
2. Run: `node scripts/migrate_profile_image.js`
3. Restart your backend server
4. Profile picture uploads should now work

## Testing

Try uploading a profile picture from:
- Profile page → "Choose from Files" button
- Profile page → "Take Selfie" button (camera)

Both should now work without database errors.

## Troubleshooting

If the error persists:
1. Verify the migration ran successfully
2. Check MySQL error logs for table alteration errors
3. Ensure the Users table exists and has a profileImage column
4. Try uploading a smaller/simpler image (solid colors compress better)

