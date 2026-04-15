import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Wallet,
  BadgeDollarSign,
  Clock3,
  AlertCircle,
  Plus,
  TrendingUp,
  CalendarDays,
  Receipt,
  CreditCard,
  Download,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Landmark,
  CircleDollarSign,
  Save,
  Pencil,
  Calendar,
  Tag,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";

/* =========================================
   HELPER
========================================= */
function formatRupiah(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatRupiahShort(value) {
  const amount = Number(value || 0);

  if (amount >= 1000000) {
    const short = amount / 1000000;
    return `Rp ${Number.isInteger(short) ? short : short.toFixed(1)}Jt`;
  }

  if (amount >= 1000) {
    const short = amount / 1000;
    return `Rp ${Number.isInteger(short) ? short : short.toFixed(1)}K`;
  }

  return formatRupiah(amount);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDateKey(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKeyFromDate(value) {
  const d = parseDate(value);
  if (!d) return null;
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(monthKey) {
  if (!monthKey) return "-";
  const [year, month] = monthKey.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getTodayDateInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getBookingMainDate(booking) {
  return (
    booking?.booking_date ||
    booking?.booking_start_date ||
    booking?.created_at ||
    null
  );
}

function getPaymentStatusLabel(status) {
  const s = String(status || "").trim().toLowerCase();

  if (s === "lunas") return "Lunas";
  if (s === "dp") return "Down Payment";
  if (s === "belum bayar" || s === "belum_bayar") return "Belum Bayar";

  return status || "Belum Ditentukan";
}

function paymentBadgeClass(status) {
  const s = String(status || "").trim().toLowerCase();

  if (s === "lunas") {
    return "bg-green-50 text-green-700 border border-green-200";
  }
  if (s === "dp") {
    return "bg-orange-50 text-orange-700 border border-orange-200";
  }
  if (s === "belum bayar" || s === "belum_bayar") {
    return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  }
  return "bg-gray-50 text-gray-600 border border-gray-200";
}

function matchesDateFilter(dateValue, filterMonth, startDate, endDate) {
  const key = normalizeDateKey(dateValue);
  if (!key) return false;

  if (filterMonth && filterMonth !== "all") {
    if (monthKeyFromDate(key) !== filterMonth) return false;
  }

  if (startDate && key < startDate) return false;
  if (endDate && key > endDate) return false;

  return true;
}

function downloadCSV(filename, rows) {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const text = `${cell ?? ""}`.replace(/"/g, '""');
          return `"${text}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob(["\ufeff" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatPercent(value, digits = 1) {
  const num = Number(value || 0);
  return `${num.toFixed(digits)}%`;
}

function formatDateTimeExport(value = new Date()) {
  const d = new Date(value);
  return d.toLocaleString("id-ID");
}

function getExportFileDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function autoFitWorksheetColumns(worksheet, rows) {
  const colWidths = [];

  rows.forEach((row) => {
    row.forEach((cell, idx) => {
      const cellText = cell == null ? "" : String(cell);
      const width = Math.max(cellText.length + 2, 12);
      colWidths[idx] = Math.max(colWidths[idx] || 12, width);
    });
  });

  worksheet["!cols"] = colWidths.map((w) => ({ wch: Math.min(w, 40) }));
}

function getGrowthRate(currentValue, previousValue) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);

  if (previous <= 0) {
    return {
      label: "N/A",
      value: 0,
    };
  }

  const growth = ((current - previous) / previous) * 100;

  return {
    label: `${growth.toFixed(1)}%`,
    value: Number(growth.toFixed(1)),
  };
}

/* =========================================
   OPTIONAL TRANSACTION MODAL
========================================= */
function TransactionModal({
  open,
  onClose,
  onSave,
  type = "income",
  loading = false,
  editingItem = null,
}) {
  const isIncome = type === "income";
  const isEdit = Boolean(editingItem?.id);

  const defaultIncomeCategories = [
    "Bonus",
    "Bunga",
    "Komisi",
    "Sewa",
    "Investasi",
    "Royalti",
    "Hadiah",
    "Lain-lain",
  ];

  const defaultExpenseCategories = [
    "Peralatan",
    "Transport",
    "Sewa",
    "Utilitas",
    "Marketing",
    "Gaji",
    "Pelatihan",
    "Lain-lain",
  ];

  const [incomeCategories, setIncomeCategories] = useState(
    defaultIncomeCategories
  );
  const [expenseCategories, setExpenseCategories] = useState(
    defaultExpenseCategories
  );

  const [date, setDate] = useState(getTodayDateInputValue());
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amountDigits, setAmountDigits] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const categoryOptions = isIncome ? incomeCategories : expenseCategories;

  useEffect(() => {
    if (!open) return;

    const incomingCategory = editingItem?.category?.trim();
    const nextIncome = [...defaultIncomeCategories];
    const nextExpense = [...defaultExpenseCategories];

    if (incomingCategory) {
      if (isIncome && !nextIncome.includes(incomingCategory)) {
        nextIncome.push(incomingCategory);
      }
      if (!isIncome && !nextExpense.includes(incomingCategory)) {
        nextExpense.push(incomingCategory);
      }
    }

    setIncomeCategories(nextIncome);
    setExpenseCategories(nextExpense);

    if (editingItem) {
      setDate(editingItem.transaction_date || getTodayDateInputValue());
      setCategory(editingItem.category || "");
      setDescription(editingItem.description || "");
      setAmountDigits(String(editingItem.amount || ""));
      setNotes(editingItem.notes || "");
    } else {
      setDate(getTodayDateInputValue());
      setCategory("");
      setDescription("");
      setAmountDigits("");
      setNotes("");
    }

    setError("");
    setShowNewCategoryInput(false);
    setNewCategory("");
  }, [open, type, editingItem]);

  function handleAmountChange(e) {
    const raw = e.target.value || "";
    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    setAmountDigits(digits);
  }

  function handleAddCategory() {
    const value = newCategory.trim();
    if (!value) return;

    if (isIncome) {
      if (!incomeCategories.includes(value)) {
        setIncomeCategories((prev) => [...prev, value]);
      }
    } else {
      if (!expenseCategories.includes(value)) {
        setExpenseCategories((prev) => [...prev, value]);
      }
    }

    setCategory(value);
    setNewCategory("");
    setShowNewCategoryInput(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!description.trim()) {
      setError("Deskripsi wajib diisi.");
      return;
    }

    if (!amountDigits || Number(amountDigits) <= 0) {
      setError("Jumlah harus lebih dari 0.");
      return;
    }

    if (!category.trim()) {
      setError("Kategori wajib dipilih.");
      return;
    }

    if (!date) {
      setError("Tanggal wajib diisi.");
      return;
    }

    await onSave({
      id: editingItem?.id || null,
      date,
      category: category.trim(),
      description: description.trim(),
      amount: Number(amountDigits),
      notes: notes.trim(),
    });
  }

  if (!open) return null;

  const title = isEdit
    ? isIncome
      ? "Edit Pemasukan Tambahan"
      : "Edit Pengeluaran"
    : isIncome
    ? "Tambah Pemasukan Tambahan"
    : "Tambah Pengeluaran";

  const descLabel = "Deskripsi *";
  const amountLabel = isIncome ? "Jumlah *" : "Jumlah (Rp) *";
  const dateLabel = isIncome ? "Tanggal Pemasukan *" : "Tanggal *";

  const descPlaceholder = isIncome
    ? "Contoh: Bonus proyek, Bunga deposito"
    : "Contoh: Beli kamera baru";

  const notesPlaceholder = isIncome
    ? "Catatan tambahan (opsional)"
    : "Catatan tambahan...";

  const saveClass =
    "bg-linear-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700";

  return (
    <div className="fixed inset-0 z-999 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-120 max-h-[88vh] rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h3 className="text-[20px] font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col max-h-[calc(88vh-76px)]"
        >
          <div className="overflow-y-auto px-6 py-5 space-y-5">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-2">
                {descLabel}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={descPlaceholder}
                className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-2">
                {amountLabel}
              </label>
              <div className="relative">
                {isIncome ? (
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm">
                    Rp
                  </span>
                ) : null}

                <input
                  type="text"
                  inputMode="numeric"
                  value={amountDigits}
                  onChange={handleAmountChange}
                  placeholder="0"
                  className={`w-full h-11 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-500 ${
                    isIncome ? "pl-12 pr-4" : "px-4"
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-2">
                Kategori
              </label>

              {!showNewCategoryInput ? (
                <>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="">
                      {isIncome ? "Pilih kategori" : "Pilih Kategori"}
                    </option>
                    {categoryOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowNewCategoryInput(true)}
                    className="mt-2 text-sm text-green-600 font-medium hover:text-green-700"
                  >
                    + Tambah kategori baru
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Masukkan kategori baru"
                    className="flex-1 h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="h-11 px-4 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCategoryInput(false);
                      setNewCategory("");
                    }}
                    className="h-11 px-4 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-2">
                {dateLabel}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-2">
                Catatan
              </label>
              <textarea
                rows="4"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={notesPlaceholder}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 bg-white flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 h-11 rounded-xl text-white font-medium shadow-sm transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 ${saveClass}`}
            >
              <Save size={16} />
              {loading
                ? "Menyimpan..."
                : isEdit
                ? "Simpan Perubahan"
                : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================
   UI COMPONENTS
========================================= */
function StatCard({ title, value, icon, iconWrapClass = "", valueClass = "" }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 min-h-28 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-2">{title}</p>
        <h3 className={`text-[20px] font-semibold ${valueClass}`}>{value}</h3>
      </div>

      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconWrapClass}`}
      >
        {icon}
      </div>
    </div>
  );
}

function SectionCard({ title, right, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-[22px] font-semibold text-gray-900">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function EmptyStateRow({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
      {text}
    </div>
  );
}

function TransactionTableSection({
  type = "income",
  items = [],
  visible = false,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
}) {
  const isIncome = type === "income";

  return (
    <SectionCard
      title={isIncome ? "Pemasukan Tambahan" : "Pengeluaran"}
      right={
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className="text-blue-600 text-sm font-medium cursor-pointer"
          >
            {visible ? "Sembunyikan" : `Tampilkan (${items.length})`}
          </button>
          <button
            onClick={onAdd}
            className={`h-11 px-4 rounded-xl text-white text-sm font-medium shadow-sm transition flex items-center gap-2 cursor-pointer ${
              isIncome
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            <Plus size={16} />
            {isIncome ? "Tambah Pemasukan" : "Tambah Pengeluaran"}
          </button>
        </div>
      }
    >
      {!visible ? null : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-[#fafafa] min-h-47.5 flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Calendar size={30} className="text-gray-400" />
          </div>
          <h4 className="text-[18px] font-semibold text-gray-900 mb-2">
            {isIncome ? "Belum Ada Pemasukan Tambahan" : "Belum Ada Pengeluaran"}
          </h4>
          <p className="text-gray-500 text-[15px]">
            Klik tombol "
            {isIncome ? "Tambah Pemasukan" : "Tambah Pengeluaran"}
            " untuk mulai mencatat
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-205 rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Deskripsi</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">Jumlah</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-gray-100 text-sm text-gray-700"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-gray-900">
                        <Calendar size={16} className="text-gray-400" />
                        <span>{formatDisplayDate(item.transaction_date)}</span>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <p className="font-semibold text-gray-900">
                        {item.description || "-"}
                      </p>
                      {item.notes ? (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                          {item.notes}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-6 py-5">
                      <div className="inline-flex items-center gap-2 text-gray-800">
                        <Tag
                          size={15}
                          className={
                            isIncome ? "text-blue-500" : "text-orange-500"
                          }
                        />
                        <span>{item.category || "-"}</span>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`font-semibold ${
                          isIncome ? "text-green-600" : "text-orange-600"
                        }`}
                      >
                        {formatRupiah(item.amount)}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => onEdit(item)}
                          className="text-blue-500 hover:text-blue-700 cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* =========================================
   MAIN
========================================= */
export default function Financial() {
  const navigate = useNavigate();

  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);

  const [bookings, setBookings] = useState([]);
  const [extraIncomes, setExtraIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);

  const [editingIncome, setEditingIncome] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  const [showIncomeList, setShowIncomeList] = useState(false);
  const [showExpenseList, setShowExpenseList] = useState(false);

  const [filterMonth, setFilterMonth] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [expandedServiceNames, setExpandedServiceNames] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  async function fetchOptionalTable(tableName, userId) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("owner_id", userId)
        .order("transaction_date", { ascending: false });

      if (error) {
        console.warn(
          `Optional table ${tableName} tidak tersedia:`,
          error.message
        );
        return [];
      }

      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn(`Optional table ${tableName} gagal dimuat:`, error);
      return [];
    }
  }

  async function loadFinancialData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user?.id) {
        setBookings([]);
        setExtraIncomes([]);
        setExpenses([]);
        setOwnerName("");
        setLoading(false);
        return;
      }

      setOwnerName(
        user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email ||
          ""
      );

      const bookingRes = await supabase
        .from("bookings")
        .select(`
          id,
          user_id,
          client_name,
          client_contact,
          client_address,
          service_id,
          service_name,
          quantity,
          unit_price,
          booking_status,
          payment_status,
          booking_more_than_one_day,
          booking_date,
          booking_start_date,
          booking_end_date,
          booking_time,
          discount_type,
          discount_value,
          discount_amount,
          ppn_percent,
          ppn_amount,
          subtotal_amount,
          fees_total,
          total_amount,
          paid_amount,
          remaining_amount,
          notes,
          created_at,
          updated_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (bookingRes.error) throw bookingRes.error;

      const [incomeData, expenseData] = await Promise.all([
        fetchOptionalTable("financial_extra_income", user.id),
        fetchOptionalTable("financial_expenses", user.id),
      ]);

      setBookings(Array.isArray(bookingRes.data) ? bookingRes.data : []);
      setExtraIncomes(incomeData);
      setExpenses(expenseData);
    } catch (error) {
      console.error("loadFinancialData error:", error);
      setErrorMessage(error.message || "Gagal memuat data laporan keuangan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinancialData();
  }, []);

  const hasBookingData = bookings.length > 0;

  const monthOptions = useMemo(() => {
    const allDates = [
      ...bookings.map((b) => getBookingMainDate(b)),
      ...extraIncomes.map((i) => i.transaction_date),
      ...expenses.map((e) => e.transaction_date),
    ];

    const set = new Set();
    allDates.forEach((d) => {
      const mk = monthKeyFromDate(d);
      if (mk) set.add(mk);
    });

    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [bookings, extraIncomes, expenses]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) =>
      matchesDateFilter(
        getBookingMainDate(booking),
        filterMonth,
        startDate,
        endDate
      )
    );
  }, [bookings, filterMonth, startDate, endDate]);

  const filteredExtraIncomes = useMemo(() => {
    return extraIncomes.filter((item) =>
      matchesDateFilter(item.transaction_date, filterMonth, startDate, endDate)
    );
  }, [extraIncomes, filterMonth, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) =>
      matchesDateFilter(item.transaction_date, filterMonth, startDate, endDate)
    );
  }, [expenses, filterMonth, startDate, endDate]);

  const financialSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalReceived = 0;
    let unpaidTransactionTotal = 0;
    let totalOutstanding = 0;

    let lunasCount = 0;
    let dpCount = 0;
    let belumBayarCount = 0;

    const revenuePerServiceMap = new Map();
    const monthlyRevenueMap = new Map();

    filteredBookings.forEach((booking) => {
      const total = toNumber(booking.total_amount);
      const paid = toNumber(booking.paid_amount);
      const remaining = toNumber(booking.remaining_amount);
      const status = String(booking.payment_status || "").trim().toLowerCase();

      totalRevenue += total;
      totalReceived += paid;
      totalOutstanding += remaining;

      if (status === "belum bayar" || status === "belum_bayar") {
        unpaidTransactionTotal += total;
      }

      if (status === "lunas") lunasCount += 1;
      else if (status === "dp") dpCount += 1;
      else if (status === "belum bayar" || status === "belum_bayar") {
        belumBayarCount += 1;
      }

      const bookingMonthKey = monthKeyFromDate(getBookingMainDate(booking));
      if (bookingMonthKey) {
        monthlyRevenueMap.set(
          bookingMonthKey,
          (monthlyRevenueMap.get(bookingMonthKey) || 0) + total
        );
      }

      const serviceName = booking?.service_name || "Layanan Tidak Diketahui";
      const subtotal =
        toNumber(booking?.subtotal_amount) ||
        toNumber(booking?.quantity) * toNumber(booking?.unit_price);

      const existing = revenuePerServiceMap.get(serviceName) || {
        serviceName,
        revenue: 0,
        bookings: 0,
        monthlyMap: new Map(),
      };

      existing.revenue += subtotal;
      existing.bookings += 1;

      if (bookingMonthKey) {
        const currentMonthData = existing.monthlyMap.get(bookingMonthKey) || {
          month: bookingMonthKey,
          amount: 0,
          bookings: 0,
        };

        currentMonthData.amount += subtotal;
        currentMonthData.bookings += 1;
        existing.monthlyMap.set(bookingMonthKey, currentMonthData);
      }

      revenuePerServiceMap.set(serviceName, existing);
    });

    const totalExtraIncome = filteredExtraIncomes.reduce(
      (sum, item) => sum + toNumber(item.amount),
      0
    );

    const totalExpense = filteredExpenses.reduce(
      (sum, item) => sum + toNumber(item.amount),
      0
    );

    const netProfit = totalReceived + totalExtraIncome - totalExpense;

    const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => (a.month > b.month ? 1 : -1));

    const revenuePerService = Array.from(revenuePerServiceMap.values())
      .map((item) => ({
        serviceName: item.serviceName,
        revenue: item.revenue,
        bookings: item.bookings,
        monthlyBreakdown: Array.from(item.monthlyMap.values()).sort((a, b) =>
          a.month > b.month ? -1 : 1
        ),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalBookingCount = filteredBookings.length;
    const averageRevenuePerMonth =
      monthlyRevenue.length > 0
        ? totalRevenue / monthlyRevenue.length
        : totalRevenue;

    const averageRevenuePerBooking =
      totalBookingCount > 0 ? totalRevenue / totalBookingCount : 0;

    const collectionRate =
      totalRevenue > 0 ? (totalReceived / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalReceived,
      unpaidTransactionTotal,
      totalOutstanding,
      totalExtraIncome,
      totalExpense,
      netProfit,
      lunasCount,
      dpCount,
      belumBayarCount,
      monthlyRevenue,
      revenuePerService,
      totalBookingCount,
      averageRevenuePerMonth,
      averageRevenuePerBooking,
      collectionRate,
    };
  }, [filteredBookings, filteredExtraIncomes, filteredExpenses]);

  function toggleServiceExpand(serviceName) {
    setExpandedServiceNames((prev) => ({
      ...prev,
      [serviceName]: !prev[serviceName],
    }));
  }

  function openAddIncomeModal() {
    setEditingIncome(null);
    setShowIncomeModal(true);
  }

  function openAddExpenseModal() {
    setEditingExpense(null);
    setShowExpenseModal(true);
  }

  function openEditIncomeModal(item) {
    setEditingIncome(item);
    setShowIncomeModal(true);
  }

  function openEditExpenseModal(item) {
    setEditingExpense(item);
    setShowExpenseModal(true);
  }

  async function handleSaveIncome(payload) {
    setSavingIncome(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) throw new Error("User tidak ditemukan.");

      if (payload.id) {
        const { error } = await supabase
          .from("financial_extra_income")
          .update({
            transaction_date: payload.date,
            category: payload.category,
            description: payload.description,
            amount: payload.amount,
            notes: payload.notes || null,
          })
          .eq("id", payload.id)
          .eq("owner_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_extra_income").insert({
          owner_id: user.id,
          transaction_date: payload.date,
          category: payload.category,
          description: payload.description,
          amount: payload.amount,
          notes: payload.notes || null,
        });

        if (error) throw error;
      }

      setShowIncomeModal(false);
      setEditingIncome(null);
      setShowIncomeList(true);
      await loadFinancialData();
    } catch (error) {
      console.error("handleSaveIncome error:", error);
      setErrorMessage(
        error.message ||
          "Gagal menyimpan pemasukan tambahan. Pastikan tabel financial_extra_income sudah dibuat."
      );
    } finally {
      setSavingIncome(false);
    }
  }

  async function handleSaveExpense(payload) {
    setSavingExpense(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) throw new Error("User tidak ditemukan.");

      if (payload.id) {
        const { error } = await supabase
          .from("financial_expenses")
          .update({
            transaction_date: payload.date,
            category: payload.category,
            description: payload.description,
            amount: payload.amount,
            notes: payload.notes || null,
          })
          .eq("id", payload.id)
          .eq("owner_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_expenses").insert({
          owner_id: user.id,
          transaction_date: payload.date,
          category: payload.category,
          description: payload.description,
          amount: payload.amount,
          notes: payload.notes || null,
        });

        if (error) throw error;
      }

      setShowExpenseModal(false);
      setEditingExpense(null);
      setShowExpenseList(true);
      await loadFinancialData();
    } catch (error) {
      console.error("handleSaveExpense error:", error);
      setErrorMessage(
        error.message ||
          "Gagal menyimpan pengeluaran. Pastikan tabel financial_expenses sudah dibuat."
      );
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleDeleteIncome(id) {
    const ok = window.confirm("Hapus pemasukan tambahan ini?");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("financial_extra_income")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await loadFinancialData();
    } catch (error) {
      console.error("handleDeleteIncome error:", error);
      setErrorMessage(error.message || "Gagal menghapus pemasukan tambahan.");
    }
  }

  async function handleDeleteExpense(id) {
    const ok = window.confirm("Hapus pengeluaran ini?");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("financial_expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await loadFinancialData();
    } catch (error) {
      console.error("handleDeleteExpense error:", error);
      setErrorMessage(error.message || "Gagal menghapus pengeluaran.");
    }
  }

  async function handleExport() {
    try {
      const exportDate = new Date();
      const exportDateLabel = exportDate.toLocaleDateString("id-ID");
      const exportDateTimeLabel = exportDate.toLocaleString("id-ID");

      const selectedPeriodLabel =
        filterMonth === "all" ? "Semua Bulan" : monthLabel(filterMonth);

      const totalRevenue = toNumber(financialSummary.totalRevenue);
      const totalReceived = toNumber(financialSummary.totalReceived);
      const unpaidTransactionTotal = toNumber(
        financialSummary.unpaidTransactionTotal
      );
      const totalOutstanding = toNumber(financialSummary.totalOutstanding);
      const totalExtraIncome = toNumber(financialSummary.totalExtraIncome);
      const totalExpense = toNumber(financialSummary.totalExpense);
      const totalIncome = totalReceived + totalExtraIncome;
      const netProfit = toNumber(financialSummary.netProfit);

      const marginProfit = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

      const collectionRate = toNumber(financialSummary.collectionRate);
      const outstandingRate =
        totalRevenue > 0 ? (totalOutstanding / totalRevenue) * 100 : 0;

      const paymentSuccessRate =
        financialSummary.totalBookingCount > 0
          ? (financialSummary.lunasCount / financialSummary.totalBookingCount) *
            100
          : 0;

      /* =========================================
         SHEET 1 - RINGKASAN KEUANGAN
      ========================================= */
      const summaryRows = [
        ["RINGKASAN KEUANGAN"],
        ["Periode", selectedPeriodLabel],
        ["Tanggal Export", exportDateLabel],
        ["Waktu Export", exportDateTimeLabel],
        [],
        ["METRIK UTAMA"],
        ["Total Revenue", formatRupiah(totalRevenue), totalRevenue],
        ["Sudah Diterima", formatRupiah(totalReceived), totalReceived],
        [
          "Belum Dibayar",
          formatRupiah(unpaidTransactionTotal),
          unpaidTransactionTotal,
        ],
        ["Sisa Tagihan", formatRupiah(totalOutstanding), totalOutstanding],
        [],
        ["PEMASUKAN & PENGELUARAN"],
        ["Revenue dari Booking", formatRupiah(totalReceived), totalReceived],
        ["Pemasukan Tambahan", formatRupiah(totalExtraIncome), totalExtraIncome],
        ["Total Pemasukan", formatRupiah(totalIncome), totalIncome],
        ["Total Pengeluaran", formatRupiah(totalExpense), totalExpense],
        [],
        ["LABA BERSIH"],
        [
          "Laba Bersih (Total Pemasukan - Pengeluaran)",
          formatRupiah(netProfit),
          netProfit,
        ],
        ["Margin Laba", formatPercent(marginProfit)],
        [],
        ["RASIO KEUANGAN"],
        ["Collection Rate", formatPercent(collectionRate)],
        ["Outstanding Rate", formatPercent(outstandingRate)],
        [],
        ["STATUS PEMBAYARAN"],
        ["Lunas", financialSummary.lunasCount],
        ["Down Payment (DP)", financialSummary.dpCount],
        ["Belum Bayar", financialSummary.belumBayarCount],
        ["Total Booking", financialSummary.totalBookingCount],
      ];

      /* =========================================
         SHEET 2 - DATA BULANAN
      ========================================= */
      const monthlyRows = [
        [
          "Bulan",
          "Bulan (YYYY-MM)",
          "Total Revenue",
          "Total Revenue (Numeric)",
          "Total Booking",
          "Sudah Dibayar",
          "Sudah Dibayar (Numeric)",
          "Belum Dibayar",
          "Belum Dibayar (Numeric)",
          "Rata-rata per Booking",
          "Rata-rata per Booking (Numeric)",
          "Growth Rate (%)",
          "Growth Rate (Numeric)",
        ],
      ];

      const monthlyMap = new Map();

      filteredBookings.forEach((booking) => {
        const mainDate = getBookingMainDate(booking);
        const mk = monthKeyFromDate(mainDate);
        if (!mk) return;

        const current = monthlyMap.get(mk) || {
          monthKey: mk,
          totalRevenue: 0,
          totalBooking: 0,
          totalPaid: 0,
          unpaidTotal: 0,
        };

        const total = toNumber(booking.total_amount);
        const paid = toNumber(booking.paid_amount);
        const status = String(booking.payment_status || "").trim().toLowerCase();

        current.totalRevenue += total;
        current.totalBooking += 1;
        current.totalPaid += paid;

        if (status === "belum bayar" || status === "belum_bayar") {
          current.unpaidTotal += total;
        }

        monthlyMap.set(mk, current);
      });

      const monthlyList = Array.from(monthlyMap.values()).sort((a, b) =>
        a.monthKey > b.monthKey ? 1 : -1
      );

      monthlyList.forEach((item, index) => {
        const previous = index > 0 ? monthlyList[index - 1] : null;
        const growth = getGrowthRate(
          item.totalRevenue,
          previous?.totalRevenue || 0
        );

        const avgPerBooking =
          item.totalBooking > 0 ? item.totalRevenue / item.totalBooking : 0;

        monthlyRows.push([
          monthLabel(item.monthKey),
          item.monthKey,
          formatRupiah(item.totalRevenue),
          item.totalRevenue,
          item.totalBooking,
          formatRupiah(item.totalPaid),
          item.totalPaid,
          formatRupiah(item.unpaidTotal),
          item.unpaidTotal,
          formatRupiah(avgPerBooking),
          Math.round(avgPerBooking),
          growth.label,
          growth.value,
        ]);
      });

      /* =========================================
         SHEET 3 - REVENUE PER LAYANAN
      ========================================= */
      const totalServiceRevenueBase = financialSummary.revenuePerService.reduce(
        (sum, item) => sum + toNumber(item.revenue),
        0
      );

      const serviceRows = [
        [
          "Jenis Layanan",
          "Total Revenue",
          "Total Revenue (Numeric)",
          "Jumlah Booking",
          "Rata-rata per Booking",
          "Rata-rata per Booking (Numeric)",
          "Persentase dari Total",
          "Persentase (Numeric)",
        ],
      ];

      financialSummary.revenuePerService.forEach((item) => {
        const revenue = toNumber(item.revenue);
        const bookingsCount = toNumber(item.bookings);
        const average = bookingsCount > 0 ? revenue / bookingsCount : 0;
        const percentage =
          totalServiceRevenueBase > 0
            ? (revenue / totalServiceRevenueBase) * 100
            : 0;

        serviceRows.push([
          item.serviceName || "-",
          formatRupiah(revenue),
          revenue,
          bookingsCount,
          formatRupiah(average),
          Math.round(average),
          formatPercent(percentage),
          Number(percentage.toFixed(1)),
        ]);
      });

      /* =========================================
         SHEET 4 - ANALISIS KEUANGAN DETAIL
      ========================================= */
      const analysisRows = [
        ["ANALISIS KEUANGAN DETAIL"],
        ["Generated on", formatDateTimeExport(exportDate)],
        [],
        ["KEY PERFORMANCE INDICATORS"],
        [
          "Total Monthly Average",
          formatRupiah(financialSummary.averageRevenuePerMonth),
        ],
        [
          "Booking Average Value",
          formatRupiah(financialSummary.averageRevenuePerBooking),
        ],
        ["Payment Success Rate", formatPercent(paymentSuccessRate)],
        [],
        ["REVENUE DISTRIBUTION"],
        ...financialSummary.revenuePerService.map((item) => {
          const percentage =
            totalServiceRevenueBase > 0
              ? (toNumber(item.revenue) / totalServiceRevenueBase) * 100
              : 0;

          return [
            item.serviceName || "-",
            formatRupiah(item.revenue),
            formatPercent(percentage),
          ];
        }),
        [],
        ["PAYMENT STATUS ANALYSIS"],
        [
          "Fully Paid (Lunas)",
          `${financialSummary.lunasCount} booking`,
          formatPercent(
            financialSummary.totalBookingCount > 0
              ? (financialSummary.lunasCount /
                  financialSummary.totalBookingCount) *
                  100
              : 0
          ),
        ],
        [
          "Down Payment (DP)",
          `${financialSummary.dpCount} booking`,
          formatPercent(
            financialSummary.totalBookingCount > 0
              ? (financialSummary.dpCount / financialSummary.totalBookingCount) *
                  100
              : 0
          ),
        ],
        [
          "Pending Payment",
          `${financialSummary.belumBayarCount} booking`,
          formatPercent(
            financialSummary.totalBookingCount > 0
              ? (financialSummary.belumBayarCount /
                  financialSummary.totalBookingCount) *
                  100
              : 0
          ),
        ],
      ];

      /* =========================================
         WORKBOOK
      ========================================= */
      const workbook = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyRows);
      const wsService = XLSX.utils.aoa_to_sheet(serviceRows);
      const wsAnalysis = XLSX.utils.aoa_to_sheet(analysisRows);

      autoFitWorksheetColumns(wsSummary, summaryRows);
      autoFitWorksheetColumns(wsMonthly, monthlyRows);
      autoFitWorksheetColumns(wsService, serviceRows);
      autoFitWorksheetColumns(wsAnalysis, analysisRows);

      XLSX.utils.book_append_sheet(workbook, wsSummary, "Ringkasan Keuangan");
      XLSX.utils.book_append_sheet(workbook, wsMonthly, "Data Bulanan");
      XLSX.utils.book_append_sheet(workbook, wsService, "Revenue Per Layanan");
      XLSX.utils.book_append_sheet(workbook, wsAnalysis, "Analisis Detail");

      const fileName = `laporan-keuangan-semua-periode-${getExportFileDate()}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Laporan keuangan semua periode berhasil diekspor ke Excel!",
        confirmButtonText: "OK",
        background: "#1e293b",
        color: "#ffffff",
        confirmButtonColor: "#2563eb",
        customClass: {
          popup: "rounded-3xl",
          confirmButton: "rounded-xl",
        },
      });
    } catch (error) {
      console.error("Gagal export excel:", error);

      await Swal.fire({
        icon: "error",
        title: "Export Gagal",
        text:
          error.message ||
          "Terjadi kesalahan saat mengekspor laporan keuangan.",
        confirmButtonText: "OK",
        background: "#1e293b",
        color: "#ffffff",
        confirmButtonColor: "#dc2626",
        customClass: {
          popup: "rounded-3xl",
          confirmButton: "rounded-xl",
        },
      });
    }
  }

  const maxMonthlyRevenue = Math.max(
    ...financialSummary.monthlyRevenue.map((item) => item.amount),
    0
  );

  const maxServiceRevenue = Math.max(
    ...financialSummary.revenuePerService.map((item) => item.revenue),
    0
  );

  const isLoss = financialSummary.netProfit < 0;
  const profitBannerClass = isLoss
    ? "bg-linear-to-r from-[#f43b47] to-[#ef233c]"
    : "bg-linear-to-r from-[#20c05c] to-[#0ea56b]";
  const profitTitle = isLoss ? "Rugi" : "Untung";
  const profitIconWrapClass = "bg-white/15";
  const ProfitIcon = isLoss ? ArrowDownRight : ArrowUpRight;

  return (
    <div className="min-h-screen bg-[#f5f6f8] font-sans">
      <header className="w-full bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="min-h-16 flex flex-wrap items-center justify-between gap-4 px-4 md:px-8 xl:px-14 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="cursor-pointer text-gray-800 hover:text-black transition"
            >
              <ArrowLeft size={20} strokeWidth={2.2} />
            </button>

            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[26px] font-semibold tracking-tight bg-linear-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                Dashboard Keuangan
              </h1>
              {ownerName ? (
                <span className="text-sm text-gray-500">{ownerName}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExport}
              className="h-11 px-4 rounded-xl bg-green-600 text-white text-sm font-medium shadow-sm hover:bg-green-700 transition flex items-center gap-2 cursor-pointer"
            >
              <Download size={16} />
              Export Excel
            </button>

            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Bulan</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>

            <div className="hidden md:block text-sm text-gray-400">atau</div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <CalendarDays
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>

              <span className="text-gray-400 text-sm">-</span>

              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <CalendarDays
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-350 mx-auto px-4 md:px-8 xl:px-14 py-6 space-y-6">
        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 text-sm">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
            Memuat data keuangan...
          </div>
        ) : !hasBookingData ? (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center py-20 px-6">
              <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center mb-6 shadow-sm">
                <BarChart3
                  size={28}
                  className="text-gray-400"
                  strokeWidth={1.8}
                />
              </div>

              <h2 className="text-[20px] font-semibold text-gray-900 mb-2">
                Belum Ada Data Keuangan
              </h2>

              <p className="text-gray-500 text-[15px] max-w-xl">
                Mulai dengan membuat booking pertama untuk melihat analisis
                keuangan.
              </p>

              <button
                onClick={() => navigate("/dashboard")}
                className="mt-7 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm shadow-md hover:bg-blue-700 transition cursor-pointer"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <StatCard
                title="Total Revenue"
                value={formatRupiah(financialSummary.totalRevenue)}
                valueClass="text-gray-900"
                icon={<Wallet size={22} className="text-green-600" />}
                iconWrapClass="bg-green-100"
              />
              <StatCard
                title="Sudah Diterima"
                value={formatRupiah(financialSummary.totalReceived)}
                valueClass="text-green-600"
                icon={<Receipt size={22} className="text-green-600" />}
                iconWrapClass="bg-green-100"
              />
              <StatCard
                title="Belum Dibayar"
                value={formatRupiah(financialSummary.unpaidTransactionTotal)}
                valueClass="text-yellow-600"
                icon={<Clock3 size={22} className="text-yellow-600" />}
                iconWrapClass="bg-yellow-100"
              />
              <StatCard
                title="Sisa Tagihan"
                value={formatRupiah(financialSummary.totalOutstanding)}
                valueClass="text-red-500"
                icon={<AlertCircle size={22} className="text-red-500" />}
                iconWrapClass="bg-red-100"
              />
              <StatCard
                title="Pemasukan Tambahan"
                value={formatRupiah(financialSummary.totalExtraIncome)}
                valueClass="text-blue-600"
                icon={<Plus size={22} className="text-blue-600" />}
                iconWrapClass="bg-blue-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-1">
                <StatCard
                  title="Total Pengeluaran"
                  value={formatRupiah(financialSummary.totalExpense)}
                  valueClass="text-orange-600"
                  icon={<Landmark size={22} className="text-orange-500" />}
                  iconWrapClass="bg-orange-100"
                />
              </div>
            </div>

            <section
              className={`rounded-2xl shadow-sm text-white px-6 py-7 flex items-center justify-between ${profitBannerClass}`}
            >
              <div>
                <p className="text-sm opacity-95 font-medium mb-1">Laba Bersih</p>
                <p className="text-xs opacity-90 mb-2">
                  (Revenue Booking + Pemasukan Tambahan - Pengeluaran)
                </p>

                <h2 className="text-4xl font-bold mb-2">
                  {formatRupiah(financialSummary.netProfit)}
                </h2>

                <p className="text-sm opacity-95 mb-1">
                  {profitTitle} - Periode:{" "}
                  {filterMonth === "all" ? "Semua Bulan" : monthLabel(filterMonth)}
                </p>

                <p className="text-sm opacity-90">
                  Revenue: {formatRupiah(financialSummary.totalReceived)}{" "}
                  &nbsp;&nbsp;+&nbsp;&nbsp; Tambahan:{" "}
                  {formatRupiah(financialSummary.totalExtraIncome)}
                  &nbsp;&nbsp;-&nbsp;&nbsp; Pengeluaran:{" "}
                  {formatRupiah(financialSummary.totalExpense)}
                </p>
              </div>

              <div
                className={`hidden md:flex w-16 h-16 rounded-full ${profitIconWrapClass} items-center justify-center`}
              >
                <ProfitIcon size={28} />
              </div>
            </section>

            <TransactionTableSection
              type="income"
              items={filteredExtraIncomes}
              visible={showIncomeList}
              onToggle={() => setShowIncomeList((prev) => !prev)}
              onAdd={openAddIncomeModal}
              onEdit={openEditIncomeModal}
              onDelete={handleDeleteIncome}
            />

            <TransactionTableSection
              type="expense"
              items={filteredExpenses}
              visible={showExpenseList}
              onToggle={() => setShowExpenseList((prev) => !prev)}
              onAdd={openAddExpenseModal}
              onEdit={openEditExpenseModal}
              onDelete={handleDeleteExpense}
            />

            <SectionCard
              title="Tren Revenue Bulanan"
              right={<TrendingUp size={18} className="text-green-600" />}
            >
              {financialSummary.monthlyRevenue.length === 0 ? (
                <EmptyStateRow text="Belum ada data revenue bulanan." />
              ) : (
                <div className="space-y-4">
                  {financialSummary.monthlyRevenue.map((item) => {
                    const percent =
                      maxMonthlyRevenue > 0
                        ? (item.amount / maxMonthlyRevenue) * 100
                        : 0;

                    const bookingCountInMonth = filteredBookings.filter(
                      (b) => monthKeyFromDate(getBookingMainDate(b)) === item.month
                    ).length;

                    return (
                      <div
                        key={item.month}
                        className="rounded-xl bg-gray-50 border border-gray-100 p-4"
                      >
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {monthLabel(item.month)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {bookingCountInMonth} booking
                            </p>
                          </div>
                          <p className="font-semibold text-gray-900">
                            {formatRupiah(item.amount)}
                          </p>
                        </div>

                        <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Status Pembayaran"
              right={<CreditCard size={18} className="text-blue-600" />}
            >
              <div className="space-y-3">
                <div className="rounded-xl px-4 py-4 bg-green-50 border border-green-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CircleDollarSign size={18} className="text-green-600" />
                    <span className="font-medium text-green-800">Lunas</span>
                  </div>
                  <span className="font-semibold text-green-700">
                    {financialSummary.lunasCount}
                  </span>
                </div>

                <div className="rounded-xl px-4 py-4 bg-orange-50 border border-orange-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Receipt size={18} className="text-orange-600" />
                    <span className="font-medium text-orange-800">
                      Down Payment
                    </span>
                  </div>
                  <span className="font-semibold text-orange-700">
                    {financialSummary.dpCount}
                  </span>
                </div>

                <div className="rounded-xl px-4 py-4 bg-yellow-50 border border-yellow-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock3 size={18} className="text-yellow-600" />
                    <span className="font-medium text-yellow-800">
                      Belum Bayar
                    </span>
                  </div>
                  <span className="font-semibold text-yellow-700">
                    {financialSummary.belumBayarCount}
                  </span>
                </div>

                <div className="rounded-xl px-5 py-5 bg-blue-50 border border-blue-100 mt-4">
                  <p className="text-sm text-blue-700 font-medium mb-2">
                    Tingkat Pembayaran
                  </p>
                  <p className="text-4xl font-bold text-blue-700 mb-2">
                    {financialSummary.collectionRate.toFixed(1)}%
                  </p>
                  <p className="text-sm text-blue-600">
                    Dari total {financialSummary.totalBookingCount} booking
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Revenue per Jenis Layanan"
              right={<BarChart3 size={18} className="text-purple-600" />}
            >
              {financialSummary.revenuePerService.length === 0 ? (
                <EmptyStateRow text="Belum ada data layanan." />
              ) : (
                <div className="space-y-4">
                  {financialSummary.revenuePerService.map((item) => {
                    const percent =
                      maxServiceRevenue > 0
                        ? (item.revenue / maxServiceRevenue) * 100
                        : 0;

                    const avg =
                      item.bookings > 0 ? item.revenue / item.bookings : 0;

                    const isExpanded = !!expandedServiceNames[item.serviceName];

                    return (
                      <div
                        key={item.serviceName}
                        className="rounded-xl border border-purple-200 p-4"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {item.serviceName}
                            </p>
                            <p className="text-2xl font-bold text-gray-900 mt-2">
                              {formatRupiah(item.revenue)}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {item.bookings} booking
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              Rata-rata: {formatRupiah(avg)}
                            </p>
                          </div>

                          <div className="text-right flex flex-col items-end gap-1">
                            <p className="text-sm font-semibold text-purple-600">
                              {percent.toFixed(1)}%
                            </p>
                            <button
                              type="button"
                              onClick={() => toggleServiceExpand(item.serviceName)}
                              className="text-gray-400 hover:text-purple-600 transition cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="w-full h-3 rounded-full bg-purple-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        {isExpanded ? (
                          <div className="mt-5 pt-4 border-t border-gray-200 space-y-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-800 mb-3">
                                Breakdown Bulanan
                              </p>

                              {item.monthlyBreakdown.length === 0 ? (
                                <EmptyStateRow text="Belum ada breakdown bulanan." />
                              ) : (
                                <div className="space-y-3">
                                  {item.monthlyBreakdown.map((monthItem) => (
                                    <div
                                      key={`${item.serviceName}-${monthItem.month}`}
                                      className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center justify-between gap-4"
                                    >
                                      <div>
                                        <p className="font-semibold text-gray-900">
                                          {monthLabel(monthItem.month)}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                          {monthItem.bookings} booking
                                        </p>
                                      </div>

                                      <p className="font-semibold text-gray-900">
                                        {formatRupiahShort(monthItem.amount)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                              <p className="text-gray-600">
                                Total ({item.monthlyBreakdown.length} bulan)
                              </p>
                              <p className="font-semibold text-gray-900">
                                {formatRupiah(item.revenue)}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                  <CalendarDays size={22} />
                </div>
                <p className="text-4xl font-bold text-gray-900">
                  {formatRupiah(financialSummary.averageRevenuePerMonth)}
                </p>
                <p className="text-gray-500 mt-2">Rata-rata Revenue per Bulan</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mb-4">
                  <BadgeDollarSign size={22} />
                </div>
                <p className="text-4xl font-bold text-gray-900">
                  {formatRupiah(financialSummary.averageRevenuePerBooking)}
                </p>
                <p className="text-gray-500 mt-2">Rata-rata Revenue per Booking</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
                  <TrendingUp size={22} />
                </div>
                <p className="text-4xl font-bold text-gray-900">
                  {financialSummary.collectionRate.toFixed(1)}%
                </p>
                <p className="text-gray-500 mt-2">Collection Rate</p>
              </div>
            </div>

            <SectionCard
              title="Detail Transaksi Booking"
              right={
                <span className="text-sm text-gray-500">
                  {filteredBookings.length} transaksi
                </span>
              }
            >
              {filteredBookings.length === 0 ? (
                <EmptyStateRow text="Belum ada transaksi booking pada periode ini." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-300">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                        <th className="py-3 pr-4">Tanggal</th>
                        <th className="py-3 pr-4">Klien</th>
                        <th className="py-3 pr-4">Layanan</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Subtotal</th>
                        <th className="py-3 pr-4">Biaya</th>
                        <th className="py-3 pr-4">Diskon</th>
                        <th className="py-3 pr-4">PPN</th>
                        <th className="py-3 pr-4">Total</th>
                        <th className="py-3 pr-4">Diterima</th>
                        <th className="py-3">Sisa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.map((booking) => {
                        const serviceName = booking.service_name || "-";

                        return (
                          <tr
                            key={booking.id}
                            className="border-b border-gray-50 text-sm text-gray-700"
                          >
                            <td className="py-4 pr-4">
                              {normalizeDateKey(getBookingMainDate(booking)) ||
                                "-"}
                            </td>
                            <td className="py-4 pr-4">
                              {booking.client_name || "-"}
                            </td>
                            <td className="py-4 pr-4">{serviceName}</td>
                            <td className="py-4 pr-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${paymentBadgeClass(
                                  booking.payment_status
                                )}`}
                              >
                                {getPaymentStatusLabel(booking.payment_status)}
                              </span>
                            </td>
                            <td className="py-4 pr-4 font-medium">
                              {formatRupiah(booking.subtotal_amount)}
                            </td>
                            <td className="py-4 pr-4 font-medium">
                              {formatRupiah(booking.fees_total)}
                            </td>
                            <td className="py-4 pr-4 font-medium text-red-500">
                              {formatRupiah(booking.discount_amount)}
                            </td>
                            <td className="py-4 pr-4 font-medium">
                              {formatRupiah(booking.ppn_amount)}
                            </td>
                            <td className="py-4 pr-4 font-medium">
                              {formatRupiah(booking.total_amount)}
                            </td>
                            <td className="py-4 pr-4 font-medium text-green-600">
                              {formatRupiah(booking.paid_amount)}
                            </td>
                            <td className="py-4 font-medium text-red-500">
                              {formatRupiah(booking.remaining_amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </main>

      <TransactionModal
        open={showIncomeModal}
        onClose={() => {
          setShowIncomeModal(false);
          setEditingIncome(null);
        }}
        onSave={handleSaveIncome}
        type="income"
        loading={savingIncome}
        editingItem={editingIncome}
      />

      <TransactionModal
        open={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
        type="expense"
        loading={savingExpense}
        editingItem={editingExpense}
      />
    </div>
  );
}