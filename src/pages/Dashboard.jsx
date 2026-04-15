import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  fetchBookingsByUser,
  deleteBookingById,
} from "../lib/bookingService";

import Navbar from "../components/Navbar";
import BookingTable from "../components/BookingTable";
import BookingCalendar from "../components/BookingCalendar";
import AddBookingModal from "../components/AddBookingModal";
import GenerateInvoiceModal from "../components/GenerateInvoiceModal";

import {
  User,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  DollarSign,
  List,
  Search,
  Filter,
  Plus,
  Package2,
  Link as LinkIcon,
  Copy,
} from "lucide-react";

export default function Dashboard() {
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");

  const [statusFilter, setStatusFilter] = useState("Semua");
  const [paymentFilter, setPaymentFilter] = useState("Semua");
  const [viewMode, setViewMode] = useState("table");
  const [openModal, setOpenModal] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const [monthFilter, setMonthFilter] = useState("Semua Bulan");
  const [sortBy, setSortBy] = useState("Terbaru Dibuat");
  const [searchTerm, setSearchTerm] = useState("");

  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const [editingBooking, setEditingBooking] = useState(null);
  const [invoiceBooking, setInvoiceBooking] = useState(null);
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);

  const reloadTimeoutRef = useRef(null);

  useEffect(() => {
    getUser();
  }, []);

  async function getUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error("Gagal mengambil user:", error.message);
      return;
    }

    if (data?.user) {
      setUserId(data.user.id);
      setUserName(
        data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email
      );
    }
  }

  useEffect(() => {
    if (!userId) return;
    loadBookings();
  }, [userId]);

  async function loadBookings() {
    try {
      setLoadingBookings(true);
      const data = await fetchBookingsByUser(userId);
      setBookings(data);
    } catch (error) {
      console.error("Gagal load booking:", error.message);
    } finally {
      setLoadingBookings(false);
    }
  }

  function scheduleReloadBookings() {
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
    }

    reloadTimeoutRef.current = setTimeout(async () => {
      await loadBookings();
    }, 350);
  }

  useEffect(() => {
    if (!userId) return;

    const bookingsChannel = supabase
      .channel(`dashboard-bookings-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          scheduleReloadBookings();
        }
      )
      .subscribe((status) => {
        console.log("Realtime bookings status:", status);
      });

    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }

      supabase.removeChannel(bookingsChannel);
    };
  }, [userId]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/admin";
  }

  async function handleDeleteBooking(bookingId) {
    const confirmDelete = window.confirm("Yakin ingin menghapus booking ini?");
    if (!confirmDelete) return;

    try {
      await deleteBookingById(bookingId, userId);
      await loadBookings();
    } catch (error) {
      alert(error.message || "Gagal menghapus booking.");
    }
  }

  function handleEditBooking(booking) {
    setEditingBooking(booking);
    setOpenModal(true);
  }

  function handleGenerateInvoice(booking) {
    setInvoiceBooking(booking);
    setOpenInvoiceModal(true);
  }

  function handleAddBooking() {
    setEditingBooking(null);
    setOpenModal(true);
  }

  function handleGoToServiceTypes() {
    window.location.href = "/service-types";
  }

  const bookingLink = useMemo(() => {
    if (!userId) return "";
    return `${window.location.origin}/booking/${userId}`;
  }, [userId]);

  async function handleCopyBookingLink() {
    if (!bookingLink) {
      alert("Link booking belum tersedia. Pastikan admin sudah login.");
      return;
    }

    try {
      await navigator.clipboard.writeText(bookingLink);
      alert("Link booking berhasil disalin!");
    } catch (error) {
      alert("Gagal menyalin link booking.");
    }
  }

  const stats = useMemo(() => {
    return {
      total: bookings.length,
      dijadwalkan: bookings.filter((b) => b.booking_status === "Dijadwalkan")
        .length,
      selesai: bookings.filter((b) => b.booking_status === "Selesai").length,
      dibatalkan: bookings.filter((b) => b.booking_status === "Dibatalkan")
        .length,
      belumBayar: bookings.filter((b) => b.payment_status === "Belum Bayar")
        .length,
      dp: bookings.filter((b) => b.payment_status === "DP").length,
      lunas: bookings.filter((b) => b.payment_status === "Lunas").length,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    let result = [...bookings];

    if (statusFilter !== "Semua") {
      result = result.filter((b) => b.booking_status === statusFilter);
    }

    if (paymentFilter !== "Semua") {
      result = result.filter((b) => b.payment_status === paymentFilter);
    }

    if (monthFilter !== "Semua Bulan") {
      const monthMap = {
        Januari: 0,
        Februari: 1,
        Maret: 2,
        April: 3,
        Mei: 4,
        Juni: 5,
        Juli: 6,
        Agustus: 7,
        September: 8,
        Oktober: 9,
        November: 10,
        Desember: 11,
      };

      result = result.filter((b) => {
        const rawDate = b.booking_more_than_one_day
          ? b.booking_start_date
          : b.booking_date;

        if (!rawDate) return false;
        const d = new Date(rawDate);
        return d.getMonth() === monthMap[monthFilter];
      });
    }

    if (searchTerm.trim()) {
      const keyword = searchTerm.toLowerCase();
      result = result.filter((b) => {
        const serviceName = (b.service_name || "").toLowerCase();

        return (
          (b.client_name || "").toLowerCase().includes(keyword) ||
          (b.client_contact || "").toLowerCase().includes(keyword) ||
          (b.client_address || "").toLowerCase().includes(keyword) ||
          serviceName.includes(keyword)
        );
      });
    }

    result.sort((a, b) => {
      if (sortBy === "Terbaru Dibuat") {
        return new Date(b.created_at) - new Date(a.created_at);
      }

      if (sortBy === "Terlama Dibuat") {
        return new Date(a.created_at) - new Date(b.created_at);
      }

      if (sortBy === "Terbaru Diperbarui") {
        return (
          new Date(b.updated_at || b.created_at) -
          new Date(a.updated_at || a.created_at)
        );
      }

      if (sortBy === "Tanggal Booking ↑") {
        const dateA = new Date(
          a.booking_more_than_one_day ? a.booking_start_date : a.booking_date
        );
        const dateB = new Date(
          b.booking_more_than_one_day ? b.booking_start_date : b.booking_date
        );
        return dateA - dateB;
      }

      if (sortBy === "Tanggal Booking ↓") {
        const dateA = new Date(
          a.booking_more_than_one_day ? a.booking_start_date : a.booking_date
        );
        const dateB = new Date(
          b.booking_more_than_one_day ? b.booking_start_date : b.booking_date
        );
        return dateB - dateA;
      }

      if (sortBy === "Nama Klien A-Z") {
        return (a.client_name || "").localeCompare(b.client_name || "");
      }

      return 0;
    });

    return result;
  }, [bookings, statusFilter, paymentFilter, monthFilter, sortBy, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={userName} onLogout={logout} />

      <main className="max-w-360 mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        <section>
          <h2 className="font-semibold mb-4 text-base">Status Booking</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
            <StatCard
              title="Total Booking"
              value={stats.total}
              icon={<User size={22} />}
              color="blue"
              active={statusFilter === "Semua"}
              onClick={() => setStatusFilter("Semua")}
            />
            <StatCard
              title="Dijadwalkan"
              value={stats.dijadwalkan}
              icon={<Calendar size={22} />}
              color="blue"
              active={statusFilter === "Dijadwalkan"}
              onClick={() => setStatusFilter("Dijadwalkan")}
            />
            <StatCard
              title="Selesai"
              value={stats.selesai}
              icon={<CheckCircle size={22} />}
              color="green"
              active={statusFilter === "Selesai"}
              onClick={() => setStatusFilter("Selesai")}
            />
            <StatCard
              title="Dibatalkan"
              value={stats.dibatalkan}
              icon={<XCircle size={22} />}
              color="red"
              active={statusFilter === "Dibatalkan"}
              onClick={() => setStatusFilter("Dibatalkan")}
            />
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-4 text-base">Status Pembayaran</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
            <StatCard
              title="Belum Bayar"
              value={stats.belumBayar}
              icon={<AlertCircle size={22} />}
              color="yellow"
              active={paymentFilter === "Belum Bayar"}
              onClick={() => setPaymentFilter("Belum Bayar")}
            />
            <StatCard
              title="DP"
              value={stats.dp}
              icon={<CreditCard size={22} />}
              color="orange"
              active={paymentFilter === "DP"}
              onClick={() => setPaymentFilter("DP")}
            />
            <StatCard
              title="Lunas"
              value={stats.lunas}
              icon={<DollarSign size={22} />}
              color="green"
              active={paymentFilter === "Lunas"}
              onClick={() => setPaymentFilter("Lunas")}
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl px-4 sm:px-6 py-5 shadow-sm border border-gray-100">
          <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
              <div className="flex items-center gap-2 text-blue-700 shrink-0">
                <LinkIcon size={18} />
                <span className="text-sm font-semibold">Link Booking Klien</span>
              </div>

              <input
                type="text"
                readOnly
                value={bookingLink}
                placeholder="Link booking akan muncul setelah user admin terbaca"
                className="flex-1 h-11 px-4 rounded-xl border border-blue-200 bg-white text-sm text-gray-700 outline-none"
              />

              <button
                type="button"
                onClick={handleCopyBookingLink}
                className="h-11 px-4 rounded-xl bg-blue-600 text-white text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-blue-700 transition"
              >
                <Copy size={16} />
                Copy Link
              </button>
            </div>

            <p className="text-xs text-blue-700 mt-2">
              Kirim link ini ke klien. Data booking yang diisi klien akan masuk
              ke dashboard admin ini.
            </p>

            {userId ? (
              <p className="text-xs text-gray-500 mt-1 break-all">
                ownerId aktif: {userId}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr_auto] items-start xl:items-center gap-6 xl:gap-10">
            <div className="flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap items-stretch sm:items-center gap-3 w-full xl:w-auto">
              <button
                onClick={() => setViewMode("table")}
                className={`h-10 min-w-23 px-4 rounded-xl text-sm flex gap-2 items-center justify-center cursor-pointer whitespace-nowrap shadow-sm transition ${
                  viewMode === "table"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <List size={16} /> Tabel
              </button>

              <button
                onClick={() => setViewMode("calendar")}
                className={`h-10 min-w-27.5 px-4 rounded-xl text-sm flex gap-2 items-center justify-center cursor-pointer whitespace-nowrap shadow-sm transition ${
                  viewMode === "calendar"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <Calendar size={16} /> Kalender
              </button>

              <div className="relative w-full sm:w-67.5">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama klien, kontak, alamat, layanan"
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-gray-100 text-sm focus:outline-none border border-transparent focus:border-gray-300"
                />
              </div>
            </div>

            <div className="flex flex-col items-start xl:items-center justify-center gap-3 w-full">
              <div className="w-full xl:w-fit space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="flex items-center gap-2 w-full sm:w-20.5 text-sm text-gray-600 whitespace-nowrap text-left">
                    <Filter size={14} /> Status:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {["Semua", "Dijadwalkan", "Selesai", "Dibatalkan"].map((s) => (
                      <FilterBox
                        key={s}
                        label={s}
                        active={statusFilter === s}
                        onClick={() => {
                          setStatusFilter(s);
                          setShowInfo(true);
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="w-full sm:w-20.5 text-sm text-gray-600 whitespace-nowrap text-left">
                    Pembayaran:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {["Semua", "Belum Bayar", "DP", "Lunas"].map((p) => (
                      <FilterBox
                        key={p}
                        label={p}
                        active={paymentFilter === p}
                        onClick={() => {
                          setPaymentFilter(p);
                          setShowInfo(true);
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="w-full sm:w-20.5 text-sm text-gray-600 whitespace-nowrap text-left">
                    Bulan:
                  </span>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-gray-300 bg-white text-sm text-gray-700 w-full sm:w-37.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Semua Bulan</option>
                    <option>Januari</option>
                    <option>Februari</option>
                    <option>Maret</option>
                    <option>April</option>
                    <option>Mei</option>
                    <option>Juni</option>
                    <option>Juli</option>
                    <option>Agustus</option>
                    <option>September</option>
                    <option>Oktober</option>
                    <option>November</option>
                    <option>Desember</option>
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="w-full sm:w-20.5 text-sm text-gray-600 whitespace-nowrap text-left">
                    Urutkan:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-gray-300 bg-white text-sm text-gray-700 w-full sm:w-42.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Terbaru Dibuat</option>
                    <option>Terbaru Diperbarui</option>
                    <option>Terlama Dibuat</option>
                    <option>Tanggal Booking ↑</option>
                    <option>Tanggal Booking ↓</option>
                    <option>Nama Klien A-Z</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-start xl:justify-center w-full xl:w-auto gap-3">
              <button
                onClick={handleGoToServiceTypes}
                className="h-10 w-full sm:w-auto min-w-46 px-6 flex items-center justify-center gap-2 bg-white text-indigo-600 border-2 border-indigo-500 rounded-xl text-sm cursor-pointer whitespace-nowrap shadow-sm hover:bg-indigo-50 transition"
              >
                <Package2 size={16} /> Kelola Layanan
              </button>

              <button
                onClick={handleAddBooking}
                className="h-10 w-full sm:w-auto min-w-46 px-6 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl text-sm cursor-pointer whitespace-nowrap shadow-sm hover:bg-blue-700 transition"
              >
                <Plus size={16} /> Tambah Booking
              </button>
            </div>
          </div>

          {showInfo && filteredBookings.length === 0 && (
            <>
              <hr className="my-6" />
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Tidak ada booking yang sesuai dengan filter saat ini.
                </p>
                <p className="text-sm text-red-500 mt-1">
                  Coba ubah status, pembayaran, bulan, atau kata pencarian.
                </p>
              </div>
            </>
          )}
        </section>

        {viewMode === "table" ? (
          <section className="w-full">
            <div className="overflow-x-auto rounded-2xl">
              <div className="min-w-237.5">
                <BookingTable
                  bookings={filteredBookings}
                  loading={loadingBookings}
                  onInvoice={handleGenerateInvoice}
                  onEdit={handleEditBooking}
                  onDelete={handleDeleteBooking}
                />
              </div>
            </div>
          </section>
        ) : (
          <section className="w-full">
            <BookingCalendar bookings={filteredBookings} />
          </section>
        )}
      </main>

      <AddBookingModal
        isOpen={openModal}
        onClose={() => {
          setOpenModal(false);
          setEditingBooking(null);
        }}
        onSaved={async () => {
          await loadBookings();
          setOpenModal(false);
          setEditingBooking(null);
        }}
        editingBooking={editingBooking}
      />

      <GenerateInvoiceModal
        isOpen={openInvoiceModal}
        onClose={() => {
          setOpenInvoiceModal(false);
          setInvoiceBooking(null);
        }}
        booking={invoiceBooking}
      />
    </div>
  );
}

function StatCard({ title, value, icon, color, active, onClick }) {
  const colors = {
    blue: {
      active: "bg-white border border-blue-500 shadow-sm ring-1 ring-blue-500",
      inactive:
        "bg-white border border-gray-200 shadow-sm hover:border-blue-200",
      iconWrap: "bg-blue-100",
      iconText: "text-blue-600",
      valueText: "text-blue-700",
    },
    green: {
      active:
        "bg-white border border-green-500 shadow-sm ring-1 ring-green-500",
      inactive:
        "bg-white border border-gray-200 shadow-sm hover:border-green-200",
      iconWrap: "bg-green-100",
      iconText: "text-green-600",
      valueText: "text-green-600",
    },
    red: {
      active: "bg-white border border-red-500 shadow-sm ring-1 ring-red-500",
      inactive:
        "bg-white border border-gray-200 shadow-sm hover:border-red-200",
      iconWrap: "bg-red-100",
      iconText: "text-red-600",
      valueText: "text-red-600",
    },
    yellow: {
      active:
        "bg-white border border-yellow-400 shadow-sm ring-1 ring-yellow-400",
      inactive:
        "bg-white border border-gray-200 shadow-sm hover:border-yellow-200",
      iconWrap: "bg-yellow-100",
      iconText: "text-yellow-600",
      valueText: "text-yellow-600",
    },
    orange: {
      active:
        "bg-white border border-orange-400 shadow-sm ring-1 ring-orange-400",
      inactive:
        "bg-white border border-gray-200 shadow-sm hover:border-orange-200",
      iconWrap: "bg-orange-100",
      iconText: "text-orange-600",
      valueText: "text-orange-600",
    },
  };

  const scheme = colors[color];

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-2xl h-24 px-5 sm:px-6 flex justify-between items-center border transition-colors duration-200 ${
        active ? scheme.active : scheme.inactive
      }`}
    >
      <div className="flex flex-col justify-center min-w-0">
        <p className="text-sm font-medium text-gray-700">{title}</p>
        <p
          className={`text-[18px] leading-none font-bold mt-2 ${scheme.valueText}`}
        >
          {value}
        </p>
      </div>

      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${scheme.iconWrap} ${scheme.iconText}`}
      >
        {icon}
      </div>
    </div>
  );
}

function FilterBox({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-lg text-xs font-medium transition whitespace-nowrap ${
        active
          ? "bg-slate-700 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}