import { supabase } from "./supabase";

/* =========================
   HELPER TANGGAL
========================= */
function parseLocalDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
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
  if (Number.isNaN(fallback.getTime())) return null;

  return new Date(
    fallback.getFullYear(),
    fallback.getMonth(),
    fallback.getDate()
  );
}

function normalizeDateKey(value) {
  if (!value) return null;

  const d = parseLocalDate(value);
  if (!d) return null;

  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* =========================
   SERVICES
========================= */
export async function fetchServicesByUser(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createServiceToSupabase({
  userId,
  name,
  price = 0,
  description = "",
}) {
  if (!userId) {
    throw new Error("User tidak valid.");
  }

  const payload = {
    user_id: userId,
    name: name?.trim() || "",
    price: Number(price || 0),
    description: description?.trim() || "",
  };

  const { data, error } = await supabase
    .from("services")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateServiceToSupabase({
  serviceId,
  userId,
  name,
  price = 0,
  description = "",
}) {
  if (!serviceId || !userId) {
    throw new Error("Data layanan tidak lengkap.");
  }

  const payload = {
    name: name?.trim() || "",
    price: Number(price || 0),
    description: description?.trim() || "",
  };

  const { data, error } = await supabase
    .from("services")
    .update(payload)
    .eq("id", serviceId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteServiceFromSupabase(serviceId, userId) {
  if (!serviceId || !userId) {
    throw new Error("ID layanan tidak valid.");
  }

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}

/* =========================
   BOOKINGS LIST
========================= */
export async function fetchBookingsByUser(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      *,
      services:service_id (
        id,
        name,
        price,
        description
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteBookingById(bookingId, userId) {
  if (!bookingId || !userId) {
    throw new Error("Data booking tidak valid.");
  }

  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", bookingId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}

/* =========================
   BLOCKED DATES
========================= */
export async function fetchBlockedBookingDates(userId) {
  if (!userId) return [];

  const { data, error } = await supabase.rpc(
    "public_get_blocked_booking_dates",
    { p_owner_id: userId }
  );

  if (error) throw error;

  return (data || [])
    .map((row) => normalizeDateKey(row?.blocked_date))
    .filter(Boolean);
}

/* =========================
   BOOKINGS - ADMIN
========================= */
export async function saveBookingToSupabase({ booking }) {
  const payload = {
    user_id: booking.user_id,
    client_name: booking.client_name || "",
    client_contact: booking.client_contact || null,
    client_address: booking.client_address || null,

    service_id: booking.service_id || null,
    service_name: booking.service_name || "",
    quantity: Number(booking.quantity || 1),
    unit_price: Number(booking.unit_price || 0),

    booking_status: booking.booking_status || "Dijadwalkan",
    payment_status: booking.payment_status || "Belum Bayar",

    booking_more_than_one_day: Boolean(booking.booking_more_than_one_day),
    booking_date: booking.booking_more_than_one_day
      ? null
      : booking.booking_date || null,
    booking_start_date: booking.booking_more_than_one_day
      ? booking.booking_start_date || null
      : null,
    booking_end_date: booking.booking_more_than_one_day
      ? booking.booking_end_date || null
      : null,
    booking_time:
      booking.booking_time && String(booking.booking_time).trim()
        ? String(booking.booking_time).trim()
        : null,

    discount_type: booking.discount_type || "rp",
    discount_value: Number(booking.discount_value || 0),
    discount_amount: Number(booking.discount_amount || 0),
    ppn_percent: Number(booking.ppn_percent || 0),
    ppn_amount: Number(booking.ppn_amount || 0),

    fees_json: Array.isArray(booking.fees_json) ? booking.fees_json : [],
    fees_total: Number(booking.fees_total || 0),

    subtotal_amount: Number(booking.subtotal_amount || 0),
    total_amount: Number(booking.total_amount || 0),
    paid_amount: Number(booking.paid_amount || 0),
    remaining_amount: Number(booking.remaining_amount || 0),

    notes: booking.notes || null,
  };

  const { data, error } = await supabase
    .from("bookings")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBookingToSupabase({ bookingId, userId, booking }) {
  if (!bookingId || !userId) {
    throw new Error("Data booking tidak lengkap.");
  }

  const payload = {
    client_name: booking.client_name || "",
    client_contact: booking.client_contact || null,
    client_address: booking.client_address || null,

    service_id: booking.service_id || null,
    service_name: booking.service_name || "",
    quantity: Number(booking.quantity || 1),
    unit_price: Number(booking.unit_price || 0),

    booking_status: booking.booking_status || "Dijadwalkan",
    payment_status: booking.payment_status || "Belum Bayar",

    booking_more_than_one_day: Boolean(booking.booking_more_than_one_day),
    booking_date: booking.booking_more_than_one_day
      ? null
      : booking.booking_date || null,
    booking_start_date: booking.booking_more_than_one_day
      ? booking.booking_start_date || null
      : null,
    booking_end_date: booking.booking_more_than_one_day
      ? booking.booking_end_date || null
      : null,
    booking_time:
      booking.booking_time && String(booking.booking_time).trim()
        ? String(booking.booking_time).trim()
        : null,

    discount_type: booking.discount_type || "rp",
    discount_value: Number(booking.discount_value || 0),
    discount_amount: Number(booking.discount_amount || 0),
    ppn_percent: Number(booking.ppn_percent || 0),
    ppn_amount: Number(booking.ppn_amount || 0),

    fees_json: Array.isArray(booking.fees_json) ? booking.fees_json : [],
    fees_total: Number(booking.fees_total || 0),

    subtotal_amount: Number(booking.subtotal_amount || 0),
    total_amount: Number(booking.total_amount || 0),
    paid_amount: Number(booking.paid_amount || 0),
    remaining_amount: Number(booking.remaining_amount || 0),

    notes: booking.notes || null,
  };

  const { data, error } = await supabase
    .from("bookings")
    .update(payload)
    .eq("id", bookingId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =========================
   PUBLIC BOOKING (CLIENT)
========================= */
export async function fetchPublicServices(ownerId) {
  if (!ownerId) return [];

  const { data, error } = await supabase
    .from("services")
    .select("id, name, price, description")
    .eq("user_id", ownerId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchPublicBlockedBookingDates(ownerId) {
  return await fetchBlockedBookingDates(ownerId);
}

export async function submitPublicBooking({
  ownerId,
  clientName,
  clientContact,
  clientAddress,
  serviceId,
  quantity,
  bookingMoreThanOneDay,
  bookingDate,
  bookingStartDate,
  bookingEndDate,
  bookingTime,
  notes,
}) {
  if (!ownerId) {
    throw new Error("Owner booking tidak ditemukan.");
  }

  const qty = Number(quantity || 1);

  const bookingTimeValue =
    bookingTime && String(bookingTime).trim()
      ? String(bookingTime).trim()
      : null;

  const { data, error } = await supabase.rpc("public_create_booking", {
    p_owner_id: ownerId,
    p_client_name: clientName || "",
    p_client_contact: clientContact || "",
    p_client_address: clientAddress || null,
    p_service_id: serviceId || null,
    p_quantity: qty,
    p_booking_more_than_one_day: Boolean(bookingMoreThanOneDay),
    p_booking_date: bookingMoreThanOneDay ? null : bookingDate || null,
    p_booking_start_date: bookingMoreThanOneDay
      ? bookingStartDate || null
      : null,
    p_booking_end_date: bookingMoreThanOneDay ? bookingEndDate || null : null,
    p_booking_time: bookingTimeValue,
    p_notes: notes || null,
  });

  if (error) throw error;
  return data;
}