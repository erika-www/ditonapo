/**
 * Helper utility to generate official PDF trip summary report matching exact formal specifications:
 * - Separates Northbound and Southbound trips with clear section labels just before the date
 * - Header fields (Driver, Conductor, Dispatcher, Plate Number, Date)
 * - Table format: Stop Name, Time, Boarded Passengers, Alighted Passengers, Total Passengers, with summary Total row
 * - Signature lines: Driver's Name and Signature, Conductor's Name and Signature, Dispatcher's Name and Signature, and Verified by:
 */
export function generatePDFSummaryReport({ timeframe = 'Day', dutySession = {} }) {
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) return;

  const driverName = dutySession.driverName || 'Juan Dela Cruz';
  const conductorName = dutySession.conductorName || 'Pedro Santos';
  const dispatcherName = dutySession.dispatcherName || 'Ricardo Mendoza';
  const plateNumber = dutySession.plateNumber || 'QC-BUS-401';
  const dateFormatted = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });

  // Northbound stop records
  const northboundStops = [
    { stopName: 'QC Hall – NHA Interchange', time: '06:00 AM', boarded: 48, alighted: 0, total: 48 },
    { stopName: 'North Ave – Veterans Hospital', time: '06:15 AM', boarded: 35, alighted: 12, total: 71 },
    { stopName: 'Mindanao Ave corner Road 1', time: '06:28 AM', boarded: 24, alighted: 8, total: 87 },
    { stopName: 'Mindanao Ave – Tullahan Bridge', time: '06:42 AM', boarded: 30, alighted: 15, total: 102 },
    { stopName: 'Mindanao Ave corner Congressional', time: '07:00 AM', boarded: 52, alighted: 22, total: 132 },
    { stopName: 'Mindanao Ave corner Tandang Sora', time: '07:18 AM', boarded: 41, alighted: 18, total: 155 },
    { stopName: 'Quirino Hwy – SM City Novaliches', time: '07:40 AM', boarded: 95, alighted: 68, total: 182 },
    { stopName: 'Gen. Luis Ave – Novaliches Bayan', time: '08:05 AM', boarded: 32, alighted: 95, total: 119 }
  ];

  // Southbound stop records
  const southboundStops = [
    { stopName: 'Gen. Luis Ave – Novaliches Bayan', time: '08:30 AM', boarded: 42, alighted: 0, total: 42 },
    { stopName: 'Quirino Hwy – SM City Novaliches', time: '08:50 AM', boarded: 88, alighted: 32, total: 98 },
    { stopName: 'Mindanao Ave corner Tandang Sora', time: '09:10 AM', boarded: 35, alighted: 28, total: 105 },
    { stopName: 'Mindanao Ave corner Congressional', time: '09:25 AM', boarded: 48, alighted: 35, total: 118 },
    { stopName: 'Mindanao Ave – Tullahan Bridge', time: '09:40 AM', boarded: 28, alighted: 22, total: 124 },
    { stopName: 'Mindanao Ave corner Road 1', time: '09:52 AM', boarded: 19, alighted: 14, total: 129 },
    { stopName: 'North Ave – Veterans Hospital', time: '10:05 AM', boarded: 25, alighted: 45, total: 109 },
    { stopName: 'QC Hall – NHA Interchange', time: '10:20 AM', boarded: 0, alighted: 109, total: 0 }
  ];

  const nbBoarded = northboundStops.reduce((s, r) => s + r.boarded, 0);
  const nbAlighted = northboundStops.reduce((s, r) => s + r.alighted, 0);
  const nbTotal = northboundStops.reduce((s, r) => s + r.total, 0);

  const sbBoarded = southboundStops.reduce((s, r) => s + r.boarded, 0);
  const sbAlighted = southboundStops.reduce((s, r) => s + r.alighted, 0);
  const sbTotal = southboundStops.reduce((s, r) => s + r.total, 0);

  reportWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>DITO NA PO - ${timeframe} Trip Summary Report</title>
        <style>
          @page { size: portrait; margin: 15mm; }
          body {
            font-family: Arial, sans-serif;
            color: #000000;
            background: #ffffff;
            padding: 20px;
            line-height: 1.4;
          }
          .section-banner {
            font-size: 16px;
            font-weight: bold;
            color: #000000;
            border-bottom: 2px solid #000000;
            padding-bottom: 4px;
            margin-top: 10px;
            margin-bottom: 15px;
            text-transform: uppercase;
          }
          .meta-section {
            margin-bottom: 25px;
            font-size: 15px;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
          }
          .meta-table td {
            padding: 5px 0;
            vertical-align: top;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          .report-table th, .report-table td {
            border: 1px solid #000000;
            padding: 8px 10px;
            text-align: left;
            font-size: 14px;
          }
          .report-table th {
            font-weight: bold;
            background-color: #ffffff;
          }
          .total-row td {
            font-weight: bold;
          }
          .signature-section {
            margin-top: 30px;
            margin-bottom: 40px;
            width: 100%;
          }
          .sig-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
          }
          .sig-col {
            width: 30%;
          }
          .sig-line {
            border-bottom: 1px solid #777777;
            margin-bottom: 6px;
            height: 30px;
          }
          .sig-label {
            font-size: 13px;
            color: #000000;
          }
          .verified-row {
            display: flex;
            justify-content: flex-end;
          }
          .verified-col {
            width: 30%;
          }
          .page-divider {
            page-break-before: always;
            margin-top: 40px;
          }
        </style>
      </head>
      <body>
        <!-- SECTION 1: NORTHBOUND TRIPS -->
        <div class="section-banner">NORTHBOUND TRIPS - ${dateFormatted} (${timeframe} Report)</div>
        
        <div class="meta-section">
          <table class="meta-table">
            <tr>
              <td style="width: 55%;">Driver’s Name: ${driverName}</td>
              <td style="width: 45%;">Plate Number: ${plateNumber}</td>
            </tr>
            <tr>
              <td>Conductor’s Name: ${conductorName}</td>
              <td>Date: ${dateFormatted}</td>
            </tr>
            <tr>
              <td>Dispatcher’s Name: ${dispatcherName}</td>
              <td></td>
            </tr>
          </table>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 32%;">Stop Name</th>
              <th style="width: 18%;">Time</th>
              <th style="width: 16%;">Boarded<br/>Passengers</th>
              <th style="width: 17%;">Alighted<br/>Passengers</th>
              <th style="width: 17%;">Total<br/>Passengers</th>
            </tr>
          </thead>
          <tbody>
            ${northboundStops.map(item => `
              <tr>
                <td>${item.stopName}</td>
                <td>${item.time}</td>
                <td>${item.boarded}</td>
                <td>${item.alighted}</td>
                <td>${item.total}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td style="border-right: none;"></td>
              <td style="border-left: none; text-align: right;"><strong>Total:</strong></td>
              <td>${nbBoarded}</td>
              <td>${nbAlighted}</td>
              <td>${nbTotal}</td>
            </tr>
          </tbody>
        </table>

        <div class="signature-section">
          <div class="sig-grid">
            <div class="sig-col">
              <div class="sig-line"></div>
              <div class="sig-label">Driver’s Name and<br/>Signature</div>
            </div>
            <div class="sig-col">
              <div class="sig-line"></div>
              <div class="sig-label">Conductor’s Name and<br/>Signature</div>
            </div>
            <div class="sig-col">
              <div class="sig-line"></div>
              <div class="sig-label">Dispatcher’s Name and<br/>Signature</div>
            </div>
          </div>
          <div class="verified-row">
            <div class="verified-col">
              <div class="sig-line"></div>
              <div class="sig-label">Verified by:</div>
            </div>
          </div>
        </div>

        <!-- PAGE DIVIDER FOR SOUTHBOUND TRIPS -->
        <div class="page-divider"></div>

        <!-- SECTION 2: SOUTHBOUND TRIPS -->
        <div class="section-banner">SOUTHBOUND TRIPS - ${dateFormatted} (${timeframe} Report)</div>
        
        <div class="meta-section">
          <table class="meta-table">
            <tr>
              <td style="width: 55%;">Driver’s Name: ${driverName}</td>
              <td style="width: 45%;">Plate Number: ${plateNumber}</td>
            </tr>
            <tr>
              <td>Conductor’s Name: ${conductorName}</td>
              <td>Date: ${dateFormatted}</td>
            </tr>
            <tr>
              <td>Dispatcher’s Name: ${dispatcherName}</td>
              <td></td>
            </tr>
          </table>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 32%;">Stop Name</th>
              <th style="width: 18%;">Time</th>
              <th style="width: 16%;">Boarded<br/>Passengers</th>
              <th style="width: 17%;">Alighted<br/>Passengers</th>
              <th style="width: 17%;">Total<br/>Passengers</th>
            </tr>
          </thead>
          <tbody>
            ${southboundStops.map(item => `
              <tr>
                <td>${item.stopName}</td>
                <td>${item.time}</td>
                <td>${item.boarded}</td>
                <td>${item.alighted}</td>
                <td>${item.total}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td style="border-right: none;"></td>
              <td style="border-left: none; text-align: right;"><strong>Total:</strong></td>
              <td>${sbBoarded}</td>
              <td>${sbAlighted}</td>
              <td>${sbTotal}</td>
            </tr>
          </tbody>
        </table>

        <div class="signature-section">
          <div class="sig-grid">
            <div class="sig-col">
              <div class="sig-line"></div>
              <div class="sig-label">Driver’s Name and<br/>Signature</div>
            </div>
            <div class="sig-col">
              <div class="sig-line"></div>
              <div class="sig-label">Conductor’s Name and<br/>Signature</div>
            </div>
            <div class="sig-col">
              <div class="sig-line"></div>
              <div class="sig-label">Dispatcher’s Name and<br/>Signature</div>
            </div>
          </div>
          <div class="verified-row">
            <div class="verified-col">
              <div class="sig-line"></div>
              <div class="sig-label">Verified by:</div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
    </html>
  `);
  reportWindow.document.close();
}
