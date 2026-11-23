import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
  QrCode,
  Save,
  CalendarClock,
} from 'lucide-react';
import {
  INITIAL_MASTER_DATA,
  SESI_PENIMBANGAN_OPTIONS,
  STATUS_PILAH_OPTIONS,
  detectCurrentSesi,
} from '../constants';
import type {
  EvaluasiRecord,
  KategoriTong,
  Role,
  SesiPenimbangan,
  StatusPilah,
} from '../types';
import {
  formatLocalHhMm,
  formatLocalYyyyMmDd,
  formatTanggalJamSingkat,
  getNowDateTimeLocalValue,
  getTodayDateInputValue,
  parseDateTimeLocalToParts,
} from '../lib/dateUtils';
import { StatusLabel } from './StatusLabel';
import { SesiBadge } from './SesiBadge';

interface VerificationWorkbenchProps {
  currentRole: Role;
  daftarKelas?: string[];
  quickTagsOrganik?: string[];
  quickTagsNonOrganik?: string[];
  onSaveEvaluation: (
    record: Omit<EvaluasiRecord, 'id' | 'waktuCatat'> & {
      waktuCatat?: string;
      tanggal?: string;
      jamCatat?: string;
    }
  ) => Promise<void>;
  onOpenBoard: () => void;
  resetSignal: number;
}

function buildDefaultEvaluationNote(params: {
  kelas: string;
  kategoriTong: KategoriTong;
  sesiPenimbangan: SesiPenimbangan;
  keteranganInsidental: string;
  statusPetugas: StatusPilah;
  quickTags: string[];
}): string {
  const {
    kelas,
    kategoriTong,
    sesiPenimbangan,
    keteranganInsidental,
    statusPetugas,
    quickTags,
  } = params;

  const sesiLabel =
    sesiPenimbangan === 'Sesi Pagi (10.30-11.00)'
      ? 'pada Sesi Pagi'
      : sesiPenimbangan === 'Sesi Siang (12.30-13.00)'
        ? 'pada Sesi Siang'
        : keteranganInsidental.trim()
          ? `pada kegiatan ${keteranganInsidental.trim()}`
          : 'pada penimbangan insidental';

  const tongLabel =
    kategoriTong === 'ORGANIK' ? 'tong Organik (Hijau)' : 'tong Non-Organik (Kuning)';

  const tagsSummary = quickTags.join(', ');

  if (statusPetugas === 'Terpilah Sempurna') {
    const base =
      kategoriTong === 'ORGANIK'
        ? `Apresiasi untuk kelas ${kelas} ${sesiLabel}! Seluruh isi ${tongLabel} sudah terpilah dengan baik dan bersih sehingga siap langsung diolah menjadi kompos sekolah.`
        : `Kerja bagus, kelas ${kelas} ${sesiLabel}! Isi ${tongLabel} sudah terpilah rapi dalam kondisi kering dan siap disetorkan ke Bank Sampah sekolah.`;
    return tagsSummary ? `${base} Catatan petugas: ${tagsSummary}.` : base;
  }

  if (statusPetugas === 'Tercampur Ringan') {
    const detail =
      tagsSummary ||
      (kategoriTong === 'ORGANIK'
        ? 'masih ditemukan sedikit sampah non-organik'
        : 'masih ditemukan sisa makanan/organik ringan');
    return `Terima kasih atas partisipasi kelas ${kelas} ${sesiLabel}. Sebagian besar isi ${tongLabel} sudah sesuai, namun tercatat ${detail.toLowerCase()}; mari segera pisahkan ke tong yang tepat agar pengolahan berjalan optimal.`;
  }

  const detailTidakDipilah =
    tagsSummary || 'sampah organik dan non-organik masih tercampur di dalam tong';
  return `Terima kasih kelas ${kelas} sudah mengumpulkan sampah ${sesiLabel}. Pada ${tongLabel} ditemukan catatan pemilahan (${detailTidakDipilah}); yuk bersama-sama pilah kembali sampah basah dan kering sebelum dibuang ke tong masing-masing.`;
}

export const VerificationWorkbench: React.FC<VerificationWorkbenchProps> = ({
  currentRole,
  daftarKelas = INITIAL_MASTER_DATA.daftarKelas,
  quickTagsOrganik = INITIAL_MASTER_DATA.quickTagsOrganik,
  quickTagsNonOrganik = INITIAL_MASTER_DATA.quickTagsNonOrganik,
  onSaveEvaluation,
  onOpenBoard,
  resetSignal,
}) => {
  const isAdmin = currentRole === 'Admin';
  const todayDateStr = getTodayDateInputValue();

  const [waktuPenimbangan, setWaktuPenimbangan] = useState<string>(() =>
    getNowDateTimeLocalValue()
  );
  const [sesiPenimbangan, setSesiPenimbangan] = useState<SesiPenimbangan>(() =>
    detectCurrentSesi()
  );
  const [keteranganInsidental, setKeteranganInsidental] = useState<string>('');
  const [kelas, setKelas] = useState<string>(daftarKelas[0] || 'XI-3');
  const [kategoriTong, setKategoriTong] = useState<KategoriTong>('ORGANIK');
  const [qrScanInput, setQrScanInput] = useState<string>('');
  const [qrScanMsg, setQrScanMsg] = useState<string | null>(null);
  const [beratKg, setBeratKg] = useState<string>('2.4');
  const [statusPetugas, setStatusPetugas] = useState<StatusPilah>('Terpilah Sempurna');
  const [quickTags, setQuickTags] = useState<string[]>(['Organik bersih sesuai aturan']);
  const [customTag, setCustomTag] = useState<string>('');
  const [petugasNama, setPetugasNama] = useState<string>('Petugas Caraka');

  const [hasEditedCatatan, setHasEditedCatatan] = useState<boolean>(false);
  const [catatanEvaluasi, setCatatanEvaluasi] = useState<string>(() =>
    buildDefaultEvaluationNote({
      kelas: daftarKelas[0] || 'XI-3',
      kategoriTong: 'ORGANIK',
      sesiPenimbangan: detectCurrentSesi(),
      keteranganInsidental: '',
      statusPetugas: 'Terpilah Sempurna',
      quickTags: ['Organik bersih sesuai aturan'],
    })
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedNote, setCopiedNote] = useState<boolean>(false);
  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  useEffect(() => {
    if (daftarKelas.length > 0 && !daftarKelas.includes(kelas)) {
      setKelas(daftarKelas[0]);
    }
  }, [daftarKelas, kelas]);

  const effectiveTimeParts = isAdmin
    ? parseDateTimeLocalToParts(waktuPenimbangan || getNowDateTimeLocalValue())
    : (() => {
        const now = new Date();
        return {
          isoTimestamp: now.toISOString(),
          tanggal: formatLocalYyyyMmDd(now),
          jamCatat: formatLocalHhMm(now),
        };
      })();

  useEffect(() => {
    if (!isAdmin) {
      setWaktuPenimbangan(getNowDateTimeLocalValue());
    }
  }, [isAdmin]);

  useEffect(() => {
    if (resetSignal > 0) {
      setSaveError(null);
      setSavedBanner(false);
      setHasEditedCatatan(false);
    }
  }, [resetSignal]);

  useEffect(() => {
    if (!hasEditedCatatan) {
      setCatatanEvaluasi(
        buildDefaultEvaluationNote({
          kelas,
          kategoriTong,
          sesiPenimbangan,
          keteranganInsidental,
          statusPetugas,
          quickTags,
        })
      );
    }
  }, [
    kelas,
    kategoriTong,
    sesiPenimbangan,
    keteranganInsidental,
    statusPetugas,
    quickTags,
    hasEditedCatatan,
  ]);

  const qrCodeId = `QR-${kelas.replace(/[^A-Za-z0-9]/g, '')}-${kategoriTong === 'ORGANIK' ? 'ORG' : 'NON'}`;
  const availableQuickTags =
    kategoriTong === 'ORGANIK' ? quickTagsOrganik : quickTagsNonOrganik;

  const handleApplyQrScan = () => {
    const raw = qrScanInput.trim();
    if (!raw) return;
    setQrScanMsg(null);
    setSavedBanner(false);

    try {
      const parsed = JSON.parse(raw) as { kelas?: string; kategori?: KategoriTong };
      if (parsed.kelas && (parsed.kategori === 'ORGANIK' || parsed.kategori === 'NON-ORGANIK')) {
        setKelas(parsed.kelas);
        setKategoriTong(parsed.kategori);
        setQuickTags([]);
        setQrScanMsg(`QR terbaca: Kelas ${parsed.kelas} (${parsed.kategori})`);
        return;
      }
    } catch {
      // Fall back to code format QR-XI3-ORG
    }

    const match = raw.toUpperCase().match(/^QR-([A-Z0-9]+)-(ORG|NON)$/);
    if (match) {
      const token = match[1];
      const matchedKelas =
        daftarKelas.find((k) => k.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === token) ||
        kelas;
      const kat: KategoriTong = match[2] === 'ORG' ? 'ORGANIK' : 'NON-ORGANIK';
      setKelas(matchedKelas);
      setKategoriTong(kat);
      setQuickTags([]);
      setQrScanMsg(`QR terbaca: Kelas ${matchedKelas} (${kat})`);
    } else {
      setQrScanMsg('Format QR tidak dikenali. Gunakan format seperti QR-XI3-ORG atau QR-X2-NON.');
    }
  };

  const handleToggleTag = (tag: string) => {
    setSavedBanner(false);
    setQuickTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    const trimmed = customTag.trim();
    if (!trimmed) return;
    setSavedBanner(false);
    if (!quickTags.includes(trimmed)) {
      setQuickTags((prev) => [...prev, trimmed]);
    }
    setCustomTag('');
  };

  const handleKategoriChange = (next: KategoriTong) => {
    setKategoriTong(next);
    setQuickTags([]);
    setSavedBanner(false);
  };

  const handleResetTemplate = () => {
    setHasEditedCatatan(false);
    setCatatanEvaluasi(
      buildDefaultEvaluationNote({
        kelas,
        kategoriTong,
        sesiPenimbangan,
        keteranganInsidental,
        statusPetugas,
        quickTags,
      })
    );
  };

  const handleSaveToBoard = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSavedBanner(false);

    const finalNote =
      catatanEvaluasi.trim() ||
      buildDefaultEvaluationNote({
        kelas,
        kategoriTong,
        sesiPenimbangan,
        keteranganInsidental,
        statusPetugas,
        quickTags,
      });

    const saveParts = isAdmin
      ? parseDateTimeLocalToParts(waktuPenimbangan || getNowDateTimeLocalValue())
      : (() => {
          const now = new Date();
          return {
            isoTimestamp: now.toISOString(),
            tanggal: formatLocalYyyyMmDd(now),
            jamCatat: formatLocalHhMm(now),
          };
        })();

    try {
      await onSaveEvaluation({
        kelas,
        kategoriTong,
        qrCodeId,
        beratKg: parseFloat(beratKg) || 0,
        sesiPenimbangan,
        keteranganInsidental:
          sesiPenimbangan === 'Insidental' && keteranganInsidental.trim()
            ? keteranganInsidental.trim()
            : undefined,
        statusPetugas,
        quickTags,
        imageUrl: null,
        petugasNama: petugasNama.trim() || 'Petugas Caraka',
        tanggal: saveParts.tanggal,
        jamCatat: saveParts.jamCatat,
        waktuCatat: saveParts.isoTimestamp,
        hasil: {
          kesesuaian_visual: statusPetugas === 'Terpilah Sempurna',
          benda_salah_tempat: statusPetugas === 'Terpilah Sempurna' ? [] : quickTags,
          catatan_evaluasi_kelas: finalNote,
          saran_status_pilah: statusPetugas,
        },
      });
      setSavedBanner(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Gagal menyimpan penimbangan ke database.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCatatan = async () => {
    if (!catatanEvaluasi) return;
    try {
      await navigator.clipboard.writeText(catatanEvaluasi);
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Input Penimbangan & QR */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
        {/* Sesi Penimbangan */}
        <div className="space-y-2.5 pb-4 border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-900">
              Sesi Penimbangan
            </span>
            <span className="text-[11px] text-slate-500">
              Terdeteksi otomatis sesuai jam saat ini
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-slate-100 border border-slate-200 rounded-lg">
            {SESI_PENIMBANGAN_OPTIONS.map((sesi) => {
              const active = sesiPenimbangan === sesi;
              const shortLabel =
                sesi === 'Sesi Pagi (10.30-11.00)'
                  ? 'Sesi Pagi (10.30-11.00)'
                  : sesi === 'Sesi Siang (12.30-13.00)'
                    ? 'Sesi Siang (12.30-13.00)'
                    : 'Insidental';
              return (
                <button
                  key={sesi}
                  type="button"
                  onClick={() => {
                    setSesiPenimbangan(sesi);
                    setSavedBanner(false);
                  }}
                  className={`px-2.5 py-2 min-h-[38px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>

          {sesiPenimbangan === 'Insidental' && (
            <div className="pt-1">
              <label
                htmlFor="keterangan-insidental"
                className="block text-[11px] font-semibold text-purple-800 mb-1"
              >
                Keterangan Kegiatan Insidental
              </label>
              <input
                id="keterangan-insidental"
                type="text"
                value={keteranganInsidental}
                onChange={(e) => {
                  setKeteranganInsidental(e.target.value);
                  setSavedBanner(false);
                }}
                placeholder="Contoh: Jumat Bersih, Acara OSIS, dll."
                className="w-full px-3 py-2 min-h-[38px] text-xs sm:text-sm bg-purple-50/50 border border-purple-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {/* Tanggal & Jam Penimbangan (Hanya tampil untuk Admin; Petugas Timbang otomatis memakai new Date()) */}
          {isAdmin && (
            <div className="pt-2">
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="input-waktu-penimbangan"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900"
                  >
                    <CalendarClock className="w-3.5 h-3.5 text-[#059669]" aria-hidden="true" />
                    <span>Tanggal &amp; Jam Penimbangan</span>
                  </label>
                  <span className="text-[11px] font-medium text-[#059669]">
                    Khusus Admin · Bisa Input Susulan
                  </span>
                </div>
                <input
                  id="input-waktu-penimbangan"
                  type="datetime-local"
                  value={waktuPenimbangan}
                  max={`${todayDateStr}T23:59`}
                  onChange={(e) => {
                    setWaktuPenimbangan(e.target.value || getNowDateTimeLocalValue());
                    setSavedBanner(false);
                  }}
                  className="w-full px-3 py-2 min-h-[40px] text-xs sm:text-sm font-mono bg-white border border-emerald-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
                />
              </div>
            </div>
          )}
        </div>

        {/* 1. Scan QR / Pilih Kelas & Berat */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              01. Scan QR Tong &amp; Input Berat
            </h3>
            <span className="font-mono text-xs font-semibold text-[#059669]">
              {qrCodeId}
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="qr-scan-input"
              className="block text-xs font-semibold text-slate-800"
            >
              Input Kode QR Tong (Opsional)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <QrCode
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="qr-scan-input"
                  type="text"
                  value={qrScanInput}
                  onChange={(e) => setQrScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyQrScan()}
                  placeholder="Contoh: QR-XI3-ORG atau hasil scan QR..."
                  className="w-full pl-9 pr-3 py-2 min-h-[40px] text-xs sm:text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyQrScan}
                className="px-3.5 py-2 min-h-[40px] text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shrink-0"
              >
                Terapkan QR
              </button>
            </div>
            {qrScanMsg && (
              <p className="text-xs text-[#059669] font-medium">{qrScanMsg}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="select-kelas"
                className="block text-xs font-semibold text-slate-800"
              >
                Kelas
              </label>
              <select
                id="select-kelas"
                value={kelas}
                onChange={(e) => {
                  setKelas(e.target.value);
                  setSavedBanner(false);
                }}
                className="w-full px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
              >
                {daftarKelas.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="input-berat"
                className="block text-xs font-semibold text-slate-800"
              >
                Berat (kg)
              </label>
              <input
                id="input-berat"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={beratKg}
                onChange={(e) => {
                  setBeratKg(e.target.value);
                  setSavedBanner(false);
                }}
                className="w-full px-3 py-2 min-h-[40px] text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="input-petugas"
                className="block text-xs font-semibold text-slate-800"
              >
                Petugas Timbang
              </label>
              <input
                id="input-petugas"
                type="text"
                value={petugasNama}
                onChange={(e) => setPetugasNama(e.target.value)}
                placeholder="Nama petugas"
                className="w-full px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-800">
              Kategori Tong QR
            </span>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 border border-slate-200 rounded-lg">
              {(['ORGANIK', 'NON-ORGANIK'] as const).map((kat) => {
                const active = kategoriTong === kat;
                return (
                  <button
                    key={kat}
                    type="button"
                    onClick={() => handleKategoriChange(kat)}
                    className={`py-2 px-3 min-h-[40px] text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                      active
                        ? kat === 'ORGANIK'
                          ? 'bg-[#059669] text-white shadow-xs'
                          : 'bg-[#D97706] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {kat === 'ORGANIK' ? 'ORGANIK (Hijau)' : 'NON-ORGANIK (Kuning)'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2. Status Pemilahan & Quick-Tags */}
        <div className="space-y-4 pt-3 border-t border-slate-200">
          <h3 className="text-base font-bold text-slate-900">
            02. Status Pemilahan &amp; Quick-Tags
          </h3>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-800">
              Status Pemilahan
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STATUS_PILAH_OPTIONS.map((status) => {
                const active = statusPetugas === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setStatusPetugas(status);
                      setSavedBanner(false);
                    }}
                    className={`px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-800">
              Quick-Tags Observasi
            </span>
            <div className="flex flex-wrap gap-2">
              {availableQuickTags.map((tag) => {
                const selected = quickTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border transition-colors ${
                      selected
                        ? 'bg-emerald-50 text-[#059669] border-[#059669]'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
              {quickTags
                .filter((t) => !availableQuickTags.includes(t))
                .map((custom) => (
                  <button
                    key={custom}
                    type="button"
                    onClick={() => handleToggleTag(custom)}
                    className="px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border bg-emerald-50 text-[#059669] border-[#059669]"
                  >
                    {custom} ×
                  </button>
                ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                placeholder="Tambah quick-tag lain..."
                className="flex-1 px-3 py-2 min-h-[40px] text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="px-3.5 py-2 min-h-[40px] text-xs font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-lg shrink-0"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Catatan Evaluasi & Simpan Penimbangan */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">
            03. Ringkasan &amp; Catatan Evaluasi Kelas
          </h3>
          <StatusLabel status={statusPetugas} />
        </div>

        {/* Context summary line */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-500">
          <SesiBadge
            sesi={sesiPenimbangan}
            keteranganInsidental={
              sesiPenimbangan === 'Insidental' ? keteranganInsidental : undefined
            }
          />
          <span aria-hidden="true">·</span>
          <span className="font-mono text-slate-700">
            {formatTanggalJamSingkat(effectiveTimeParts.isoTimestamp)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-slate-900">Kelas {kelas}</span>
          <span aria-hidden="true">·</span>
          <span
            className={`font-mono font-semibold ${
              kategoriTong === 'ORGANIK' ? 'text-[#059669]' : 'text-[#D97706]'
            }`}
          >
            {kategoriTong}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {parseFloat(beratKg || '0').toFixed(1)} kg
          </span>
          <span aria-hidden="true">·</span>
          <span>Petugas: {petugasNama || 'Petugas Caraka'}</span>
        </div>

        {saveError && (
          <div
            role="alert"
            className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed"
          >
            {saveError}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="catatan-evaluasi"
              className="block text-xs font-semibold text-slate-900"
            >
              Catatan Evaluasi Kelas (Otomatis dari Template · Dapat Diedit)
            </label>
            <div className="flex items-center gap-3">
              {hasEditedCatatan && (
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#059669] hover:underline"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>Terapkan Ulang Template</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyCatatan}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                {copiedNote ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#059669]" aria-hidden="true" />
                    <span className="text-[#059669]">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Salin Pesan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <textarea
            id="catatan-evaluasi"
            rows={5}
            value={catatanEvaluasi}
            onChange={(e) => {
              setHasEditedCatatan(true);
              setCatatanEvaluasi(e.target.value);
              setSavedBanner(false);
            }}
            className="w-full p-3.5 text-sm leading-relaxed bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
          />
          <p className="text-[11px] text-slate-500">
            Catatan dibuat otomatis sesuai Status Pemilahan dan Quick-Tags yang dipilih, dan dapat disesuaikan sebelum disimpan.
          </p>
        </div>

        {savedBanner ? (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[#059669]">
                  Penimbangan Tersimpan ke Papan Evaluasi
                </p>
                <p className="text-xs text-emerald-800">
                  Data timbangan kelas {kelas} ({parseFloat(beratKg || '0').toFixed(1)} kg) pada{' '}
                  {formatTanggalJamSingkat(effectiveTimeParts.isoTimestamp)} berhasil dicatat.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSavedBanner(false);
                  setHasEditedCatatan(false);
                }}
                className="px-3 py-2 min-h-[38px] text-xs font-medium bg-white border border-emerald-200 text-[#059669] hover:bg-emerald-100/50 rounded-lg whitespace-nowrap"
              >
                Catat Lagi
              </button>
              <button
                type="button"
                onClick={onOpenBoard}
                className="px-4 py-2 min-h-[38px] text-xs font-semibold bg-[#059669] text-white hover:bg-emerald-700 rounded-lg whitespace-nowrap"
              >
                Lihat Papan Evaluasi
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveToBoard}
            className="w-full min-h-[46px] px-5 py-3 bg-[#059669] hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#059669]"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{isSaving ? 'Menyimpan Penimbangan...' : 'Simpan Penimbangan'}</span>
          </button>
        )}
      </div>
    </section>
  );
};
