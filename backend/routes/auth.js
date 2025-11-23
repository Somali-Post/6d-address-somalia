const express = require('express');
const admin = require('../firebaseAdmin');
const db = require('../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/firebase', async (req, res) => {
    const { token, fullName, address } = req.body;
    if (!token) return res.status(401).json({ error: 'ID token is required.' });

    let transactionStarted = false;

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { uid, phone_number } = decodedToken;

        await db.query('BEGIN');
        transactionStarted = true;

        let userResult = await db.query('SELECT * FROM users WHERE id = $1', [uid]);
        let user = userResult.rows[0];

        if (!user) {
            if (!fullName) {
                await db.query('ROLLBACK');
                transactionStarted = false;
                return res.status(400).json({ error: 'Full name is required for new user registration.' });
            }
            const newUserResult = await db.query(
                'INSERT INTO users(id, phone_number, full_name) VALUES($1, $2, $3) RETURNING *',
                [uid, phone_number, fullName]
            );
            user = newUserResult.rows[0];
        }
        
        // --- THIS IS THE CRITICAL FIX ---
        // If the frontend sent an address object (meaning it's a registration), save it.
        if (address) {
            const { sixDCode, localitySuffix, region, city, district, neighborhood, lat, lng } = address;
            const addressQuery = `
                INSERT INTO addresses(user_id, six_d_code, locality_suffix, region, city, district, neighborhood, location, registered_at)
                VALUES($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326), NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    six_d_code = EXCLUDED.six_d_code,
                    locality_suffix = EXCLUDED.locality_suffix,
                    region = EXCLUDED.region,
                    city = EXCLUDED.city,
                    district = EXCLUDED.district,
                    neighborhood = EXCLUDED.neighborhood,
                    location = EXCLUDED.location,
                    registered_at = NOW();
            `;
            await db.query(addressQuery, [uid, sixDCode, localitySuffix, region, city, district, neighborhood, lng, lat]);
        }
        // --- END OF FIX ---

        await db.query('COMMIT');
        transactionStarted = false;

        // Fetch the complete, final user profile to return to the client
        const fullProfileResult = await db.query(`
            SELECT u.*, a.*, ST_X(a.location) as lng, ST_Y(a.location) as lat
            FROM users u LEFT JOIN addresses a ON u.id = a.user_id
            WHERE u.id = $1
        `, [uid]);
        
        if (fullProfileResult.rows.length === 0) throw new Error('Could not retrieve user profile.');
        
        let fullUserProfile = fullProfileResult.rows[0];
        // Format dates to prevent client-side parsing errors
        fullUserProfile.created_at = new Date(fullUserProfile.created_at).toISOString();
        if (fullUserProfile.registered_at) {
            fullUserProfile.registered_at = new Date(fullUserProfile.registered_at).toISOString();
        }
        delete fullUserProfile.location; // Don't send the raw geometry object

        const sessionToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ token: sessionToken, user: fullUserProfile });

    } catch (error) {
        if (transactionStarted) {
            try {
                await db.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Database rollback failed:', rollbackError);
            }
        }
        console.error('Authentication process failed:', error);
        res.status(500).json({ error: 'Authentication failed.' });
    }
});

module.exports = router;
