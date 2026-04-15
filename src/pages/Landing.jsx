import React from "react";
import FeatureCard from "../components/FeatureCard";
import { loginWithGoogle } from "../auth/auth";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">

      {/* HERO */}
      <div className="text-center pt-24 px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-blue-600">
          CatatKlien
        </h1>
        <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
          Sistem pencatatan klien dan appointment yang sederhana dan efisien.
          Kelola jadwal, lacak status, dan tingkatkan produktivitas tim Anda.
        </p>

        <button
          onClick={loginWithGoogle}
          className="mt-8 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition"
        >
          Masuk dengan Google
        </button>
      </div>

      {/* FEATURES */}
      <div className="max-w-6xl mx-auto mt-20 px-4 grid grid-cols-1 md:grid-cols-4 gap-6">
        <FeatureCard title="Tampilan Kalender" desc="Visualisasi booking dalam format kalender yang mudah dipahami" icon="📅" />
        <FeatureCard title="Manajemen Klien" desc="Input dan kelola data klien dengan informasi kontak lengkap" icon="👥" />
        <FeatureCard title="Status Tracking" desc="Lacak status booking: Dijadwalkan, Selesai, atau Dibatalkan" icon="⏱️" />
        <FeatureCard title="Data Aman" desc="Semua data booking tersimpan aman dan bisa diekspor kapan saja" icon="🛡️" />
      </div>

      {/* CTA */}
      <div className="max-w-6xl mx-auto mt-24 px-4">
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold">
            Siap untuk mengelola catatan klien dengan lebih efisien?
          </h2>
          <p className="text-gray-500 mt-2">
            Mulai sekarang dan rasakan kemudahan sistem pencatatan klien yang profesional.
          </p>
          <button
            onClick={loginWithGoogle}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
          >
            Mulai Sekarang
          </button>
        </div>
      </div>

    </div>
  );
}
