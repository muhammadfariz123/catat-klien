import { useEffect, useRef, useState } from "react";
import {
  X,
  Building2,
  Upload,
  Landmark,
  Download,
  UploadCloud,
  Info,
  Save,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getCurrentUserOrThrow,
  fetchCompanySettings,
  upsertCompanySettings,
  uploadCompanyLogo,
} from "../lib/companySettingsService";
import { importBookingsFromExcelFile } from "../lib/bookingImportService";

const DEFAULT_FORM = {
  companyName: "CatatKlien",
  companyAddress: "Jl. Contoh No. 123\nJakarta, Indonesia",
  companyPhone: "+62 21 1234 5678",
  companyEmail: "info@catatklien.com",
  logoPreview: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  paymentInstruction:
    "Silakan transfer ke rekening di atas dan kirimkan bukti transfer untuk konfirmasi pembayaran.",
  bankName2: "",
  bankAccountNumber2: "",
  bankAccountHolder2: "",
};

export default function CompanySettingsModal({ isOpen, onClose }) {
  const [animate, setAnimate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [companyName, setCompanyName] = useState(DEFAULT_FORM.companyName);
  const [companyAddress, setCompanyAddress] = useState(
    DEFAULT_FORM.companyAddress
  );
  const [companyPhone, setCompanyPhone] = useState(DEFAULT_FORM.companyPhone);
  const [companyEmail, setCompanyEmail] = useState(DEFAULT_FORM.companyEmail);

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(DEFAULT_FORM.logoPreview);

  const [bankName, setBankName] = useState(DEFAULT_FORM.bankName);
  const [bankAccountNumber, setBankAccountNumber] = useState(
    DEFAULT_FORM.bankAccountNumber
  );
  const [bankAccountHolder, setBankAccountHolder] = useState(
    DEFAULT_FORM.bankAccountHolder
  );
  const [paymentInstruction, setPaymentInstruction] = useState(
    DEFAULT_FORM.paymentInstruction
  );

  const [bankName2, setBankName2] = useState(DEFAULT_FORM.bankName2);
  const [bankAccountNumber2, setBankAccountNumber2] = useState(
    DEFAULT_FORM.bankAccountNumber2
  );
  const [bankAccountHolder2, setBankAccountHolder2] = useState(
    DEFAULT_FORM.bankAccountHolder2
  );

  const [importFileName, setImportFileName] = useState("");
  const [importResult, setImportResult] = useState(null);

  const importRef = useRef(null);
  const logoInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setAnimate(true), 10);
      document.body.style.overflow = "hidden";
    } else {
      setAnimate(false);
      document.body.style.overflow = "";
      setImportResult(null);
      setImportFileName("");
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e) => {
      if (e.key === "Escape" && !saving && !importing) onClose();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, saving, importing]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadSettings() {
      try {
        setLoading(true);

        const user = await getCurrentUserOrThrow();
        const data = await fetchCompanySettings(user.id);

        if (!data) {
          setCompanyName(DEFAULT_FORM.companyName);
          setCompanyAddress(DEFAULT_FORM.companyAddress);
          setCompanyPhone(DEFAULT_FORM.companyPhone);
          setCompanyEmail(DEFAULT_FORM.companyEmail);
          setLogoPreview(DEFAULT_FORM.logoPreview);
          setBankName(DEFAULT_FORM.bankName);
          setBankAccountNumber(DEFAULT_FORM.bankAccountNumber);
          setBankAccountHolder(DEFAULT_FORM.bankAccountHolder);
          setPaymentInstruction(DEFAULT_FORM.paymentInstruction);
          setBankName2(DEFAULT_FORM.bankName2);
          setBankAccountNumber2(DEFAULT_FORM.bankAccountNumber2);
          setBankAccountHolder2(DEFAULT_FORM.bankAccountHolder2);
          return;
        }

        setCompanyName(data.company_name || DEFAULT_FORM.companyName);
        setCompanyAddress(data.company_address || DEFAULT_FORM.companyAddress);
        setCompanyPhone(data.company_phone || DEFAULT_FORM.companyPhone);
        setCompanyEmail(data.company_email || DEFAULT_FORM.companyEmail);
        setLogoPreview(data.logo_url || "");
        setBankName(data.bank_name || "");
        setBankAccountNumber(data.bank_account_number || "");
        setBankAccountHolder(data.bank_account_holder || "");
        setPaymentInstruction(
          data.payment_instruction || DEFAULT_FORM.paymentInstruction
        );
        setBankName2(data.bank_name2 || "");
        setBankAccountNumber2(data.bank_account_number2 || "");
        setBankAccountHolder2(data.bank_account_holder2 || "");
      } catch (error) {
        console.error("Gagal mengambil company settings:", error);
        alert(error.message || "Gagal memuat pengaturan perusahaan.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const openLogoPicker = () => {
    if (saving || loading || importing) return;
    logoInputRef.current?.click();
  };

  const handleFile = async (file) => {
    if (!file) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Format logo harus JPG, PNG, GIF, atau WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran logo maksimal 5MB.");
      return;
    }

    try {
      setSaving(true);
      const user = await getCurrentUserOrThrow();
      const publicUrl = await uploadCompanyLogo(file, user.id);

      setLogoFile(file);
      setLogoPreview(publicUrl);
      alert("Logo berhasil diupload.");
    } catch (error) {
      console.error("Gagal upload logo:", error);
      alert(error.message || "Gagal upload logo.");
    } finally {
      setSaving(false);
    }
  };

  const handlePickImport = () => {
    if (saving || loading || importing) return;
    importRef.current?.click();
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Nama Klien",
      "Kontak Klien",
      "Alamat Klien",
      "Layanan",
      "Quantity",
      "Harga",
      "Tanggal Booking (YYYY-MM-DD)",
      "Waktu Booking (HH:mm)",
      "Status",
      "Status Pembayaran",
      "Sudah Dibayar",
      "Catatan",
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);

    worksheet["!cols"] = headers.map((header) => ({
      wch: Math.max(header.length + 4, 18),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Booking");

    XLSX.writeFile(workbook, "template-import-booking.xlsx");
  };

  const handleImportFile = async (file) => {
    if (!file) return;

    try {
      setImporting(true);
      setImportFileName(file.name);
      setImportResult(null);

      const result = await importBookingsFromExcelFile(file);

      setImportResult({
        type: "success",
        message: `${result.imported} data booking berhasil diimport.`,
        detail:
          result.failed > 0
            ? `${result.failed} baris dilewati karena formatnya tidak valid.`
            : "Semua baris berhasil diproses.",
        failedRows: result.failedRows || [],
      });

      alert(
        result.failed > 0
          ? `Import selesai. ${result.imported} booking berhasil masuk, ${result.failed} baris dilewati.`
          : `Import berhasil. ${result.imported} booking masuk ke sistem.`
      );

      if (importRef.current) {
        importRef.current.value = "";
      }
    } catch (error) {
      console.error("Gagal import file:", error);

      setImportResult({
        type: "error",
        message: error.message || "Gagal import data booking.",
        detail: "",
        failedRows: [],
      });

      alert(error.message || "Gagal import data booking.");
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const user = await getCurrentUserOrThrow();

      const payload = {
        user_id: user.id,
        company_name: companyName.trim(),
        company_address: companyAddress.trim(),
        company_phone: companyPhone.trim(),
        company_email: companyEmail.trim(),
        logo_url: logoPreview || null,
        bank_name: bankName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        bank_account_holder: bankAccountHolder.trim(),
        payment_instruction: paymentInstruction.trim(),
        bank_name2: bankName2.trim(),
        bank_account_number2: bankAccountNumber2.trim(),
        bank_account_holder2: bankAccountHolder2.trim(),
      };

      await upsertCompanySettings(payload);

      alert("Pengaturan perusahaan berhasil disimpan.");
      onClose();
    } catch (error) {
      console.error("Gagal menyimpan pengaturan:", error);
      alert(error.message || "Gagal menyimpan pengaturan perusahaan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div
        onClick={() => !saving && !importing && onClose()}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div
        className={`relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 ${
          animate
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-4"
        }`}
      >
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Building2 size={18} />
            </div>
            <h2 className="font-semibold text-gray-900">
              Pengaturan Perusahaan
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
            disabled={saving || importing}
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-8">
            {loading && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Memuat pengaturan perusahaan...
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-900">
                <Building2 size={18} className="text-gray-700" />
                <h3 className="font-semibold">Informasi Perusahaan</h3>
              </div>

              <div>
                <label className="text-sm font-medium">Nama Perusahaan *</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Alamat Perusahaan *
                </label>
                <textarea
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nomor Telepon *</label>
                  <input
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Email Perusahaan *
                  </label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Logo Perusahaan</label>

                <div className="mt-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={openLogoPicker}
                    onKeyDown={(e) => {
                      if (
                        (e.key === "Enter" || e.key === " ") &&
                        !saving &&
                        !importing
                      ) {
                        openLogoPicker();
                      }
                    }}
                    className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100/60 transition px-6 py-6 flex items-center justify-center cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 text-gray-700">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="preview"
                          className="w-11 h-11 object-cover rounded-lg border bg-white"
                        />
                      ) : (
                        <Upload size={20} className="text-gray-500" />
                      )}

                      <span className="text-[15px] font-medium">
                        {saving ? "Memproses logo..." : "Klik untuk upload logo"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-[12px] text-gray-500">
                    Format: JPG, PNG, GIF, WebP. Maksimal 5MB. Disarankan
                    200x80px
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-200" />

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-900">
                <Landmark size={18} className="text-gray-700" />
                <h3 className="font-semibold">Informasi Rekening Bank</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nama Bank</label>
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Bank BCA, Bank Mandiri, dll"
                    className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Nomor Rekening</label>
                  <input
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="1234567890"
                    className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Nama Pemegang Rekening
                </label>
                <input
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  placeholder="Nama sesuai rekening bank"
                  className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Instruksi Pembayaran
                </label>
                <textarea
                  value={paymentInstruction}
                  onChange={(e) => setPaymentInstruction(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="h-px bg-gray-200" />

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-900">
                <Landmark size={18} className="text-gray-700" />
                <h3 className="font-semibold">
                  Rekening Bank Alternatif (Opsional)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nama Bank Kedua</label>
                  <input
                    value={bankName2}
                    onChange={(e) => setBankName2(e.target.value)}
                    placeholder="Bank Mandiri, BNI, dll"
                    className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Nomor Rekening Kedua
                  </label>
                  <input
                    value={bankAccountNumber2}
                    onChange={(e) => setBankAccountNumber2(e.target.value)}
                    placeholder="0987654321"
                    className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Nama Pemegang Rekening Kedua
                </label>
                <input
                  value={bankAccountHolder2}
                  onChange={(e) => setBankAccountHolder2(e.target.value)}
                  placeholder="Nama sesuai rekening bank kedua"
                  className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm hover:bg-gray-50"
                  disabled={saving || importing}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-full px-4 py-3 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-70"
                  disabled={saving || loading || importing}
                >
                  <Save size={16} />
                  {saving ? "Menyimpan..." : "Simpan Pengaturan"}
                </button>
              </div>
            </div>

            <div className="h-px bg-gray-200" />

            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-[18px] font-semibold text-gray-900">
                  Import Data Booking
                </h3>
                <p className="text-[15px] text-gray-600">
                  Upload file Excel untuk menambahkan banyak booking sekaligus
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-[#f4f3ff] p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                    <UploadCloud size={22} />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-[24px] font-semibold text-gray-900 leading-tight">
                      Import Data Booking dari Excel / CSV
                    </h4>
                    <p className="mt-1 text-[15px] text-gray-600">
                      Upload file backup hasil export untuk menambah booking ke sistem
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-[15px] text-gray-700">
                    <span className="font-semibold">Langkah 1:</span> Download
                    template / gunakan file hasil export booking
                  </p>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="mt-3 w-full rounded-xl border-2 border-indigo-500 bg-transparent px-4 py-3.5 text-[15px] font-semibold text-indigo-600 transition hover:bg-indigo-50 flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    Download Template Import
                  </button>
                </div>

                <div className="mt-5">
                  <p className="text-[15px] text-gray-700">
                    <span className="font-semibold">Langkah 2:</span> Upload file
                    Excel / CSV untuk langsung menambahkan data booking
                  </p>

                  <input
                    ref={importRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleImportFile(e.target.files?.[0])}
                  />

                  <button
                    type="button"
                    onClick={handlePickImport}
                    disabled={importing || saving || loading}
                    className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
                  >
                    <UploadCloud size={16} />
                    {importing ? "Mengimport Data..." : "Upload File Excel"}
                  </button>
                </div>

                <div className="mt-5 rounded-xl border border-indigo-200 bg-white/60 p-4">
                  <div className="text-[14px] font-semibold text-indigo-700 mb-2">
                    Petunjuk:
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-[14px] text-gray-700">
                    <li>Bisa upload file hasil export booking sebelumnya</li>
                    <li>Format yang didukung: .xlsx, .xls, .csv</li>
                    <li>Data yang berhasil dibaca akan langsung ditambahkan ke tabel booking</li>
                    <li>Baris yang formatnya rusak akan dilewati</li>
                    <li>Layanan akan dicocokkan otomatis ke tabel services berdasarkan nama layanan</li>
                  </ul>
                </div>

                {importFileName && (
                  <div className="mt-3 text-sm text-gray-600">
                    File dipilih:{" "}
                    <span className="font-semibold text-gray-800">
                      {importFileName}
                    </span>
                  </div>
                )}

                {importResult && (
                  <div
                    className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                      importResult.type === "success"
                        ? "border border-green-200 bg-green-50 text-green-700"
                        : "border border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    <div className="font-semibold">{importResult.message}</div>
                    {importResult.detail ? (
                      <div className="mt-1">{importResult.detail}</div>
                    ) : null}

                    {Array.isArray(importResult.failedRows) &&
                    importResult.failedRows.length > 0 ? (
                      <div className="mt-3">
                        <div className="font-semibold mb-1">
                          Baris yang dilewati:
                        </div>
                        <ul className="list-disc pl-5 space-y-1">
                          {importResult.failedRows.slice(0, 10).map((item) => (
                            <li key={`${item.rowNumber}-${item.reason}`}>
                              Baris {item.rowNumber}: {item.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-center gap-2 text-blue-900 font-semibold">
                  <Info size={16} />
                  Tips Pengaturan
                </div>

                <ul className="mt-3 text-sm text-blue-900/90 space-y-1 list-disc pl-5">
                  <li>
                    Pastikan informasi perusahaan akurat untuk tampil profesional
                    di invoice
                  </li>
                  <li>
                    Logo perusahaan akan ditampilkan di bagian atas invoice jika
                    diisi
                  </li>
                  <li>
                    Informasi rekening bank opsional, akan muncul di invoice jika
                    diisi
                  </li>
                  <li>
                    Pengaturan ini akan tersimpan dan digunakan untuk semua
                    invoice yang dibuat
                  </li>
                </ul>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}