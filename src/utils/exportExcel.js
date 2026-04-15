import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "../lib/supabase";

/* =========================================
   HELPER ANGKA & FORMAT
========================================= */
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatRupiah(value) {
  const amount = toNumber(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function parseLocalDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const parts = value.split("-");
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const d = new Date(year, month, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatDateIndonesia(value) {
  const d = parseLocalDate(value);
  if (!d) return "-";

  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTimeIndonesia(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  const datePart = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const timePart = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${datePart}, ${timePart.replace(":", ".")}`;
}

function formatBookingDateRange(booking) {
  const isMultiDay = Boolean(booking?.booking_more_than_one_day);

  if (isMultiDay) {
    const start = booking?.booking_start_date;
    const end = booking?.booking_end_date;

    if (start && end) {
      return `${formatDateIndonesia(start)} - ${formatDateIndonesia(end)}`;
    }

    if (start) return formatDateIndonesia(start);
    if (end) return formatDateIndonesia(end);

    return "-";
  }

  if (booking?.booking_date) {
    return formatDateIndonesia(booking.booking_date);
  }

  return "-";
}

function getBookingStatusLabel(status) {
  if (!status) return "-";

  const s = String(status).trim().toLowerCase();

  if (s === "scheduled" || s === "dijadwalkan") return "Dijadwalkan";
  if (s === "completed" || s === "selesai") return "Selesai";
  if (s === "cancelled" || s === "dibatalkan") return "Dibatalkan";
  if (s === "pending" || s === "menunggu") return "Menunggu";

  return status;
}

function getPaymentStatusLabel(status) {
  if (!status) return "-";

  const s = String(status).trim().toLowerCase();

  if (s === "lunas") return "Lunas";
  if (s === "dp") return "DP";
  if (s === "belum bayar" || s === "belum_bayar") return "Belum Bayar";

  return status;
}

function formatBookingTime(value) {
  if (!value || String(value).trim() === "") return "-";
  return String(value).trim();
}

function formatAdditionalFees(feesJson) {
  if (!Array.isArray(feesJson) || feesJson.length === 0) return "-";

  const validFees = feesJson.filter((fee) => {
    const hasName = String(fee?.name || "").trim() !== "";
    const hasAmount = toNumber(fee?.amount) > 0;
    return hasName || hasAmount;
  });

  if (!validFees.length) return "-";

  return validFees
    .map((fee) => {
      const name = String(fee?.name || "Biaya Tambahan").trim();
      const amount = formatRupiah(fee?.amount || 0);
      const op = fee?.op === "sub" ? "-" : "";
      return `${name}: ${op}${amount}`;
    })
    .join("; ");
}

function getPaymentMethodLabel(booking) {
  const raw =
    booking?.payment_method ??
    booking?.paymentMethod ??
    booking?.metode_pembayaran ??
    null;

  if (!raw || String(raw).trim() === "") return "-";
  return String(raw).trim();
}

function getServiceDescriptionLabel(booking) {
  const description =
    booking?.services?.description ??
    booking?.service_description ??
    "";

  return String(description || "").trim() || "-";
}

function getTodayFileDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* =========================================
   AMBIL DATA BOOKING DARI SUPABASE
========================================= */
async function fetchAllBookingsForExport() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user?.id) {
    throw new Error("User tidak ditemukan. Silakan login ulang.");
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      *,
      services:service_id (
        id,
        name,
        description,
        price
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return Array.isArray(data) ? data : [];
}

/* =========================================
   HEADER EXCEL
========================================= */
function buildHeaders() {
  return [
    "Nama Klien",
    "Kontak Klien",
    "Alamat Klien",
    "Layanan 1",
    "Deskripsi Layanan 1",
    "Quantity 1",
    "Harga Layanan 1",
    "Subtotal 1",
    "Tanggal Booking",
    "Waktu Booking",
    "Status",
    "Status Pembayaran",
    "Metode Pembayaran",
    "Biaya Tambahan",
    "Total Biaya Tambahan",
    "Total Keseluruhan",
    "Sudah Dibayar",
    "Sisa Pembayaran",
    "Catatan",
    "Dibuat Pada",
    "Diupdate Pada",
  ];
}

/* =========================================
   TRANSFORM DATA BOOKING KE ROW EXCEL
========================================= */
function transformBookingsToRows(bookings = []) {
  const headers = buildHeaders();

  const rows = bookings.map((booking) => {
    const qty = toNumber(booking.quantity || 0);
    const unitPrice = toNumber(booking.unit_price || 0);

    const subtotal1 =
      toNumber(booking.subtotal_amount) > 0
        ? toNumber(booking.subtotal_amount)
        : qty * unitPrice;

    const feesTotal = toNumber(booking.fees_total || 0);
    const totalAmount =
      toNumber(booking.total_amount) > 0
        ? toNumber(booking.total_amount)
        : subtotal1 + feesTotal;

    const paidAmount = toNumber(booking.paid_amount || 0);
    const remainingAmount =
      toNumber(booking.remaining_amount) > 0
        ? toNumber(booking.remaining_amount)
        : Math.max(0, totalAmount - paidAmount);

    return {
      "Nama Klien": booking.client_name?.trim() || "-",
      "Kontak Klien": booking.client_contact?.trim() || "-",
      "Alamat Klien": booking.client_address?.trim() || "-",
      "Layanan 1": booking.service_name?.trim() || booking?.services?.name || "-",
      "Deskripsi Layanan 1": getServiceDescriptionLabel(booking),
      "Quantity 1": qty > 0 ? qty : "-",
      "Harga Layanan 1": unitPrice > 0 ? formatRupiah(unitPrice) : "-",
      "Subtotal 1": subtotal1 > 0 ? formatRupiah(subtotal1) : "-",
      "Tanggal Booking": formatBookingDateRange(booking),
      "Waktu Booking": formatBookingTime(booking.booking_time),
      "Status": getBookingStatusLabel(booking.booking_status),
      "Status Pembayaran": getPaymentStatusLabel(booking.payment_status),
      "Metode Pembayaran": getPaymentMethodLabel(booking),
      "Biaya Tambahan": formatAdditionalFees(booking.fees_json),
      "Total Biaya Tambahan":
        feesTotal > 0 ? formatRupiah(feesTotal) : "-",
      "Total Keseluruhan":
        totalAmount > 0 ? formatRupiah(totalAmount) : "-",
      "Sudah Dibayar":
        paidAmount > 0 ? formatRupiah(paidAmount) : "-",
      "Sisa Pembayaran":
        remainingAmount > 0 ? formatRupiah(remainingAmount) : "-",
      "Catatan": booking.notes?.trim() || "-",
      "Dibuat Pada": formatDateTimeIndonesia(booking.created_at),
      "Diupdate Pada": formatDateTimeIndonesia(booking.updated_at),
    };
  });

  return { headers, rows };
}

/* =========================================
   AUTO WIDTH COLUMN
========================================= */
function buildColumnWidths(headers, rows) {
  return headers.map((header) => {
    let maxLength = String(header).length;

    rows.forEach((row) => {
      const cellValue = row[header];
      const cellLength = String(cellValue ?? "").length;
      if (cellLength > maxLength) maxLength = cellLength;
    });

    return { wch: Math.min(Math.max(maxLength + 2, 12), 45) };
  });
}

/* =========================================
   STYLE HEADER + FREEZE
========================================= */
function applyWorksheetEnhancements(worksheet, headers, rows) {
  worksheet["!cols"] = buildColumnWidths(headers, rows);
  worksheet["!autofilter"] = {
    ref: `A1:U${rows.length + 1}`,
  };
  worksheet["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
  };
}

/* =========================================
   EXPORT EXCEL
========================================= */
export async function exportBookingsToExcel(
  fileName = `booking-data-${getTodayFileDate()}.xlsx`
) {
  const bookings = await fetchAllBookingsForExport();

  if (!bookings.length) {
    throw new Error("Belum ada data booking untuk diekspor.");
  }

  const { headers, rows } = transformBookingsToRows(bookings);

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });

  applyWorksheetEnhancements(worksheet, headers, rows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Booking");

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  saveAs(blob, fileName);

  return {
    total: bookings.length,
    fileName,
  };
}