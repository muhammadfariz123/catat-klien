import * as XLSX from "xlsx";
import { supabase } from "./supabase";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value).trim();
  if (!raw) return 0;

  const cleaned = raw
    .replace(/rp/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeStatus(value) {
  const raw = cleanText(value).toLowerCase();

  if (!raw) return "Dijadwalkan";
  if (raw === "scheduled" || raw === "dijadwalkan") return "Dijadwalkan";
  if (raw === "completed" || raw === "selesai") return "Selesai";
  if (raw === "cancelled" || raw === "dibatalkan") return "Dibatalkan";
  if (raw === "pending" || raw === "menunggu") return "Menunggu";

  return cleanText(value);
}

function normalizePaymentStatus(value) {
  const raw = cleanText(value).toLowerCase();

  if (!raw) return "Belum Bayar";
  if (raw === "belum bayar" || raw === "belum_bayar") return "Belum Bayar";
  if (raw === "dp") return "DP";
  if (raw === "lunas") return "Lunas";

  return cleanText(value);
}

function monthNameToNumber(monthName) {
  const map = {
    januari: 0,
    februari: 1,
    maret: 2,
    april: 3,
    mei: 4,
    juni: 5,
    juli: 6,
    agustus: 7,
    september: 8,
    oktober: 9,
    november: 10,
    desember: 11,
    january: 0,
    february: 1,
    march: 2,
    april_en: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september_en: 8,
    october: 9,
    november_en: 10,
    december: 11,
  };

  const key = cleanText(monthName).toLowerCase();

  if (key === "april") return 3;
  if (key === "september") return 8;
  if (key === "november") return 10;

  if (key in map) return map[key];
  return null;
}

function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseFlexibleDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;

    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  const raw = cleanText(value);
  if (!raw || raw === "-") return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [month, day, year] = raw.split("/").map(Number);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const indoMatch = raw.match(
    /^([A-Za-zÀ-ÿ]+),?\s+(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/i
  );
  if (indoMatch) {
    const day = Number(indoMatch[2]);
    const month = monthNameToNumber(indoMatch[3]);
    const year = Number(indoMatch[4]);

    if (month !== null) {
      const d = new Date(year, month, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  const longMatch = raw.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/i);
  if (longMatch) {
    const day = Number(longMatch[1]);
    const month = monthNameToNumber(longMatch[2]);
    const year = Number(longMatch[3]);

    if (month !== null) {
      const d = new Date(year, month, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  const nativeDate = new Date(raw);
  if (!Number.isNaN(nativeDate.getTime())) {
    return new Date(
      nativeDate.getFullYear(),
      nativeDate.getMonth(),
      nativeDate.getDate()
    );
  }

  return null;
}

function parseDateRangeCell(value) {
  const raw = cleanText(value);
  if (!raw || raw === "-") {
    return {
      booking_more_than_one_day: false,
      booking_date: null,
      booking_start_date: null,
      booking_end_date: null,
    };
  }

  const separator = /\s+\-\s+/;
  const parts = raw.split(separator).map((item) => item.trim()).filter(Boolean);

  if (parts.length >= 2) {
    const startDate = parseFlexibleDate(parts[0]);
    const endDate = parseFlexibleDate(parts[1]);

    return {
      booking_more_than_one_day: true,
      booking_date: null,
      booking_start_date: toDateKey(startDate),
      booking_end_date: toDateKey(endDate),
    };
  }

  const single = parseFlexibleDate(raw);

  return {
    booking_more_than_one_day: false,
    booking_date: toDateKey(single),
    booking_start_date: null,
    booking_end_date: null,
  };
}

function parseDateTimeCell(value) {
  const raw = cleanText(value);
  if (!raw || raw === "-") {
    return {
      booking_more_than_one_day: false,
      booking_date: null,
      booking_start_date: null,
      booking_end_date: null,
      booking_time: null,
    };
  }

  const parts = raw.split(/\s+\-\s+/).map((item) => item.trim()).filter(Boolean);

  if (parts.length === 1) {
    const maybeDate = parseFlexibleDate(parts[0]);
    return {
      booking_more_than_one_day: false,
      booking_date: toDateKey(maybeDate),
      booking_start_date: null,
      booking_end_date: null,
      booking_time: null,
    };
  }

  if (parts.length === 2) {
    const firstDate = parseFlexibleDate(parts[0]);
    const secondDate = parseFlexibleDate(parts[1]);

    if (firstDate && secondDate) {
      return {
        booking_more_than_one_day: true,
        booking_date: null,
        booking_start_date: toDateKey(firstDate),
        booking_end_date: toDateKey(secondDate),
        booking_time: null,
      };
    }

    const oneDate = parseFlexibleDate(parts[0]);
    return {
      booking_more_than_one_day: false,
      booking_date: toDateKey(oneDate),
      booking_start_date: null,
      booking_end_date: null,
      booking_time: cleanText(parts[1]) || null,
    };
  }

  const firstDate = parseFlexibleDate(parts[0]);
  const secondDate = parseFlexibleDate(parts[1]);
  const timePart = cleanText(parts.slice(2).join(" - "));

  return {
    booking_more_than_one_day: true,
    booking_date: null,
    booking_start_date: toDateKey(firstDate),
    booking_end_date: toDateKey(secondDate),
    booking_time: timePart || null,
  };
}

function parseTimeCell(value) {
  const raw = cleanText(value);
  if (!raw || raw === "-") return null;

  const match = raw.match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return raw;

  const hh = `${Number(match[1])}`.padStart(2, "0");
  const mm = `${Number(match[2])}`.padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseAdditionalFees(value) {
  const raw = cleanText(value);
  if (!raw || raw === "-") {
    return {
      fees_json: [],
      fees_total: 0,
    };
  }

  const segments = raw
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  const fees = segments.map((segment, index) => {
    const [left, ...right] = segment.split(":");
    const name = cleanText(left) || `Biaya Tambahan ${index + 1}`;
    const amountText = cleanText(right.join(":"));
    const op = /\(-\)|\b-\b|^-/.test(amountText) ? "sub" : "add";
    const amount = toNumber(amountText);

    return {
      id: Date.now() + index + Math.random(),
      name,
      op,
      amount,
    };
  });

  const total = fees.reduce((acc, fee) => {
    return acc + (fee.op === "sub" ? -fee.amount : fee.amount);
  }, 0);

  return {
    fees_json: fees,
    fees_total: total,
  };
}

function parseCreatedAt(value) {
  const raw = cleanText(value);
  if (!raw || raw === "-") return null;

  const normalized = raw.replace(",", "").replace(/\./g, ":");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

async function findServiceIdByName(userId, serviceName) {
  const cleanName = cleanText(serviceName);
  if (!cleanName) return null;

  const { data, error } = await supabase
    .from("services")
    .select("id, name")
    .eq("user_id", userId);

  if (error) throw error;
  if (!Array.isArray(data)) return null;

  const matched = data.find(
    (item) => cleanText(item.name).toLowerCase() === cleanName.toLowerCase()
  );

  return matched?.id || null;
}

function buildBookingPayloadFromRow(row, userId, serviceId) {
  const tanggalBookingRaw = row["Tanggal Booking"];
  const waktuBookingRaw = row["Waktu Booking"];
  const dateResult =
    cleanText(tanggalBookingRaw) && cleanText(tanggalBookingRaw) !== "-"
      ? parseDateRangeCell(tanggalBookingRaw)
      : parseDateTimeCell(row["Tanggal & Waktu"]);

  const quantity = Math.max(1, toNumber(row["Quantity 1"]));
  const unitPrice = toNumber(row["Harga Layanan 1"]);
  const subtotal = toNumber(row["Subtotal 1"]);
  const totalKeseluruhan = toNumber(row["Total Keseluruhan"]);
  const sudahDibayar = toNumber(row["Sudah Dibayar"]);
  const sisaPembayaran = toNumber(row["Sisa Pembayaran"]);
  const discountAmount = toNumber(row["Diskon"]);
  const ppnAmount = toNumber(row["PPN"]);
  const { fees_json, fees_total } = parseAdditionalFees(row["Biaya Tambahan"]);

  const payload = {
    user_id: userId,
    client_name: cleanText(row["Nama Klien"]) || "Tanpa Nama",
    client_contact: cleanText(row["Kontak Klien"]) || null,
    client_address: cleanText(row["Alamat Klien"]) || null,

    service_id: serviceId,
    service_name: cleanText(row["Layanan 1"]) || null,
    quantity,
    unit_price: unitPrice,

    booking_status: normalizeStatus(row["Status"]),
    payment_status: normalizePaymentStatus(row["Status Pembayaran"]),

    booking_more_than_one_day: Boolean(dateResult.booking_more_than_one_day),
    booking_date: dateResult.booking_date,
    booking_start_date: dateResult.booking_start_date,
    booking_end_date: dateResult.booking_end_date,
    booking_time: parseTimeCell(waktuBookingRaw || dateResult.booking_time),

    discount_type: "rp",
    discount_value: discountAmount,
    discount_amount: discountAmount,

    ppn_percent: 0,
    ppn_amount: ppnAmount,

    fees_json,
    fees_total,

    subtotal_amount: subtotal > 0 ? subtotal : quantity * unitPrice,
    total_amount:
      totalKeseluruhan > 0
        ? totalKeseluruhan
        : Math.max(0, quantity * unitPrice - discountAmount + ppnAmount + fees_total),
    paid_amount: sudahDibayar,
    remaining_amount:
      sisaPembayaran > 0
        ? sisaPembayaran
        : Math.max(
            0,
            (totalKeseluruhan > 0
              ? totalKeseluruhan
              : Math.max(0, quantity * unitPrice - discountAmount + ppnAmount + fees_total)) -
              sudahDibayar
          ),

    notes: cleanText(row["Catatan"]) || null,
  };

  const createdAt = parseCreatedAt(row["Dibuat Pada"]);
  const updatedAt = parseCreatedAt(row["Diupdate Pada"]);

  if (createdAt) {
    payload.created_at = createdAt;
  }

  if (updatedAt) {
    payload.updated_at = updatedAt;
  }

  return payload;
}

function validateImportedRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("File tidak berisi data booking.");
  }

  const validRows = rows.filter((row) => {
    const nama = cleanText(row["Nama Klien"]);
    const layanan = cleanText(row["Layanan 1"]);
    return nama || layanan;
  });

  if (!validRows.length) {
    throw new Error("Tidak ditemukan baris booking yang valid.");
  }

  return validRows;
}

export async function importBookingsFromExcelFile(file) {
  if (!file) {
    throw new Error("File belum dipilih.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user?.id) {
    throw new Error("User tidak ditemukan. Silakan login ulang.");
  }

  const fileBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(fileBuffer, { type: "array" });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Sheet Excel tidak ditemukan.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  const rows = validateImportedRows(rawRows);

  const payloads = [];
  const failedRows = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    try {
      const serviceName = cleanText(row["Layanan 1"]);
      const serviceId = await findServiceIdByName(user.id, serviceName);

      const payload = buildBookingPayloadFromRow(row, user.id, serviceId);

      if (!payload.client_name) {
        throw new Error("Nama klien kosong.");
      }

      if (!payload.service_name) {
        throw new Error("Layanan kosong.");
      }

      if (
        !payload.booking_date &&
        !payload.booking_start_date &&
        !payload.booking_end_date
      ) {
        throw new Error("Tanggal booking tidak valid.");
      }

      payloads.push(payload);
    } catch (error) {
      failedRows.push({
        rowNumber: index + 2,
        reason: error.message || "Baris gagal diproses.",
      });
    }
  }

  if (!payloads.length) {
    const firstError = failedRows[0]?.reason || "Semua baris gagal diproses.";
    throw new Error(firstError);
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert(payloads)
    .select("id");

  if (error) throw error;

  return {
    imported: Array.isArray(data) ? data.length : payloads.length,
    failed: failedRows.length,
    failedRows,
  };
}