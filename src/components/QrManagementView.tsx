import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Search, Plus, Pencil, Trash2, Check, X, RefreshCw } from 'lucide-react';
import type { BinItem, ClassItem, KategoriTong } from '../types';
import { buildStandardQrCodeId } from '../lib/supabase';

interface QrManagementViewProps {
  classes: ClassItem[];
  bins: BinItem[];
  onCreateBin: (input: {
    class_id?: string | null;
    kelas: string;
    kategori: KategoriTong;
    qr_code_id?: string;
  }) => Promise<void>;
  onUpdateBin: (
    binId: string,
    updates: Partial<Pick<BinItem, 'kelas' | 'kategori' | 'qr_code_id' | 'class_id'>>
  ) => Promise<void>;
  onDeleteBin: (binId: string) => Promise<void>;
  onSyncBins: () => Promise<void>;
}

interface QrStickerItem {
  bin: BinItem;
  qrDataUrl: string;
}

export const QrManagementView: React.FC<QrManagementViewProps> = ({
  classes,
  bins,
  onCreateBin,
  onUpdateBin,
  onDeleteBin,
  onSyncBins,
}) => {
  const [searchKelas, setSearchKelas] = useState('');
  const [filterKategori, setFilterKategori] = useState<'SEMUA' | KategoriTong>('SEMUA');
  const [stickers, setStickers] = useState<QrStickerItem[]>([]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newKelas, setNewKelas] = useState(classes[0]?.name || '');
  const [newKategori, setNewKategori] = useState<KategoriTong>('ORGANIK');
  const [newQrCodeId, setNewQrCodeId] = useState('');

  const [editingBinId, setEditingBinId] = useState<string | null>(null);
  const [editQrCodeId, setEditQrCodeId] = useState('');
  const [editKategori, setEditKategori] = useState<KategoriTong>('ORGANIK');

  const [isBusy, setIsBusy] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!newKelas && classes.length > 0) {
      setNewKelas(classes[0].name);
    }
  }, [classes, newKelas]);

  useEffect(() => {
    let cancelled = false;
    async function generateAll() {
      const items: QrStickerItem[] = [];
      for (const bin of bins) {
        const payload = JSON.stringify({
          school: 'SMAN 1 Karang Bahagia',
          app: 'KAIZEN-O',
          kelas: bin.kelas,
          kategori: bin.kategori,
          codeId: bin.qr_code_id,
        });
        const qrDataUrl = await QRCode.toDataURL(payload, {
          width: 220,
          margin: 1,
          color: {
            dark: bin.kategori === 'ORGANIK' ? '#064E3B' : '#78350F',
            light: '#FFFFFF',
          },
        });
        items.push({ bin, qrDataUrl });
      }
      if (!cancelled) {
        setStickers(items);
      }
    }
    generateAll();
    return () => {
      cancelled = true;
    };
  }, [bins]);

  const filtered = stickers.filter(({ bin }) => {
    if (filterKategori !== 'SEMUA' && bin.kategori !== filterKategori) return false;
    if (
      searchKelas.trim() &&
      !bin.kelas.toLowerCase().includes(searchKelas.trim().toLowerCase()) &&
      !bin.qr_code_id.toLowerCase().includes(searchKelas.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 2400);
  };

  const handleAddBin = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetKelas = newKelas.trim().toUpperCase();
    if (!targetKelas) return;
    setErrorMsg(null);
    setIsBusy(true);
    try {
      const matchedClass = classes.find((c) => c.name.toUpperCase() === targetKelas);
      const qrId =
        newQrCodeId.trim().toUpperCase() || buildStandardQrCodeId(targetKelas, newKategori);
      await onCreateBin({
        class_id: matchedClass?.id ?? null,
        kelas: targetKelas,
        kategori: newKategori,
        qr_code_id: qrId,
      });
      setNewQrCodeId('');
      setShowAddForm(false);
      showFeedback(`Tong QR ${qrId} berhasil ditambahkan`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menambahkan tong QR.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveEdit = async (bin: BinItem) => {
    const qrId = editQrCodeId.trim().toUpperCase();
    if (!qrId) return;
    setErrorMsg(null);
    setIsBusy(true);
    try {
      await onUpdateBin(bin.id, {
        kategori: editKategori,
        qr_code_id: qrId,
      });
      setEditingBinId(null);
      showFeedback(`Tong QR ${qrId} diperbarui`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui tong QR.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteBin = async (bin: BinItem) => {
    setErrorMsg(null);
    setIsBusy(true);
    try {
      await onDeleteBin(bin.id);
      showFeedback(`Tong QR ${bin.qr_code_id} dihapus`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus tong QR.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSync = async () => {
    setErrorMsg(null);
    setIsBusy(true);
    try {
      await onSyncBins();
      showFeedback('Tong QR seluruh kelas berhasil disinkronkan');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyinkronkan tong QR.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      {(feedbackMsg || errorMsg) && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2 print:hidden ${
            errorMsg
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-[#059669]'
          }`}
        >
          {!errorMsg && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
          <span>{errorMsg || feedbackMsg}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchKelas}
                onChange={(e) => setSearchKelas(e.target.value)}
                placeholder="Filter kelas atau kode QR..."
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
                  {kat === 'SEMUA' ? 'Semua Stiker' : kat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isBusy || classes.length === 0}
              onClick={handleSync}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sinkronkan Tong Kelas</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tambah Tong QR</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold bg-[#059669] hover:bg-emerald-700 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              <span>Cetak Stiker QR ({filtered.length})</span>
            </button>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddBin}
            className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Kelas</label>
              <select
                value={newKelas}
                onChange={(e) => setNewKelas(e.target.value)}
                className="w-full px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Kategori Tong</label>
              <select
                value={newKategori}
                onChange={(e) => setNewKategori(e.target.value as KategoriTong)}
                className="w-full px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              >
                <option value="ORGANIK">ORGANIK</option>
                <option value="NON-ORGANIK">NON-ORGANIK</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Kode QR (opsional)
              </label>
              <input
                type="text"
                value={newQrCodeId}
                onChange={(e) => setNewQrCodeId(e.target.value)}
                placeholder={
                  newKelas ? buildStandardQrCodeId(newKelas, newKategori) : 'QR-XI3-ORG'
                }
                className="w-full px-3 py-2 min-h-[40px] text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isBusy}
                className="flex-1 px-4 py-2 min-h-[40px] text-xs font-semibold bg-[#059669] hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg"
              >
                Simpan Tong
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 min-h-[40px] text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Printable Sticker Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            Belum ada tong QR yang terdaftar atau sesuai filter
          </p>
          <p className="text-xs text-slate-500">
            Klik &ldquo;Sinkronkan Tong Kelas&rdquo; untuk membuat stiker QR Organik &amp; Non-Organik otomatis dari daftar kelas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-2 print:gap-4">
          {filtered.map(({ bin, qrDataUrl }) => {
            const isOrganik = bin.kategori === 'ORGANIK';
            const isEditing = editingBinId === bin.id;
            return (
              <article
                key={bin.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col break-inside-avoid"
              >
                <div
                  className={`px-4 py-2.5 flex items-center justify-between text-white ${
                    isOrganik ? 'bg-[#059669]' : 'bg-[#D97706]'
                  }`}
                >
                  <span className="font-display text-xs font-bold tracking-wide">
                    TONG {bin.kategori}
                  </span>
                  <span className="font-mono text-xs font-semibold">{bin.kelas}</span>
                </div>

                <div className="p-5 flex flex-col items-center text-center space-y-3 flex-1">
                  <div className="p-2 bg-white border border-slate-200 rounded-lg">
                    <img
                      src={qrDataUrl}
                      alt={`Kode QR ${bin.qr_code_id}`}
                      className="w-36 h-36 object-contain"
                    />
                  </div>

                  {isEditing ? (
                    <div className="w-full space-y-2 print:hidden">
                      <select
                        value={editKategori}
                        onChange={(e) => setEditKategori(e.target.value as KategoriTong)}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md"
                      >
                        <option value="ORGANIK">ORGANIK</option>
                        <option value="NON-ORGANIK">NON-ORGANIK</option>
                      </select>
                      <input
                        type="text"
                        value={editQrCodeId}
                        onChange={(e) => setEditQrCodeId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
                      />
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSaveEdit(bin)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#059669] text-white rounded-md"
                        >
                          <Check className="w-3 h-3" aria-hidden="true" />
                          <span>Simpan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBinId(null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-100 text-slate-700 rounded-md"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                          <span>Batal</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="font-mono text-xs font-bold text-slate-900">
                        {bin.qr_code_id}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        SMAN 1 Karang Bahagia · KAIZEN-O
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-600 leading-snug pt-2 border-t border-slate-100 w-full">
                    {isOrganik
                      ? 'Khusus sisa makanan, daun kering, kulit buah, & ampas teh/kopi.'
                      : 'Khusus botol plastik, kemasan snack, kertas, kardus, kaleng & kaca.'}
                  </p>

                  {!isEditing && (
                    <div className="flex items-center justify-end gap-2 w-full pt-1 print:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBinId(bin.id);
                          setEditQrCodeId(bin.qr_code_id);
                          setEditKategori(bin.kategori);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-50"
                      >
                        <Pencil className="w-3 h-3" aria-hidden="true" />
                        <span>Ubah</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteBin(bin)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

