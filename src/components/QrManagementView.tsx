import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Search } from 'lucide-react';
import type { KategoriTong } from '../types';

interface QrManagementViewProps {
  daftarKelas: string[];
}

interface QrStickerItem {
  kelas: string;
  kategori: KategoriTong;
  codeId: string;
  qrDataUrl: string;
}

export const QrManagementView: React.FC<QrManagementViewProps> = ({
  daftarKelas,
}) => {
  const [searchKelas, setSearchKelas] = useState('');
  const [filterKategori, setFilterKategori] = useState<'SEMUA' | KategoriTong>('SEMUA');
  const [stickers, setStickers] = useState<QrStickerItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function generateAll() {
      const items: QrStickerItem[] = [];
      for (const kelas of daftarKelas) {
        const cleanKelas = kelas.replace(/[^A-Za-z0-9]/g, '');
        for (const kategori of ['ORGANIK', 'NON-ORGANIK'] as KategoriTong[]) {
          const codeId = `QR-${cleanKelas}-${kategori === 'ORGANIK' ? 'ORG' : 'NON'}`;
          const payload = JSON.stringify({
            school: 'SMAN 1 Karang Bahagia',
            app: 'KAIZEN-O',
            kelas,
            kategori,
            codeId,
          });
          const qrDataUrl = await QRCode.toDataURL(payload, {
            width: 220,
            margin: 1,
            color: {
              dark: kategori === 'ORGANIK' ? '#064E3B' : '#78350F',
              light: '#FFFFFF',
            },
          });
          items.push({ kelas, kategori, codeId, qrDataUrl });
        }
      }
      if (!cancelled) {
        setStickers(items);
      }
    }
    generateAll();
    return () => {
      cancelled = true;
    };
  }, [daftarKelas]);

  const filtered = stickers.filter((s) => {
    if (filterKategori !== 'SEMUA' && s.kategori !== filterKategori) return false;
    if (searchKelas.trim() && !s.kelas.toLowerCase().includes(searchKelas.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <section className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
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
              placeholder="Filter kelas (misal XI-3)..."
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

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold bg-[#059669] hover:bg-emerald-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Printer className="w-4 h-4" aria-hidden="true" />
          <span>Cetak Stiker QR ({filtered.length})</span>
        </button>
      </div>

      {/* Printable Sticker Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-2 print:gap-4">
        {filtered.map((item) => {
          const isOrganik = item.kategori === 'ORGANIK';
          return (
            <article
              key={item.codeId}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col break-inside-avoid"
            >
              <div
                className={`px-4 py-2.5 flex items-center justify-between text-white ${
                  isOrganik ? 'bg-[#059669]' : 'bg-[#D97706]'
                }`}
              >
                <span className="font-display text-xs font-bold tracking-wide">
                  TONG {item.kategori}
                </span>
                <span className="font-mono text-xs font-semibold">
                  {item.kelas}
                </span>
              </div>

              <div className="p-5 flex flex-col items-center text-center space-y-3">
                <div className="p-2 bg-white border border-slate-200 rounded-lg">
                  <img
                    src={item.qrDataUrl}
                    alt={`Kode QR ${item.codeId}`}
                    className="w-36 h-36 object-contain"
                  />
                </div>

                <div className="space-y-0.5">
                  <p className="font-mono text-xs font-bold text-slate-900">
                    {item.codeId}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    SMAN 1 Karang Bahagia · KAIZEN-O
                  </p>
                </div>

                <p className="text-[11px] text-slate-600 leading-snug pt-2 border-t border-slate-100 w-full">
                  {isOrganik
                    ? 'Khusus sisa makanan, daun kering, kulit buah, & ampas teh/kopi.'
                    : 'Khusus botol plastik, kemasan snack, kertas, kardus, kaleng & kaca.'}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
