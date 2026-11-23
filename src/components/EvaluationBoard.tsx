import React, { useMemo, useState } from 'react';
import { Copy, Check, Search, Trash2, Pencil, X } from 'lucide-react';
import { SESI_PENIMBANGAN_OPTIONS, STATUS_PILAH_OPTIONS } from '../constants';
import type {
  EvaluasiRecord,
  KategoriTong,
  Role,
  SesiPenimbangan,
  StatusPilah,
} from '../types';
import { StatusLabel } from './StatusLabel';
import { SesiBadge } from './SesiBadge';

interface EvaluationBoardProps {
  evaluations: EvaluasiRecord[];
  isLoading: boolean;
  currentRole: Role;
  onUpdateEvaluation: (
    id: string,
    updates: {
      beratKg: number;
      sesiPenimbangan: SesiPenimbangan;
      keteranganInsidental?: string;
      statusPetugas: StatusPilah;
      hasil: EvaluasiRecord['hasil'];
    }
  ) => Promise<void>;
  onDeleteEvaluation: (id: string) => Promise<void>;
  onGoToVerify: () => void;
}

function formatWaktu(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export const EvaluationBoard: React.FC<EvaluationBoardProps> = ({
  evaluations,
  isLoading,
  currentRole,
  onUpdateEvaluation,
  onDeleteEvaluation,
  onGoToVerify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterSesi, setFilterSesi] = useState<'SEMUA' | SesiPenimbangan>('SEMUA');
  const [filterKategori, setFilterKategori] = useState<'SEMUA' | KategoriTong>('SEMUA');
  const [filterStatus, setFilterStatus] = useState<'SEMUA' | StatusPilah>('SEMUA');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBeratKg, setEditBeratKg] = useState<string>('0');
  const [editSesi, setEditSesi] = useState<SesiPenimbangan>('Sesi Pagi (10.30-11.00)');
  const [editInsidental, setEditInsidental] = useState<string>('');
  const [editStatus, setEditStatus] = useState<StatusPilah>('Terpilah Sempurna');
  const [editCatatan, setEditCatatan] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [boardError, setBoardError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = evaluations.length;
    const sempurnaCount = evaluations.filter(
      (item) => item.hasil.saran_status_pilah === 'Terpilah Sempurna'
    ).length;
    const compliancePct = total > 0 ? Math.round((sempurnaCount / total) * 100) : 0;
    const organikKg = evaluations
      .filter((item) => item.kategoriTong === 'ORGANIK')
      .reduce((acc, item) => acc + (Number(item.beratKg) || 0), 0);
    const nonOrganikKg = evaluations
      .filter((item) => item.kategoriTong === 'NON-ORGANIK')
      .reduce((acc, item) => acc + (Number(item.beratKg) || 0), 0);

    return { total, compliancePct, organikKg, nonOrganikKg };
  }, [evaluations]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return evaluations.filter((item) => {
      if (filterSesi !== 'SEMUA' && item.sesiPenimbangan !== filterSesi) {
        return false;
      }
      if (filterKategori !== 'SEMUA' && item.kategoriTong !== filterKategori) {
        return false;
      }
      if (filterStatus !== 'SEMUA' && item.hasil.saran_status_pilah !== filterStatus) {
        return false;
      }
      if (filterDate) {
        const itemDate = item.waktuCatat.slice(0, 10);
        if (itemDate !== filterDate) return false;
      }
      if (!query) {
        return true;
      }
      const inKelas = item.kelas.toLowerCase().includes(query);
      const inCatatan = item.hasil.catatan_evaluasi_kelas.toLowerCase().includes(query);
      const inItems = item.hasil.benda_salah_tempat.some((b) =>
        b.toLowerCase().includes(query)
      );
      return inKelas || inCatatan || inItems;
    });
  }, [evaluations, filterSesi, filterKategori, filterStatus, filterDate, searchQuery]);

  const handleCopy = async (record: EvaluasiRecord) => {
    const text = `Evaluasi Adiwiyata Kelas ${record.kelas} (${record.kategoriTong}) — ${record.hasil.saran_status_pilah}: ${record.hasil.catatan_evaluasi_kelas}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(record.id);
      setTimeout(() => setCopiedId((prev) => (prev === record.id ? null : prev)), 2000);
    } catch {
      // ignore
    }
  };

  const canModify = currentRole === 'Admin' || currentRole === 'Petugas Timbang';

  const startEdit = (record: EvaluasiRecord) => {
    setBoardError(null);
    setConfirmDeleteId(null);
    setEditingId(record.id);
    setEditBeratKg(String(record.beratKg));
    setEditSesi(record.sesiPenimbangan);
    setEditInsidental(record.keteranganInsidental || '');
    setEditStatus(record.hasil.saran_status_pilah);
    setEditCatatan(record.hasil.catatan_evaluasi_kelas);
  };

  const handleSaveEdit = async (record: EvaluasiRecord) => {
    setBoardError(null);
    setIsUpdating(true);
    try {
      await onUpdateEvaluation(record.id, {
        beratKg: parseFloat(editBeratKg) || 0,
        sesiPenimbangan: editSesi,
        keteranganInsidental:
          editSesi === 'Insidental' ? editInsidental.trim() || undefined : undefined,
        statusPetugas: editStatus,
        hasil: {
          ...record.hasil,
          kesesuaian_visual: editStatus === 'Terpilah Sempurna',
          saran_status_pilah: editStatus,
          catatan_evaluasi_kelas:
            editCatatan.trim() || record.hasil.catatan_evaluasi_kelas,
        },
      });
      setEditingId(null);
    } catch (err) {
      setBoardError(
        err instanceof Error ? err.message : 'Gagal memperbarui catatan evaluasi.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="space-y-6">
      {boardError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium"
        >
          {boardError}
        </div>
      )}
      {/* 4-column metric strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-4 sm:p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Total Penimbangan</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {stats.total} <span className="text-sm font-normal text-slate-500">tong</span>
          </p>
        </div>
        <div className="p-4 sm:p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Terpilah Sempurna</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#059669]">
            {stats.compliancePct}%
          </p>
        </div>
        <div className="p-4 sm:p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Total Sampah Organik</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#059669]">
            {stats.organikKg.toFixed(1)}{' '}
            <span className="text-sm font-normal text-slate-500">kg</span>
          </p>
        </div>
        <div className="p-4 sm:p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Total Sampah Non-Organik</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#D97706]">
            {stats.nonOrganikKg.toFixed(1)}{' '}
            <span className="text-sm font-normal text-slate-500">kg</span>
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kelas, catatan evaluasi, atau benda..."
              className="w-full pl-9 pr-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]"
            />
          </div>

          <input
            type="date"
            aria-label="Filter tanggal penimbangan"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 min-h-[40px] text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
          />

          <select
            aria-label="Filter sesi penimbangan"
            value={filterSesi}
            onChange={(e) => setFilterSesi(e.target.value as 'SEMUA' | SesiPenimbangan)}
            className="px-3 py-2 min-h-[40px] text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
          >
            <option value="SEMUA">Semua Sesi</option>
            {SESI_PENIMBANGAN_OPTIONS.map((sesi) => (
              <option key={sesi} value={sesi}>
                {sesi === 'Sesi Pagi (10.30-11.00)'
                  ? 'Sesi Pagi'
                  : sesi === 'Sesi Siang (12.30-13.00)'
                    ? 'Sesi Siang'
                    : 'Insidental'}
              </option>
            ))}
          </select>

          {filterDate && (
            <button
              type="button"
              onClick={() => setFilterDate('')}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Reset Tanggal
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg">
            {(['SEMUA', 'ORGANIK', 'NON-ORGANIK'] as const).map((kat) => (
              <button
                key={kat}
                type="button"
                onClick={() => setFilterKategori(kat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterKategori === kat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {kat === 'SEMUA' ? 'Semua Tong' : kat}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg overflow-x-auto max-w-full">
            {(
              [
                'SEMUA',
                'Terpilah Sempurna',
                'Tercampur Ringan',
                'Tidak Dipilah',
              ] as const
            ).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterStatus === status
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'SEMUA' ? 'Semua Status' : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Evaluation List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse space-y-3"
            >
              <div className="h-4 w-56 bg-slate-100 rounded" />
              <div className="h-5 w-40 bg-slate-100 rounded" />
              <div className="h-14 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">
            Belum ada catatan evaluasi yang sesuai filter
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Ubah filter pencarian/tanggal atau lakukan pemindaian baru pada menu Scanner QR & Timbang.
          </p>
          {canModify && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onGoToVerify}
                className="px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-[#059669] hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Buka Scanner QR & Timbang
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((record) => (
              <article
                key={record.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3"
              >
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="font-display text-sm font-bold text-slate-900">
                          Kelas {record.kelas}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-mono font-semibold ${
                            record.kategoriTong === 'ORGANIK'
                              ? 'text-[#059669]'
                              : 'text-[#D97706]'
                          }`}
                        >
                          {record.kategoriTong}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{record.qrCodeId}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {Number(record.beratKg).toFixed(1)} kg
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatWaktu(record.waktuCatat)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <SesiBadge
                          sesi={record.sesiPenimbangan}
                          keteranganInsidental={record.keteranganInsidental}
                        />
                        <StatusLabel status={record.hasil.saran_status_pilah} />
                      </div>
                    </div>

                    {editingId === record.id ? (
                      <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              Berat (kg)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={editBeratKg}
                              onChange={(e) => setEditBeratKg(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              Sesi Penimbangan
                            </label>
                            <select
                              value={editSesi}
                              onChange={(e) =>
                                setEditSesi(e.target.value as SesiPenimbangan)
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                            >
                              {SESI_PENIMBANGAN_OPTIONS.map((sesi) => (
                                <option key={sesi} value={sesi}>
                                  {sesi}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              Status Pemilahan
                            </label>
                            <select
                              value={editStatus}
                              onChange={(e) =>
                                setEditStatus(e.target.value as StatusPilah)
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                            >
                              {STATUS_PILAH_OPTIONS.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {editSesi === 'Insidental' && (
                          <input
                            type="text"
                            value={editInsidental}
                            onChange={(e) => setEditInsidental(e.target.value)}
                            placeholder="Keterangan kegiatan insidental..."
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                          />
                        )}

                        <textarea
                          rows={2}
                          value={editCatatan}
                          onChange={(e) => setEditCatatan(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md leading-relaxed"
                        />

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Batal</span>
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleSaveEdit(record)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#059669] hover:bg-emerald-700 disabled:opacity-60 text-white rounded-md"
                          >
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm sm:text-[15px] text-slate-800 leading-relaxed">
                          {record.hasil.catatan_evaluasi_kelas}
                        </p>

                        {record.hasil.benda_salah_tempat.length > 0 && (
                          <p className="text-xs text-slate-600">
                            <span className="font-semibold text-[#D97706]">
                              Benda salah tempat:
                            </span>{' '}
                            {record.hasil.benda_salah_tempat.join(', ')}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>Input petugas: {record.statusPetugas}</span>
                      {record.quickTags.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{record.quickTags.join(', ')}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(record)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 py-1 px-2 rounded-md hover:bg-slate-50 transition-colors"
                      >
                        {copiedId === record.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#059669]" aria-hidden="true" />
                            <span className="text-[#059669]">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Salin Catatan</span>
                          </>
                        )}
                      </button>

                      {canModify && editingId !== record.id && (
                        <button
                          type="button"
                          onClick={() => startEdit(record)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 py-1 px-2 rounded-md hover:bg-slate-50 transition-colors"
                          aria-label={`Ubah evaluasi kelas ${record.kelas}`}
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Ubah</span>
                        </button>
                      )}

                      {canModify &&
                        (confirmDeleteId === record.id ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await onDeleteEvaluation(record.id);
                                  setConfirmDeleteId(null);
                                } catch (err) {
                                  setBoardError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Gagal menghapus catatan evaluasi.'
                                  );
                                }
                              }}
                              className="text-xs font-semibold text-red-600 hover:underline"
                            >
                              Konfirmasi Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-slate-500 hover:text-slate-900"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(record.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 py-1 px-2 rounded-md hover:bg-slate-50 transition-colors"
                            aria-label={`Hapus evaluasi kelas ${record.kelas}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Hapus</span>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </article>
          ))}
        </div>
      )}
    </section>
  );
};
