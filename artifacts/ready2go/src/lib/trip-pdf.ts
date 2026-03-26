import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TripEvent {
  id: number;
  type: string;
  title: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  notes?: string | null;
  pricePerPerson?: number | null;
  priceType?: string | null;
  transportData?: Record<string, unknown> | null;
  logementData?: Record<string, unknown> | null;
  restaurationData?: Record<string, unknown> | null;
}

interface TripMember {
  id: number;
  username: string;
  userId: string;
  joinedAt: string;
}

interface TripData {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  inviteCode: string;
  members: TripMember[];
  events: TripEvent[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const EVENT_LABEL: Record<string, string> = {
  activite: "Activité",
  transport: "Transport",
  logement: "Logement",
  restauration: "Restauration",
  reunion: "Réunion",
  autre: "Autre",
};

const PRICE_TYPE_LABEL: Record<string, string> = {
  per_person: "/ pers.",
  per_adult: "/ adulte",
  per_group: "/ groupe",
};

function fmtDate(d: string) {
  try { return format(parseISO(d), "dd/MM/yyyy", { locale: fr }); }
  catch { return d; }
}

function fmtTime(t?: string | null) {
  return t ?? "";
}

function getAddress(e: TripEvent): string {
  if (e.location) return e.location;
  if (e.logementData) {
    const ld = e.logementData as Record<string, string>;
    return [ld.address, ld.city, ld.country].filter(Boolean).join(", ");
  }
  if (e.transportData) {
    const td = e.transportData as Record<string, string>;
    if (td.departureLocation && td.arrivalLocation) {
      return `${td.departureLocation} → ${td.arrivalLocation}`;
    }
    return td.departureLocation ?? "";
  }
  return "";
}

function getPriceStr(e: TripEvent, travelers: number): string {
  if (e.pricePerPerson === null || e.pricePerPerson === undefined) return "—";
  if (e.pricePerPerson === 0) return "Gratuit";
  const typeLabel = PRICE_TYPE_LABEL[e.priceType ?? "per_person"] ?? "/ pers.";
  const priceStr = `${e.pricePerPerson} € ${typeLabel}`;
  if (e.priceType === "per_group") return priceStr;
  const total = e.pricePerPerson * travelers;
  return `${priceStr} (total: ${total} €)`;
}

function calcEventTotal(e: TripEvent, travelers: number): number {
  if (!e.pricePerPerson) return 0;
  if (e.priceType === "per_group") return e.pricePerPerson;
  return e.pricePerPerson * travelers;
}

// ── Primary function ───────────────────────────────────────────────────────────

export function generateTripPDF(trip: TripData, travelers: number, children: number) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const PRIMARY = [59, 130, 246] as [number, number, number];
  const DARK = [30, 41, 59] as [number, number, number];
  const MUTED = [100, 116, 139] as [number, number, number];
  const WHITE = [255, 255, 255] as [number, number, number];
  const LIGHT = [248, 250, 252] as [number, number, number];
  const BORDER = [226, 232, 240] as [number, number, number];

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 0;

  // ── Header band ──────────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 38, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("READY2GO", margin, 14);

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(trip.name, margin, 23);

  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(
    `${trip.destination}  ·  ${fmtDate(trip.startDate)} — ${fmtDate(trip.endDate)}  ·  ${travelers} adulte${travelers > 1 ? "s" : ""}${children > 0 ? ` + ${children} enfant${children > 1 ? "s" : ""}` : ""}`,
    margin, 31
  );

  y = 46;

  // ── Info row ─────────────────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.roundedRect(margin, y, pageW - margin * 2, 10, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.text(`Code d'invitation : ${trip.inviteCode}`, margin + 3, y + 6.5);
  doc.text(
    `Document généré le ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}`,
    pageW - margin - 3, y + 6.5,
    { align: "right" }
  );

  y += 16;

  // ── Events section ───────────────────────────────────────────────────────────
  const events = [...(trip.events ?? [])].sort((a, b) => {
    const da = a.date + (a.startTime ?? "");
    const db = b.date + (b.startTime ?? "");
    return da < db ? -1 : 1;
  });

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("Programme du voyage", margin, y);
  y += 5;

  if (events.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...MUTED);
    doc.text("Aucun événement planifié.", margin, y + 5);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Date", "Heure", "Type", "Événement", "Adresse", "Prix"]],
      body: events.map(e => [
        fmtDate(e.date),
        [fmtTime(e.startTime), fmtTime(e.endTime)].filter(Boolean).join(" - ") || "—",
        EVENT_LABEL[e.type] ?? e.type,
        e.title,
        getAddress(e) || "—",
        getPriceStr(e, travelers + children),
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: DARK,
        lineColor: BORDER,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: PRIMARY,
        textColor: WHITE,
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: LIGHT,
      },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 18 },
        2: { cellWidth: 20 },
        3: { cellWidth: 45 },
        4: { cellWidth: 52 },
        5: { cellWidth: 25 },
      },
      didDrawPage: () => {
        doc.setFillColor(...PRIMARY);
        doc.rect(0, pageH - 10, pageW, 10, "F");
        doc.setFontSize(7);
        doc.setTextColor(...WHITE);
        doc.text("Ready2Go — Récapitulatif de voyage", margin, pageH - 4);
        const pageNum = (doc as unknown as { internal: { getCurrentPageInfo: () => { pageNumber: number } } }).internal.getCurrentPageInfo().pageNumber;
        doc.text(`Page ${pageNum}`, pageW - margin, pageH - 4, { align: "right" });
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Notes section ────────────────────────────────────────────────────────────
  const eventWithNotes = events.filter(e => e.notes);
  if (eventWithNotes.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20; }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Notes et informations", margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Événement", "Notes"]],
      body: eventWithNotes.map(e => [e.title, e.notes ?? ""]),
      styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK, lineColor: BORDER, lineWidth: 0.2 },
      headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 118 },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Budget section ────────────────────────────────────────────────────────────
  const pricedEvents = events.filter(e => e.pricePerPerson !== null && e.pricePerPerson !== undefined);
  const totalTravelers = travelers + children;
  if (pricedEvents.length > 0) {
    if (y > pageH - 80) { doc.addPage(); y = 20; }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Récapitulatif du budget", margin, y);
    y += 5;

    const grandTotal = pricedEvents.reduce((s, e) => s + calcEventTotal(e, totalTravelers), 0);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Événement", "Type de tarif", "Prix unitaire", "Total"]],
      body: [
        ...pricedEvents.map(e => [
          e.title,
          EVENT_LABEL[e.type] ?? e.type,
          e.pricePerPerson === 0 ? "Gratuit" : `${e.pricePerPerson} € ${PRICE_TYPE_LABEL[e.priceType ?? "per_person"] ?? ""}`,
          e.pricePerPerson === 0 ? "0 €" : `${calcEventTotal(e, totalTravelers)} €`,
        ]),
        ["", "", "TOTAL", `${grandTotal} €`],
      ],
      styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK, lineColor: BORDER, lineWidth: 0.2 },
      headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT },
      bodyStyles: {},
      didParseCell: (data) => {
        if (data.row.index === pricedEvents.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [239, 246, 255];
          data.cell.styles.textColor = PRIMARY;
        }
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30 },
        2: { cellWidth: 35 },
        3: { cellWidth: 33 },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    if (totalTravelers > 0) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...MUTED);
      doc.text(
        `Groupe : ${travelers} adulte${travelers > 1 ? "s" : ""}${children > 0 ? ` + ${children} enfant${children > 1 ? "s" : ""}` : ""} — Budget total : ${grandTotal} € — Par personne (hors forfait groupe) : ${totalTravelers > 0 ? Math.round(grandTotal / totalTravelers) : "—"} €`,
        margin, y
      );
      y += 8;
    }
  }

  // ── Members section ───────────────────────────────────────────────────────────
  if (trip.members?.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20; }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Participants", margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Participant", "Rejoint le"]],
      body: trip.members.map(m => [m.username, fmtDate(m.joinedAt)]),
      styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK, lineColor: BORDER, lineWidth: 0.2 },
      headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40 },
      },
    });
  }

  // ── Footer on last page ───────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text("Ready2Go — Récapitulatif de voyage", margin, pageH - 4);
  const lastPage = doc.getNumberOfPages();
  doc.text(`Page ${lastPage}`, pageW - margin, pageH - 4, { align: "right" });

  // ── Save ──────────────────────────────────────────────────────────────────────
  const safeName = trip.name.replace(/[^a-zA-Z0-9\-_\s]/g, "").trim().replace(/\s+/g, "_");
  doc.save(`ready2go_${safeName}_${fmtDate(trip.startDate).replace(/\//g, "-")}.pdf`);
}
