# 6D Address Somalia - Progressive Web App

## 1. Project Vision

The mission of this project is to build a high-performance, secure, and user-friendly Progressive Web App (PWA) that allows Somali citizens to generate, register, and manage their official 6D digital address. The application is designed to be mobile-first and eventually publishable to app stores.

## 2. Core Technologies & Architecture

This project uses a modern, cloud-native, serverless architecture.

*   **Frontend:**
    *   **Framework:** Vanilla JavaScript (ES Modules). No frameworks like React, Vue, or Angular are used.
    *   **Mapping:** Google Maps JavaScript API.
    *   **Styling:** Plain CSS3 with a CSS Variable-based theme system (Light/Dark modes).
    *   **Deployment:** **Cloudflare Pages**, connected to the `main` branch of the GitHub repository for continuous deployment.

*   **Backend:**
    *   **Framework:** Node.js with Express.
    *   **Architecture:** Deployed as a scalable web service.
    *   **Deployment:** **Render**, connected to the `main` branch of the GitHub repository for continuous deployment.

*   **Database:**
    *   **Engine:** PostgreSQL with the PostGIS extension for geospatial queries.
    *   **Hosting:** **Supabase**.

*   **Authentication:**
    *   **Provider:** Firebase Authentication (Phone/OTP only).
    *   **Strategy:** A hybrid model. The frontend uses the Firebase SDK for OTP verification. The resulting ID Token is sent to our custom backend on Render, which verifies it and issues its own internal session token (JWT).

## 3. Project Structure

The repository is a monorepo containing two distinct applications: the frontend and the backend.

```
/
├── backend/              # Node.js/Express backend server
│   ├── routes/
│   ├── middleware/
│   ├── .env.example      # Example environment variables
│   └── index.js
├── public/               # All static frontend files for Cloudflare
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── index.html
├── inject-env.js         # Build script for the frontend
└── schema.sql            # The definitive PostgreSQL database schema
```

## 4. Deployment & Environment Variables

This application is deployed across multiple cloud services. All secret keys are managed as environment variables on their respective platforms.

*   **Frontend (Cloudflare Pages):**
    *   **Build Command:** `node inject-env.js`
    *   **Publish Directory:** `public`
    *   **Environment Variables:** `GOOGLE_MAPS_API_KEY`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, etc. The `inject-env.js` script uses these to generate the final `config.js` and `firebase.js` files during the build.

*   **Backend (Render):**
    *   **Root Directory:** `backend`
    *   **Build Command:** `npm install`
    *   **Start Command:** `node index.js`
    *   **Environment Variables:** `DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, `JWT_SECRET`.

## 5. Critical Architectural Decisions & History

This section documents hard-won lessons from our development process. **These decisions are non-negotiable and must be respected to avoid reintroducing critical bugs.**

*   **State Management is Client-Side:** All UI state is managed in a simple `appState` object in `public/js/main.js`. There is no complex state management library.

*   **Authentication is a Hybrid Model:** We **do not** use the Firebase Admin SDK to create user sessions directly. We use it only to verify the one-time ID Token from the client. Our custom backend then issues its own internal JWT, which is used for all subsequent API calls. This decouples our API from Firebase's session management.

*   **The "Map Not Ready" Race Condition:** We encountered a persistent bug where the app would crash upon login (`Uncaught Error: Expected number...`).
    *   **Root Cause:** The frontend was attempting to create a Google Maps marker (`new google.maps.Marker`) before the `map` object was fully loaded and idle.
    *   **The Solution:** All code that interacts with the map object after the initial page load (especially in the `transitionToLoggedInState` function) **must** be wrapped in a `google.maps.event.addListenerOnce(map, 'idle', () => { ... });` callback. This is a critical stability fix.

*   **Backend Data Consistency:** We encountered a bug where new user registrations were not saving address data.
    *   **Root Cause:** We had two conflicting backend endpoints for registration.
    *   **The Solution:** All user creation and session generation is now handled by a **single, unified endpoint:** `POST /api/auth/firebase`. This endpoint has "get-or-create" logic to handle both new registrations and returning user logins, and it must always return the complete user profile object.