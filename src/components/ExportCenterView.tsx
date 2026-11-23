import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer, Search } from 'lucide-react';
import type { EvaluasiRecord, KategoriTong } from '../types';
import {
  formatTanggalJamSingkat,
  getTodayDateInputValue,
  toDateInputValue,
  toDateTimeLocalInputValue,
} from '../lib/dateUtils';
import { StatusLabel } from './StatusLabel';
import { SesiBadge } from './SesiBadge';

interface ExportCenterViewProps {
  evaluations: EvaluasiRecord[];
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const ExportCenterView: React.FC<ExportCenterViewProps> = ({
  evaluations,
}) => {
  const [filterKelas, setFilterKelas] = useState('');
  const [filterKategori, setFilterKategori] = useState<'SEMUA' | KategoriTong>('SEMUA');

  const filtered = useMemo(() => {
    const q = filterKelas.trim().toLowerCase();
    return evaluations.filter((ev) => {
      if (filterKategori !== 'SEMUA' && ev.kategoriTong !== filterKategori) return false;
      if (q && !ev.kelas.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [evaluations, filterKelas, filterKategori]);

  const totals = useMemo(() => {
    const orgKg = filtered
      .filter((e) => e.kategoriTong === 'ORGANIK')
      .reduce((s, e) => s + (Number(e.beratKg) || 0), 0);
    const nonKg = filtered
      .filter((e) => e.kategoriTong === 'NON-ORGANIK')
      .reduce((s, e) => s + (Number(e.beratKg) || 0), 0);
    return { orgKg, nonKg, totalKg: orgKg + nonKg };
  }, [filtered]);

  const handleDownloadCsv = () => {
    const headers = [
      'ID',
      'Tanggal',
      'Jam',
      'Waktu Catat',
      'Sesi Penimbangan',
      'Keterangan Insidental',
      'Kelas',
      'Kategori Tong',
      'QR Code',
      'Berat (kg)',
      'Status Petugas',
      'Rekomendasi AI',
      'Kesesuaian Visual',
      'Benda Salah Tempat',
      'Catatan Evaluasi Kelas',
      'Petugas',
    ];

    const rows = filtered.map((ev) => [
      ev.id,
      toDateInputValue(ev.waktuCatat),
      toDateTimeLocalInputValue(ev.waktuCatat).slice(11, 16),
      ev.waktuCatat,
      ev.sesiPenimbangan,
      ev.keteranganInsidental || '',
      ev.kelas,
      ev.kategoriTong,
      ev.qrCodeId,
      Number(ev.beratKg).toFixed(1),
      ev.statusPetugas,
      ev.hasil.saran_status_pilah,
      ev.hasil.kesesuaian_visual ? 'Sesuai' : 'Tercampur',
      ev.hasil.benda_salah_tempat.join('; '),
      ev.hasil.catatan_evaluasi_kelas,
      ev.petugasNama,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) => row.map(escapeCsvCell).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rekap-kaizen-o-sman1-karang-bahagia-${getTodayDateInputValue()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      {/* Export Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              placeholder="Filter kelas sebelum ekspor..."
              className="w-full pl-9 pr-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
            />
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg">
            {(['SEMUA', 'ORGANIK', 'NON-ORGANIK'] as const).map((kat) => (
              <button
                key={kat}
                type="button"
                onClick={() => setFilterKategori(kat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filterKategori === kat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {kat === 'SEMUA' ? 'Semua Kategori' : kat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold bg-[#059669] hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>Unduh Excel / CSV</span>
          </button>

          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Cetak Berita Acara PDF</span>
          </button>
        </div>
      </div>

      {/* Formal Printable Sheet */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#059669]">
              BERITA ACARA PENIMBANGAN & EVALUASI SAMPAH
            </p>
            <h3 className="text-lg font-bold text-slate-900">
              SMAN 1 Karang Bahagia · Program KAIZEN-O Adiwiyata
            </h3>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600">
            {filtered.length} entri · Total {totals.totalKg.toFixed(1)} kg (Org {totals.orgKg.toFixed(1)} kg / Non-Org {totals.nonKg.toFixed(1)} kg)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-3">Kelas</th>
                <th className="py-2.5 px-3">Sesi Penimbangan</th>
                <th className="py-2.5 px-3">Tong QR</th>
                <th className="py-2.5 px-3 text-right">Berat</th>
                <th className="py-2.5 px-3">Status Pemilahan</th>
                <th className="py-2.5 pl-3">Catatan Evaluasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Tidak ada data penimbangan untuk diekspor.
                  </td>
                </tr>
              ) : (
                filtered.map((ev) => (
                  <tr key={ev.id} className="align-top">
                    <td className="py-3 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                      {ev.kelas}
                      <span className="block font-mono text-[11px] font-normal text-slate-500 mt-0.5">
                        {formatTanggalJamSingkat(ev.waktuCatat)}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <SesiBadge
                        sesi={ev.sesiPenimbangan}
                        keteranganInsidental={ev.keteranganInsidental}
                      />
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          ev.kategoriTong === 'ORGANIK'
                            ? 'text-[#059669]'
                            : 'text-[#D97706]'
                        }`}
                      >
                        {ev.kategoriTong}
                      </span>
                      <span className="block font-mono text-[11px] text-slate-500">
                        {ev.qrCodeId}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {Number(ev.beratKg).toFixed(1)} kg
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusLabel status={ev.hasil.saran_status_pilah} />
                    </td>
                    <td className="py-3 pl-3 text-xs text-slate-600 leading-relaxed min-w-[240px]">
                      {ev.hasil.catatan_evaluasi_kelas}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
