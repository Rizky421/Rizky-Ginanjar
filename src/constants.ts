import type {
  MasterData,
  MonthlyRecapInput,
  SamplePhotoOption,
  SesiPenimbangan,
  StatusPilah,
} from './types';

export const SESI_PENIMBANGAN_OPTIONS: SesiPenimbangan[] = [
  'Sesi Pagi (10.30-11.00)',
  'Sesi Siang (12.30-13.00)',
  'Insidental',
];

export function detectCurrentSesi(now: Date = new Date()): SesiPenimbangan {
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  if (totalMinutes >= 10 * 60 + 30 && totalMinutes <= 11 * 60) {
    return 'Sesi Pagi (10.30-11.00)';
  }
  if (totalMinutes >= 12 * 60 + 30 && totalMinutes <= 13 * 60) {
    return 'Sesi Siang (12.30-13.00)';
  }
  return 'Insidental';
}

export const INITIAL_MASTER_DATA: MasterData = {
  daftarKelas: [
    'X-1', 'X-2', 'X-3', 'X-4', 'X-5', 'X-6',
    'XI-1', 'XI-2', 'XI-3', 'XI-4', 'XI-5', 'XI-6',
    'XII-1', 'XII-2', 'XII-3', 'XII-4', 'XII-5', 'XII-6',
  ],
  quickTagsOrganik: [
    'Plastik di tong organik',
    'Kemasan makanan ringan tercampur',
    'Kertas/tisu berlebihan',
    'Kaleng/botol di tong organik',
    'Organik bersih sesuai aturan',
  ],
  quickTagsNonOrganik: [
    'Sisa makanan di tong non-organik',
    'Sisa makanan bercampur kertas',
    'Kulit buah basah tercampur',
    'Kemasan masih berisi cairan',
    'Kardus belum dilipat rapi',
    'Non-organik kering dan bersih',
  ],
  users: [
    {
      id: 'usr-1',
      nama: 'Rizky Pratama, S.Pd.',
      email: 'rizky421@guru.sma.belajar.id',
      peran: 'Admin',
      aktif: true,
    },
    {
      id: 'usr-2',
      nama: 'Pokja Kebersihan Adiwiyata',
      email: 'pokja.adiwiyata@sman1kb.sch.id',
      peran: 'Petugas Timbang',
      aktif: true,
    },
    {
      id: 'usr-3',
      nama: 'Siti Aminah, M.Pd.',
      email: 'siti.aminah@guru.sma.belajar.id',
      peran: 'Wali Kelas',
      kelasBinaan: 'XI-3',
      aktif: true,
    },
    {
      id: 'usr-4',
      nama: 'Drs. H. Ahmad Fauzi, M.M.',
      email: 'kepsek@sman1kb.sch.id',
      peran: 'Kepala Sekolah',
      aktif: true,
    },
  ],
};

export const DEFAULT_NOVEMBER_RECAP: MonthlyRecapInput = {
  bulan: 'November 2026',
  totalOrganikKg: 420,
  totalNonOrganikKg: 315,
  sesiPagiKg: 260,
  sesiSiangKg: 385,
  sesiInsidentalKg: 90,
  persenTerpilahSempurna: 68,
  persenTercampurRingan: 24,
  persenTidakDipilah: 8,
  topClasses: [
    { kelas: 'XII-1', skor: 98 },
    { kelas: 'X-5', skor: 96 },
    { kelas: 'XI-2', skor: 95 },
  ],
  violationClasses: [
    {
      kelas: 'X-2',
      pola: '5x Tercampur Ringan - dominan botol plastik masuk ke tong organik',
    },
    {
      kelas: 'XI-4',
      pola: '4x Tidak Dipilah - sisa makanan kantin bercampur kertas di tong non-organik',
    },
    {
      kelas: 'XII-6',
      pola: '3x Tercampur Ringan - gelas plastik di tong organik',
    },
  ],
};

export const DAFTAR_KELAS: string[] = [
  'X-1', 'X-2', 'X-3', 'X-4', 'X-5', 'X-6',
  'XI-1', 'XI-2', 'XI-3', 'XI-4', 'XI-5', 'XI-6',
  'XII-1', 'XII-2', 'XII-3', 'XII-4', 'XII-5', 'XII-6',
];

export const STATUS_PILAH_OPTIONS: StatusPilah[] = [
  'Terpilah Sempurna',
  'Tercampur Ringan',
  'Tidak Dipilah',
];

export const QUICK_TAGS_ORGANIK: string[] = [
  'Plastik di tong organik',
  'Kemasan makanan ringan tercampur',
  'Kertas/tisu berlebihan',
  'Kaleng/botol di tong organik',
  'Organik bersih sesuai aturan',
];

export const QUICK_TAGS_NON_ORGANIK: string[] = [
  'Sisa makanan di tong non-organik',
  'Kulit buah basah tercampur',
  'Kemasan masih berisi cairan',
  'Kardus belum dilipat rapi',
  'Non-organik kering dan bersih',
];

export const SAMPLE_PHOTOS: SamplePhotoOption[] = [
  {
    id: 'organik-tercampur',
    label: 'Tong Organik · Tercampur Plastik',
    description: 'Daun kering dan kulit buah bercampur gelas & bungkus plastik',
    path: '/src/assets/images/sample_organik_tercampur_1795446549597.jpg',
    suggestedKategori: 'ORGANIK',
    suggestedStatus: 'Tercampur Ringan',
    suggestedTags: ['Plastik di tong organik'],
  },
  {
    id: 'organik-bersih',
    label: 'Tong Organik · Terpilah Bersih',
    description: 'Daun kering, kulit pisang, potongan buah, dan ampas teh',
    path: '/src/assets/images/sample_organik_bersih_1795446550268.jpg',
    suggestedKategori: 'ORGANIK',
    suggestedStatus: 'Terpilah Sempurna',
    suggestedTags: ['Organik bersih sesuai aturan'],
  },
  {
    id: 'nonorganik-bersih',
    label: 'Tong Non-Organik · Terpilah Bersih',
    description: 'Botol plastik PET, kaleng minuman, kardus lipat, dan kertas',
    path: '/src/assets/images/sample_nonorganik_bersih_1795446550814.jpg',
    suggestedKategori: 'NON-ORGANIK',
    suggestedStatus: 'Terpilah Sempurna',
    suggestedTags: ['Non-organik kering dan bersih'],
  },
  {
    id: 'nonorganik-tercampur',
    label: 'Tong Non-Organik · Tercampur Sisa Makanan',
    description: 'Botol & kemasan snack bercampur roti, kulit buah, dan sisa makanan',
    path: '/src/assets/images/sample_nonorganik_tercampur_1795446550485.jpg',
    suggestedKategori: 'NON-ORGANIK',
    suggestedStatus: 'Tidak Dipilah',
    suggestedTags: ['Sisa makanan di tong non-organik', 'Kulit buah basah tercampur'],
  },
];

export const PANDUAN_PEMILAHAN = {
  organik: {
    judul: 'Sampah Organik (Tong Hijau)',
    ringkasan: 'Bahan hayati yang mudah terurai secara alami dan diolah menjadi kompos sekolah.',
    contoh: [
      'Sisa makanan dan lauk tanpa kemasan',
      'Daun kering dan ranting kecil halaman kelas',
      'Kulit buah-buahan (pisang, jeruk, apel)',
      'Ampas teh celup dan ampas kopi',
      'Bahan organik mudah terurai lainnya',
    ],
    larangan: [
      'Gelas plastik minuman dan sedotan',
      'Bungkus makanan ringan atau plastik kresek',
      'Kertas berlapis plastik atau kaleng minuman',
    ],
  },
  nonOrganik: {
    judul: 'Sampah Non-Organik (Tong Kuning)',
    ringkasan: 'Material kering yang dapat didaur ulang atau disetor ke Bank Sampah SMAN 1 Karang Bahagia.',
    contoh: [
      'Botol plastik air mineral dalam keadaan kosong',
      'Kemasan makanan ringan yang kering',
      'Kertas bekas catatan dan kertas HVS',
      'Kardus bekas dalam kondisi terlipat rapi',
      'Kaleng minuman aluminium dan pecahan kaca terbungkus aman',
    ],
    larangan: [
      'Sisa makanan basah dan kuah di dalam kemasan',
      'Kulit buah atau daun basah yang mengotori kertas',
      'Botol minuman yang masih penuh cairan',
    ],
  },
};
