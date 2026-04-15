import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import DatePicker, { registerLocale } from "react-datepicker";
import id from "date-fns/locale/id";
import "react-datepicker/dist/react-datepicker.css";

import {
  fetchPublicServices,
  fetchPublicBlockedBookingDates,
  submitPublicBooking,
} from "../lib/bookingService";
import PublicBookingInvoiceModal from "../components/PublicBookingInvoiceModal";

registerLocale("id", id);

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

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

function formatDateIndonesia(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr;

  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Pilih tanggal",
  minDate,
  filterDate,
  error,
  excludeDates = [],
  onCalendarOpen,
}) {
  function toDateObj(v) {
    return parseLocalDate(v);
  }

  function toInputDate(date) {
    if (!date) return "";
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          {label}
        </label>
      )}

      <DatePicker
        selected={toDateObj(value)}
        onChange={(date) => onChange(toInputDate(date))}
        onCalendarOpen={onCalendarOpen}
        placeholderText={placeholder}
        dateFormat="dd/MM/yyyy"
        locale="id"
        minDate={minDate || undefined}
        filterDate={filterDate}
        excludeDates={excludeDates}
        onKeyDown={(e) => e.preventDefault()}
        showPopperArrow={false}
        className="w-full h-12 px-4 rounded-2xl bg-white border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
        wrapperClassName="w-full"
      />

      {error ? (
        <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>
      ) : null}
    </div>
  );
}

export default function UserBookingForm() {
  const { ownerId: ownerIdFromParams } = useParams();

  const defaultOwnerId = import.meta.env.VITE_DEFAULT_OWNER_ID || "";
  const ownerId = ownerIdFromParams || defaultOwnerId;

  const [form, setForm] = useState({
    nama: "",
    kontak: "",
    alamat: "",
    layananId: "",
    quantity: "1",
    bookingMoreThanOneDay: false,
    tanggal: "",
    tanggalMulai: "",
    tanggalSelesai: "",
    waktu: "",
    catatan: "",
  });

  const [services, setServices] = useState([]);
  const [blockedBookingDates, setBlockedBookingDates] = useState([]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [bookingDateError, setBookingDateError] = useState("");

  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);

  function setField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function formatRupiah(value) {
    if (!value) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  }

  function toDateObj(value) {
    return parseLocalDate(value);
  }

  function expandDateRange(startDate, endDate) {
    const startKey = normalizeDateKey(startDate);
    const endKey = normalizeDateKey(endDate);

    if (!startKey || !endKey) return [];

    const start = parseLocalDate(startKey);
    const end = parseLocalDate(endKey);

    if (!start || !end) return [];
    if (start > end) return [];

    const result = [];
    const current = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );

    while (current <= end) {
      result.push(normalizeDateKey(current));
      current.setDate(current.getDate() + 1);
    }

    return result.filter(Boolean);
  }

  async function reloadBlockedDates() {
    if (!ownerId) return;

    try {
      const latestBlockedDates = await fetchPublicBlockedBookingDates(ownerId);

      const normalizedDates = Array.isArray(latestBlockedDates)
        ? [...new Set(latestBlockedDates.map((d) => normalizeDateKey(d)).filter(Boolean))]
        : [];

      setBlockedBookingDates(normalizedDates);
    } catch (error) {
      console.error("Gagal reload blocked dates:", error);
    }
  }

  const blockedDateKeySet = useMemo(() => {
    return new Set(
      (Array.isArray(blockedBookingDates) ? blockedBookingDates : [])
        .map((item) => normalizeDateKey(item))
        .filter(Boolean)
    );
  }, [blockedBookingDates]);

  const blockedDateKeyList = useMemo(() => {
    return [...blockedDateKeySet].sort();
  }, [blockedDateKeySet]);

  function isDateBlocked(dateValue) {
    const key = normalizeDateKey(dateValue);
    if (!key) return false;
    return blockedDateKeySet.has(key);
  }

  function isDateRangeBlocked(startDate, endDate) {
    const allDates = expandDateRange(startDate, endDate);
    return allDates.some((dateKey) => blockedDateKeySet.has(dateKey));
  }

  function canPickBookingStart(date) {
    const dateKey = normalizeDateKey(date);
    const todayKey = normalizeDateKey(getTodayStart());

    if (!dateKey || !todayKey) return false;
    if (dateKey < todayKey) return false;
    if (blockedDateKeySet.has(dateKey)) return false;

    return true;
  }

  function canPickBookingEnd(date) {
    const dateKey = normalizeDateKey(date);
    const todayKey = normalizeDateKey(getTodayStart());

    if (!dateKey || !todayKey) return false;
    if (dateKey < todayKey) return false;

    if (!form.tanggalMulai) {
      return !blockedDateKeySet.has(dateKey);
    }

    if (dateKey < form.tanggalMulai) return false;

    return !isDateRangeBlocked(form.tanggalMulai, dateKey);
  }

  function handleSingleDateChange(value) {
    if (!value) {
      setField("tanggal", "");
      setBookingDateError("");
      return;
    }

    if (isDateBlocked(value)) {
      setField("tanggal", "");
      setBookingDateError("Tanggal booking ini sudah dipakai booking lain.");
      return;
    }

    setField("tanggal", value);
    setBookingDateError("");
  }

  function handleStartDateChange(value) {
    if (!value) {
      setField("tanggalMulai", "");
      setBookingDateError("");
      return;
    }

    if (isDateBlocked(value)) {
      setField("tanggalMulai", "");
      setBookingDateError("Tanggal mulai booking ini sudah dipakai booking lain.");
      return;
    }

    setField("tanggalMulai", value);

    if (form.tanggalSelesai && form.tanggalSelesai < value) {
      setBookingDateError(
        "Tanggal selesai booking tidak boleh sebelum tanggal mulai."
      );
      return;
    }

    if (form.tanggalSelesai && isDateRangeBlocked(value, form.tanggalSelesai)) {
      setBookingDateError("Rentang tanggal booking bentrok dengan booking lain.");
    } else {
      setBookingDateError("");
    }
  }

  function handleEndDateChange(value) {
    if (!value) {
      setField("tanggalSelesai", "");
      setBookingDateError("");
      return;
    }

    if (form.tanggalMulai && value < form.tanggalMulai) {
      setBookingDateError(
        "Tanggal selesai booking tidak boleh sebelum tanggal mulai."
      );
      return;
    }

    if (form.tanggalMulai && isDateRangeBlocked(form.tanggalMulai, value)) {
      setField("tanggalSelesai", "");
      setBookingDateError("Rentang tanggal booking bentrok dengan booking lain.");
      return;
    }

    setField("tanggalSelesai", value);
    setBookingDateError("");
  }

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setLoadError("");

        if (!ownerId) {
          throw new Error(
            "ownerId tidak ditemukan. Isi VITE_DEFAULT_OWNER_ID di file .env atau akses lewat /booking/:ownerId."
          );
        }

        const [serviceRows, blockedDates] = await Promise.all([
          fetchPublicServices(ownerId),
          fetchPublicBlockedBookingDates(ownerId),
        ]);

        const normalizedDates = Array.isArray(blockedDates)
          ? [...new Set(blockedDates.map((d) => normalizeDateKey(d)).filter(Boolean))]
          : [];

        setServices(Array.isArray(serviceRows) ? serviceRows : []);
        setBlockedBookingDates(normalizedDates);
      } catch (error) {
        setLoadError(
          error.message || "Gagal memuat form booking. Silakan coba lagi."
        );
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [ownerId]);

  const blockedDateObjects = useMemo(() => {
    return blockedDateKeyList
      .map((dateStr) => parseLocalDate(dateStr))
      .filter(Boolean);
  }, [blockedDateKeyList]);

  const selectedService = useMemo(() => {
    return services.find((item) => String(item.id) === String(form.layananId));
  }, [services, form.layananId]);

  const quantityNumber = useMemo(() => {
    const qty = Number(form.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    return qty;
  }, [form.quantity]);

  const estimation = useMemo(() => {
    const unitPrice = Number(selectedService?.price || 0);
    return unitPrice * quantityNumber;
  }, [selectedService, quantityNumber]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSending(true);
      setSubmitError("");
      setSubmitSuccess("");

      if (!ownerId) {
        throw new Error("ownerId tidak ditemukan dari link form booking.");
      }

      if (!form.nama.trim()) {
        throw new Error("Nama klien wajib diisi.");
      }

      if (!form.kontak.trim()) {
        throw new Error("Kontak klien wajib diisi.");
      }

      if (!form.layananId) {
        throw new Error("Jenis layanan wajib dipilih.");
      }

      if (!quantityNumber) {
        throw new Error("Quantity wajib diisi minimal 1.");
      }

      if (form.bookingMoreThanOneDay) {
        if (!form.tanggalMulai || !form.tanggalSelesai) {
          throw new Error("Tanggal mulai dan tanggal selesai wajib diisi.");
        }

        if (form.tanggalSelesai < form.tanggalMulai) {
          throw new Error(
            "Tanggal selesai booking tidak boleh sebelum tanggal mulai."
          );
        }

        if (isDateRangeBlocked(form.tanggalMulai, form.tanggalSelesai)) {
          throw new Error("Rentang tanggal booking bentrok dengan booking lain.");
        }
      } else {
        if (!form.tanggal) {
          throw new Error("Tanggal booking wajib diisi.");
        }

        if (isDateBlocked(form.tanggal)) {
          throw new Error("Tanggal booking ini sudah dipakai booking lain.");
        }
      }

      if (!selectedService) {
        throw new Error("Layanan yang dipilih tidak ditemukan.");
      }

      const bookingPayload = {
        ownerId,
        clientName: form.nama.trim(),
        clientContact: form.kontak.trim(),
        clientAddress: form.alamat.trim() || null,
        serviceId: selectedService.id,
        quantity: quantityNumber,
        bookingMoreThanOneDay: form.bookingMoreThanOneDay,
        bookingDate: form.bookingMoreThanOneDay ? null : form.tanggal || null,
        bookingStartDate: form.bookingMoreThanOneDay
          ? form.tanggalMulai || null
          : null,
        bookingEndDate: form.bookingMoreThanOneDay
          ? form.tanggalSelesai || null
          : null,
        bookingTime: form.waktu || null,
        notes: form.catatan.trim() || null,
      };

      const submitResult = await submitPublicBooking(bookingPayload);

      await reloadBlockedDates();

      setSubmitSuccess(
        "Booking berhasil dikirim. Silakan lanjutkan ke invoice DP 30%."
      );

      setInvoiceData({
        id: submitResult?.id || null,
        invoiceSeed: submitResult?.id || Date.now(),
        client_name: form.nama.trim(),
        client_contact: form.kontak.trim(),
        client_address: form.alamat.trim() || null,
        service_name: selectedService.name || "Layanan",
        service_description: selectedService.description || "",
        quantity: quantityNumber,
        unit_price: Number(selectedService.price || 0),
        booking_more_than_one_day: Boolean(form.bookingMoreThanOneDay),
        booking_date: form.bookingMoreThanOneDay ? null : form.tanggal || null,
        booking_start_date: form.bookingMoreThanOneDay
          ? form.tanggalMulai || null
          : null,
        booking_end_date: form.bookingMoreThanOneDay
          ? form.tanggalSelesai || null
          : null,
        booking_time: form.waktu || null,
        notes: form.catatan.trim() || null,
      });

      setOpenInvoiceModal(true);

      setForm({
        nama: "",
        kontak: "",
        alamat: "",
        layananId: "",
        quantity: "1",
        bookingMoreThanOneDay: false,
        tanggal: "",
        tanggalMulai: "",
        tanggalSelesai: "",
        waktu: "",
        catatan: "",
      });
      setBookingDateError("");
    } catch (error) {
      setSubmitError(
        error.message || "Terjadi kesalahan saat mengirim booking."
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-white/70 p-10 text-center">
          <p className="text-slate-600 text-base">Memuat form booking...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-white/70 p-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-linear-to-br from-slate-100 via-blue-50 to-slate-100 px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-[28px] shadow-xl border border-white/80 overflow-hidden">
            <div className="px-6 md:px-10 py-8 border-b border-slate-100 bg-linear-to-r from-blue-600 to-indigo-600 text-white">
              <h1 className="text-3xl font-bold text-center">
                Form Booking Layanan
              </h1>
              <p className="text-sm text-blue-100 text-center mt-2">
                Isi data di bawah ini untuk mengirim booking ke admin.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 md:px-10 py-8 space-y-8">
              <section className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Data Klien
                    </h2>
                    <p className="text-sm text-slate-500">
                      Isi informasi dasar klien terlebih dahulu
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Nama Klien <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.nama}
                      onChange={(e) => setField("nama", e.target.value)}
                      placeholder="Masukkan nama klien"
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Kontak Klien <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.kontak}
                      onChange={(e) => setField("kontak", e.target.value)}
                      placeholder="Nomor telepon atau email"
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      Disarankan isi nomor WhatsApp agar mudah dihubungi.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Alamat / Lokasi Acara
                  </label>
                  <input
                    type="text"
                    value={form.alamat}
                    onChange={(e) => setField("alamat", e.target.value)}
                    placeholder="Alamat klien / lokasi acara"
                    className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </section>

              <section className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Pilih Paket Layanan
                    </h2>
                    <p className="text-sm text-slate-500">
                      Pilih salah satu layanan yang tersedia
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {services.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500 text-center">
                      Belum ada layanan yang tersedia.
                    </div>
                  ) : (
                    services.map((service) => {
                      const active = String(form.layananId) === String(service.id);

                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => setField("layananId", String(service.id))}
                          className={`w-full text-left rounded-3xl border p-5 transition-all ${
                            active
                              ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 shrink-0 ${
                                active ? "border-blue-600" : "border-slate-300"
                              }`}
                            >
                              <div
                                className={`w-2.5 h-2.5 rounded-full ${
                                  active ? "bg-blue-600" : "bg-transparent"
                                }`}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3
                                className={`text-lg font-bold ${
                                  active ? "text-blue-700" : "text-slate-900"
                                }`}
                              >
                                {service.name || "Layanan"}
                              </h3>

                              <div className="mt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                                  Deskripsi
                                </p>
                                <div className="rounded-2xl bg-white/80 border border-slate-200 px-4 py-3">
                                  <p className="text-sm text-slate-600 leading-6 whitespace-pre-line break-words">
                                    {service.description?.trim()
                                      ? service.description
                                      : "Tidak ada deskripsi layanan."}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                                  Harga
                                </p>
                                <span
                                  className={`inline-flex items-center rounded-2xl px-4 py-2 text-sm font-semibold ${
                                    active
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {formatRupiah(service.price)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {!form.layananId ? (
                  <p className="text-xs text-red-500 font-medium">
                    Jenis layanan wajib dipilih.
                  </p>
                ) : null}
              </section>

              <section className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Detail Booking
                    </h2>
                    <p className="text-sm text-slate-500">
                      Isi jumlah, tanggal, dan waktu booking
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={form.quantity}
                      onChange={(e) => setField("quantity", e.target.value)}
                      placeholder="1"
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>

                  {selectedService ? (
                    <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 flex flex-col justify-center">
                      <span className="text-sm text-blue-700 font-medium">
                        Estimasi biaya
                      </span>
                      <span className="text-2xl font-bold text-blue-700 mt-1">
                        {formatRupiah(estimation)}
                      </span>
                      <p className="text-xs text-blue-600 mt-2 leading-5">
                        Ini hanya estimasi awal dari harga default layanan. Admin
                        masih bisa menyesuaikan jika ada kebutuhan tambahan.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 flex items-center text-sm text-slate-500">
                      Pilih layanan terlebih dahulu untuk melihat estimasi biaya.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.bookingMoreThanOneDay}
                    onChange={(e) =>
                      setField("bookingMoreThanOneDay", e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">
                    Booking lebih dari 1 hari
                  </span>
                </div>

                {!form.bookingMoreThanOneDay && blockedDateKeyList.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1">
                      Tanggal yang sudah terisi:
                    </p>
                    <p className="text-xs text-slate-600 leading-5 whitespace-pre-wrap">
                      {blockedDateKeyList.map(formatDateIndonesia).join(", ")}
                    </p>
                  </div>
                )}

                {form.bookingMoreThanOneDay ? (
                  <>
                    <div className="grid md:grid-cols-3 gap-5">
                      <DatePickerField
                        label="Tanggal Mulai *"
                        value={form.tanggalMulai}
                        onChange={handleStartDateChange}
                        minDate={getTodayStart()}
                        filterDate={canPickBookingStart}
                        excludeDates={blockedDateObjects}
                        onCalendarOpen={reloadBlockedDates}
                      />

                      <DatePickerField
                        label="Tanggal Selesai *"
                        value={form.tanggalSelesai}
                        onChange={handleEndDateChange}
                        minDate={
                          form.tanggalMulai
                            ? toDateObj(form.tanggalMulai)
                            : getTodayStart()
                        }
                        filterDate={canPickBookingEnd}
                        excludeDates={blockedDateObjects}
                        onCalendarOpen={reloadBlockedDates}
                      />

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Waktu
                        </label>
                        <input
                          type="time"
                          value={form.waktu}
                          onChange={(e) => setField("waktu", e.target.value)}
                          className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        />
                      </div>
                    </div>

                    {bookingDateError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {bookingDateError}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid md:grid-cols-2 gap-5">
                    <DatePickerField
                      label="Tanggal *"
                      value={form.tanggal}
                      onChange={handleSingleDateChange}
                      minDate={getTodayStart()}
                      filterDate={canPickBookingStart}
                      excludeDates={blockedDateObjects}
                      onCalendarOpen={reloadBlockedDates}
                      error={bookingDateError}
                    />

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Waktu
                      </label>
                      <input
                        type="time"
                        value={form.waktu}
                        onChange={(e) => setField("waktu", e.target.value)}
                        className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Catatan Tambahan
                    </h2>
                    <p className="text-sm text-slate-500">
                      Isi bila ada permintaan khusus
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Catatan
                  </label>
                  <textarea
                    value={form.catatan}
                    onChange={(e) => setField("catatan", e.target.value)}
                    placeholder="Catatan tambahan..."
                    rows="4"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition"
                  />
                </div>
              </section>

              {submitError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              {submitSuccess && (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {submitSuccess}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={sending}
                  className={`w-full h-13 rounded-2xl text-white font-semibold text-sm shadow-lg transition ${
                    sending
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  }`}
                >
                  {sending ? "Mengirim Booking..." : "Kirim Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <PublicBookingInvoiceModal
        isOpen={openInvoiceModal}
        onClose={() => setOpenInvoiceModal(false)}
        ownerId={ownerId}
        invoiceData={invoiceData}
      />
    </>
  );
}