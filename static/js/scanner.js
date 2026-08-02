/**
 * scanner.js
 * ----------
 * Camera-based QR scanning using the html5-qrcode library.
 * On success, the scanned value (a URL like /verify/<token>)
 * is parsed and the user is redirected to the verification page.
 */

// Show scanning status in the result area.
function setStatus(message, type) {
  const el = document.getElementById("qr-result");
  if (!el) return;
  el.innerHTML = `<p>${message}</p>`;
  el.className = "scan-status";
  if (type) el.classList.add(type);
}

// Extract the /verify/<token> path from a scanned URL.
function extractToken(scannedText) {
  try {
    const url = new URL(scannedText);
    const match = url.pathname.match(/^\/verify\/([a-f0-9\-]+)$/i);
    if (match) return match[1];
  } catch (e) {
    // Not a URL — maybe just the raw token itself.
    if (/^[a-f0-9\-]{36}$/i.test(scannedText.trim())) {
      return scannedText.trim();
    }
  }
  return null;
}

document.addEventListener("DOMContentLoaded", function () {
  const reader = document.getElementById("qr-reader");
  if (!reader) return;

  const config = {
    fps: 10,
    qrbox: { width: 220, height: 220 },
  };

  const html5Qr = new Html5Qrcode("qr-reader");

  function onScanSuccess(decodedText) {
    // Pause scanning as soon as a QR is found.
    html5Qr.pause(true);

    const token = extractToken(decodedText);
    if (token) {
      setStatus("✅ QR detected! Redirecting to verification…", "alert-success");
      window.location.href = "/verify/" + token;
    } else {
      setStatus("❌ Invalid QR code. This code is not registered.", "alert-danger");
      // Allow scanning again after a short delay.
      setTimeout(() => html5Qr.resume(), 2500);
    }
  }

  function onScanFailure() {
    // Ignore individual scan failures — the library keeps trying.
  }

  // Try the back camera first, fall back to any available camera.
  Html5Qrcode.getCameras()
    .then(function (cameras) {
      if (!cameras || cameras.length === 0) {
        setStatus("❌ No camera found on this device.", "alert-danger");
        return;
      }
      const backCamera = cameras.find(
        (c) => /back|environment/i.test(c.label)
      );
      const selected = backCamera ? backCamera.id : cameras[0].id;

      return html5Qr.start(
        selected,
        config,
        onScanSuccess,
        onScanFailure
      );
    })
    .then(function () {
      setStatus("📷 Camera active. Point at the parking QR code.");
    })
    .catch(function (err) {
      console.error("Scanner error:", err);
      setStatus(
        "❌ Could not start the camera. Please allow camera access.",
        "alert-danger"
      );
    });
});

