import React from 'react';
import { Check, X } from 'lucide-react';
import { PANDUAN_PEMILAHAN } from '../constants';

export const SortingGuide: React.FC = () => {
  return (
    <section className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111814] text-balance">
          Panduan Pemilahan Sampah Adiwiyata
        </h1>
        <p className="text-sm sm:text-base text-[#4B554E] leading-relaxed">
          Acuan resmi pemilahan sampah kelas di SMAN 1 Karang Bahagia bagi siswa, wali kelas, dan tim pokja kebersihan sebelum penimbangan harian.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organik */}
        <article className="bg-white border border-[#E4E7E2] rounded-xl p-6 space-y-5">
          <div className="space-y-1.5 pb-4 border-b border-[#E4E7E2]">
            <p className="text-xs font-mono font-medium text-[#15803D]">
              KODE QR: ORGANIK
            </p>
            <h2 className="text-lg font-bold text-[#111814]">
              {PANDUAN_PEMILAHAN.organik.judul}
            </h2>
            <p className="text-sm text-[#4B554E] leading-relaxed">
              {PANDUAN_PEMILAHAN.organik.ringkasan}
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-[#111814]">
              Boleh Dimasukkan ke Tong Organik
            </h3>
            <ul className="space-y-2">
              {PANDUAN_PEMILAHAN.organik.contoh.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#111814]">
                  <Check className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-[#E4E7E2]">
            <h3 className="text-xs font-semibold text-[#B91C1C]">
              Dilarang Masuk ke Tong Organik
            </h3>
            <ul className="space-y-2">
              {PANDUAN_PEMILAHAN.organik.larangan.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#4B554E]">
                  <X className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        {/* Non-Organik */}
        <article className="bg-white border border-[#E4E7E2] rounded-xl p-6 space-y-5">
          <div className="space-y-1.5 pb-4 border-b border-[#E4E7E2]">
            <p className="text-xs font-mono font-medium text-[#B45309]">
              KODE QR: NON-ORGANIK
            </p>
            <h2 className="text-lg font-bold text-[#111814]">
              {PANDUAN_PEMILAHAN.nonOrganik.judul}
            </h2>
            <p className="text-sm text-[#4B554E] leading-relaxed">
              {PANDUAN_PEMILAHAN.nonOrganik.ringkasan}
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-[#111814]">
              Boleh Dimasukkan ke Tong Non-Organik
            </h3>
            <ul className="space-y-2">
              {PANDUAN_PEMILAHAN.nonOrganik.contoh.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#111814]">
                  <Check className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-[#E4E7E2]">
            <h3 className="text-xs font-semibold text-[#B91C1C]">
              Dilarang Masuk ke Tong Non-Organik
            </h3>
            <ul className="space-y-2">
              {PANDUAN_PEMILAHAN.nonOrganik.larangan.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#4B554E]">
                  <X className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      {/* Rubric Table */}
      <div className="bg-white border border-[#E4E7E2] rounded-xl p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[#111814]">
            Rubrik Penetapan Status Pemilahan
          </h2>
          <p className="text-sm text-[#6E7871]">
            Standar penilaian bersama antara petugas pokja dan verifikasi visual asisten digital.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="space-y-1.5 pt-3 border-t border-[#E4E7E2]">
            <p className="text-sm font-semibold text-[#15803D]">Terpilah Sempurna</p>
            <p className="text-sm text-[#4B554E] leading-relaxed">
              Seluruh isi tong sesuai dengan kategori QR tanpa kontaminasi benda dari kategori lain.
            </p>
          </div>
          <div className="space-y-1.5 pt-3 border-t border-[#E4E7E2]">
            <p className="text-sm font-semibold text-[#B45309]">Tercampur Ringan</p>
            <p className="text-sm text-[#4B554E] leading-relaxed">
              Mayoritas isi tong sudah sesuai kategori, namun masih ditemukan 1–3 benda salah tempat yang mudah dipisahkan.
            </p>
          </div>
          <div className="space-y-1.5 pt-3 border-t border-[#E4E7E2]">
            <p className="text-sm font-semibold text-[#B91C1C]">Tidak Dipilah</p>
            <p className="text-sm text-[#4B554E] leading-relaxed">
              Sampah basah organik dan plastik/kertas non-organik bercampur merata sehingga perlu pemilahan ulang oleh piket kelas.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
