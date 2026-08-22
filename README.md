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

## SUPABASE PHONE AUTH SETUP

To successfully use the new Phone Number OTP authentication flow in CampusPark, you must configure a Phone Auth Provider in your Supabase dashboard.

Supabase handles the actual dispatching of SMS messages, ensuring security and preventing OTP spoofing in the frontend.

### Step 1: Enable Phone Authentication
1. Go to your Supabase Dashboard (`gscrhfcsiwpcdhmncxghct`).
2. Navigate to **Authentication** > **Providers** in the sidebar.
3. Click on **Phone** and toggle the switch to **Enable Phone provider**.

### Step 2: Configure an SMS Provider
Supabase requires an SMS gateway to actually send the messages. You have several options (e.g., Twilio, MessageBird, TextMagic, Vonage).

**Example using Twilio:**
1. Create a free Twilio account if you don't have one, and get your **Account SID** and **Auth Token**.
2. Get a Twilio phone number capable of sending SMS.
3. In your Supabase Dashboard (under the **Phone** provider settings), select **Twilio** from the SMS provider list.
4. Enter your Twilio **Account SID** and **Auth Token**.
5. Enter your Twilio phone number in the **Message Sender** field.
6. Click **Save**.

### Step 3: Test It
Once configured, the "SEND OTP" button on the CampusPark login and signup pages will trigger Supabase to securely send a 6-digit code via SMS to the provided number!

**IMPORTANT:** If you do not configure an SMS provider, Supabase will silently fail to send messages, and users will be unable to log in. Do NOT put your Twilio/SMS provider secrets into the frontend HTML or JavaScript!
