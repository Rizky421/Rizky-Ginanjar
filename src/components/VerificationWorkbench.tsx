import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Code2,
  RotateCcw,
  Upload,
  ImageOff,
  QrCode,
} from 'lucide-react';
import {
  INITIAL_MASTER_DATA,
  SAMPLE_PHOTOS,
  SESI_PENIMBANGAN_OPTIONS,
  STATUS_PILAH_OPTIONS,
  detectCurrentSesi,
} from '../constants';
import type {
  EvaluasiRecord,
  KategoriTong,
  SesiPenimbangan,
  StatusPilah,
  VerifikasiHasil,
} from '../types';
import { StatusLabel } from './StatusLabel';
import { SesiBadge } from './SesiBadge';

interface VerificationWorkbenchProps {
  daftarKelas?: string[];
  quickTagsOrganik?: string[];
  quickTagsNonOrganik?: string[];
  onSaveEvaluation: (record: Omit<EvaluasiRecord, 'id' | 'waktuCatat'>) => Promise<void>;
  onOpenBoard: () => void;
  resetSignal: number;
}

async function compressDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Berkas gambar kosong.'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: result, mimeType: file.type || 'image/jpeg' });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ dataUrl: compressed, mimeType: 'image/jpeg' });
      };
      img.onerror = () => resolve({ dataUrl: result, mimeType: file.type || 'image/jpeg' });
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export const VerificationWorkbench: React.FC<VerificationWorkbenchProps> = ({
  daftarKelas = INITIAL_MASTER_DATA.daftarKelas,
  quickTagsOrganik = INITIAL_MASTER_DATA.quickTagsOrganik,
  quickTagsNonOrganik = INITIAL_MASTER_DATA.quickTagsNonOrganik,
  onSaveEvaluation,
  onOpenBoard,
  resetSignal,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [sesiPenimbangan, setSesiPenimbangan] = useState<SesiPenimbangan>(() =>
    detectCurrentSesi()
  );
  const [keteranganInsidental, setKeteranganInsidental] = useState<string>('');
  const [kelas, setKelas] = useState<string>('XI-3');
  const [kategoriTong, setKategoriTong] = useState<KategoriTong>('ORGANIK');
  const [qrScanInput, setQrScanInput] = useState<string>('');
  const [qrScanMsg, setQrScanMsg] = useState<string | null>(null);
  const [beratKg, setBeratKg] = useState<string>('2.4');
  const [statusPetugas, setStatusPetugas] = useState<StatusPilah>('Tercampur Ringan');
  const [quickTags, setQuickTags] = useState<string[]>(['Plastik di tong organik']);
  const [customTag, setCustomTag] = useState<string>('');
  const [petugasNama, setPetugasNama] = useState<string>('Tim Pokja Adiwiyata');

  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [selectedSamplePath, setSelectedSamplePath] = useState<string>(SAMPLE_PHOTOS[0].path);
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [uploadedMimeType, setUploadedMimeType] = useState<string>('image/jpeg');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState<boolean>(false);

  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [hasil, setHasil] = useState<VerifikasiHasil | null>(null);
  const [editableCatatan, setEditableCatatan] = useState<string>('');
  const [selectedFinalStatus, setSelectedFinalStatus] = useState<StatusPilah>('Tercampur Ringan');
  const [showJson, setShowJson] = useState<boolean>(false);
  const [copiedNote, setCopiedNote] = useState<boolean>(false);
  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  React.useEffect(() => {
    if (resetSignal > 0) {
      setHasil(null);
      setVerifyError(null);
      setSavedBanner(false);
    }
  }, [resetSignal]);

  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const qrCodeId = `QR-${kelas.replace(/[^A-Za-z0-9]/g, '')}-${kategoriTong === 'ORGANIK' ? 'ORG' : 'NON'}`;
  const availableQuickTags =
    kategoriTong === 'ORGANIK' ? quickTagsOrganik : quickTagsNonOrganik;
  const activePreviewUrl = uploadedDataUrl || selectedSamplePath;

  const handleApplyQrScan = () => {
    const raw = qrScanInput.trim();
    if (!raw) return;
    setQrScanMsg(null);

    try {
      const parsed = JSON.parse(raw) as { kelas?: string; kategori?: KategoriTong };
      if (parsed.kelas && (parsed.kategori === 'ORGANIK' || parsed.kategori === 'NON-ORGANIK')) {
        setKelas(parsed.kelas);
        setKategoriTong(parsed.kategori);
        setQuickTags([]);
        setHasil(null);
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
      setHasil(null);
      setQrScanMsg(`QR terbaca: Kelas ${matchedKelas} (${kat})`);
    } else {
      setQrScanMsg('Format QR tidak dikenali. Gunakan format seperti QR-XI3-ORG atau QR-X2-NON.');
    }
  };

  const handleStartCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Perangkat atau browser ini tidak mendukung akses kamera langsung. Gunakan unggah foto.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      setCameraError('Izin kamera ditolak atau tidak tersedia. Silakan unggah berkas foto atau pilih sampel.');
    }
  };

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const handleCaptureCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setUploadedDataUrl(dataUrl);
    setUploadedMimeType('image/jpeg');
    setUploadedFileName(`kamera-${qrCodeId}.jpg`);
    setImageLoadFailed(false);
    setHasil(null);
    handleStopCamera();
  };

  const handleToggleTag = (tag: string) => {
    setQuickTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    const trimmed = customTag.trim();
    if (!trimmed) return;
    if (!quickTags.includes(trimmed)) {
      setQuickTags((prev) => [...prev, trimmed]);
    }
    setCustomTag('');
  };

  const handleKategoriChange = (next: KategoriTong) => {
    setKategoriTong(next);
    setQuickTags([]);
    setHasil(null);
    setSavedBanner(false);
  };

  const handleSelectSample = (samplePath: string) => {
    setUploadedDataUrl(null);
    setUploadedFileName(null);
    setSelectedSamplePath(samplePath);
    setImageLoadFailed(false);
    setHasil(null);
    setVerifyError(null);
    setSavedBanner(false);
  };

  const handleApplySampleScenario = () => {
    const matched = SAMPLE_PHOTOS.find((s) => s.path === selectedSamplePath);
    if (!matched) return;
    setKategoriTong(matched.suggestedKategori);
    setStatusPetugas(matched.suggestedStatus);
    setQuickTags(matched.suggestedTags);
    setHasil(null);
    setSavedBanner(false);
  };

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    setVerifyError(null);
    setSavedBanner(false);
    try {
      const { dataUrl, mimeType } = await compressDataUrl(file);
      setUploadedDataUrl(dataUrl);
      setUploadedMimeType(mimeType);
      setUploadedFileName(file.name);
      setImageLoadFailed(false);
      setHasil(null);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Gagal memuat foto.');
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyError(null);
    setSavedBanner(false);

    try {
      const response = await fetch('/api/verify-waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kelas,
          kategoriTong,
          sesiPenimbangan,
          keteranganInsidental:
            sesiPenimbangan === 'Insidental' ? keteranganInsidental : undefined,
          beratKg: parseFloat(beratKg) || 0,
          statusPetugas,
          quickTags,
          imageBase64: uploadedDataUrl || undefined,
          imageMimeType: uploadedDataUrl ? uploadedMimeType : undefined,
          sampleImagePath: uploadedDataUrl ? undefined : selectedSamplePath,
        }),
      });

      const payload = (await response.json()) as { result?: VerifikasiHasil; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || 'Gagal memverifikasi foto tong sampah.');
      }

      setHasil(payload.result);
      setEditableCatatan(payload.result.catatan_evaluasi_kelas);
      setSelectedFinalStatus(payload.result.saran_status_pilah);
    } catch (err) {
      setVerifyError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan jaringan saat menghubungi layanan verifikasi.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveToBoard = async () => {
    if (!hasil) return;
    setIsSaving(true);
    setVerifyError(null);
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
        imageUrl: activePreviewUrl,
        petugasNama,
        hasil: {
          ...hasil,
          catatan_evaluasi_kelas: editableCatatan.trim() || hasil.catatan_evaluasi_kelas,
          saran_status_pilah: selectedFinalStatus,
        },
      });
      setSavedBanner(true);
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : 'Gagal menyimpan hasil ke Papan Evaluasi.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCatatan = async () => {
    if (!editableCatatan) return;
    try {
      await navigator.clipboard.writeText(editableCatatan);
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2000);
    } catch {
      // ignore
    }
  };

  const activeSampleMeta = !uploadedDataUrl
    ? SAMPLE_PHOTOS.find((s) => s.path === selectedSamplePath)
    : null;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Input Penimbangan & Foto */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
        {/* Waktu / Sesi Penimbangan (Segmented Buttons) */}
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
                    setHasil(null);
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
              <label htmlFor="ket-insidental" className="sr-only">
                Keterangan kegiatan insidental
              </label>
              <input
                id="ket-insidental"
                type="text"
                value={keteranganInsidental}
                onChange={(e) => setKeteranganInsidental(e.target.value)}
                placeholder="Contoh: Jumat Bersih, Acara OSIS, dll."
                className="w-full px-3 py-2 min-h-[38px] text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]"
              />
            </div>
          )}
        </div>

        {/* 1. Identitas Tong & QR */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              01. Pindai QR & Data Penimbangan
            </h3>
            <span
              className={`font-mono text-xs font-semibold ${
                kategoriTong === 'ORGANIK' ? 'text-[#059669]' : 'text-[#D97706]'
              }`}
            >
              {qrCodeId}
            </span>
          </div>

          {/* QR Input / Quick Decode */}
          <div className="space-y-1.5">
            <label htmlFor="qr-scan-input" className="block text-xs font-semibold text-slate-800">
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
                onChange={(e) => setKelas(e.target.value)}
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
                onChange={(e) => setBeratKg(e.target.value)}
                className="w-full px-3 py-2 min-h-[40px] text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="input-petugas"
                className="block text-xs font-semibold text-slate-800"
              >
                Petugas Piket
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

        {/* 2. Input Petugas */}
        <div className="space-y-4 pt-3 border-t border-slate-200">
          <h3 className="text-base font-bold text-slate-900">
            02. Observasi Status & Quick-Tags
          </h3>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-800">
              Status dari Petugas
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STATUS_PILAH_OPTIONS.map((status) => {
                const active = statusPetugas === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusPetugas(status)}
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
              Quick-Tags Petugas
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

        {/* 3. Foto Isi Tong */}
        <div className="space-y-4 pt-3 border-t border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">
              03. Foto Bukti Isi Tong
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={cameraOpen ? handleStopCamera : handleStartCamera}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
              >
                <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{cameraOpen ? 'Tutup Kamera' : 'Kamera HP'}</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] hover:underline"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Unggah Foto</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
            </div>
          </div>

          {cameraError && (
            <p className="text-xs text-[#D97706] bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              {cameraError}
            </p>
          )}

          {cameraOpen && (
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 space-y-2 p-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[4/3] object-cover rounded-lg"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleStopCamera}
                  className="px-3 py-1.5 text-xs text-white/80 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCaptureCamera}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#059669] text-white rounded-lg"
                >
                  Ambil Foto Tong
                </button>
              </div>
            </div>
          )}

          {/* Active Photo Preview */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileUpload(e.dataTransfer.files?.[0]);
            }}
            className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200"
          >
            {imageLoadFailed ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
                <ImageOff className="w-8 h-8" aria-hidden="true" />
                <p className="text-sm font-medium">Pratinjau foto tidak dapat dimuat</p>
              </div>
            ) : (
              <img
                src={activePreviewUrl}
                alt={`Pratinjau foto tong sampah kelas ${kelas}`}
                referrerPolicy="no-referrer"
                onError={() => setImageLoadFailed(true)}
                className="w-full h-full object-cover"
              />
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">
                  {uploadedFileName
                    ? `Foto Unggahan: ${uploadedFileName}`
                    : activeSampleMeta?.label || 'Foto Sampel Lapangan'}
                </p>
                {activeSampleMeta && (
                  <p className="text-[11px] text-white/80 truncate">
                    {activeSampleMeta.description}
                  </p>
                )}
              </div>

              {activeSampleMeta &&
                (activeSampleMeta.suggestedKategori !== kategoriTong ||
                  activeSampleMeta.suggestedStatus !== statusPetugas) && (
                  <button
                    type="button"
                    onClick={handleApplySampleScenario}
                    className="px-2.5 py-1.5 text-[11px] font-medium bg-white/95 text-slate-900 hover:bg-white rounded-md whitespace-nowrap shrink-0"
                  >
                    Samakan Input ke Sampel
                  </button>
                )}
            </div>
          </div>

          {/* Sample Photos Selector */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">
              Pilih foto sampel lapangan untuk uji cepat:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SAMPLE_PHOTOS.map((sample) => {
                const isActive = !uploadedDataUrl && selectedSamplePath === sample.path;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSelectSample(sample.path)}
                    className={`group text-left rounded-lg overflow-hidden border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] ${
                      isActive
                        ? 'border-[#059669] ring-1 ring-[#059669]'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                      <img
                        src={sample.path}
                        alt={sample.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                      />
                    </div>
                    <div className="p-2 bg-white">
                      <p className="text-[11px] font-semibold text-slate-900 truncate">
                        {sample.suggestedKategori}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {sample.suggestedStatus}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={isVerifying}
          onClick={handleVerify}
          className="w-full min-h-[46px] px-5 py-3 bg-[#059669] hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#059669]"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          <span>
            {isVerifying
              ? 'Sedang Memverifikasi Foto Tong...'
              : 'Verifikasi Foto dengan Asisten Adiwiyata'}
          </span>
        </button>
      </div>

      {/* Right Column: Hasil Evaluasi Asisten Adiwiyata */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">
            Hasil Verifikasi & Catatan Evaluasi AI
          </h3>
          {hasil && (
            <button
              type="button"
              onClick={() => setShowJson((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap"
            >
              <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showJson ? 'Sembunyikan JSON' : 'Lihat Output JSON'}</span>
            </button>
          )}
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
          <span className="font-semibold text-slate-900">Kelas {kelas}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">Tong QR: {kategoriTong}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{parseFloat(beratKg || '0').toFixed(1)} kg</span>
          <span aria-hidden="true">·</span>
          <span>Petugas: {statusPetugas}</span>
        </div>

        {verifyError && (
          <div
            role="alert"
            className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm space-y-2"
          >
            <p className="font-semibold">Verifikasi belum dapat diproses</p>
            <p className="text-xs leading-relaxed">{verifyError}</p>
            <button
              type="button"
              onClick={handleVerify}
              className="inline-flex items-center gap-1.5 text-xs font-semibold underline"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Coba Verifikasi Ulang</span>
            </button>
          </div>
        )}

        {isVerifying ? (
          <div className="space-y-4 animate-pulse py-2">
            <div className="h-6 w-48 bg-slate-100 rounded" />
            <div className="h-20 w-full bg-slate-100 rounded-lg" />
            <div className="h-28 w-full bg-slate-100 rounded-lg" />
            <div className="h-10 w-52 bg-slate-100 rounded-lg" />
          </div>
        ) : !hasil ? (
          <div className="py-10 px-4 text-center space-y-3 border border-dashed border-slate-300 rounded-xl bg-slate-50/70">
            <p className="text-sm font-semibold text-slate-900">
              Siap memverifikasi foto sampah kelas {kelas}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Asisten AI akan mencocokkan foto isi tong dengan kategori QR ({kategoriTong}) dan observasi petugas ({quickTags.length > 0 ? quickTags.join(', ') : 'tanpa quick-tag'}), lalu menyusun catatan sopan untuk papan evaluasi kelas.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-slate-200">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Kesesuaian Visual Foto</p>
                {hasil.kesesuaian_visual ? (
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#059669]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Sesuai Kategori Tong QR</span>
                  </p>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#D97706]">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Ditemukan Sampah Tercampur</span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-500">Rekomendasi Status Pilah</p>
                <div>
                  <StatusLabel status={selectedFinalStatus} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-900">
                Benda Salah Tempat Terdeteksi
              </h4>
              {hasil.benda_salah_tempat.length === 0 ? (
                <p className="text-sm text-[#059669]">
                  Tidak ditemukan benda yang salah tempat pada foto tong ini.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {hasil.benda_salah_tempat.map((benda, idx) => (
                    <li
                      key={`${benda}-${idx}`}
                      className="flex items-start gap-2 text-sm text-slate-900"
                    >
                      <span className="font-mono text-xs text-[#D97706] mt-0.5">
                        0{idx + 1}.
                      </span>
                      <span>{benda}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-900">
                Konfirmasi Status untuk Papan Kelas
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {STATUS_PILAH_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSelectedFinalStatus(status)}
                    className={`px-3 py-2 min-h-[38px] text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      selectedFinalStatus === status
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="catatan-evaluasi"
                  className="block text-xs font-semibold text-slate-900"
                >
                  Catatan Evaluasi Kelas (Dibaca Siswa & Wali Kelas)
                </label>
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

              <textarea
                id="catatan-evaluasi"
                rows={4}
                value={editableCatatan}
                onChange={(e) => setEditableCatatan(e.target.value)}
                className="w-full p-3.5 text-sm leading-relaxed bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
              />
            </div>

            {showJson && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500">
                  Output JSON Terstruktur
                </p>
                <pre className="p-3.5 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                  {JSON.stringify(
                    {
                      kesesuaian_visual: hasil.kesesuaian_visual,
                      benda_salah_tempat: hasil.benda_salah_tempat,
                      catatan_evaluasi_kelas: editableCatatan,
                      saran_status_pilah: selectedFinalStatus,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            {savedBanner ? (
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-[#059669]">
                    Tersimpan ke Papan Evaluasi Kelas
                  </p>
                  <p className="text-xs text-emerald-800">
                    Catatan evaluasi untuk kelas {kelas} kini tampil bagi siswa dan wali kelas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenBoard}
                  className="px-4 py-2 min-h-[38px] text-xs font-semibold bg-[#059669] text-white hover:bg-emerald-700 rounded-lg whitespace-nowrap shrink-0"
                >
                  Lihat Papan Evaluasi
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveToBoard}
                  className="flex-1 min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan ke Papan Evaluasi Kelas'}
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  Analisis Ulang
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
