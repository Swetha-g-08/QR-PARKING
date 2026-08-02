# QR-Based College Parking Management System — Build Checklist

## Steps
- [x] Create `requirements.txt`
- [x] Create `app.py` (Flask app, DB init, all routes, business logic)
- [x] Create `templates/base.html` (shared layout + navbar + flash messages)
- [x] Create `templates/index.html` (landing page)
- [x] Create `templates/register.html` (vehicle registration form)
- [x] Create `templates/qr.html` (QR display + download)
- [x] Create `templates/login.html` (admin login)
- [x] Create `templates/vehicle.html` (verify result: VALID/INVALID/PARKED/EXIT)
- [x] Create `templates/dashboard.html` (public parking map + AJAX polling)
- [x] Create `templates/admin_base.html` (sidebar layout for security pages)
- [x] Create `templates/admin.html` (stats + current vehicles table)
- [x] Create `templates/scan.html` (QR camera scanner)
- [x] Create `templates/history.html` (parking history + search)
- [x] Create `templates/error.html` (404/500 friendly errors)
- [x] Create `static/css/style.css` (full modern UI)
- [x] Create `static/js/scanner.js` (html5-qrcode camera logic + manual fallback)
- [x] Create `static/qr/` directory
- [x] Create `README.md` (full documentation)
- [ ] Verify dependencies installed (`pip install -r requirements.txt`)
- [ ] Run the app and test registration → QR → scan → entry → exit flow

