import React, { useMemo, useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Printer,
  RotateCcw,
  Award,
  AlertCircle,
  Database,
} from 'lucide-react';
import { DEFAULT_NOVEMBER_RECAP } from '../constants';
import type {
  EvaluasiRecord,
  MonthlyRecapInput,
  MonthlyReportOutput,
} from '../types';
import { generateMonthlyReportWithGemini } from '../lib/gemini';

interface MonthlyReportViewProps {
  evaluations: EvaluasiRecord[];
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  evaluations,
}) => {
  const [form, setForm] = useState<MonthlyRecapInput>(DEFAULT_NOVEMBER_RECAP);
  const [report, setReport] = useState<MonthlyReportOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const liveStats = useMemo(() => {
    const total = Number(form.totalOrganikKg) + Number(form.totalNonOrganikKg);
    const orgPct = total > 0 ? ((form.totalOrganikKg / total) * 100).toFixed(1) : '0.0';
    const nonPct = total > 0 ? ((form.totalNonOrganikKg / total) * 100).toFixed(1) : '0.0';
    const distSum =
      Number(form.persenTerpilahSempurna) +
      Number(form.persenTercampurRingan) +
      Number(form.persenTidakDipilah);
    return { total, orgPct, nonPct, distSum };
  }, [form]);

  const handleLoadFromBoard = () => {
    if (evaluations.length === 0) return;

    const orgKg = Number(
      evaluations
        .filter((e) => e.kategoriTong === 'ORGANIK')
        .reduce((sum, e) => sum + (Number(e.beratKg) || 0), 0)
        .toFixed(1)
    );
    const nonKg = Number(
      evaluations
        .filter((e) => e.kategoriTong === 'NON-ORGANIK')
        .reduce((sum, e) => sum + (Number(e.beratKg) || 0), 0)
        .toFixed(1)
    );
    const totalCount = evaluations.length;
    const countSempurna = evaluations.filter(
      (e) => e.hasil.saran_status_pilah === 'Terpilah Sempurna'
    ).length;
    const countRingan = evaluations.filter(
      (e) => e.hasil.saran_status_pilah === 'Tercampur Ringan'
    ).length;
    const pSempurna = Math.round((countSempurna / totalCount) * 100);
    const pRingan = Math.round((countRingan / totalCount) * 100);
    const pTidak = Math.max(0, 100 - pSempurna - pRingan);

    const byClass: Record<string, { scoreSum: number; count: number; violations: string[] }> = {};
    for (const ev of evaluations) {
      if (!byClass[ev.kelas]) {
        byClass[ev.kelas] = { scoreSum: 0, count: 0, violations: [] };
      }
      const pts =
        ev.hasil.saran_status_pilah === 'Terpilah Sempurna'
          ? 100
          : ev.hasil.saran_status_pilah === 'Tercampur Ringan'
            ? 70
            : 40;
      byClass[ev.kelas].scoreSum += pts;
      byClass[ev.kelas].count += 1;
      if (ev.hasil.saran_status_pilah !== 'Terpilah Sempurna') {
        const itemsText =
          ev.hasil.benda_salah_tempat.length > 0
            ? ev.hasil.benda_salah_tempat.join(', ')
            : ev.quickTags.join(', ') || 'Pemilahan belum sesuai';
        byClass[ev.kelas].violations.push(
          `${ev.hasil.saran_status_pilah} - ${itemsText}`
        );
      }
    }

    const ranked = Object.entries(byClass)
      .map(([kelas, info]) => ({
        kelas,
        skor: Math.round(info.scoreSum / info.count),
        violations: info.violations,
      }))
      .sort((a, b) => b.skor - a.skor);

    const topClasses = ranked.slice(0, 3).map(({ kelas, skor }) => ({ kelas, skor }));
    const violationClasses = ranked
      .filter((r) => r.violations.length > 0)
      .slice(-3)
      .reverse()
      .map((r) => ({
        kelas: r.kelas,
        pola: `${r.violations.length}x catatan - ${r.violations[0]}`,
      }));

    const sesiPagiKg = Number(
      evaluations
        .filter((e) => e.sesiPenimbangan === 'Sesi Pagi (10.30-11.00)')
        .reduce((sum, e) => sum + (Number(e.beratKg) || 0), 0)
        .toFixed(1)
    );
    const sesiSiangKg = Number(
      evaluations
        .filter((e) => e.sesiPenimbangan === 'Sesi Siang (12.30-13.00)')
        .reduce((sum, e) => sum + (Number(e.beratKg) || 0), 0)
        .toFixed(1)
    );
    const sesiInsidentalKg = Number(
      evaluations
        .filter((e) => e.sesiPenimbangan === 'Insidental')
        .reduce((sum, e) => sum + (Number(e.beratKg) || 0), 0)
        .toFixed(1)
    );

    setForm({
      bulan: 'Rekap Papan Evaluasi Terkini',
      totalOrganikKg: orgKg,
      totalNonOrganikKg: nonKg,
      sesiPagiKg,
      sesiSiangKg,
      sesiInsidentalKg,
      persenTerpilahSempurna: pSempurna,
      persenTercampurRingan: pRingan,
      persenTidakDipilah: pTidak,
      topClasses: topClasses.length > 0 ? topClasses : DEFAULT_NOVEMBER_RECAP.topClasses,
      violationClasses:
        violationClasses.length > 0
          ? violationClasses
          : [{ kelas: '-', pola: 'Tidak ada pelanggaran tercatat pada papan saat ini' }],
    });
    setReport(null);
    setError(null);
  };

  const handleLoadDefaultNovember = () => {
    setForm(DEFAULT_NOVEMBER_RECAP);
    setReport(null);
    setError(null);
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const generated = await generateMonthlyReportWithGemini(form);
      setReport(generated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menghubungi layanan Konsultan AI.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!report) return;
    const text = [
      report.judul_laporan.toUpperCase(),
      'SMAN 1 Karang Bahagia — Program Sekolah Adiwiyata',
      '',
      '1. RINGKASAN EKSEKUTIF',
      report.ringkasan_eksekutif,
      `- Total Sampah: ${report.estimasi_dampak.total_sampah_kg} kg (Organik ${report.estimasi_dampak.rasio_organik_persen}% / Non-Organik ${report.estimasi_dampak.rasio_non_organik_persen}%)`,
      `- Estimasi Kompos: ${report.estimasi_dampak.estimasi_kompos_kg} kg | Estimasi Material Daur Ulang: ${report.estimasi_dampak.estimasi_daur_ulang_kg} kg`,
      '',
      '2. EVALUASI KEDISIPLINAN PEMILAHAN',
      report.evaluasi_kedisiplinan,
      '',
      '3. SOROTAN KELAS (APRESIASI & PEMBINAAN)',
      'Apresiasi Kelas Terdisiplin:',
      ...report.sorotan_apresiasi.map(
        (a, i) => `  ${i + 1}. Kelas ${a.kelas} (Skor ${a.skor}): ${a.keterangan}`
      ),
      'Kelas Memerlukan Pembinaan:',
      ...report.sorotan_pembinaan.map(
        (p, i) => `  ${i + 1}. Kelas ${p.kelas} — ${p.pola_kesalahan}. ${p.catatan_pembinaan}`
      ),
      '',
      '4. REKOMENDASI TINDAK LANJUT',
      ...report.rekomendasi_tindak_lanjut.map(
        (r, i) => `  ${i + 1}. ${r.judul} (${r.sasaran}): ${r.langkah_konkret}`
      ),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const repeatedOffenders = useMemo(() => {
    const counts: Record<string, { kelas: string; count: number; latestNote: string }> = {};
    for (const ev of evaluations) {
      if (ev.hasil.saran_status_pilah === 'Terpilah Sempurna') continue;
      if (!counts[ev.kelas]) {
        counts[ev.kelas] = { kelas: ev.kelas, count: 0, latestNote: '' };
      }
      counts[ev.kelas].count += 1;
      if (!counts[ev.kelas].latestNote) {
        counts[ev.kelas].latestNote =
          ev.hasil.benda_salah_tempat.join(', ') ||
          ev.quickTags.join(', ') ||
          ev.hasil.saran_status_pilah;
      }
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [evaluations]);

  return (
    <section className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-900">
            Deteksi Pelanggaran Berulang dari Log Penimbangan
          </p>
          {repeatedOffenders.length === 0 ? (
            <p className="text-xs text-[#059669]">
              Belum ada kelas dengan catatan pelanggaran pada papan evaluasi aktif.
            </p>
          ) : (
            <p className="text-xs text-slate-600">
              {repeatedOffenders
                .map((o) => `Kelas ${o.kelas} (${o.count}x catatan: ${o.latestNote})`)
                .join(' · ')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleLoadDefaultNovember}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-lg transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Data November 2026</span>
          </button>
          <button
            type="button"
            onClick={handleLoadFromBoard}
            disabled={evaluations.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium bg-[#059669] hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tarik dari Papan Evaluasi</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Rekapitulasi Input */}
        <div className="lg:col-span-5 bg-white border border-[#E4E7E2] rounded-xl p-5 sm:p-6 space-y-6 print:hidden">
          <div className="pb-3 border-b border-[#E4E7E2] flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#111814]">
              Data Rekapitulasi Bulanan
            </h2>
            <span className="font-mono text-xs tabular-nums text-[#6E7871]">
              Total {liveStats.total.toFixed(1)} kg
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="bulan-laporan" className="block text-xs font-semibold text-[#111814]">
                Periode / Bulan Laporan
              </label>
              <input
                id="bulan-laporan"
                type="text"
                value={form.bulan}
                onChange={(e) => setForm((f) => ({ ...f, bulan: e.target.value }))}
                className="w-full px-3 py-2 min-h-[40px] text-sm bg-[#F7F8F6] border border-[#E4E7E2] rounded-lg text-[#111814] focus:outline-none focus:ring-2 focus:ring-[#15803D]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="total-organik" className="block text-xs font-semibold text-[#111814]">
                  Sampah Organik (kg)
                </label>
                <input
                  id="total-organik"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.totalOrganikKg}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, totalOrganikKg: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 min-h-[40px] text-sm font-mono tabular-nums bg-[#F7F8F6] border border-[#E4E7E2] rounded-lg text-[#111814] focus:outline-none focus:ring-2 focus:ring-[#15803D]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="total-nonorganik" className="block text-xs font-semibold text-[#111814]">
                  Sampah Non-Organik (kg)
                </label>
                <input
                  id="total-nonorganik"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.totalNonOrganikKg}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, totalNonOrganikKg: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 min-h-[40px] text-sm font-mono tabular-nums bg-[#F7F8F6] border border-[#E4E7E2] rounded-lg text-[#111814] focus:outline-none focus:ring-2 focus:ring-[#15803D]"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <span className="block text-xs font-semibold text-slate-900">
                Distribusi Berat per Sesi Penimbangan (kg)
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="sesi-pagi-kg" className="block text-[11px] text-sky-700">
                    Sesi Pagi
                  </label>
                  <input
                    id="sesi-pagi-kg"
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.sesiPagiKg ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sesiPagiKg: Number(e.target.value) || 0 }))
                    }
                    className="w-full px-2.5 py-2 min-h-[38px] text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sesi-siang-kg" className="block text-[11px] text-orange-700">
                    Sesi Siang
                  </label>
                  <input
                    id="sesi-siang-kg"
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.sesiSiangKg ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sesiSiangKg: Number(e.target.value) || 0 }))
                    }
                    className="w-full px-2.5 py-2 min-h-[38px] text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sesi-insidental-kg" className="block text-[11px] text-purple-700">
                    Insidental
                  </label>
                  <input
                    id="sesi-insidental-kg"
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.sesiInsidentalKg ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sesiInsidentalKg: Number(e.target.value) || 0 }))
                    }
                    className="w-full px-2.5 py-2 min-h-[38px] text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#E4E7E2]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#111814]">
                  Distribusi Status Pilah (%)
                </span>
                <span
                  className={`font-mono text-xs tabular-nums ${
                    liveStats.distSum === 100 ? 'text-[#15803D]' : 'text-[#B45309]'
                  }`}
                >
                  Total: {liveStats.distSum}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="pct-sempurna" className="block text-[11px] text-[#6E7871]">
                    Terpilah Sempurna
                  </label>
                  <input
                    id="pct-sempurna"
                    type="number"
                    min="0"
                    max="100"
                    value={form.persenTerpilahSempurna}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        persenTerpilahSempurna: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-2.5 py-2 min-h-[38px] text-sm font-mono tabular-nums bg-[#F7F8F6] border border-[#E4E7E2] rounded-lg text-[#111814]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="pct-ringan" className="block text-[11px] text-[#6E7871]">
                    Tercampur Ringan
                  </label>
                  <input
                    id="pct-ringan"
                    type="number"
                    min="0"
                    max="100"
                    value={form.persenTercampurRingan}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        persenTercampurRingan: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-2.5 py-2 min-h-[38px] text-sm font-mono tabular-nums bg-[#F7F8F6] border border-[#E4E7E2] rounded-lg text-[#111814]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="pct-tidak" className="block text-[11px] text-[#6E7871]">
                    Tidak Dipilah
                  </label>
                  <input
                    id="pct-tidak"
                    type="number"
                    min="0"
                    max="100"
                    value={form.persenTidakDipilah}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        persenTidakDipilah: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-2.5 py-2 min-h-[38px] text-sm font-mono tabular-nums bg-[#F7F8F6] border border-[#E4E7E2] rounded-lg text-[#111814]"
                  />
                </div>
              </div>
            </div>

            {/* Top 3 Classes */}
            <div className="space-y-2 pt-2 border-t border-[#E4E7E2]">
              <span className="block text-xs font-semibold text-[#111814]">
                Top 3 Kelas Terdisiplin
              </span>
              <div className="space-y-2">
                {form.topClasses.map((entry, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      aria-label={`Kelas terdisiplin ${idx + 1}`}
                      value={entry.kelas}
                      onChange={(e) => {
                        const updated = [...form.topClasses];
                        updated[idx] = { ...entry, kelas: e.target.value };
                        setForm((f) => ({ ...f, topClasses: updated }));
                      }}
                      className="col-span-7 px-3 py-1.5 min-h-[38px] text-sm bg-[#F7F8F6] border border-[#E4E7E2] rounded-lg text-[#111814]"
                    />
                    <input
                      type="number"
                      aria-label={`Skor kelas terdisiplin ${idx + 1}`}
                      value={entry.skor}
                      onChange={(e) => {
                        const updated = [...form.topClasses];
                        updated[idx] = { ...entry, skor: Number(e.target.value) || 0 };
                        setForm((f) => ({ ...f, topClasses: updated }));
                      }}
                      className="col-span-5 px-3 py-1.5 min-h-[38px] text-sm font-mono tabular-nums bg-[#F7F8F6] border border-[#E4E7E2] rounded-lg text-[#111814]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Top 3 Violations */}
            <div className="space-y-2 pt-2 border-t border-[#E4E7E2]">
              <span className="block text-xs font-semibold text-[#111814]">
                3 Kelas dengan Pelanggaran Terbanyak
              </span>
              <div className="space-y-2">
                {form.violationClasses.map((entry, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      aria-label={`Kelas pembinaan ${idx + 1}`}
                      value={entry.kelas}
                      onChange={(e) => {
                        const updated = [...form.violationClasses];
                        updated[idx] = { ...entry, kelas: e.target.value };
                        setForm((f) => ({ ...f, violationClasses: updated }));
                      }}
                      className="col-span-4 px-2.5 py-1.5 min-h-[38px] text-sm bg-[#F7F8F6] border border-[#E4E7E2] rounded-lg text-[#111814]"
                    />
                    <input
                      type="text"
                      aria-label={`Pola pelanggaran ${idx + 1}`}
                      value={entry.pola}
                      onChange={(e) => {
                        const updated = [...form.violationClasses];
                        updated[idx] = { ...entry, pola: e.target.value };
                        setForm((f) => ({ ...f, violationClasses: updated }));
                      }}
                      className="col-span-8 px-2.5 py-1.5 min-h-[38px] text-xs sm:text-sm bg-[#F7F8F6] border border-[#E4E7E2] rounded-lg text-[#111814]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerateReport}
            className="w-full min-h-[46px] px-5 py-3 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#15803D]"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>
              {isGenerating
                ? 'Menyusun Laporan Resmi...'
                : 'Susun Laporan Evaluasi Bulanan'}
            </span>
          </button>
        </div>

        {/* Right Column: Official Report Sheet */}
        <div className="lg:col-span-7 bg-white border border-[#E4E7E2] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E4E7E2]">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-[#15803D]">
                Program Sekolah Adiwiyata · SMAN 1 Karang Bahagia
              </p>
              <h2 className="text-lg font-bold text-[#111814]">
                {report ? report.judul_laporan : `Pratinjau Laporan Bulan ${form.bulan}`}
              </h2>
            </div>

            {report && (
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium bg-[#F7F8F6] border border-[#E4E7E2] hover:bg-[#ECEEEB] text-[#111814] rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                      <span className="text-[#15803D]">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Salin Naskah</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium bg-[#111814] hover:bg-[#232D27] text-white rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Cetak</span>
                </button>
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="p-4 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm space-y-2"
            >
              <p className="font-semibold">Laporan belum dapat disusun</p>
              <p className="text-xs leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={handleGenerateReport}
                className="inline-flex items-center gap-1.5 text-xs font-semibold underline"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Coba Susun Ulang</span>
              </button>
            </div>
          )}

          {isGenerating ? (
            <div className="space-y-5 animate-pulse py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-16 bg-[#ECEEEB] rounded-lg" />
                ))}
              </div>
              <div className="h-24 bg-[#ECEEEB] rounded-lg" />
              <div className="h-24 bg-[#ECEEEB] rounded-lg" />
              <div className="h-32 bg-[#ECEEEB] rounded-lg" />
            </div>
          ) : !report ? (
            <div className="space-y-6">
              {/* Live computed preview strip before AI synthesis */}
              <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#E4E7E2] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E4E7E2]">
                <div className="p-4 space-y-1">
                  <p className="text-[11px] text-[#6E7871]">Total Sampah</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-[#111814]">
                    {liveStats.total.toFixed(1)} kg
                  </p>
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-[11px] text-[#6E7871]">Rasio Organik</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-[#15803D]">
                    {liveStats.orgPct}%
                  </p>
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-[11px] text-[#6E7871]">Rasio Non-Organik</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-[#B45309]">
                    {liveStats.nonPct}%
                  </p>
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-[11px] text-[#6E7871]">Terpilah Sempurna</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-[#111814]">
                    {form.persenTerpilahSempurna}%
                  </p>
                </div>
              </div>

              <div className="py-10 px-4 text-center space-y-3 border border-dashed border-[#D6DBD3] rounded-xl bg-[#F7F8F6]/60">
                <p className="text-sm font-semibold text-[#111814]">
                  Siap menyusun Laporan Evaluasi Resmi Bulan {form.bulan}
                </p>
                <p className="text-xs sm:text-sm text-[#6E7871] max-w-lg mx-auto leading-relaxed">
                  Klik tombol <strong>Susun Laporan Evaluasi Bulanan</strong> untuk menghasilkan analisis lengkap mencakup Ringkasan Eksekutif, Evaluasi Kedisiplinan, Sorotan Kelas (Apresiasi & Pembinaan), serta 3 Rekomendasi Tindak Lanjut resmi.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-7">
              {/* 1. Ringkasan Eksekutif */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#111814]">
                  01. Ringkasan Eksekutif & Dampak Lingkungan
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#E4E7E2] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E4E7E2]">
                  <div className="p-4 space-y-1">
                    <p className="text-[11px] text-[#6E7871]">Total Sampah</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-[#111814]">
                      {report.estimasi_dampak.total_sampah_kg} kg
                    </p>
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="text-[11px] text-[#6E7871]">Rasio Org / Non-Org</p>
                    <p className="text-base font-bold font-mono tabular-nums text-[#111814]">
                      {report.estimasi_dampak.rasio_organik_persen}% /{' '}
                      {report.estimasi_dampak.rasio_non_organik_persen}%
                    </p>
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="text-[11px] text-[#6E7871]">Potensi Kompos</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-[#15803D]">
                      {report.estimasi_dampak.estimasi_kompos_kg} kg
                    </p>
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="text-[11px] text-[#6E7871]">Potensi Daur Ulang</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-[#111814]">
                      {report.estimasi_dampak.estimasi_daur_ulang_kg} kg
                    </p>
                  </div>
                </div>

                <p className="text-sm text-[#111814] leading-relaxed">
                  {report.ringkasan_eksekutif}
                </p>
              </div>

              {/* 2. Evaluasi Kedisiplinan */}
              <div className="space-y-3 pt-5 border-t border-[#E4E7E2]">
                <h3 className="text-sm font-bold text-[#111814]">
                  02. Evaluasi Kedisiplinan Pemilahan
                </h3>

                {/* Visual stacked distribution bar */}
                <div className="space-y-2">
                  <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-[#ECEEEB]">
                    <div
                      style={{ width: `${form.persenTerpilahSempurna}%` }}
                      className="bg-[#15803D]"
                    />
                    <div
                      style={{ width: `${form.persenTercampurRingan}%` }}
                      className="bg-[#D97706]"
                    />
                    <div
                      style={{ width: `${form.persenTidakDipilah}%` }}
                      className="bg-[#DC2626]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6E7871] font-mono tabular-nums">
                    <span className="text-[#15803D] font-semibold">
                      Terpilah Sempurna {form.persenTerpilahSempurna}%
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#B45309] font-semibold">
                      Tercampur Ringan {form.persenTercampurRingan}%
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#B91C1C] font-semibold">
                      Tidak Dipilah {form.persenTidakDipilah}%
                    </span>
                  </div>
                </div>

                <p className="text-sm text-[#111814] leading-relaxed">
                  {report.evaluasi_kedisiplinan}
                </p>
              </div>

              {/* 3. Sorotan Kelas */}
              <div className="space-y-4 pt-5 border-t border-[#E4E7E2]">
                <h3 className="text-sm font-bold text-[#111814]">
                  03. Sorotan Kelas (Apresiasi & Pembinaan)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
                      <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Apresiasi Kelas Terdisiplin</span>
                    </div>
                    <div className="divide-y divide-[#E4E7E2] border border-[#E4E7E2] rounded-xl">
                      {report.sorotan_apresiasi.map((item) => (
                        <div key={item.kelas} className="p-3.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-[#111814]">
                              Kelas {item.kelas}
                            </span>
                            <span className="font-mono text-xs font-semibold tabular-nums text-[#15803D]">
                              Skor {item.skor}
                            </span>
                          </div>
                          <p className="text-xs text-[#4B554E] leading-relaxed">
                            {item.keterangan}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#B45309]">
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Kelas Prioritas Pembinaan</span>
                    </div>
                    <div className="divide-y divide-[#E4E7E2] border border-[#E4E7E2] rounded-xl">
                      {report.sorotan_pembinaan.map((item) => (
                        <div key={item.kelas} className="p-3.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-[#111814]">
                              Kelas {item.kelas}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-[#B45309]">
                            {item.pola_kesalahan}
                          </p>
                          <p className="text-xs text-[#4B554E] leading-relaxed">
                            {item.catatan_pembinaan}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Rekomendasi Tindak Lanjut */}
              <div className="space-y-3 pt-5 border-t border-[#E4E7E2]">
                <h3 className="text-sm font-bold text-[#111814]">
                  04. Rekomendasi Tindak Lanjut Bulan Berikutnya
                </h3>
                <ol className="space-y-3">
                  {report.rekomendasi_tindak_lanjut.map((rek, idx) => (
                    <li
                      key={`${rek.judul}-${idx}`}
                      className="p-4 border border-[#E4E7E2] rounded-xl space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#111814]">
                          0{idx + 1}. {rek.judul}
                        </span>
                        <span className="text-xs font-medium text-[#6E7871]">
                          Sasaran: {rek.sasaran}
                        </span>
                      </div>
                      <p className="text-sm text-[#4B554E] leading-relaxed">
                        {rek.langkah_konkret}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
