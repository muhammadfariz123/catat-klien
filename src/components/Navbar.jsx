import { useState } from "react";
import {
  BarChart3,
  Download,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { exportBookingsToExcel } from "../utils/exportExcel";
import CompanySettingsModal from "./CompanySettingsModal";

/* =========================================
   EXPORT RESULT MODAL
========================================= */
function ExportResultModal({
  open,
  onClose,
  type = "success",
  title = "",
  message = "",
  subMessage = "",
}) {
  if (!open) return null;

  const isSuccess = type === "success";

  return (
    <div className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-[450px] rounded-[22px] bg-[#1f2d44] shadow-2xl overflow-hidden animate-[fadeIn_.18s_ease-out]">
        <div className="px-8 pt-7 pb-6 text-center text-white">
          <div className="flex justify-center mb-5">
            {isSuccess ? (
              <div className="w-16 h-16 rounded-full border border-green-400/20 bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 size={40} className="text-[#22c55e]" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full border border-red-400/20 bg-red-500/10 flex items-center justify-center">
                <AlertCircle size={40} className="text-[#ef4444]" />
              </div>
            )}
          </div>

          <h3 className="text-[17px] sm:text-[18px] font-semibold mb-4">
            {title}
          </h3>

          <p className="text-[15px] leading-7 text-white/85">{message}</p>

          {subMessage ? (
            <p className="text-[15px] leading-7 text-white/85">{subMessage}</p>
          ) : null}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-[#2f67e8] hover:bg-[#2457cf] text-white font-semibold transition cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Navbar({ userName, onLogout }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [exportModal, setExportModal] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
    subMessage: "",
  });

  const navigate = useNavigate();

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const closeExportModal = () => {
    setExportModal((prev) => ({
      ...prev,
      open: false,
    }));
  };

  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      const result = await exportBookingsToExcel();

      setExportModal({
        open: true,
        type: "success",
        title: "Berhasil",
        message: "Data berhasil diekspor ke file Excel.",
        subMessage: `${result.total} booking telah disimpan.`,
      });
    } catch (error) {
      console.error("Export booking error:", error);

      setExportModal({
        open: true,
        type: "error",
        title: "Export Gagal",
        message:
          error?.message || "Terjadi kesalahan saat mengekspor data booking.",
        subMessage: "",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <header className="bg-white shadow-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-3 sm:gap-6 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-blue-600 whitespace-nowrap">
                Rozi Photography
              </h1>

              <span className="hidden sm:block text-sm text-gray-700 truncate">
                Halo, <b>{userName}</b>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-5 lg:gap-6 text-gray-500">
              <div className="relative group">
                <button
                  onClick={() => navigate("/financial")}
                  className="cursor-pointer hover:text-blue-600 transition"
                >
                  <BarChart3 size={18} />
                </button>

                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[11px] px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-20">
                  Laporan Keuangan
                </span>
              </div>

              <div className="relative group">
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className={`cursor-pointer transition ${
                    isExporting
                      ? "text-gray-300 cursor-not-allowed"
                      : "hover:text-blue-600"
                  }`}
                >
                  <Download size={18} />
                </button>

                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[11px] px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-20">
                  {isExporting ? "Mengekspor..." : "Unduh Excel"}
                </span>
              </div>

              

              <div className="relative group">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="cursor-pointer hover:text-blue-600 transition"
                >
                  <Settings size={18} />
                </button>

                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[11px] px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-20">
                  Pengaturan Perusahaan
                </span>
              </div>

              <div className="relative group">
                <button
                  onClick={onLogout}
                  className="cursor-pointer hover:text-red-500 transition"
                >
                  <LogOut size={18} />
                </button>

                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[11px] px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-20">
                  Logout
                </span>
              </div>
            </div>

            <div className="flex md:hidden items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          <div className="sm:hidden mt-3">
            <span className="text-sm text-gray-700 block truncate">
              Halo, <b>{userName}</b>
            </span>
          </div>

          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 border-t border-gray-100 pt-4">
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => {
                    navigate("/financial");
                    closeMobileMenu();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition"
                >
                  <BarChart3 size={18} />
                  <span>Laporan Keuangan</span>
                </button>

                <button
                  onClick={async () => {
                    await handleExport();
                    closeMobileMenu();
                  }}
                  disabled={isExporting}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition ${
                    isExporting
                      ? "text-gray-400 bg-gray-50 cursor-not-allowed"
                      : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  <Download size={18} />
                  <span>{isExporting ? "Mengekspor..." : "Unduh Excel"}</span>
                </button>

               

                <button
                  onClick={() => {
                    setIsSettingsOpen(true);
                    closeMobileMenu();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition"
                >
                  <Settings size={18} />
                  <span>Pengaturan Perusahaan</span>
                </button>

                <button
                  onClick={() => {
                    closeMobileMenu();
                    onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-red-500 hover:bg-red-50 transition"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <CompanySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ExportResultModal
        open={exportModal.open}
        onClose={closeExportModal}
        type={exportModal.type}
        title={exportModal.title}
        message={exportModal.message}
        subMessage={exportModal.subMessage}   
      />
    </>
  );
}