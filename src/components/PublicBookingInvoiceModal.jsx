import { useEffect, useMemo, useRef, useState } from "react";
import { X, FileText, Printer } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { fetchCompanySettingsByUserId } from "../lib/companySettingsService";

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
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

function generateInvoiceNumber(invoiceDate, bookingLikeId = "") {
  const dateStr = toInputDate(
    parseLocalDate(invoiceDate) || new Date()
  ).replaceAll("-", "");

  const shortId = String(bookingLikeId || "PUBLIC")
    .replace(/-/g, "")
    .slice(0, 5)
    .toUpperCase();

  return `INV-${dateStr}-${shortId || "AUTO"}`;
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

  if (!waktu) return tanggal;
  return `${tanggal} - ${waktu}`;
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

function ExportPublicInvoiceSheet({
  company,
  invoiceNumber,
  invoiceDate,
  dueDate,
  invoiceData,
  summary,
}) {
  const logoUrl = company?.logo_url || "";

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
          gap: "20px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo Perusahaan"
              crossOrigin="anonymous"
              style={{
                width: "68px",
                height: "68px",
                objectFit: "contain",
                display: "block",
                borderRadius: "8px",
                background: "#ffffff",
              }}
            />
          ) : (
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "8px",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
              }}
            />
          )}

          <div
            style={{
              marginTop: "14px",
              fontSize: "23px",
              lineHeight: 1.2,
              fontWeight: 700,
              color: "#2563eb",
            }}
          >
            {company.company_name || "CatatKlien"}
          </div>

          <div
            style={{
              fontSize: "12px",
              lineHeight: 1.45,
              color: "#64748b",
              whiteSpace: "pre-line",
              marginTop: "6px",
            }}
          >
            {company.company_address || "-"}
          </div>

          <div
            style={{
              fontSize: "12px",
              lineHeight: 1.45,
              color: "#64748b",
            }}
          >
            Tel: {company.company_phone || "-"}
          </div>

          <div
            style={{
              fontSize: "12px",
              lineHeight: 1.45,
              color: "#64748b",
            }}
          >
            Email: {company.company_email || "-"}
          </div>
        </div>

        <div
          style={{
            width: "220px",
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              margin: 0,
              fontSize: "28px",
              lineHeight: 1.1,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            INVOICE DP
          </div>

          <div
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#94a3b8",
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
          margin: "18px 0",
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "28px",
          marginBottom: "18px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#475569",
              marginBottom: "10px",
            }}
          >
            Bill To:
          </div>

          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#1e293b",
              marginBottom: "6px",
            }}
          >
            {invoiceData.client_name || "-"}
          </div>

          <div
            style={{
              fontSize: "13px",
              lineHeight: 1.45,
              color: "#64748b",
            }}
          >
            {invoiceData.client_contact || "-"}
          </div>

          <div
            style={{
              fontSize: "13px",
              lineHeight: 1.45,
              color: "#64748b",
              whiteSpace: "pre-line",
            }}
          >
            {invoiceData.client_address || "-"}
          </div>
        </div>

        <div
          style={{
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: "10px",
              marginBottom: "2px",
            }}
          >
            <div style={{ color: "#64748b" }}>Tanggal Invoice</div>
            <div style={{ color: "#334155" }}>
              {formatDateIndonesia(invoiceDate)}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: "10px",
              marginBottom: "2px",
            }}
          >
            <div style={{ color: "#64748b" }}>Jatuh Tempo</div>
            <div style={{ color: "#334155" }}>{formatDateIndonesia(dueDate)}</div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: "10px",
              marginBottom: "2px",
            }}
          >
            <div style={{ color: "#64748b" }}>Tanggal Layanan</div>
            <div style={{ color: "#334155" }}>
              {formatBookingDateForInvoice(invoiceData)}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: "10px",
              marginBottom: "2px",
            }}
          >
            <div style={{ color: "#64748b" }}>Status</div>
            <div style={{ color: "#334155" }}>Belum Bayar</div>
          </div>
        </div>
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          fontSize: "12px",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: "32%",
                border: "1px solid #e2e8f0",
                padding: "10px 12px",
                verticalAlign: "top",
                background: "#f1f5f9",
                color: "#475569",
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              Deskripsi Layanan
            </th>
            <th
              style={{
                width: "8%",
                border: "1px solid #e2e8f0",
                padding: "10px 12px",
                verticalAlign: "top",
                background: "#f1f5f9",
                color: "#475569",
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              Qty
            </th>
            <th
              style={{
                width: "19%",
                border: "1px solid #e2e8f0",
                padding: "10px 12px",
                verticalAlign: "top",
                background: "#f1f5f9",
                color: "#475569",
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              Harga per Unit
            </th>
            <th
              style={{
                width: "25%",
                border: "1px solid #e2e8f0",
                padding: "10px 12px",
                verticalAlign: "top",
                background: "#f1f5f9",
                color: "#475569",
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              Tanggal & Waktu
            </th>
            <th
              style={{
                width: "16%",
                border: "1px solid #e2e8f0",
                padding: "10px 12px",
                verticalAlign: "top",
                background: "#f1f5f9",
                color: "#475569",
                fontWeight: 700,
                textAlign: "right",
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
                padding: "10px 12px",
                verticalAlign: "top",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#1e293b",
                  marginBottom: "6px",
                }}
              >
                {invoiceData.service_name || "-"}
              </div>

              <div
                style={{
                  fontSize: "12px",
                  lineHeight: 1.45,
                  color: "#64748b",
                  whiteSpace: "pre-line",
                }}
              >
                {invoiceData.service_description || "Tidak ada deskripsi layanan."}
              </div>
            </td>

            <td
              style={{
                border: "1px solid #e2e8f0",
                padding: "10px 12px",
                verticalAlign: "top",
              }}
            >
              {summary.qty || 1}
            </td>

            <td
              style={{
                border: "1px solid #e2e8f0",
                padding: "10px 12px",
                verticalAlign: "top",
              }}
            >
              {formatRupiah(summary.unitPrice)}
            </td>

            <td
              style={{
                border: "1px solid #e2e8f0",
                padding: "10px 12px",
                verticalAlign: "top",
              }}
            >
              {formatBookingDateTimeForTable(invoiceData)}
            </td>

            <td
              style={{
                border: "1px solid #e2e8f0",
                padding: "10px 12px",
                verticalAlign: "top",
                textAlign: "right",
              }}
            >
              {formatRupiah(summary.subtotal)}
            </td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          width: "355px",
          marginLeft: "auto",
          marginTop: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            padding: "5px 0",
            fontSize: "13px",
          }}
        >
          <div style={{ color: "#64748b" }}>Subtotal:</div>
          <div style={{ color: "#1e293b", fontWeight: 600 }}>
            {formatRupiah(summary.subtotal)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            padding: "5px 0",
            fontSize: "13px",
          }}
        >
          <div style={{ color: "#64748b" }}>DP 30%:</div>
          <div style={{ color: "#1d4ed8", fontWeight: 600 }}>
            {formatRupiah(summary.dpAmount)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            padding: "5px 0",
            fontSize: "13px",
          }}
        >
          <div style={{ color: "#64748b" }}>Sisa setelah DP:</div>
          <div style={{ color: "#c2410c", fontWeight: 600 }}>
            {formatRupiah(summary.remaining)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginTop: "8px",
            paddingTop: "10px",
            borderTop: "1px solid #cbd5e1",
            fontSize: "15px",
            fontWeight: 700,
            color: "#1e293b",
          }}
        >
          <div>Total invoice ini:</div>
          <div>{formatRupiah(summary.dpAmount)}</div>
        </div>
      </div>

      <div
        style={{
          marginTop: "18px",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          background: "#f8fafc",
          padding: "14px",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#334155",
          }}
        >
          Informasi Pembayaran
        </div>

        <div
          style={{
            marginTop: "14px",
            border: "2px solid #f59e0b",
            borderRadius: "12px",
            background: "#ffffff",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#b45309",
            }}
          >
            Jumlah DP yang harus ditransfer
          </div>

          <div
            style={{
              marginTop: "6px",
              fontSize: "24px",
              fontWeight: 700,
              color: "#b45309",
            }}
          >
            {formatRupiah(summary.dpAmount)}
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
                marginTop: "18px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#334155",
              }}
            >
              Transfer Bank:
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
                marginTop: "10px",
              }}
            >
              {(company.bank_name ||
                company.bank_account_number ||
                company.bank_account_holder) && (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    background: "#ffffff",
                    padding: "12px",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    color: "#475569",
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
                    borderRadius: "10px",
                    background: "#ffffff",
                    padding: "12px",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    color: "#475569",
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
          </>
        )}

        <div
          style={{
            marginTop: "14px",
            border: "2px solid #f59e0b",
            borderRadius: "10px",
            background: "#fffbeb",
            padding: "12px 14px",
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
            Instruksi Pembayaran:
          </div>

          <div
            style={{
              fontSize: "13px",
              lineHeight: 1.5,
              color: "#475569",
              whiteSpace: "pre-line",
            }}
          >
            {company.payment_instruction ||
              DEFAULT_COMPANY.payment_instruction}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "16px",
          textAlign: "center",
          fontSize: "11px",
          color: "#94a3b8",
        }}
      >
        Invoice ini dibuat secara otomatis oleh sistem{" "}
        {company.company_name || "CatatKlien"}
      </div>
    </div>
  );
}

export default function PublicBookingInvoiceModal({
  isOpen,
  onClose,
  ownerId,
  invoiceData,
}) {
  const [animate, setAnimate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [company, setCompany] = useState(DEFAULT_COMPANY);

  const printRef = useRef(null);
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
    if (!isOpen || !ownerId) return;

    async function loadCompany() {
      try {
        setLoading(true);

        const data = await fetchCompanySettingsByUserId(ownerId);
        setCompany(data || DEFAULT_COMPANY);
      } catch (error) {
        console.error("Gagal memuat company settings dari backend:", error);
        setCompany(DEFAULT_COMPANY);
      } finally {
        setLoading(false);
      }
    }

    loadCompany();
  }, [isOpen, ownerId]);

  const invoiceDate = useMemo(() => {
    return toInputDate(new Date());
  }, []);

  const dueDate = useMemo(() => {
    return toInputDate(addDays(new Date(), 7));
  }, []);

  const invoiceNumber = useMemo(() => {
    return generateInvoiceNumber(
      invoiceDate,
      invoiceData?.invoiceSeed || ownerId || "PUBLIC"
    );
  }, [invoiceDate, invoiceData, ownerId]);

  const summary = useMemo(() => {
    const qty = toNumber(invoiceData?.quantity || 1);
    const unitPrice = toNumber(
      invoiceData?.unit_price ??
        invoiceData?.unitPrice ??
        invoiceData?.price ??
        0
    );

    const subtotal = qty * unitPrice;
    const dpAmount = Math.floor(subtotal * 0.3);
    const remaining = Math.max(0, subtotal - dpAmount);

    return {
      qty,
      unitPrice,
      subtotal,
      dpAmount,
      remaining,
    };
  }, [invoiceData]);

  function buildInvoicePrintHtml({ autoPrint = false } = {}) {
    const logoHtml = company?.logo_url
      ? `<img src="${escapeHtml(company.logo_url)}" alt="Logo" class="invoice-logo" />`
      : `<div class="invoice-logo placeholder"></div>`;

    const bank1Exists =
      company.bank_name ||
      company.bank_account_number ||
      company.bank_account_holder;

    const bank2Exists =
      company.bank_name2 ||
      company.bank_account_number2 ||
      company.bank_account_holder2;

    const serviceDescription = invoiceData?.service_description?.trim()
      ? invoiceData.service_description
      : "Tidak ada deskripsi layanan.";

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(invoiceNumber)}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
              color: #334155;
            }

            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .page {
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              background: #ffffff;
              padding: 10mm;
              overflow: hidden;
            }

            .invoice-root {
              width: 100%;
            }

            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 20px;
            }

            .left {
              flex: 1;
              min-width: 0;
            }

            .right {
              width: 220px;
              text-align: right;
              flex-shrink: 0;
            }

            .invoice-logo {
              width: 68px;
              height: 68px;
              object-fit: contain;
              display: block;
              border-radius: 8px;
              background: #ffffff;
            }

            .invoice-logo.placeholder {
              background: #f1f5f9;
              border: 1px solid #e2e8f0;
            }

            .company-name {
              margin: 14px 0 6px;
              font-size: 23px;
              line-height: 1.2;
              font-weight: 700;
              color: #2563eb;
            }

            .company-text {
              font-size: 12px;
              line-height: 1.45;
              color: #64748b;
              white-space: pre-line;
            }

            .invoice-title {
              margin: 0;
              font-size: 28px;
              line-height: 1.1;
              font-weight: 700;
              color: #334155;
            }

            .invoice-number {
              margin-top: 8px;
              font-size: 12px;
              color: #94a3b8;
            }

            .divider {
              height: 1px;
              background: #e2e8f0;
              margin: 18px 0;
            }

            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 28px;
              margin-bottom: 18px;
            }

            .bill-title {
              font-size: 14px;
              font-weight: 700;
              color: #475569;
              margin-bottom: 10px;
            }

            .client-name {
              font-size: 16px;
              font-weight: 700;
              color: #1e293b;
              margin-bottom: 6px;
            }

            .client-text {
              font-size: 13px;
              line-height: 1.45;
              color: #64748b;
              white-space: pre-line;
            }

            .meta-right {
              font-size: 13px;
              line-height: 1.5;
            }

            .meta-row {
              display: grid;
              grid-template-columns: 120px 1fr;
              gap: 10px;
              margin-bottom: 2px;
            }

            .meta-label {
              color: #64748b;
            }

            .meta-value {
              color: #334155;
            }

            .invoice-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 12px;
            }

            .invoice-table th,
            .invoice-table td {
              border: 1px solid #e2e8f0;
              padding: 10px 12px;
              vertical-align: top;
            }

            .invoice-table th {
              background: #f1f5f9;
              color: #475569;
              font-weight: 700;
              text-align: left;
            }

            .invoice-table .text-right {
              text-align: right;
            }

            .service-title {
              font-size: 14px;
              font-weight: 700;
              color: #1e293b;
              margin-bottom: 6px;
            }

            .service-desc {
              font-size: 12px;
              line-height: 1.45;
              color: #64748b;
              white-space: pre-line;
            }

            .summary {
              width: 355px;
              margin-left: auto;
              margin-top: 16px;
            }

            .summary-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              padding: 5px 0;
              font-size: 13px;
            }

            .summary-label {
              color: #64748b;
            }

            .summary-value {
              color: #1e293b;
              font-weight: 600;
            }

            .summary-blue {
              color: #1d4ed8;
            }

            .summary-orange {
              color: #c2410c;
            }

            .summary-total {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              margin-top: 8px;
              padding-top: 10px;
              border-top: 1px solid #cbd5e1;
              font-size: 15px;
              font-weight: 700;
              color: #1e293b;
            }

            .payment-card {
              margin-top: 18px;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              background: #f8fafc;
              padding: 14px;
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .payment-title {
              font-size: 14px;
              font-weight: 700;
              color: #334155;
            }

            .highlight-box {
              margin-top: 14px;
              border: 2px solid #f59e0b;
              border-radius: 12px;
              background: #ffffff;
              padding: 16px;
              text-align: center;
            }

            .highlight-label {
              font-size: 12px;
              font-weight: 700;
              color: #b45309;
            }

            .highlight-amount {
              margin-top: 6px;
              font-size: 24px;
              font-weight: 700;
              color: #b45309;
            }

            .bank-title {
              margin-top: 18px;
              font-size: 14px;
              font-weight: 700;
              color: #334155;
            }

            .bank-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 14px;
              margin-top: 10px;
            }

            .bank-card {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              background: #ffffff;
              padding: 12px;
              font-size: 13px;
              line-height: 1.5;
              color: #475569;
            }

            .bank-card b {
              color: #334155;
            }

            .instruction-box {
              margin-top: 14px;
              border: 2px solid #f59e0b;
              border-radius: 10px;
              background: #fffbeb;
              padding: 12px 14px;
            }

            .instruction-title {
              font-size: 13px;
              font-weight: 700;
              color: #334155;
              margin-bottom: 6px;
            }

            .instruction-text {
              font-size: 13px;
              line-height: 1.5;
              color: #475569;
              white-space: pre-line;
            }

            .footer-note {
              margin-top: 16px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
            }

            @media print {
              html, body {
                width: 210mm;
                height: 297mm;
              }

              .page {
                margin: 0;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="invoice-root">
              <div class="header">
                <div class="left">
                  ${logoHtml}
                  <div class="company-name">${escapeHtml(
                    company.company_name || "CatatKlien"
                  )}</div>
                  <div class="company-text">${nl2br(company.company_address || "-")}</div>
                  <div class="company-text">Tel: ${escapeHtml(
                    company.company_phone || "-"
                  )}</div>
                  <div class="company-text">Email: ${escapeHtml(
                    company.company_email || "-"
                  )}</div>
                </div>

                <div class="right">
                  <h1 class="invoice-title">INVOICE DP</h1>
                  <div class="invoice-number">${escapeHtml(invoiceNumber)}</div>
                </div>
              </div>

              <div class="divider"></div>

              <div class="meta-grid">
                <div>
                  <div class="bill-title">Bill To:</div>
                  <div class="client-name">${escapeHtml(
                    invoiceData.client_name || "-"
                  )}</div>
                  <div class="client-text">${escapeHtml(
                    invoiceData.client_contact || "-"
                  )}</div>
                  <div class="client-text">${nl2br(
                    invoiceData.client_address || "-"
                  )}</div>
                </div>

                <div class="meta-right">
                  <div class="meta-row">
                    <div class="meta-label">Tanggal Invoice</div>
                    <div class="meta-value">${escapeHtml(
                      formatDateIndonesia(invoiceDate)
                    )}</div>
                  </div>
                  <div class="meta-row">
                    <div class="meta-label">Jatuh Tempo</div>
                    <div class="meta-value">${escapeHtml(
                      formatDateIndonesia(dueDate)
                    )}</div>
                  </div>
                  <div class="meta-row">
                    <div class="meta-label">Tanggal Layanan</div>
                    <div class="meta-value">${escapeHtml(
                      formatBookingDateForInvoice(invoiceData)
                    )}</div>
                  </div>
                  <div class="meta-row">
                    <div class="meta-label">Status</div>
                    <div class="meta-value">Belum Bayar</div>
                  </div>
                </div>
              </div>

              <table class="invoice-table">
                <thead>
                  <tr>
                    <th style="width:32%;">Deskripsi Layanan</th>
                    <th style="width:8%;">Qty</th>
                    <th style="width:19%;">Harga per Unit</th>
                    <th style="width:25%;">Tanggal &amp; Waktu</th>
                    <th style="width:16%;" class="text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div class="service-title">${escapeHtml(
                        invoiceData.service_name || "-"
                      )}</div>
                      <div class="service-desc">${nl2br(serviceDescription)}</div>
                    </td>
                    <td>${escapeHtml(summary.qty || 1)}</td>
                    <td>${escapeHtml(formatRupiah(summary.unitPrice))}</td>
                    <td>${escapeHtml(formatBookingDateTimeForTable(invoiceData))}</td>
                    <td class="text-right">${escapeHtml(
                      formatRupiah(summary.subtotal)
                    )}</td>
                  </tr>
                </tbody>
              </table>

              <div class="summary">
                <div class="summary-row">
                  <div class="summary-label">Subtotal:</div>
                  <div class="summary-value">${escapeHtml(
                    formatRupiah(summary.subtotal)
                  )}</div>
                </div>
                <div class="summary-row">
                  <div class="summary-label">DP 30%:</div>
                  <div class="summary-value summary-blue">${escapeHtml(
                    formatRupiah(summary.dpAmount)
                  )}</div>
                </div>
                <div class="summary-row">
                  <div class="summary-label">Sisa setelah DP:</div>
                  <div class="summary-value summary-orange">${escapeHtml(
                    formatRupiah(summary.remaining)
                  )}</div>
                </div>
                <div class="summary-total">
                  <div>Total invoice ini:</div>
                  <div>${escapeHtml(formatRupiah(summary.dpAmount))}</div>
                </div>
              </div>

              <div class="payment-card">
                <div class="payment-title">Informasi Pembayaran</div>

                <div class="highlight-box">
                  <div class="highlight-label">Jumlah DP yang harus ditransfer</div>
                  <div class="highlight-amount">${escapeHtml(
                    formatRupiah(summary.dpAmount)
                  )}</div>
                </div>

                ${
                  bank1Exists || bank2Exists
                    ? `
                    <div class="bank-title">Transfer Bank:</div>
                    <div class="bank-grid">
                      ${
                        bank1Exists
                          ? `
                          <div class="bank-card">
                            <div><b>Bank:</b> ${escapeHtml(company.bank_name || "-")}</div>
                            <div><b>No. Rekening:</b> ${escapeHtml(
                              company.bank_account_number || "-"
                            )}</div>
                            <div><b>A.n:</b> ${escapeHtml(
                              company.bank_account_holder || "-"
                            )}</div>
                          </div>
                        `
                          : ""
                      }

                      ${
                        bank2Exists
                          ? `
                          <div class="bank-card">
                            <div><b>Bank:</b> ${escapeHtml(company.bank_name2 || "-")}</div>
                            <div><b>No. Rekening:</b> ${escapeHtml(
                              company.bank_account_number2 || "-"
                            )}</div>
                            <div><b>A.n:</b> ${escapeHtml(
                              company.bank_account_holder2 || "-"
                            )}</div>
                          </div>
                        `
                          : ""
                      }
                    </div>
                  `
                    : ""
                }

                <div class="instruction-box">
                  <div class="instruction-title">Instruksi Pembayaran:</div>
                  <div class="instruction-text">${nl2br(
                    company.payment_instruction ||
                      DEFAULT_COMPANY.payment_instruction
                  )}</div>
                </div>
              </div>

              <div class="footer-note">
                Invoice ini dibuat secara otomatis oleh sistem ${escapeHtml(
                  company.company_name || "CatatKlien"
                )}
              </div>
            </div>
          </div>

          ${
            autoPrint
              ? `
              <script>
                window.onload = function () {
                  setTimeout(function () {
                    window.print();
                  }, 400);
                };
              </script>
            `
              : ""
          }
        </body>
      </html>
    `;
  }

  function openPrintWindow({ autoPrint = false }) {
    const printWindow = window.open("", "_blank", "width=1100,height=900");

    if (!printWindow) {
      alert(
        "Pop-up diblokir browser. Izinkan pop-up untuk mencetak atau menyimpan PDF."
      );
      return null;
    }

    const html = buildInvoicePrintHtml({ autoPrint });
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return printWindow;
  }

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
      console.error("Gagal membuat PDF invoice:", error);
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
    try {
      setPrinting(true);

      const printWindow = openPrintWindow({ autoPrint: true });
      if (!printWindow) return;

      printWindow.focus();
    } catch (error) {
      console.error("Gagal print invoice:", error);
      alert("Gagal mencetak invoice.");
    } finally {
      setPrinting(false);
    }
  }

  if (!isOpen || !invoiceData) return null;

  const logoUrl = company?.logo_url || "";

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
            Invoice DP Booking
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
              disabled={printing || loading}
              className="h-10 px-5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Printer size={16} />
              {printing ? "Membuka Print..." : "Print"}
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
              <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Setelah booking berhasil dikirim, customer wajib melakukan pembayaran
                minimal <b> DP 30% </b>dari total layanan yang dipilih.
              </div>

              <div className="mt-6">
                <div className="invoice-print-sheet bg-white w-full max-w-[794px] mx-auto">
                  <div
                    ref={printRef}
                    className="invoice-root bg-white w-full p-8 text-slate-700"
                  >
                    <div className="flex justify-between items-start gap-6">
                      <div className="flex-1">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo Perusahaan"
                            className="invoice-logo w-[72px] h-[72px] object-contain rounded-lg bg-white"
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div className="w-[72px] h-[72px] rounded-lg bg-slate-100 border border-slate-200" />
                        )}

                        <h1 className="text-[24px] font-bold text-blue-600 mt-4">
                          {company.company_name || "CatatKlien"}
                        </h1>

                        <div className="text-[12px] leading-5 whitespace-pre-line text-slate-600 mt-1">
                          {company.company_address || "-"}
                        </div>
                        <div className="text-[12px] text-slate-600">
                          Tel: {company.company_phone || "-"}
                        </div>
                        <div className="text-[12px] text-slate-600">
                          Email: {company.company_email || "-"}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <h2 className="text-[26px] font-bold text-slate-700">
                          INVOICE DP
                        </h2>
                        <p className="text-[12px] text-slate-500 mt-2">
                          {invoiceNumber}
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-slate-200 my-5" />

                    <div className="grid grid-cols-2 gap-8 mb-5">
                      <div>
                        <div className="text-sm font-semibold text-slate-700 mb-2">
                          Bill To:
                        </div>
                        <div className="text-[15px] font-semibold text-slate-800">
                          {invoiceData.client_name || "-"}
                        </div>
                        <div className="text-[13px] text-slate-600 mt-1">
                          {invoiceData.client_contact || "-"}
                        </div>
                        <div className="text-[13px] text-slate-600 whitespace-pre-line">
                          {invoiceData.client_address || "-"}
                        </div>
                      </div>

                      <div className="text-[13px]">
                        <div className="grid grid-cols-[130px_1fr] gap-y-1">
                          <span className="text-slate-500">Tanggal Invoice</span>
                          <span>{formatDateIndonesia(invoiceDate)}</span>

                          <span className="text-slate-500">Jatuh Tempo</span>
                          <span>{formatDateIndonesia(dueDate)}</span>

                          <span className="text-slate-500">Tanggal Layanan</span>
                          <span>{formatBookingDateForInvoice(invoiceData)}</span>

                          <span className="text-slate-500">Status</span>
                          <span>Belum Bayar</span>
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
                              {invoiceData.service_name || "-"}
                            </div>
                            <div className="text-slate-500 whitespace-pre-line mt-1">
                              {invoiceData.service_description ||
                                "Tidak ada deskripsi layanan."}
                            </div>
                          </td>

                          <td className="border border-slate-200 px-3 py-3 align-top">
                            {summary.qty || 1}
                          </td>

                          <td className="border border-slate-200 px-3 py-3 align-top">
                            {formatRupiah(summary.unitPrice)}
                          </td>

                          <td className="border border-slate-200 px-3 py-3 align-top">
                            {formatBookingDateTimeForTable(invoiceData)}
                          </td>

                          <td className="border border-slate-200 px-3 py-3 text-right align-top">
                            {formatRupiah(summary.subtotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="mt-5 ml-auto w-full max-w-[360px]">
                      <div className="flex items-center justify-between py-1.5 text-[13px]">
                        <span className="text-slate-600">Subtotal:</span>
                        <span className="font-medium text-slate-800">
                          {formatRupiah(summary.subtotal)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 text-[13px]">
                        <span className="text-slate-600">DP 30%:</span>
                        <span className="font-medium text-blue-700">
                          {formatRupiah(summary.dpAmount)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 text-[13px]">
                        <span className="text-slate-600">Sisa setelah DP:</span>
                        <span className="font-medium text-orange-600">
                          {formatRupiah(summary.remaining)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2 mt-2 border-t border-slate-300 text-[15px] font-bold">
                        <span>Total invoice ini:</span>
                        <span>{formatRupiah(summary.dpAmount)}</span>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-800">
                        Informasi Pembayaran
                      </div>

                      <div className="mt-4 border-2 border-amber-400 rounded-xl px-4 py-4 text-center bg-white">
                        <div className="text-[12px] font-semibold text-amber-700">
                          Jumlah DP yang harus ditransfer
                        </div>
                        <div className="text-[24px] font-bold text-amber-700 mt-1">
                          {formatRupiah(summary.dpAmount)}
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
                  <ExportPublicInvoiceSheet
                    company={company}
                    invoiceNumber={invoiceNumber}
                    invoiceDate={invoiceDate}
                    dueDate={dueDate}
                    invoiceData={invoiceData}
                    summary={summary}
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