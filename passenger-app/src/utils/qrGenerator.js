/**
 * QR Code Canvas Generator Utility (JavaScript)
 * Generates standard 100% legitimate phone-scannable QR codes using the `qrcode` library
 * with Quezon City Bus branding and trip details.
 */
import QRCode from 'qrcode';

/**
 * Draws real scannable QR Code matrix and trip info on HTML5 canvas
 */
import { isPriorityCategory, createPassengerQrPayload } from '@shared/qrPassUtils';

/**
 * Draws real scannable QR Code matrix and trip info on HTML5 canvas
 */
export async function drawQRCodeCanvas(
  canvas,
  dataString,
  fromStop,
  toStop,
  busPlate,
  companionsCount,
  estMinutes,
  busEta,
  category = 'Regular',
  passId = null
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 360;
  const height = 490;
  canvas.width = width;
  canvas.height = height;

  // White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Header Bar
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 0, width, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QUEZON CITY BUS SYSTEM', width / 2, 32);

  // Subheader
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('OFFICIAL DIGITAL BOARDING PASS', width / 2, 74);

  const totalPax = 1 + (Number(companionsCount) || 0);
  const companionText = companionsCount > 0 ? `1 + ${companionsCount} companion(s)` : 'Solo Passenger';
  const resolvedTripId = passId || (typeof dataString === 'string' && /^\d{6}-\d{5}$/.test(dataString) ? dataString : (dataString ? dataString.slice(0, 16) : 'PASS-00001'));

  // Build the clean, standardized JSON QR payload that any scanner can parse
  const qrPayload = createPassengerQrPayload({
    tripId: resolvedTripId,
    count: totalPax,
    category: category || 'Regular',
    boardingStop: fromStop,
    destinationStop: toStop,
    busPlate: busPlate || 'QC-BUS'
  });

  try {
    // Generate real enlarged QR code matrix (250x250) onto temporary canvas
    const qrTempCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrTempCanvas, qrPayload, {
      width: 250,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    const qrStartX = (width - 250) / 2;
    const qrStartY = 86;
    ctx.drawImage(qrTempCanvas, qrStartX, qrStartY);

    // Border around QR Code
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrStartX - 4, qrStartY - 4, 258, 258);

    // Bottom Ticket Details Box
    const boxY = qrStartY + 268;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(16, boxY, width - 32, 118);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, boxY, width - 32, 118);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`Pass ID: ${resolvedTripId}`, 26, boxY + 22);

    const isPri = isPriorityCategory(category);
    ctx.fillStyle = isPri ? '#b45309' : '#0369a1';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`Category: ${category} (${isPri ? 'Priority Seat /20' : 'Regular Seat /30'})`, 26, boxY + 42);

    ctx.fillStyle = '#334155';
    ctx.font = '11px sans-serif';
    const fromTrunc = fromStop.length > 36 ? fromStop.slice(0, 34) + '…' : fromStop;
    const toTrunc = toStop.length > 36 ? toStop.slice(0, 34) + '…' : toStop;
    ctx.fillText(`From: ${fromTrunc}`, 26, boxY + 62);
    ctx.fillText(`To: ${toTrunc}`, 26, boxY + 80);

    ctx.fillStyle = '#16a34a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`✓ ${companionText} · Valid Single Entry`, 26, boxY + 102);

  } catch (err) {
    console.error('Failed to generate QR code canvas:', err);
  }
}

/**
 * Downloads the drawn QR canvas image to device file system
 */
export function downloadQRImage(canvas, filename = 'QCBus_Boarding_Pass.png') {
  try {
    const imageURI = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imageURI;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('Failed to download QR code image:', error);
    return false;
  }
}
