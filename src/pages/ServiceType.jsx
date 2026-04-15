import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  fetchServicesByUser,
  createServiceToSupabase,
  updateServiceToSupabase,
  deleteServiceFromSupabase,
} from "../lib/bookingService";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";
import Navbar from "../components/Navbar";

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

function toDigitsNoLeadingZero(raw) {
  let digits = (raw || "").replace(/\D/g, "");
  digits = digits.replace(/^0+(?=\d)/, "");
  return digits;
}

export default function ServiceTypes() {
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [editServiceId, setEditServiceId] = useState(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceDesc, setServiceDesc] = useState("");
  const [servicePriceDigits, setServicePriceDigits] = useState("");

  useEffect(() => {
    getUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadServices();
  }, [userId]);

  async function getUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/admin";
      return;
    }

    setUserId(user.id);
    setUserName(
      user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email
    );
  }

  async function loadServices() {
    try {
      setLoading(true);
      const rows = await fetchServicesByUser(userId);
      setServices(rows || []);
    } catch (error) {
      console.error("Gagal load layanan:", error.message);
      alert(error.message || "Gagal memuat layanan.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/admin";
  }

  function resetForm() {
    setEditServiceId(null);
    setServiceName("");
    setServiceDesc("");
    setServicePriceDigits("");
    setFormError("");
  }

  function openAddModal() {
    resetForm();
    setShowModal(true);
  }

  function openEditModal(service) {
    setEditServiceId(service.id);
    setServiceName(service.name || "");
    setServiceDesc(service.description || "");
    setServicePriceDigits(String(service.price || ""));
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    resetForm();
  }

  async function handleSaveService() {
    try {
      setSaving(true);
      setFormError("");

      if (!serviceName.trim()) {
        throw new Error("Nama layanan wajib diisi.");
      }

      if (!userId) {
        throw new Error("User login tidak ditemukan. Silakan login ulang.");
      }

      if (editServiceId) {
        await updateServiceToSupabase({
          serviceId: editServiceId,
          userId,
          name: serviceName.trim(),
          price: Number(servicePriceDigits || 0),
          description: serviceDesc.trim(),
        });
      } else {
        await createServiceToSupabase({
          userId,
          name: serviceName.trim(),
          price: Number(servicePriceDigits || 0),
          description: serviceDesc.trim(),
        });
      }

      await loadServices();
      closeModal();
    } catch (error) {
      setFormError(error.message || "Gagal menyimpan layanan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteService(serviceId) {
    const confirmDelete = window.confirm(
      "Yakin ingin menghapus layanan ini?"
    );
    if (!confirmDelete) return;

    try {
      await deleteServiceFromSupabase(serviceId, userId);
      await loadServices();
    } catch (error) {
      alert(error.message || "Gagal menghapus layanan.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={userName} onLogout={logout} />

      <main className="max-w-360 mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-6 sm:p-8">
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm mb-6 cursor-pointer"
          >
            <ArrowLeft size={18} />
            Kembali ke Dashboard
          </button>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Kelola Jenis Layanan
              </h1>
              <p className="text-gray-600 mt-2">
                Tambahkan dan kelola jenis layanan yang Anda tawarkan
              </p>
            </div>

            <button
              onClick={openAddModal}
              className="h-12 px-6 inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition whitespace-nowrap"
            >
              <Plus size={18} />
              Tambah Layanan
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Nama Layanan
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Deskripsi
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Harga Default
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-sm text-gray-500 text-center"
                    >
                      Memuat layanan...
                    </td>
                  </tr>
                ) : services.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-sm text-gray-500 text-center"
                    >
                      Belum ada layanan. Klik "Tambah Layanan" untuk membuat
                      layanan baru.
                    </td>
                  </tr>
                ) : (
                  services.map((service) => (
                    <tr
                      key={service.id}
                      className="border-t border-gray-100 hover:bg-gray-50/60"
                    >
                      <td className="px-6 py-5 text-sm font-semibold text-slate-900">
                        {service.name}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-500">
                        {service.description?.trim()
                          ? service.description
                          : "-"}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-900">
                        {formatRupiah(service.price)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-4">
                          <button
                            onClick={() => openEditModal(service)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit layanan"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteService(service.id)}
                            className="text-red-500 hover:text-red-600"
                            title="Hapus layanan"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />

          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-slate-900">
                {editServiceId ? "Edit Layanan" : "Tambah Layanan Baru"}
              </h2>

              <button
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
              >
                <X size={22} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nama Layanan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Cuci Mobil, Poles, Coating"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Deskripsi (Opsional)
                </label>
                <textarea
                  rows={4}
                  placeholder="Deskripsi layanan..."
                  value={serviceDesc}
                  onChange={(e) => setServiceDesc(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Harga Default (Opsional)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Rp 0"
                  value={formatRupiahInput(servicePriceDigits)}
                  onChange={(e) =>
                    setServicePriceDigits(toDigitsNoLeadingZero(e.target.value))
                  }
                  className="w-full h-12 px-4 rounded-2xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Harga ini akan diisi otomatis saat membuat booking (bisa
                  diubah nanti)
                </p>
              </div>

              {formError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="h-12 px-6 rounded-2xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>

              <button
                onClick={handleSaveService}
                disabled={saving}
                className={`h-12 min-w-[180px] px-6 rounded-2xl inline-flex items-center justify-center gap-2 text-white ${
                  saving
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                <Save size={18} />
                {saving
                  ? "Menyimpan..."
                  : editServiceId
                  ? "Simpan Perubahan"
                  : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}