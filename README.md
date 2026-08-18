# College QR Parking System

A static HTML, CSS, vanilla JavaScript, and Supabase college mini-project. No backend, build step, or secret key is required.

## Supabase setup

1. Create a Supabase project and enable Email authentication.
2. In SQL Editor, run [`sql/database.sql`](sql/database.sql). It creates the tables, RLS policies, secure functions, and 20 demo slots.
3. In Project Settings → API, copy the Project URL and anon/public key.
4. Put them in `js/config.js`. Never use a service-role key.
5. Register users. To make a security or admin user, change `profiles.role` in the Supabase Table Editor to `security` or `admin`.

Students can access only their own profile/sessions. Staff can read parking data; admins manage slots. Database functions atomically handle booking, entry, and exit, preventing duplicate active sessions and duplicate slot allocation.

## Local testing and Vercel

Serve the `college-parking` folder with a static server, for example `python3 -m http.server 8000`, then open `http://localhost:8000`. Camera scanning works best over HTTPS after deployment.

Push this folder to GitHub, import it in Vercel, choose **Other** for the framework preset, leave build settings empty, and deploy. No `npm install` is needed.
