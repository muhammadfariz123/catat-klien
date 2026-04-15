import { useEffect, useMemo, useRef, useState } from "react";
import { X, FileText, Printer, RotateCcw } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  getCurrentUserOrThrow,
  fetchCompanySettings,
} from "../lib/companySettingsService";

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
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function addDays(dateValue, days) {
  const d = parseLocalDate(dateValue) || new Date();
  const cloned = new Date(d);
  cloned.setDate(cloned.getDate() + days);
  return cloned;
}

function toInputDate(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBookingDateForInvoice(booking) {
  if (!booking) return "-";

  if (booking.booking_more_than_one_day) {
    const start = booking.booking_start_date
      ? formatDateIndonesia(booking.booking_start_date)
      : "-";
    const end = booking.booking_end_date
      ? formatDateIndonesia(booking.booking_end_date)
      : "-";

    return `${start} - ${end}`;
  }

  return booking.booking_date ? formatDateIndonesia(booking.booking_date) : "-";
}

function formatBookingDateTimeForTable(booking) {
  const tanggal = formatBookingDateForInvoice(booking);
  const waktu =
    booking?.booking_time && String(booking.booking_time).trim()
      ? String(booking.booking_time).trim()
      : "";

  if (!waktu || waktu === "-") return tanggal;
  return `${tanggal} - ${waktu}`;
}

function formatAdditionalFees(feesJson) {
  if (!Array.isArray(feesJson) || feesJson.length === 0) return [];

  return feesJson
    .filter((fee) => String(fee?.name || "").trim() || toNumber(fee?.amount) > 0)
    .map((fee) => ({
      name: String(fee?.name || "Biaya Tambahan").trim(),
      op: fee?.op === "sub" ? "sub" : "add",
      amount: toNumber(fee?.amount || 0),
    }));
}

function generateInvoiceNumber(bookingId, invoiceDate) {
  const dateStr = toInputDate(parseLocalDate(invoiceDate) || new Date()).replaceAll(
    "-",
    ""
  );
  const shortId = String(bookingId || "")
    .replace(/-/g, "")
    .slice(0, 5)
    .toUpperCase();

  return `INV-${dateStr}-${shortId || "AUTO"}`;
}

function splitDescriptionLines(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function waitForImages(container) {
  if (!container) return Promise.resolve();

  const images = Array.from(container.querySelectorAll("img"));
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }

          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        })
    )
  );
}

const DEFAULT_COMPANY = {
  company_name: "CatatKlien",
  company_address: "Jl. Contoh No. 123\nJakarta, Indonesia",
  company_phone: "+62 21 1234 5678",
  company_email: "info@catatklien.com",
  logo_url: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_holder: "",
  payment_instruction:
    "Silakan transfer ke rekening di atas dan kirimkan bukti transfer untuk konfirmasi pembayaran.",
  bank_name2: "",
  bank_account_number2: "",
  bank_account_holder2: "",
};

function ExportInvoiceSheet({
  booking,
  company,
  invoiceNumber,
  invoiceDate,
  dueDate,
  bookingSummary,
  invoiceType,
}) {
  const logoUrl = company?.logo_url || "";
  const additionalFeeLines = bookingSummary.feeItems;
  const serviceDescriptionLines = splitDescriptionLines(
    booking?.services?.description?.trim() || "Tidak ada deskripsi layanan."
  );

  const headlineAmountLabel =
    invoiceType === "dp"
      ? "Jumlah DP yang harus ditransfer"
      : invoiceType === "pelunasan"
      ? "Jumlah sisa yang harus ditransfer"
      : "Jumlah yang harus ditransfer";

  return (
    <div
      className="invoice-export-sheet"
      style={{
        width: "794px",
        height: "1123px",
        background: "#ffffff",
        color: "#334155",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "34px 44px 28px 44px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "24px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo Perusahaan"
              crossOrigin="anonymous"
              style={{
                width: "76px",
                height: "76px",
                objectFit: "contain",
                borderRadius: "8px",
                background: "#fff",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "76px",
                height: "76px",
                borderRadius: "8px",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
              }}
            />
          )}

          <div
            style={{
              marginTop: "14px",
              fontSize: "20px",
              fontWeight: 700,
              color: "#2563eb",
              lineHeight: 1.2,
            }}
          >
            {company.company_name || "CatatKlien"}
          </div>

          <div
            style={{
              marginTop: "6px",
              whiteSpace: "pre-line",
              color: "#64748b",
              fontSize: "12px",
              lineHeight: 1.45,
            }}
          >
            {company.company_address || "-"}
          </div>

          <div
            style={{
              color: "#64748b",
              fontSize: "12px",
              lineHeight: 1.45,
            }}
          >
            Tel: {company.company_phone || "-"}
          </div>

          <div
            style={{
              color: "#64748b",
              fontSize: "12px",
              lineHeight: 1.45,
            }}
          >
            Email: {company.company_email || "-"}
          </div>
        </div>

        <div style={{ textAlign: "right", minWidth: "210px" }}>
          <div
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#334155",
              lineHeight: 1.1,
            }}
          >
            INVOICE
          </div>

          <div
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            {invoiceNumber}
          </div>
        </div>
      </div>

      <div
        style={{
          height: "1px",
          background: "#e2e8f0",
          marginTop: "10px",
          marginBottom: "18px",
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: "26px",
          marginBottom: "18px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#334155",
              marginBottom: "8px",
            }}
          >
            Bill To:
          </div>

          <div
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.3,
            }}
          >
            {booking.client_name || "-"}
          </div>

          <div
            style={{
              marginTop: "5px",
              fontSize: "12px",
              color: "#64748b",
              lineHeight: 1.4,
            }}
          >
            {booking.client_contact || "-"}
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              lineHeight: 1.4,
              whiteSpace: "pre-line",
            }}
          >
            {booking.client_address || "-"}
          </div>
        </div>

        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "105px 1fr",
              gap: "6px 8px",
              fontSize: "12px",
              lineHeight: 1.4,
            }}
          >
            <div style={{ color: "#64748b" }}>Tanggal Invoice:</div>
            <div style={{ color: "#334155" }}>{formatDateIndonesia(invoiceDate)}</div>

            <div style={{ color: "#64748b" }}>Jatuh Tempo:</div>
            <div style={{ color: "#334155" }}>{formatDateIndonesia(dueDate)}</div>

            <div style={{ color: "#64748b" }}>Tanggal Layanan:</div>
            <div style={{ color: "#334155" }}>{formatBookingDateForInvoice(booking)}</div>
          </div>
        </div>
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          fontSize: "11px",
        }}
      >
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <th
              style={{
                border: "1px solid #e2e8f0",
                padding: "9px 10px",
                textAlign: "left",
                width: "34%",
                color: "#475569",
                fontWeight: 700,
              }}
            >
              Deskripsi Layanan
            </th>
            <th
              style={{
                border: "1px solid #e2e8f0",
                padding: "9px 10px",
                textAlign: "center",
                width: "8%",
                color: "#475569",
                fontWeight: 700,
              }}
            >
              Qty
            </th>
            <th
              style={{
                border: "1px solid #e2e8f0",
                padding: "9px 10px",
                textAlign: "center",
                width: "16%",
                color: "#475569",
                fontWeight: 700,
              }}
            >
              Harga per Unit
            </th>
            <th
              style={{
                border: "1px solid #e2e8f0",
                padding: "9px 10px",
                textAlign: "center",
                width: "22%",
                color: "#475569",
                fontWeight: 700,
              }}
            >
              Tanggal & Waktu
            </th>
            <th
              style={{
                border: "1px solid #e2e8f0",
                padding: "9px 10px",
                textAlign: "right",
                width: "20%",
                color: "#475569",
                fontWeight: 700,
              }}
            >
              Jumlah
            </th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td
              style={{
                border: "1px solid #e2e8f0",
                padding: "10px",
                verticalAlign: "top",
                lineHeight: 1.45,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: "4px",
                }}
              >
                {booking.service_name || "-"}
              </div>

              {serviceDescriptionLines.length > 0 && (
                <div style={{ color: "#64748b" }}>
                  {serviceDescriptionLines.map((line, index) => (
                    <div key={`${line}-${index}`}>{line}</div>
                  ))}
                </div>
              )}

              {additionalFeeLines.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: "3px",
                    }}
                  >
                    Biaya Tambahan:
                  </div>

                  {additionalFeeLines.map((fee, index) => (
                    <div
                      key={`${fee.name}-${index}`}
                      style={{ color: "#64748b", lineHeight: 1.45 }}
                    >
                      • {fee.name} {fee.op === "sub" ? "(-)" : "(+)"}{" "}
                      {formatRupiah(fee.amount)}
                    </div>
                  ))}
                </div>
              )}
            </td>

            <td
              style={{
                border: "1px solid #e2e8f0",
                padding: "10px",
                verticalAlign: "top",
                textAlign: "center",
                color: "#334155",
              }}
            >
              {toNumber(booking.quantity || 0) || 1}
            </td>

            <td
              style={{
                border: "1px solid #e2e8f0",
                padding: "10px",
                verticalAlign: "top",
                textAlign: "center",
                color: "#334155",
              }}
            >
              {formatRupiah(booking.unit_price || 0)}
            </td>

            <td
              style={{
                border: "1px solid #e2e8f0",
                padding: "10px",
                verticalAlign: "top",
                color: "#334155",
                lineHeight: 1.4,
              }}
            >
              {formatBookingDateTimeForTable(booking)}
            </td>

            <td
              style={{
                border: "1px solid #e2e8f0",
                padding: "10px",
                verticalAlign: "top",
                textAlign: "right",
                color: "#334155",
              }}
            >
              {formatRupiah(booking.total_amount || booking.subtotal_amount || 0)}
            </td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          marginTop: "16px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <div style={{ width: "320px" }}>
          {bookingSummary.subtitleRows.map((item, index) => {
            const isMainRow =
              item.label === "DP yang harus dibayar" ||
              item.label.includes("DP (") ||
              item.label === "Sisa pembayaran" ||
              item.label === "Invoice ini";

            return (
              <div
                key={`${item.label}-${index}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  padding: "4px 0",
                  fontSize: isMainRow ? "11px" : "10px",
                  fontWeight: isMainRow ? 700 : 400,
                  color: isMainRow ? "#111827" : "#64748b",
                }}
              >
                <span>{item.label}:</span>
                <span
                  style={{
                    color: item.label.toLowerCase().includes("sisa")
                      ? "#ea580c"
                      : isMainRow
                      ? "#111827"
                      : "#64748b",
                    textAlign: "right",
                  }}
                >
                  {item.value}
                </span>
              </div>
            );
          })}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              borderTop: "2px solid #334155",
              marginTop: "6px",
              paddingTop: "8px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#111827",
            }}
          >
            <span>
              {invoiceType === "dp"
                ? "DP yang harus dibayar"
                : invoiceType === "pelunasan"
                ? "Sisa yang harus dibayar"
                : "Total invoice ini"}
              :
            </span>
            <span>{formatRupiah(bookingSummary.invoiceAmount)}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "18px",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          background: "#f8fafc",
          padding: "14px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#334155",
            marginBottom: "6px",
          }}
        >
          Informasi Pembayaran
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#475569",
            marginBottom: "12px",
          }}
        >
          Status:{" "}
          <span style={{ fontWeight: 700, color: "#111827" }}>
            {booking.payment_status || "Belum Bayar"}
          </span>
        </div>

        <div
          style={{
            border: "2px solid #f59e0b",
            background: "#fff7ed",
            borderRadius: "8px",
            padding: "13px 14px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: "#b45309",
              fontWeight: 700,
            }}
          >
            {headlineAmountLabel}
          </div>

          <div
            style={{
              marginTop: "6px",
              fontSize: "20px",
              fontWeight: 700,
              color: "#b45309",
              lineHeight: 1.2,
            }}
          >
            {formatRupiah(bookingSummary.invoiceAmount)}
          </div>
        </div>

        {(company.bank_name ||
          company.bank_account_number ||
          company.bank_account_holder ||
          company.bank_name2 ||
          company.bank_account_number2 ||
          company.bank_account_holder2) && (
          <>
            <div
              style={{
                marginTop: "14px",
                paddingTop: "12px",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: "8px",
                }}
              >
                Transfer Bank:
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                {(company.bank_name ||
                  company.bank_account_number ||
                  company.bank_account_holder) && (
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      background: "#ffffff",
                      padding: "12px",
                      fontSize: "12px",
                      lineHeight: 1.5,
                      color: "#334155",
                    }}
                  >
                    <div>
                      <b>Bank:</b> {company.bank_name || "-"}
                    </div>
                    <div>
                      <b>No. Rekening:</b> {company.bank_account_number || "-"}
                    </div>
                    <div>
                      <b>A.n:</b> {company.bank_account_holder || "-"}
                    </div>
                  </div>
                )}

                {(company.bank_name2 ||
                  company.bank_account_number2 ||
                  company.bank_account_holder2) && (
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      background: "#ffffff",
                      padding: "12px",
                      fontSize: "12px",
                      lineHeight: 1.5,
                      color: "#334155",
                    }}
                  >
                    <div>
                      <b>Bank:</b> {company.bank_name2 || "-"}
                    </div>
                    <div>
                      <b>No. Rekening:</b> {company.bank_account_number2 || "-"}
                    </div>
                    <div>
                      <b>A.n:</b> {company.bank_account_holder2 || "-"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: "14px",
            border: "2px solid #f59e0b",
            borderRadius: "8px",
            background: "#fffbeb",
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#334155",
              marginBottom: "4px",
            }}
          >
            Instruksi Pembayaran:
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "#334155",
              lineHeight: 1.45,
              whiteSpace: "pre-line",
            }}
          >
            {company.payment_instruction || DEFAULT_COMPANY.payment_instruction}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "14px",
          textAlign: "center",
          fontSize: "10px",
          color: "#94a3b8",
        }}
      >
        Invoice ini dibuat secara otomatis oleh sistem{" "}
        {company.company_name || "CatatKlien"}
      </div>
    </div>
  );
}

export default function GenerateInvoiceModal({ isOpen, onClose, booking }) {
  const [animate, setAnimate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState(DEFAULT_COMPANY);

  const [invoiceType, setInvoiceType] = useState("dp");
  const [dpMethod, setDpMethod] = useState("percentage");
  const [dpPercent, setDpPercent] = useState(30);
  const [dpNominal, setDpNominal] = useState("");

  const [invoiceDate, setInvoiceDate] = useState(toInputDate(new Date()));
  const [dueDate, setDueDate] = useState(toInputDate(addDays(new Date(), 7)));
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [downloading, setDownloading] = useState(false);

  const previewRef = useRef(null);
  const exportRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setAnimate(true), 10);
      document.body.style.overflow = "hidden";
    } else {
      setAnimate(false);
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !booking) return;

    async function loadSettings() {
      try {
        setLoading(true);

        const user = await getCurrentUserOrThrow();
        const data = await fetchCompanySettings(user.id);

        setCompany(data || DEFAULT_COMPANY);

        const today = new Date();
        const invoiceDateValue = toInputDate(today);
        const dueDateValue = toInputDate(addDays(today, 7));

        setInvoiceDate(invoiceDateValue);
        setDueDate(dueDateValue);
        setInvoiceNumber(generateInvoiceNumber(booking.id, invoiceDateValue));

        const totalAmount = toNumber(booking.total_amount);
        const paidAmount = toNumber(booking.paid_amount);

        if (paidAmount > 0 && paidAmount < totalAmount) {
          setInvoiceType("pelunasan");
        } else if (paidAmount >= totalAmount && totalAmount > 0) {
          setInvoiceType("penuh");
        } else {
          setInvoiceType("dp");
        }

        setDpMethod("percentage");
        setDpPercent(30);
        setDpNominal("");
      } catch (error) {
        console.error("Gagal memuat invoice:", error);
        alert(error.message || "Gagal memuat data invoice.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [isOpen, booking]);

  const bookingSummary = useMemo(() => {
    const subtotal = toNumber(booking?.subtotal_amount);
    const discountAmount = toNumber(booking?.discount_amount);
    const ppnAmount = toNumber(booking?.ppn_amount);
    const feesTotal = toNumber(booking?.fees_total);
    const totalAmount = toNumber(booking?.total_amount);
    const paidAmount = toNumber(booking?.paid_amount);
    const remainingAmount =
      toNumber(booking?.remaining_amount) > 0
        ? toNumber(booking?.remaining_amount)
        : Math.max(0, totalAmount - paidAmount);

    const baseTotal =
      totalAmount > 0
        ? totalAmount
        : Math.max(0, subtotal - discountAmount + ppnAmount + feesTotal);

    const safeRemaining = Math.max(0, remainingAmount);

    let invoiceAmount = baseTotal;
    let summaryTitle = "Jumlah yang harus ditransfer";
    let subtitleRows = [];

    if (invoiceType === "dp") {
      if (dpMethod === "nominal") {
        invoiceAmount = Math.min(Math.max(toNumber(dpNominal), 0), baseTotal);
      } else {
        invoiceAmount = Math.floor((baseTotal * toNumber(dpPercent)) / 100);
      }

      subtitleRows = [
        { label: "Subtotal", value: formatRupiah(subtotal) },
        ...(discountAmount > 0
          ? [{ label: "Diskon", value: `- ${formatRupiah(discountAmount)}` }]
          : []),
        ...(ppnAmount > 0
          ? [{ label: "PPN", value: formatRupiah(ppnAmount) }]
          : []),
        ...(feesTotal > 0
          ? [{ label: "Biaya tambahan", value: formatRupiah(feesTotal) }]
          : []),
        { label: "Total keseluruhan", value: formatRupiah(baseTotal) },
        {
          label:
            dpMethod === "nominal"
              ? "DP yang harus dibayar"
              : `DP (${toNumber(dpPercent)}%)`,
          value: formatRupiah(invoiceAmount),
        },
        {
          label: "Sisa setelah DP ini",
          value: formatRupiah(Math.max(0, baseTotal - invoiceAmount)),
        },
      ];
    }

    if (invoiceType === "pelunasan") {
      invoiceAmount = safeRemaining;
      summaryTitle = "Jumlah sisa yang harus ditransfer";

      subtitleRows = [
        { label: "Total keseluruhan", value: formatRupiah(baseTotal) },
        { label: "Sudah dibayar", value: formatRupiah(paidAmount) },
        { label: "Sisa pembayaran", value: formatRupiah(invoiceAmount) },
      ];
    }

    if (invoiceType === "penuh") {
      invoiceAmount = baseTotal;
      summaryTitle = "Jumlah yang harus ditransfer";

      subtitleRows = [
        { label: "Subtotal", value: formatRupiah(subtotal) },
        ...(discountAmount > 0
          ? [{ label: "Diskon", value: `- ${formatRupiah(discountAmount)}` }]
          : []),
        ...(ppnAmount > 0
          ? [{ label: "PPN", value: formatRupiah(ppnAmount) }]
          : []),
        ...(feesTotal > 0
          ? [{ label: "Biaya tambahan", value: formatRupiah(feesTotal) }]
          : []),
        { label: "Total keseluruhan", value: formatRupiah(baseTotal) },
        { label: "Invoice ini", value: formatRupiah(invoiceAmount) },
      ];
    }

    return {
      subtotal,
      discountAmount,
      ppnAmount,
      feesTotal,
      totalAmount: baseTotal,
      paidAmount,
      remainingAmount: safeRemaining,
      invoiceAmount,
      summaryTitle,
      subtitleRows,
      feeItems: formatAdditionalFees(booking?.fees_json),
    };
  }, [booking, invoiceType, dpMethod, dpPercent, dpNominal]);

  async function handleDownloadPdf() {
    if (!exportRef.current) return;

    try {
      setDownloading(true);

      await waitForImages(exportRef.current);

      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: exportRef.current.scrollWidth,
        height: exportRef.current.scrollHeight,
        windowWidth: exportRef.current.scrollWidth,
        windowHeight: exportRef.current.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      pdf.save(`${invoiceNumber || "invoice"}.pdf`);
    } catch (error) {
      console.error("Gagal download PDF:", error);
      alert(
        error?.message
          ? `Gagal membuat PDF invoice: ${error.message}`
          : "Gagal membuat PDF invoice."
      );
    } finally {
      setDownloading(false);
    }
  }

  async function handlePrint() {
    if (!exportRef.current) return;

    try {
      await waitForImages(exportRef.current);

      const printWindow = window.open("", "_blank", "width=1200,height=900");

      if (!printWindow) {
        alert("Pop-up diblokir browser. Izinkan pop-up untuk mencetak invoice.");
        return;
      }

      const html = exportRef.current.outerHTML;

      printWindow.document.open();
      printWindow.document.write(`
        <html>
          <head>
            <title>${invoiceNumber}</title>
            <meta charset="utf-8" />
            <style>
              @page {
                size: A4 portrait;
                margin: 0;
              }

              html, body {
                margin: 0;
                padding: 0;
                background: #ffffff;
                font-family: Arial, Helvetica, sans-serif;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              body {
                width: 210mm;
                height: 297mm;
                overflow: hidden;
              }

              .invoice-export-sheet {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 auto !important;
                overflow: hidden !important;
                background: #ffffff !important;
              }

              img {
                display: block;
                max-width: 100%;
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 700);
    } catch (error) {
      console.error("Gagal print invoice:", error);
      alert("Gagal memproses print invoice.");
    }
  }

  function resetInvoiceSetting() {
    setInvoiceType("dp");
    setDpMethod("percentage");
    setDpPercent(30);
    setDpNominal("");
    const today = new Date();
    const invoiceDateValue = toInputDate(today);
    setInvoiceDate(invoiceDateValue);
    setDueDate(toInputDate(addDays(today, 7)));
    setInvoiceNumber(generateInvoiceNumber(booking?.id, invoiceDateValue));
  }

  if (!isOpen || !booking) return null;

  const logoUrl = company?.logo_url || "";
  const additionalFeeLines = bookingSummary.feeItems;
  const serviceDescription =
    booking?.services?.description?.trim() || "Tidak ada deskripsi layanan.";

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div
        className={`relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300 ${
          animate
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-4"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-slate-800">
            Generate Invoice
          </h2>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading || loading}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              <FileText size={16} />
              {downloading ? "Membuat PDF..." : "Download PDF"}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={loading}
              className="h-10 px-5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Printer size={16} />
              Print
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="max-h-[82vh] overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Memuat data invoice...
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-blue-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">
                      Pengaturan Invoice
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={resetInvoiceSetting}
                    className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
                  >
                    <RotateCcw size={16} />
                    Reset
                  </button>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-[#eef5ff] p-4">
                  <div className="text-sm font-semibold text-slate-700 mb-4">
                    Jenis Invoice
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <label className="flex items-center gap-3 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="invoiceType"
                        checked={invoiceType === "dp"}
                        onChange={() => setInvoiceType("dp")}
                      />
                      <span>Invoice DP</span>
                    </label>

                    <label className="flex items-center gap-3 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="invoiceType"
                        checked={invoiceType === "pelunasan"}
                        onChange={() => setInvoiceType("pelunasan")}
                      />
                      <span>Invoice Pelunasan</span>
                    </label>

                    <label className="flex items-center gap-3 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="invoiceType"
                        checked={invoiceType === "penuh"}
                        onChange={() => setInvoiceType("penuh")}
                      />
                      <span>Invoice Penuh</span>
                    </label>
                  </div>

                  {invoiceType === "dp" && (
                    <div className="mt-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-700">
                          Metode DP:
                        </span>

                        <button
                          type="button"
                          onClick={() => setDpMethod("percentage")}
                          className={`px-4 py-1.5 rounded-xl text-sm ${
                            dpMethod === "percentage"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          Persentase (%)
                        </button>

                        <button
                          type="button"
                          onClick={() => setDpMethod("nominal")}
                          className={`px-4 py-1.5 rounded-xl text-sm ${
                            dpMethod === "nominal"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          Nominal (Rp)
                        </button>
                      </div>

                      {dpMethod === "percentage" ? (
                        <div>
                          <label className="text-sm font-medium text-slate-700">
                            Persentase DP
                          </label>

                          <div className="mt-3 flex items-center gap-4">
                            <input
                              type="range"
                              min="1"
                              max="100"
                              value={dpPercent}
                              onChange={(e) => setDpPercent(Number(e.target.value))}
                              className="flex-1"
                            />

                            <div className="w-20 h-10 rounded-lg border border-gray-300 bg-white flex items-center justify-center text-sm">
                              {dpPercent}%
                            </div>
                          </div>

                          <p className="text-sm text-slate-600 mt-3">
                            DP: {formatRupiah(bookingSummary.invoiceAmount)} dari
                            total {formatRupiah(bookingSummary.totalAmount)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <label className="text-sm font-medium text-slate-700">
                            Nominal DP
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={dpNominal}
                            onChange={(e) => setDpNominal(e.target.value)}
                            className="mt-2 w-full md:w-72 h-11 px-4 rounded-xl border border-gray-300"
                            placeholder="Masukkan nominal DP"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 rounded-2xl border border-gray-300 bg-white px-4 py-3">
                    {invoiceType === "dp" && (
                      <>
                        <div className="flex justify-between py-1 text-sm">
                          <span>Total Keseluruhan:</span>
                          <span className="font-semibold">
                            {formatRupiah(bookingSummary.totalAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 text-sm text-blue-600 font-semibold">
                          <span>
                            DP {dpMethod === "percentage" ? `(${dpPercent}%)` : "(Nominal)"}:
                          </span>
                          <span>{formatRupiah(bookingSummary.invoiceAmount)}</span>
                        </div>
                        <div className="flex justify-between py-1 text-sm">
                          <span>Sisa setelah DP:</span>
                          <span className="font-semibold">
                            {formatRupiah(
                              bookingSummary.totalAmount - bookingSummary.invoiceAmount
                            )}
                          </span>
                        </div>
                      </>
                    )}

                    {invoiceType === "pelunasan" && (
                      <>
                        <div className="flex justify-between py-1 text-sm">
                          <span>Total Keseluruhan:</span>
                          <span className="font-semibold">
                            {formatRupiah(bookingSummary.totalAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 text-sm">
                          <span>Sudah dibayar:</span>
                          <span className="font-semibold">
                            {formatRupiah(bookingSummary.paidAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 text-sm text-orange-600 font-semibold">
                          <span>Sisa pembayaran:</span>
                          <span>{formatRupiah(bookingSummary.invoiceAmount)}</span>
                        </div>
                      </>
                    )}

                    {invoiceType === "penuh" && (
                      <>
                        <div className="flex justify-between py-1 text-sm">
                          <span>Total Keseluruhan:</span>
                          <span className="font-semibold">
                            {formatRupiah(bookingSummary.totalAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 text-sm text-green-600 font-semibold">
                          <span>Invoice ini:</span>
                          <span>{formatRupiah(bookingSummary.invoiceAmount)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nomor Invoice
                    </label>
                    <input
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tanggal Invoice
                    </label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Jatuh Tempo
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-gray-300"
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  💡 Pilih jenis invoice di atas: <b>Invoice DP</b> untuk pembayaran
                  awal, <b>Invoice Pelunasan</b> untuk sisa pembayaran, atau{" "}
                  <b>Invoice Penuh</b> untuk pembayaran lengkap. Diskon dan PPN
                  diatur dari halaman edit booking.
                </div>
              </div>

              <div className="mt-6">
                <div
                  ref={previewRef}
                  className="invoice-root bg-white w-full max-w-[794px] mx-auto p-8 text-slate-700"
                >
                  <div className="flex justify-between items-start gap-6">
                    <div className="flex-1">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo Perusahaan"
                          className="w-[90px] h-[90px] object-contain rounded-lg bg-white"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="w-[90px] h-[90px] rounded-lg bg-slate-100 border border-slate-200" />
                      )}

                      <h1 className="text-[26px] font-bold text-blue-600 mt-4">
                        {company.company_name || "CatatKlien"}
                      </h1>

                      <div className="text-[13px] leading-6 whitespace-pre-line text-slate-600 mt-1">
                        {company.company_address || "-"}
                      </div>
                      <div className="text-[13px] text-slate-600">
                        Tel: {company.company_phone || "-"}
                      </div>
                      <div className="text-[13px] text-slate-600">
                        Email: {company.company_email || "-"}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <h2 className="text-[28px] font-bold text-slate-700">
                        INVOICE
                      </h2>
                      <p className="text-[12px] text-slate-500 mt-2">
                        {invoiceNumber}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-slate-200 my-6" />

                  <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                      <div className="text-sm font-semibold text-slate-700 mb-2">
                        Bill To:
                      </div>
                      <div className="text-[15px] font-semibold text-slate-800">
                        {booking.client_name || "-"}
                      </div>
                      <div className="text-[13px] text-slate-600 mt-1">
                        {booking.client_contact || "-"}
                      </div>
                      <div className="text-[13px] text-slate-600 whitespace-pre-line">
                        {booking.client_address || "-"}
                      </div>
                    </div>

                    <div className="text-[13px]">
                      <div className="grid grid-cols-[130px_1fr] gap-y-1">
                        <span className="text-slate-500">Tanggal Invoice</span>
                        <span>{formatDateIndonesia(invoiceDate)}</span>

                        <span className="text-slate-500">Jatuh Tempo</span>
                        <span>{formatDateIndonesia(dueDate)}</span>

                        <span className="text-slate-500">Tanggal Layanan</span>
                        <span>{formatBookingDateForInvoice(booking)}</span>
                      </div>
                    </div>
                  </div>

                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-200 px-3 py-3 text-left">
                          Deskripsi Layanan
                        </th>
                        <th className="border border-slate-200 px-3 py-3 text-left w-[60px]">
                          Qty
                        </th>
                        <th className="border border-slate-200 px-3 py-3 text-left w-[140px]">
                          Harga per Unit
                        </th>
                        <th className="border border-slate-200 px-3 py-3 text-left w-[180px]">
                          Tanggal & Waktu
                        </th>
                        <th className="border border-slate-200 px-3 py-3 text-right w-[130px]">
                          Jumlah
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td className="border border-slate-200 px-3 py-3 align-top">
                          <div className="font-semibold text-slate-800">
                            {booking.service_name || "-"}
                          </div>
                          <div className="text-slate-500 whitespace-pre-line mt-1">
                            {serviceDescription}
                          </div>

                          {additionalFeeLines.length > 0 && (
                            <div className="mt-3">
                              <div className="text-slate-700 font-semibold mb-1">
                                Biaya Tambahan:
                              </div>
                              <ul className="list-disc pl-4 text-slate-500">
                                {additionalFeeLines.map((fee, index) => (
                                  <li key={`${fee.name}-${index}`}>
                                    {fee.name}{" "}
                                    {fee.op === "sub" ? `( - )` : `( + )`}{" "}
                                    {formatRupiah(fee.amount)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>

                        <td className="border border-slate-200 px-3 py-3 align-top">
                          {toNumber(booking.quantity || 0) || 1}
                        </td>

                        <td className="border border-slate-200 px-3 py-3 align-top">
                          {formatRupiah(booking.unit_price || 0)}
                        </td>

                        <td className="border border-slate-200 px-3 py-3 align-top">
                          {formatBookingDateTimeForTable(booking)}
                        </td>

                        <td className="border border-slate-200 px-3 py-3 text-right align-top">
                          {formatRupiah(
                            booking.total_amount || booking.subtotal_amount || 0
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="mt-5 ml-auto w-full max-w-[360px]">
                    {bookingSummary.subtitleRows.map((item, index) => (
                      <div
                        key={`${item.label}-${index}`}
                        className="flex items-center justify-between py-1.5 text-[13px]"
                      >
                        <span className="text-slate-600">{item.label}:</span>
                        <span
                          className={`font-medium ${
                            item.label.toLowerCase().includes("sisa")
                              ? "text-orange-600"
                              : "text-slate-800"
                          }`}
                        >
                          {item.value}
                        </span>
                      </div>
                    ))}

                    <div className="flex items-center justify-between py-2 mt-2 border-t border-slate-300 text-[15px] font-bold">
                      <span>Total invoice ini:</span>
                      <span>{formatRupiah(bookingSummary.invoiceAmount)}</span>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-800">
                      Informasi Pembayaran
                    </div>
                    <div className="text-[13px] text-slate-600 mt-1">
                      Status: {booking.payment_status || "Belum Bayar"}
                    </div>

                    <div className="mt-4 border-2 border-amber-400 rounded-xl px-4 py-5 text-center bg-white">
                      <div className="text-[12px] font-semibold text-amber-700">
                        {bookingSummary.summaryTitle}
                      </div>
                      <div className="text-[26px] font-bold text-amber-700 mt-1">
                        {formatRupiah(bookingSummary.invoiceAmount)}
                      </div>
                    </div>

                    {(company.bank_name ||
                      company.bank_account_number ||
                      company.bank_account_holder ||
                      company.bank_name2 ||
                      company.bank_account_number2 ||
                      company.bank_account_holder2) && (
                      <>
                        <div className="mt-5 text-sm font-semibold text-slate-800">
                          Transfer Bank:
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-3">
                          {(company.bank_name ||
                            company.bank_account_number ||
                            company.bank_account_holder) && (
                            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[13px]">
                              <div>
                                <b>Bank:</b> {company.bank_name || "-"}
                              </div>
                              <div>
                                <b>No. Rekening:</b>{" "}
                                {company.bank_account_number || "-"}
                              </div>
                              <div>
                                <b>A.n:</b> {company.bank_account_holder || "-"}
                              </div>
                            </div>
                          )}

                          {(company.bank_name2 ||
                            company.bank_account_number2 ||
                            company.bank_account_holder2) && (
                            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[13px]">
                              <div>
                                <b>Bank:</b> {company.bank_name2 || "-"}
                              </div>
                              <div>
                                <b>No. Rekening:</b>{" "}
                                {company.bank_account_number2 || "-"}
                              </div>
                              <div>
                                <b>A.n:</b> {company.bank_account_holder2 || "-"}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <div className="mt-4 rounded-lg border-2 border-amber-400 bg-[#fffbeb] p-3 text-[13px]">
                      <div className="font-semibold text-slate-800 mb-1">
                        Instruksi Pembayaran:
                      </div>
                      <div className="text-slate-700 whitespace-pre-line">
                        {company.payment_instruction ||
                          DEFAULT_COMPANY.payment_instruction}
                      </div>
                    </div>
                  </div>

                  <div className="text-center text-[11px] text-slate-400 mt-5">
                    Invoice ini dibuat secara otomatis oleh sistem{" "}
                    {company.company_name || "CatatKlien"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  position: "fixed",
                  left: "-99999px",
                  top: 0,
                  width: "794px",
                  height: "1123px",
                  opacity: 1,
                  pointerEvents: "none",
                  overflow: "hidden",
                  background: "#ffffff",
                  zIndex: -1,
                }}
              >
                <div ref={exportRef}>
                  <ExportInvoiceSheet
                    booking={booking}
                    company={company}
                    invoiceNumber={invoiceNumber}
                    invoiceDate={invoiceDate}
                    dueDate={dueDate}
                    bookingSummary={bookingSummary}
                    invoiceType={invoiceType}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}