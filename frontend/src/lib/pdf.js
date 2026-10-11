import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney } from './format.js';
import { formatDate } from './dates.js';

/**
 * Generates and downloads a high-quality, responsive and well-aligned PDF
 * containing all member records, joining dates, total paid, remaining dues,
 * along with calculated sums and summary stats.
 */
export function generateMembersPdf(members = [], fundSummary = null, options = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  // 1. Calculate Sums & Totals
  const totalCount = members.length;
  const totalPaidSum = members.reduce((sum, m) => sum + (Number(m.paid) || 0), 0);
  const totalRemainingSum = members.reduce((sum, m) => sum + (Number(m.remaining) || 0), 0);
  const fullyPaidCount = members.filter((m) => Number(m.remaining) === 0 && Number(m.paid) > 0).length;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // 2. Top Decorative Header Bar
  doc.setFillColor(5, 150, 105); // Emerald-600
  doc.rect(0, 0, pageWidth, 5, 'F');

  // 3. Document Title & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text('FAMILY MUTUAL SUPPORT FUND', marginX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('Complete Members Record & Contribution Statement', marginX, 22);

  // Generation timestamp on top right
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${dateFormatted} at ${timeFormatted}`, pageWidth - marginX, 16, { align: 'right' });
  doc.text('Status: Official Verified Record', pageWidth - marginX, 21, { align: 'right' });

  // Divider line
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.5);
  doc.line(marginX, 26, pageWidth - marginX, 26);

  // 4. KPI Summary Cards Block (Top Summary)
  const cardWidth = (contentWidth - 6) / 3;
  const cardY = 30;
  const cardHeight = 18;

  // Card 1: Total Members
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(marginX, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, cardY, cardWidth, cardHeight, 2, 2, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL MEMBERS', marginX + 4, cardY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalCount} Members (${fullyPaidCount} Paid)`, marginX + 4, cardY + 13);

  // Card 2: Total Collected / Paid
  const card2X = marginX + cardWidth + 3;
  doc.setFillColor(236, 253, 245); // Emerald-50
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(167, 243, 208); // Emerald-200
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(5, 150, 105); // Emerald-600
  doc.text('TOTAL COLLECTED (PAID)', card2X + 4, cardY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(4, 120, 87); // Emerald-700
  doc.text(formatMoney(totalPaidSum), card2X + 4, cardY + 13);

  // Card 3: Total Remaining
  const card3X = marginX + (cardWidth * 2) + 6;
  doc.setFillColor(254, 242, 242); // Rose-50
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(254, 202, 202); // Rose-200
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(225, 29, 72); // Rose-600
  doc.text('TOTAL REMAINING (DUE)', card3X + 4, cardY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(190, 18, 60); // Rose-700
  doc.text(formatMoney(totalRemainingSum), card3X + 4, cardY + 13);

  // 5. Build Table Rows
  const tableData = members.map((m, index) => {
    const joinDateDisplay = m.join_date ? formatDate(m.join_date) : '—';
    const paidDisplay = formatMoney(m.paid || 0);
    const remainingDisplay = formatMoney(m.remaining || 0);

    return [
      String(index + 1),
      m.name || '—',
      m.father_name || '—',
      joinDateDisplay,
      paidDisplay,
      remainingDisplay,
    ];
  });

  // Table Footer Row with sums
  const footerRow = [
    '',
    'GRAND TOTAL / کل رقم',
    '',
    `${totalCount} Members`,
    formatMoney(totalPaidSum),
    formatMoney(totalRemainingSum),
  ];

  // 6. Draw Table with autoTable
  autoTable(doc, {
    startY: cardY + cardHeight + 6,
    margin: { left: marginX, right: marginX, bottom: 16 },
    head: [
      [
        '#',
        'Member Name',
        'Father Name',
        'Date of Joining',
        'Total Paid',
        'Remaining',
      ],
    ],
    body: tableData,
    foot: [footerRow],
    theme: 'plain',
    headStyles: {
      fillColor: [5, 150, 105], // Emerald-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
      cellPadding: 3.5,
    },
    footStyles: {
      fillColor: [241, 245, 249], // Slate-100
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
      lineWidth: { top: 0.8, bottom: 1 },
      lineColor: [203, 213, 225],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 44, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 44 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 27 },
      5: { halign: 'right', cellWidth: 27 },
    },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: 3.2,
      overflow: 'linebreak',
      valign: 'middle',
      lineWidth: { bottom: 0.2 },
      lineColor: [241, 245, 249],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate-50 alternating row
    },
    didParseCell: (data) => {
      // Highlight Grand Total Remaining in red if greater than 0
      if (data.section === 'foot' && data.column.index === 5 && totalRemainingSum > 0) {
        data.cell.styles.textColor = [190, 18, 60];
      }
      if (data.section === 'foot' && data.column.index === 4) {
        data.cell.styles.textColor = [4, 120, 87];
      }
      // Highlight individual cell colors
      if (data.section === 'body') {
        if (data.column.index === 4) {
          data.cell.styles.textColor = [4, 120, 87]; // Emerald for paid
        } else if (data.column.index === 5) {
          const raw = members[data.row.index];
          if (raw && Number(raw.remaining) > 0) {
            data.cell.styles.textColor = [190, 18, 60]; // Rose for remaining
          } else {
            data.cell.styles.textColor = [100, 116, 139];
          }
        }
      }
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageNumber = doc.internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400

      // Left footer
      doc.text(
        'Family Mutual Support Fund · Official Confidential Statement',
        marginX,
        pageHeight - 8
      );

      // Right footer
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth - marginX,
        pageHeight - 8,
        { align: 'right' }
      );

      // Top header on subsequent pages
      if (data.pageNumber > 1) {
        doc.setFillColor(5, 150, 105);
        doc.rect(0, 0, pageWidth, 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('FAMILY MUTUAL SUPPORT FUND — MEMBERS RECORD', marginX, 10);
        doc.line(marginX, 12, pageWidth - marginX, 12);
      }
    },
  });

  // 7. Save and trigger browser download
  if (options.download !== false) {
    const filename = options.filename || `Family_Fund_Members_Record_${now.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  }
  return doc;
}

