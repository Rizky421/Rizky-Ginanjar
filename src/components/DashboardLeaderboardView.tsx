import React, { useMemo, useState } from 'react';
import { QrCode, ArrowUpRight, BookOpen, Clock } from 'lucide-react';
import { SESI_PENIMBANGAN_OPTIONS } from '../constants';
import type { EvaluasiRecord, Role, SesiPenimbangan } from '../types';
import { StatusLabel } from './StatusLabel';
import { SortingGuide } from './SortingGuide';

interface DashboardLeaderboardViewProps {
  evaluations: EvaluasiRecord[];
  daftarKelas: string[];
  currentRole: Role;
  onNavigate: (menuId: string) => void;
}

export const DashboardLeaderboardView: React.FC<DashboardLeaderboardViewProps> = ({
  evaluations,
  daftarKelas,
  currentRole,
  onNavigate,
}) => {
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [filterSesi, setFilterSesi] = useState<'SEMUA' | SesiPenimbangan>('SEMUA');

  const sesiTotals = useMemo(() => {
    const pagiKg = evaluations
      .filter((e) => e.sesiPenimbangan === 'Sesi Pagi (10.30-11.00)')
      .reduce((s, e) => s + (Number(e.beratKg) || 0), 0);
    const siangKg = evaluations
      .filter((e) => e.sesiPenimbangan === 'Sesi Siang (12.30-13.00)')
      .reduce((s, e) => s + (Number(e.beratKg) || 0), 0);
    const insidentalKg = evaluations
      .filter((e) => e.sesiPenimbangan === 'Insidental')
      .reduce((s, e) => s + (Number(e.beratKg) || 0), 0);
    const allKg = pagiKg + siangKg + insidentalKg;
    return { pagiKg, siangKg, insidentalKg, allKg };
  }, [evaluations]);

  const filteredEvaluations = useMemo(() => {
    if (filterSesi === 'SEMUA') return evaluations;
    return evaluations.filter((e) => e.sesiPenimbangan === filterSesi);
  }, [evaluations, filterSesi]);

  const summary = useMemo(() => {
    const totalCount = filteredEvaluations.length;
    const organikRecords = filteredEvaluations.filter((e) => e.kategoriTong === 'ORGANIK');
    const nonOrganikRecords = filteredEvaluations.filter((e) => e.kategoriTong === 'NON-ORGANIK');
    const organikKg = organikRecords.reduce((s, e) => s + (Number(e.beratKg) || 0), 0);
    const nonOrganikKg = nonOrganikRecords.reduce((s, e) => s + (Number(e.beratKg) || 0), 0);
    const totalKg = organikKg + nonOrganikKg;

    const sempurnaCount = filteredEvaluations.filter(
      (e) => e.hasil.saran_status_pilah === 'Terpilah Sempurna'
    ).length;
    const compliancePct = totalCount > 0 ? Math.round((sempurnaCount / totalCount) * 100) : 0;

    return {
      totalCount,
      organikKg,
      nonOrganikKg,
      totalKg,
      orgPct: totalKg > 0 ? Math.round((organikKg / totalKg) * 100) : 0,
      nonPct: totalKg > 0 ? Math.round((nonOrganikKg / totalKg) * 100) : 0,
      compliancePct,
    };
  }, [filteredEvaluations]);

  const classBreakdown = useMemo(() => {
    const map: Record<
      string,
      {
        kelas: string;
        organikKg: number;
        nonOrganikKg: number;
        count: number;
        scoreSum: number;
        latestStatus: EvaluasiRecord['hasil']['saran_status_pilah'] | null;
      }
    > = {};

    for (const k of daftarKelas) {
      map[k] = {
        kelas: k,
        organikKg: 0,
        nonOrganikKg: 0,
        count: 0,
        scoreSum: 0,
        latestStatus: null,
      };
    }

    for (const ev of filteredEvaluations) {
      if (!map[ev.kelas]) {
        map[ev.kelas] = {
          kelas: ev.kelas,
          organikKg: 0,
          nonOrganikKg: 0,
          count: 0,
          scoreSum: 0,
          latestStatus: null,
        };
      }
      const entry = map[ev.kelas];
      if (ev.kategoriTong === 'ORGANIK') {
        entry.organikKg += Number(ev.beratKg) || 0;
      } else {
        entry.nonOrganikKg += Number(ev.beratKg) || 0;
      }
      const pts =
        ev.hasil.saran_status_pilah === 'Terpilah Sempurna'
          ? 100
          : ev.hasil.saran_status_pilah === 'Tercampur Ringan'
            ? 70
            : 40;
      entry.scoreSum += pts;
      entry.count += 1;
      if (!entry.latestStatus) {
        entry.latestStatus = ev.hasil.saran_status_pilah;
      }
    }

    const activeRows = Object.values(map)
      .filter((r) => r.count > 0)
      .map((r) => ({
        ...r,
        avgScore: Math.round(r.scoreSum / r.count),
        totalKg: r.organikKg + r.nonOrganikKg,
      }))
      .sort((a, b) => b.avgScore - a.avgScore || b.totalKg - a.totalKg);

    return {
      activeRows,
      maxClassKg: Math.max(
        1,
        ...activeRows.map((r) => Math.max(r.organikKg, r.nonOrganikKg))
      ),
    };
  }, [filteredEvaluations, daftarKelas]);

  const canScan = currentRole === 'Admin' || currentRole === 'Petugas Timbang';

  return (
    <div className="space-y-6">
      {/* Filter Sesi Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <Clock className="w-4 h-4 text-[#059669] shrink-0" aria-hidden="true" />
          <span>Filter Statistik berdasarkan Waktu / Sesi Penimbangan:</span>
        </div>

        <select
          aria-label="Filter sesi penimbangan"
          value={filterSesi}
          onChange={(e) => setFilterSesi(e.target.value as 'SEMUA' | SesiPenimbangan)}
          className="px-3 py-2 min-h-[40px] text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
        >
          <option value="SEMUA">Semua Sesi</option>
          {SESI_PENIMBANGAN_OPTIONS.map((sesi) => (
            <option key={sesi} value={sesi}>
              {sesi === 'Sesi Pagi (10.30-11.00)'
                ? 'Sesi Pagi (10.30-11.00)'
                : sesi === 'Sesi Siang (12.30-13.00)'
                  ? 'Sesi Siang (12.30-13.00)'
                  : 'Insidental'}
            </option>
          ))}
        </select>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Total Sampah Tercatat</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {summary.totalKg.toFixed(1)}{' '}
            <span className="text-sm font-normal text-slate-500">kg</span>
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {summary.totalCount} sesi penimbangan
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Fraksi Organik (Hijau)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#059669]">
            {summary.organikKg.toFixed(1)}{' '}
            <span className="text-sm font-normal text-slate-500">kg</span>
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {summary.orgPct}% dari total volume
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Fraksi Non-Organik (Kuning)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#D97706]">
            {summary.nonOrganikKg.toFixed(1)}{' '}
            <span className="text-sm font-normal text-slate-500">kg</span>
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {summary.nonPct}% dari total volume
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Kepatuhan Terpilah Sempurna</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {summary.compliancePct}%
          </p>
          <p className="text-xs text-slate-500">
            Target sekolah Adiwiyata ≥ 85%
          </p>
        </div>
      </div>

      {/* Distribusi Berat per Sesi */}
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
              Sesi Pagi (10.30-11.00)
            </span>
            <p className="text-xs text-slate-500 pt-1">Dominan kemasan jajanan/minuman</p>
          </div>
          <p className="font-mono text-lg font-bold tabular-nums text-slate-900 shrink-0">
            {sesiTotals.pagiKg.toFixed(1)} kg
          </p>
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
              Sesi Siang (12.30-13.00)
            </span>
            <p className="text-xs text-slate-500 pt-1">Dominan sisa makan siang & daun</p>
          </div>
          <p className="font-mono text-lg font-bold tabular-nums text-slate-900 shrink-0">
            {sesiTotals.siangKg.toFixed(1)} kg
          </p>
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
              Insidental
            </span>
            <p className="text-xs text-slate-500 pt-1">Jumat Bersih & kegiatan sekolah</p>
          </div>
          <p className="font-mono text-lg font-bold tabular-nums text-slate-900 shrink-0">
            {sesiTotals.insidentalKg.toFixed(1)} kg
          </p>
        </div>
      </div>

      {/* Main Split: Chart + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Perbandingan Organik vs Non-Organik per Kelas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Akumulasi berat penimbangan aktual berdasarkan kategori tong QR
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#059669]" aria-hidden="true" />
                Organik
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706]" aria-hidden="true" />
                Non-Organik
              </span>
            </div>
          </div>

          {classBreakdown.activeRows.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Belum ada data penimbangan pada sesi yang dipilih
              </p>
              {canScan && (
                <button
                  type="button"
                  onClick={() => onNavigate('scanner')}
                  className="px-4 py-2 text-xs font-semibold bg-[#059669] text-white rounded-lg hover:bg-emerald-700"
                >
                  Mulai Scan Tong Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {classBreakdown.activeRows.slice(0, 8).map((row) => {
                const orgWidth = Math.max(
                  row.organikKg > 0 ? 6 : 0,
                  Math.round((row.organikKg / classBreakdown.maxClassKg) * 100)
                );
                const nonWidth = Math.max(
                  row.nonOrganikKg > 0 ? 6 : 0,
                  Math.round((row.nonOrganikKg / classBreakdown.maxClassKg) * 100)
                );
                return (
                  <div key={row.kelas} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">
                        Kelas {row.kelas}
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        Org {row.organikKg.toFixed(1)} kg · Non-Org {row.nonOrganikKg.toFixed(1)} kg
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-[#059669] rounded-sm transition-all duration-300"
                          style={{ width: `${orgWidth}%` }}
                        />
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-[#D97706] rounded-sm transition-all duration-300"
                          style={{ width: `${nonWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Klasemen Pemilahan Kelas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Peringkat skor kedisiplinan berdasarkan hasil evaluasi
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGuideModal((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#059669] hover:underline whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showGuideModal ? 'Tutup Panduan' : 'Panduan Pilah'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 px-2">Kelas</th>
                  <th className="py-2 px-2 text-right">Berat</th>
                  <th className="py-2 px-2 text-right">Skor</th>
                  <th className="py-2 pl-2 text-right">Status Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {classBreakdown.activeRows.map((row, index) => (
                  <tr key={row.kelas} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-2 font-mono tabular-nums text-slate-500">
                      0{index + 1}
                    </td>
                    <td className="py-2.5 px-2 font-semibold text-slate-900">
                      {row.kelas}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600">
                      {row.totalKg.toFixed(1)} kg
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums text-slate-900">
                      {row.avgScore}
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      {row.latestStatus && (
                        <div className="inline-flex justify-end">
                          <StatusLabel status={row.latestStatus} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            {canScan && (
              <button
                type="button"
                onClick={() => onNavigate('scanner')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#059669] hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Scanner QR & Timbang</span>
              </button>
            )}
            {(currentRole === 'Admin' ||
              currentRole === 'Petugas Timbang' ||
              currentRole === 'Wali Kelas') && (
              <button
                type="button"
                onClick={() => onNavigate('evaluasi')}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <span>Buka Papan Evaluasi</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {showGuideModal && (
        <div className="pt-2">
          <SortingGuide />
        </div>
      )}
    </div>
  );
};
