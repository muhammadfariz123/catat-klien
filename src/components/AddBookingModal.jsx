import { supabase } from "../lib/supabase";
import {
  saveBookingToSupabase,
  updateBookingToSupabase,
  fetchServicesByUser,
  createServiceToSupabase,
  updateServiceToSupabase,
  deleteServiceFromSupabase,
  fetchBlockedBookingDates,
} from "../lib/bookingService";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import id from "date-fns/locale/id";
import "react-datepicker/dist/react-datepicker.css";

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

function normalizeDateKey(value) {
  if (!value) return null;

  const d = parseLocalDate(value);
  if (!d) return null;

  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function expandDateRange(startDate, endDate) {
  const startKey = normalizeDateKey(startDate);
  const endKey = normalizeDateKey(endDate);

  if (!startKey || !endKey) return [];

  const start = parseLocalDate(startKey);
  const end = parseLocalDate(endKey);

  if (!start || !end) return [];
  if (start > end) return [];

  const results = [];
  const current = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );

  while (current <= end) {
    results.push(normalizeDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return results.filter(Boolean);
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
      {label && <label className="text-sm font-medium">{label}</label>}
      <DatePicker
        selected={toDateObj(value)}
        onChange={(date) => onChange(toInputDate(date))}
        placeholderText={placeholder}
        dateFormat="dd/MM/yyyy"
        locale="id"
        minDate={minDate || undefined}
        filterDate={filterDate}
        excludeDates={excludeDates}
        showPopperArrow={false}
        onKeyDown={(e) => e.preventDefault()}
        className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        wrapperClassName="w-full"
      />
      {error ? (
        <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>
      ) : null}
    </div>
  );
}

export default function AddBookingModal({
  isOpen,
  onClose,
  onSaved,
  editingBooking,
}) {
  const [animate, setAnimate] = useState(false);
  const isPrefillingSingleServiceRef = useRef(false);

  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [loadingServices, setLoadingServices] = useState(false);

  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);

  const [services, setServices] = useState([
    { id: 1, name: "Foto Wedding", price: 5000000, description: "" },
    { id: 2, name: "Video Wedding", price: 4000000, description: "" },
    { id: 3, name: "Prewedding", price: 3000000, description: "" },
  ]);

  const [selectedService, setSelectedService] = useState("");

  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [editServiceId, setEditServiceId] = useState(null);
  const [serviceSearch, setServiceSearch] = useState("");

  const [blockedBookingDates, setBlockedBookingDates] = useState([]);
  const [bookingDateError, setBookingDateError] = useState("");

  const [bookingStatus, setBookingStatus] = useState("Dijadwalkan");
  const [paymentStatus, setPaymentStatus] = useState("Belum Bayar");

  const [singleQty, setSingleQty] = useState("1");
  const [singleUnitPriceDigits, setSingleUnitPriceDigits] = useState("");
  const [sudahDibayarDigits, setSudahDibayarDigits] = useState("");

  const [diskonType, setDiskonType] = useState("rp");
  const [diskonValueDigits, setDiskonValueDigits] = useState("");
  const [ppnDigits, setPpnDigits] = useState("");

  const [additionalFees, setAdditionalFees] = useState([]);

  const [bookingMoreThanOneDay, setBookingMoreThanOneDay] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingStartDate, setBookingStartDate] = useState("");
  const [bookingEndDate, setBookingEndDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setAnimate(true), 10);
    } else {
      setAnimate(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!showDropdown) return;

    function handleOutsideClick() {
      setShowDropdown(false);
    }

    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [showDropdown]);

  useEffect(() => {
    const svc = services.find((s) => s.name === selectedService);

    if (isPrefillingSingleServiceRef.current) {
      isPrefillingSingleServiceRef.current = false;
      return;
    }

    if (svc && Number.isFinite(svc.price)) {
      setSingleUnitPriceDigits(String(svc.price || ""));
      setSingleQty((prev) => (prev && String(prev).trim() ? prev : "1"));
    } else {
      setSingleUnitPriceDigits("");
    }
  }, [selectedService, services]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadInitialData() {
      try {
        setLoadingServices(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const excludeBookingId = editingBooking?.id || null;

        const [serviceRows, blockedDates] = await Promise.all([
          fetchServicesByUser(user.id),
          fetchBlockedBookingDates(user.id, excludeBookingId),
        ]);

        if (Array.isArray(serviceRows) && serviceRows.length > 0) {
          setServices(serviceRows);
        }

        setBlockedBookingDates(
          Array.isArray(blockedDates)
            ? [
                ...new Set(
                  blockedDates.map((d) => normalizeDateKey(d)).filter(Boolean)
                ),
              ]
            : []
        );
      } catch (error) {
        console.error("Gagal load data modal:", error);
      } finally {
        setLoadingServices(false);
      }
    }

    loadInitialData();
  }, [isOpen, editingBooking]);

  function formatRupiah(value) {
    if (!value) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  }

  function formatRupiahInput(digits) {
    const clean = (digits || "").replace(/\D/g, "");
    if (!clean) return "Rp 0";
    const withDots = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `Rp ${withDots}`;
  }

  const blockedDateKeySet = useMemo(() => {
    return new Set(
      (Array.isArray(blockedBookingDates) ? blockedBookingDates : [])
        .map((item) => normalizeDateKey(item))
        .filter(Boolean)
    );
  }, [blockedBookingDates]);

  const editableOriginalDateKeys = useMemo(() => {
    if (!editingBooking) return new Set();

    if (editingBooking.booking_more_than_one_day) {
      return new Set(
        expandDateRange(
          editingBooking.booking_start_date,
          editingBooking.booking_end_date
        )
      );
    }

    const oneDate = normalizeDateKey(editingBooking.booking_date);
    return new Set(oneDate ? [oneDate] : []);
  }, [editingBooking]);

  function isDateBlocked(dateValue) {
    const key = normalizeDateKey(dateValue);
    if (!key) return false;

    if (editableOriginalDateKeys.has(key)) {
      return false;
    }

    return blockedDateKeySet.has(key);
  }

  function isDateRangeBlocked(startDate, endDate) {
    const allDates = expandDateRange(startDate, endDate);

    return allDates.some((dateKey) => {
      if (editableOriginalDateKeys.has(dateKey)) return false;
      return blockedDateKeySet.has(dateKey);
    });
  }

  function getReservedDateObjects() {
    return [...blockedDateKeySet]
      .filter((dateKey) => !editableOriginalDateKeys.has(dateKey))
      .map((dateStr) => parseLocalDate(dateStr))
      .filter(Boolean);
  }

  function canPickBookingStart(date) {
    return !isDateBlocked(date);
  }

  function canPickBookingEnd(date) {
    if (!bookingStartDate) return !isDateBlocked(date);

    const candidate = normalizeDateKey(date);
    if (!candidate) return false;
    if (candidate < bookingStartDate) return false;

    return !isDateRangeBlocked(bookingStartDate, candidate);
  }

  function getValidatedPaymentStatus(total, paid) {
    const totalNum = Number(total || 0);
    const paidNum = Number(paid || 0);

    if (paidNum <= 0) return "Belum Bayar";
    if (totalNum > 0 && paidNum < totalNum) return "DP";
    return "Lunas";
  }

  function getPaymentStatusClass(status) {
    if (status === "Lunas") {
      return "bg-green-50 text-green-700 border-green-200";
    }
    if (status === "DP") {
      return "bg-orange-50 text-orange-700 border-orange-200";
    }
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  }

  function toDigitsNoLeadingZero(raw) {
    let digits = (raw || "").replace(/\D/g, "");
    digits = digits.replace(/^0+(?=\d)/, "");
    return digits;
  }

  function handlePriceChange(e) {
    const raw = e.target.value || "";
    setNewServicePrice(toDigitsNoLeadingZero(raw));
  }

  async function handleAddService() {
    if (!newServiceName || !newServicePrice) return;

    try {
      setSaveError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User login tidak ditemukan. Silakan login ulang.");
      }

      let finalService;

      if (editServiceId) {
        const updated = await updateServiceToSupabase({
          serviceId: editServiceId,
          userId: user.id,
          name: newServiceName.trim(),
          price: Number(newServicePrice || 0),
          description: newServiceDesc.trim(),
        });

        finalService = updated;

        setServices((prev) =>
          prev.map((s) => (s.id === editServiceId ? finalService : s))
        );
        setEditServiceId(null);
      } else {
        const created = await createServiceToSupabase({
          userId: user.id,
          name: newServiceName.trim(),
          price: Number(newServicePrice || 0),
          description: newServiceDesc.trim(),
        });

        finalService = created;
        setServices((prev) => [...prev, finalService]);
      }

      setSelectedService(finalService.name);
      setSingleUnitPriceDigits(String(finalService.price || ""));
      setNewServiceName("");
      setNewServiceDesc("");
      setNewServicePrice("");
      setShowAddServiceForm(false);
      setShowDropdown(false);
    } catch (error) {
      setSaveError(error.message || "Gagal menyimpan layanan.");
    }
  }

  function handleEdit(service) {
    setNewServiceName(service.name);
    setNewServiceDesc(service.description || "");
    setNewServicePrice(String(service.price || ""));
    setEditServiceId(service.id);
    setShowAddServiceForm(true);
    setShowDropdown(false);
  }

  async function handleDelete(id) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User login tidak ditemukan. Silakan login ulang.");
      }

      const deleted = services.find((x) => x.id === id);

      if (typeof id === "string") {
        await deleteServiceFromSupabase(id, user.id);
      }

      setServices((prev) => prev.filter((s) => s.id !== id));

      if (selectedService === deleted?.name) {
        setSelectedService("");
        setSingleUnitPriceDigits("");
      }
    } catch (error) {
      setSaveError(error.message || "Gagal menghapus layanan.");
    }
  }

  function handleSingleQtyChange(v) {
    const digits = (v || "").replace(/\D/g, "");
    setSingleQty(digits ? digits : "");
  }

  function handleSingleUnitPriceChange(e) {
    const raw = e.target.value || "";
    setSingleUnitPriceDigits(toDigitsNoLeadingZero(raw));
  }

  function handleSudahDibayarChange(e) {
    const raw = e.target.value || "";
    setSudahDibayarDigits(toDigitsNoLeadingZero(raw));
  }

  function handleDiskonValueChange(e) {
    const raw = e.target.value || "";
    setDiskonValueDigits(toDigitsNoLeadingZero(raw));
  }

  function handlePpnChange(e) {
    const raw = e.target.value || "";
    setPpnDigits(toDigitsNoLeadingZero(raw));
  }

  function addFeeRow() {
    setAdditionalFees((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        name: "",
        digits: "",
        op: "add",
        showOpDropdown: false,
      },
    ]);
  }

  function updateFeeRow(id, field, value) {
    setAdditionalFees((prev) =>
      prev.map((fee) => (fee.id === id ? { ...fee, [field]: value } : fee))
    );
  }

  function toggleFeeOpDropdown(id) {
    setAdditionalFees((prev) =>
      prev.map((fee) =>
        fee.id === id
          ? { ...fee, showOpDropdown: !fee.showOpDropdown }
          : { ...fee, showOpDropdown: false }
      )
    );
  }

  function setFeeOp(id, op) {
    setAdditionalFees((prev) =>
      prev.map((fee) =>
        fee.id === id ? { ...fee, op, showOpDropdown: false } : fee
      )
    );
  }

  function removeFee(id) {
    setAdditionalFees((prev) => prev.filter((fee) => fee.id !== id));
  }

  const singleCalc = useMemo(() => {
    const qty = Number(singleQty || 0);
    const unit = Number(singleUnitPriceDigits || 0);
    const serviceSubtotal = qty * unit;

    const visibleFees = additionalFees.filter(
      (f) => (f.name || "").trim() !== "" || Number(f.digits || 0) > 0
    );

    const feesTotal = visibleFees.reduce((acc, f) => {
      const val = Number(f.digits || 0);
      return acc + (f.op === "sub" ? -val : val);
    }, 0);

    let diskonAmount = 0;
    const diskonVal = Number(diskonValueDigits || 0);
    if (diskonType === "rp") {
      diskonAmount = diskonVal;
    } else {
      diskonAmount = Math.floor((serviceSubtotal * diskonVal) / 100);
    }

    const subtotalAfterFees = serviceSubtotal + feesTotal;
    const baseBeforeTax = Math.max(0, serviceSubtotal - diskonAmount) + feesTotal;

    const ppnVal = Number(ppnDigits || 0);
    const ppnAmount = Math.floor((baseBeforeTax * ppnVal) / 100);

    const total = baseBeforeTax + ppnAmount;

    const paid = Number(sudahDibayarDigits || 0);
    const remaining = Math.max(0, total - paid);

    return {
      serviceSubtotal,
      visibleFees,
      feesTotal,
      subtotalAfterFees,
      diskonAmount,
      ppnAmount,
      total,
      paid,
      remaining,
    };
  }, [
    singleQty,
    singleUnitPriceDigits,
    additionalFees,
    diskonType,
    diskonValueDigits,
    ppnDigits,
    sudahDibayarDigits,
  ]);

  useEffect(() => {
    const nextStatus = getValidatedPaymentStatus(singleCalc.total, singleCalc.paid);
    setPaymentStatus(nextStatus);
  }, [singleCalc.total, singleCalc.paid]);

  const bookingDurationDays = useMemo(() => {
    if (!bookingMoreThanOneDay) return null;
    if (!bookingStartDate || !bookingEndDate) return null;

    const s = parseLocalDate(bookingStartDate);
    const e = parseLocalDate(bookingEndDate);

    if (!s || !e) return null;

    const diff = Math.floor(
      (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diff < 0) return null;
    return diff + 1;
  }, [bookingMoreThanOneDay, bookingStartDate, bookingEndDate]);

  function handleBookingModeChange(checked) {
    setBookingDateError("");

    if (checked) {
      const baseDate =
        bookingDate ||
        bookingStartDate ||
        editingBooking?.booking_date ||
        editingBooking?.booking_start_date ||
        "";

      setBookingMoreThanOneDay(true);
      setBookingStartDate(baseDate || "");
      setBookingEndDate(baseDate || "");
      setBookingDate("");
      return;
    }

    const baseDate =
      bookingStartDate ||
      bookingDate ||
      editingBooking?.booking_start_date ||
      editingBooking?.booking_date ||
      "";

    setBookingMoreThanOneDay(false);
    setBookingDate(baseDate || "");
    setBookingStartDate("");
    setBookingEndDate("");
  }

  function handleBookingDateChange(value) {
    setBookingDate(value);

    if (value && isDateBlocked(value)) {
      setBookingDateError("Tanggal booking ini sudah dipakai booking lain.");
    } else {
      setBookingDateError("");
    }
  }

  function handleBookingStartDateChange(value) {
    setBookingStartDate(value);

    if (value && bookingEndDate && bookingEndDate < value) {
      setBookingDateError(
        "Tanggal selesai booking tidak boleh sebelum tanggal mulai."
      );
      return;
    }

    if (value && bookingEndDate && isDateRangeBlocked(value, bookingEndDate)) {
      setBookingDateError("Rentang tanggal booking bentrok dengan booking lain.");
    } else {
      setBookingDateError("");
    }
  }

  function handleBookingEndDateChange(value) {
    setBookingEndDate(value);

    if (bookingStartDate && value && value < bookingStartDate) {
      setBookingDateError(
        "Tanggal selesai booking tidak boleh sebelum tanggal mulai."
      );
      return;
    }

    if (
      bookingStartDate &&
      value &&
      isDateRangeBlocked(bookingStartDate, value)
    ) {
      setBookingDateError("Rentang tanggal booking bentrok dengan booking lain.");
    } else {
      setBookingDateError("");
    }
  }

  function resetFormAfterSave() {
    setClientName("");
    setClientContact("");
    setClientAddress("");
    setNotes("");

    setSelectedService("");
    setSingleQty("1");
    setSingleUnitPriceDigits("");
    setSudahDibayarDigits("");
    setDiskonType("rp");
    setDiskonValueDigits("");
    setPpnDigits("");
    setAdditionalFees([]);
    setPaymentStatus("Belum Bayar");
    setBookingStatus("Dijadwalkan");

    setBookingMoreThanOneDay(false);
    setBookingDate("");
    setBookingStartDate("");
    setBookingEndDate("");
    setBookingTime("");

    setShowDropdown(false);
    setShowAddServiceForm(false);
    setEditServiceId(null);
    setServiceSearch("");
    setSaveError("");
    setSaveSuccess("");
    setBookingDateError("");
  }

  useEffect(() => {
    if (!isOpen) return;

    if (!editingBooking) {
      resetFormAfterSave();
      return;
    }

    setSaveError("");
    setSaveSuccess("");
    setShowDropdown(false);
    setShowAddServiceForm(false);
    setEditServiceId(null);
    setServiceSearch("");
    setBookingDateError("");

    setClientName(editingBooking.client_name || "");
    setClientContact(editingBooking.client_contact || "");
    setClientAddress(editingBooking.client_address || "");
    setNotes(editingBooking.notes || "");

    const serviceName = editingBooking.service_name || "";
    const unitPrice = String(editingBooking.unit_price || "");
    const qty = String(editingBooking.quantity || "1");

    if (serviceName && !services.some((svc) => svc.name === serviceName)) {
      setServices((prev) => [
        ...prev,
        {
          id: editingBooking.service_id || Date.now() + Math.random(),
          name: serviceName,
          price: Number(editingBooking.unit_price || 0),
          description: "",
        },
      ]);
    }

    isPrefillingSingleServiceRef.current = true;
    setSelectedService(serviceName);
    setSingleQty(qty);
    setSingleUnitPriceDigits(unitPrice);

    setBookingStatus(editingBooking.booking_status || "Dijadwalkan");
    setPaymentStatus(editingBooking.payment_status || "Belum Bayar");

    setSudahDibayarDigits(String(editingBooking.paid_amount || ""));
    setDiskonType(editingBooking.discount_type || "rp");
    setDiskonValueDigits(String(editingBooking.discount_value || ""));
    setPpnDigits(String(editingBooking.ppn_percent || ""));

    setAdditionalFees(
      Array.isArray(editingBooking.fees_json)
        ? editingBooking.fees_json.map((fee) => ({
            id: fee.id || Date.now() + Math.random(),
            name: fee.name || "",
            digits: String(fee.amount || ""),
            op: fee.op || "add",
            showOpDropdown: false,
          }))
        : []
    );

    setBookingMoreThanOneDay(Boolean(editingBooking.booking_more_than_one_day));
    setBookingDate(editingBooking.booking_date || "");
    setBookingStartDate(editingBooking.booking_start_date || "");
    setBookingEndDate(editingBooking.booking_end_date || "");
    setBookingTime(editingBooking.booking_time || "");
  }, [isOpen, editingBooking]);

  async function handleSaveBooking() {
    try {
      setSaving(true);
      setSaveError("");
      setSaveSuccess("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User login tidak ditemukan. Silakan login ulang.");
      }

      if (!clientName.trim()) {
        throw new Error("Nama klien wajib diisi.");
      }

      if (!selectedService) {
        throw new Error("Jenis layanan wajib dipilih.");
      }

      if (bookingMoreThanOneDay) {
        if (!bookingStartDate || !bookingEndDate) {
          throw new Error("Tanggal mulai dan tanggal selesai wajib diisi.");
        }

        if (bookingEndDate < bookingStartDate) {
          throw new Error(
            "Tanggal selesai booking tidak boleh sebelum tanggal mulai."
          );
        }

        if (isDateRangeBlocked(bookingStartDate, bookingEndDate)) {
          throw new Error("Rentang tanggal booking bentrok dengan booking lain.");
        }
      } else {
        if (!bookingDate) {
          throw new Error("Tanggal booking wajib diisi.");
        }

        if (isDateBlocked(bookingDate)) {
          throw new Error("Tanggal booking ini sudah dipakai booking lain.");
        }
      }

      const matchedService = services.find((svc) => svc.name === selectedService);

      const feesJson = additionalFees
        .filter((fee) => fee.name?.trim() || Number(fee.digits || 0) > 0)
        .map((fee) => ({
          id: fee.id,
          name: fee.name?.trim() || "",
          op: fee.op,
          amount: Number(fee.digits || 0),
        }));

      const bookingPayload = {
        user_id: user.id,
        client_name: clientName.trim(),
        client_contact: clientContact.trim() || null,
        client_address: clientAddress.trim() || null,

        service_id: matchedService?.id || null,
        service_name: selectedService,
        quantity: Number(singleQty || 1),
        unit_price: Number(singleUnitPriceDigits || 0),

        booking_status: bookingStatus,
        payment_status: paymentStatus,

        booking_more_than_one_day: bookingMoreThanOneDay,
        booking_date: bookingMoreThanOneDay ? null : bookingDate || null,
        booking_start_date: bookingMoreThanOneDay ? bookingStartDate || null : null,
        booking_end_date: bookingMoreThanOneDay ? bookingEndDate || null : null,
        booking_time: bookingTime || null,

        discount_type: diskonType,
        discount_value: Number(diskonValueDigits || 0),
        discount_amount: singleCalc.diskonAmount,
        ppn_percent: Number(ppnDigits || 0),
        ppn_amount: singleCalc.ppnAmount,

        fees_json: feesJson,
        fees_total: singleCalc.feesTotal,

        subtotal_amount: singleCalc.serviceSubtotal,
        total_amount: singleCalc.total,
        paid_amount: Number(sudahDibayarDigits || 0),
        remaining_amount: singleCalc.remaining,

        notes: notes.trim() || null,
      };

      if (editingBooking?.id) {
        await updateBookingToSupabase({
          bookingId: editingBooking.id,
          userId: user.id,
          booking: bookingPayload,
        });

        setSaveSuccess("Booking berhasil diperbarui.");
      } else {
        await saveBookingToSupabase({
          booking: bookingPayload,
        });

        setSaveSuccess("Booking berhasil disimpan.");
      }

      resetFormAfterSave();

      if (typeof onSaved === "function") {
        await onSaved();
        return;
      }

      if (typeof onClose === "function") {
        onClose();
      }
    } catch (error) {
      setSaveError(
        error.message || "Terjadi kesalahan saat menyimpan booking."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const showSingleDiskonRow = Number(diskonValueDigits || 0) > 0;
  const showSinglePpnRow = Number(ppnDigits || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div
        className={`relative bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 ${
          animate
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-4"
        }`}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {editingBooking ? "Edit Booking" : "Tambah Booking Baru"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          <div className="px-6 py-5 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nama Klien *</label>
                <input
                  type="text"
                  placeholder="Masukkan nama klien"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Kontak Klien</label>
                <input
                  type="text"
                  placeholder="Nomor telepon atau email"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                  className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Alamat Klien</label>
                <input
                  type="text"
                  placeholder="Alamat klien"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-3 relative">
              <div>
                <h3 className="text-sm font-semibold">Jenis Layanan</h3>
              </div>

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <div
                  onClick={() => {
                    setShowDropdown(!showDropdown);
                    setShowAddServiceForm(false);
                    setServiceSearch("");
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 cursor-pointer text-sm flex items-center justify-between"
                >
                  <span
                    className={`${
                      selectedService ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {selectedService || "Pilih atau tambah jenis layanan"}
                  </span>
                  {showDropdown ? (
                    <ChevronUp size={18} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={18} className="text-gray-400" />
                  )}
                </div>

                {!selectedService && (
                  <p className="text-xs text-red-500 mt-2">
                    Jenis layanan harus diisi
                  </p>
                )}

                {showDropdown && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-3 space-y-2">
                    <input
                      type="text"
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder="Cari layanan atau ketik untuk menambah..."
                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                    />

                    {loadingServices && (
                      <div className="text-center text-xs text-gray-500 py-2">
                        Memuat layanan...
                      </div>
                    )}

                    {services.length === 0 && !loadingServices && (
                      <div className="text-center text-xs text-gray-500 py-4">
                        Belum ada layanan tersedia. Silakan tambahkan layanan baru.
                      </div>
                    )}

                    {services.map((service) => {
                      if (
                        serviceSearch &&
                        !service.name
                          .toLowerCase()
                          .includes(serviceSearch.toLowerCase())
                      ) {
                        return null;
                      }

                      return (
                        <div
                          key={service.id}
                          onClick={() => {
                            setSelectedService(service.name);
                            setShowDropdown(false);
                          }}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {service.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatRupiah(service.price)}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(service);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(service.id);
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setShowDropdown(false);
                        setShowAddServiceForm(true);
                      }}
                      className="w-full mt-2 py-2 rounded-lg bg-blue-600 text-white text-sm flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      Tambah Layanan
                    </button>
                  </div>
                )}
              </div>

              {showAddServiceForm && (
                <div className="absolute inset-0 z-20 flex items-start justify-center pt-16">
                  <div
                    onClick={() => {
                      setShowAddServiceForm(false);
                      setEditServiceId(null);
                    }}
                    className="absolute inset-0 bg-black/10 backdrop-blur-[1px] rounded-xl"
                  />

                  <div className="relative w-[92%] bg-white border border-gray-200 rounded-xl shadow-xl p-5 space-y-4">
                    <h3 className="text-sm font-semibold">
                      {editServiceId ? "Edit Layanan" : "Tambah Layanan Baru"}
                    </h3>

                    <div>
                      <label className="text-sm font-medium">
                        Nama Layanan Baru
                      </label>
                      <input
                        placeholder="Masukkan nama layanan..."
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        className="mt-1 w-full px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Deskripsi (opsional)
                      </label>
                      <textarea
                        placeholder="Masukkan deskripsi layanan..."
                        value={newServiceDesc}
                        onChange={(e) => setNewServiceDesc(e.target.value)}
                        className="mt-1 w-full px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Harga Default (opsional)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Rp 0"
                        value={formatRupiahInput(newServicePrice)}
                        onChange={handlePriceChange}
                        className="mt-1 w-full px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddServiceForm(false);
                          setEditServiceId(null);
                        }}
                        className="px-4 py-2 bg-gray-200 rounded-xl text-sm"
                      >
                        Batal
                      </button>

                      <button
                        type="button"
                        onClick={handleAddService}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        {editServiceId ? "Simpan Perubahan" : "Tambah Layanan"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bookingMoreThanOneDay}
                  onChange={(e) => handleBookingModeChange(e.target.checked)}
                />
                <span className="text-sm">Booking lebih dari 1 hari</span>
              </div>

              {bookingMoreThanOneDay ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <DatePickerField
                      label="Tanggal Mulai *"
                      value={bookingStartDate}
                      onChange={handleBookingStartDateChange}
                      filterDate={canPickBookingStart}
                      excludeDates={getReservedDateObjects()}
                    />

                    <DatePickerField
                      label="Tanggal Selesai *"
                      value={bookingEndDate}
                      onChange={handleBookingEndDateChange}
                      minDate={
                        bookingStartDate
                          ? parseLocalDate(bookingStartDate)
                          : undefined
                      }
                      filterDate={canPickBookingEnd}
                      excludeDates={getReservedDateObjects()}
                    />

                    <div>
                      <label className="text-sm font-medium">Waktu</label>
                      <input
                        type="time"
                        value={bookingTime}
                        onChange={(e) => setBookingTime(e.target.value)}
                        className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Opsional - kosongkan jika tidak diperlukan
                      </p>
                    </div>
                  </div>

                  {typeof bookingDurationDays === "number" && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                      <p className="text-sm font-medium text-blue-700">
                        Total durasi: {bookingDurationDays} hari
                      </p>
                    </div>
                  )}

                  {bookingDateError && (
                    <p className="text-xs text-red-500 font-medium">
                      {bookingDateError}
                    </p>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <DatePickerField
                    label="Tanggal *"
                    value={bookingDate}
                    onChange={handleBookingDateChange}
                    filterDate={(date) => !isDateBlocked(date)}
                    excludeDates={getReservedDateObjects()}
                    error={bookingDateError}
                  />

                  <div>
                    <label className="text-sm font-medium">Waktu</label>
                    <input
                      type="time"
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Opsional - kosongkan jika tidak diperlukan
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-1 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={bookingStatus}
                    onChange={(e) => setBookingStatus(e.target.value)}
                    className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Dijadwalkan</option>
                    <option>Selesai</option>
                    <option>Dibatalkan</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Status Pembayaran
                  </label>
                  <div
                    className={`mt-1 w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${getPaymentStatusClass(
                      paymentStatus
                    )}`}
                  >
                    {paymentStatus === "DP"
                      ? "Down Payment ( DP )"
                      : paymentStatus}
                  </div>
                  <p className="text-[11px] text-blue-600 mt-1">
                    Status pembayaran tervalidasi otomatis berdasarkan nominal
                    yang dibayarkan.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Quantity</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1"
                    value={singleQty}
                    onChange={(e) => handleSingleQtyChange(e.target.value)}
                    className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Harga per Unit (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Rp 0"
                    value={formatRupiahInput(singleUnitPriceDigits)}
                    onChange={handleSingleUnitPriceChange}
                    className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Sudah Dibayar (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Rp 0"
                  value={formatRupiahInput(sudahDibayarDigits)}
                  onChange={handleSudahDibayarChange}
                  className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Diskon</label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={diskonValueDigits || "0"}
                      onChange={handleDiskonValueChange}
                      className="w-full pr-20 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                    />

                    <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => setDiskonType("rp")}
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          diskonType === "rp"
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        Rp
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiskonType("%")}
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          diskonType === "%"
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">PPN (%)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={ppnDigits || "0"}
                    onChange={handlePpnChange}
                    className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Biaya Tambahan</div>

                  <button
                    type="button"
                    onClick={addFeeRow}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm inline-flex items-center gap-2 hover:bg-blue-700"
                  >
                    <Plus size={16} />
                    Tambah Biaya
                  </button>
                </div>

                {additionalFees.map((fee) => (
                  <div
                    key={fee.id}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                  >
                    <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-4 sm:col-span-3 relative">
                        <button
                          type="button"
                          onClick={() => toggleFeeOpDropdown(fee.id)}
                          className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm flex items-center justify-between hover:bg-gray-50"
                        >
                          <span className="font-semibold">
                            {fee.op === "add" ? "Tambah (+)" : "Kurang (-)"}
                          </span>
                          {fee.showOpDropdown ? (
                            <ChevronUp size={16} className="text-gray-400" />
                          ) : (
                            <ChevronDown size={16} className="text-gray-400" />
                          )}
                        </button>

                        {fee.showOpDropdown && (
                          <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setFeeOp(fee.id, "add")}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                            >
                              Tambah (+)
                            </button>
                            <button
                              type="button"
                              onClick={() => setFeeOp(fee.id, "sub")}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                            >
                              Kurang (-)
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="col-span-8 sm:col-span-5">
                        <input
                          type="text"
                          placeholder="Contoh: transport"
                          value={fee.name}
                          onChange={(e) =>
                            updateFeeRow(fee.id, "name", e.target.value)
                          }
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="col-span-10 sm:col-span-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={fee.digits || ""}
                          onChange={(e) =>
                            updateFeeRow(
                              fee.id,
                              "digits",
                              toDigitsNoLeadingZero(e.target.value)
                            )
                          }
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeFee(fee.id)}
                          className="p-2 rounded-xl hover:bg-red-50 text-red-600"
                          title="Hapus biaya"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-gray-600">
                    {selectedService ? `${selectedService} :` : "Layanan :"}
                  </div>
                  <div className="text-gray-700 font-medium">
                    {formatRupiah(singleCalc.serviceSubtotal)}
                  </div>
                </div>

                {singleCalc.visibleFees.map((fee) => (
                  <div
                    key={fee.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100"
                  >
                    <div className="text-gray-600">
                      {fee.name || "Biaya Tambahan"}:
                    </div>
                    <div
                      className={`font-medium ${
                        fee.op === "sub" ? "text-red-600" : "text-gray-700"
                      }`}
                    >
                      {fee.op === "sub" ? "- " : ""}
                      {formatRupiah(Number(fee.digits || 0))}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-gray-600">Subtotal:</div>
                  <div className="text-gray-700 font-medium">
                    {formatRupiah(singleCalc.subtotalAfterFees)}
                  </div>
                </div>

                {showSingleDiskonRow && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div className="text-gray-600">Diskon:</div>
                    <div className="text-gray-700 font-medium">
                      - {formatRupiah(singleCalc.diskonAmount)}
                    </div>
                  </div>
                )}

                {showSinglePpnRow && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div className="text-gray-600">PPN:</div>
                    <div className="text-gray-700 font-medium">
                      {formatRupiah(singleCalc.ppnAmount)}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-gray-800 font-semibold">
                    Total Keseluruhan:
                  </div>
                  <div className="text-blue-700 font-semibold">
                    {formatRupiah(singleCalc.total)}
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-gray-600">Sudah Dibayar:</div>
                  <div className="text-gray-700 font-medium">
                    {formatRupiah(singleCalc.paid)}
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="text-gray-600">Sisa Pembayaran:</div>
                  <div className="text-red-600 font-semibold">
                    {formatRupiah(singleCalc.remaining)}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Catatan</label>
              <textarea
                rows="3"
                placeholder="Tambahkan catatan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {saveError && (
            <div className="px-6 pb-2">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            </div>
          )}

          {saveSuccess && (
            <div className="px-6 pb-2">
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {saveSuccess}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-200 text-sm"
            >
              Batal
            </button>
            <button
              onClick={handleSaveBooking}
              disabled={saving}
              className={`px-6 py-2 rounded-xl text-white text-sm ${
                saving
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {saving
                ? editingBooking
                  ? "Menyimpan Perubahan..."
                  : "Menyimpan..."
                : editingBooking
                ? "Simpan Perubahan"
                : "Simpan Booking"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}