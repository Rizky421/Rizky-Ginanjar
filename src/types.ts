export type KategoriTong = 'ORGANIK' | 'NON-ORGANIK';

export type StatusPilah = 'Terpilah Sempurna' | 'Tercampur Ringan' | 'Tidak Dipilah';

export type SesiPenimbangan =
  | 'Sesi Pagi (10.30-11.00)'
  | 'Sesi Siang (12.30-13.00)'
  | 'Insidental';

export interface VerifikasiHasil {
  kesesuaian_visual: boolean;
  benda_salah_tempat: string[];
  catatan_evaluasi_kelas: string;
  saran_status_pilah: StatusPilah;
}

export interface EvaluasiRecord {
  id: string;
  kelas: string;
  kategoriTong: KategoriTong;
  qrCodeId: string;
  beratKg: number;
  sesiPenimbangan: SesiPenimbangan;
  keteranganInsidental?: string;
  statusPetugas: StatusPilah;
  quickTags: string[];
  imageUrl: string;
  petugasNama: string;
  waktuCatat: string;
  hasil: VerifikasiHasil;
}

export interface SamplePhotoOption {
  id: string;
  label: string;
  description: string;
  path: string;
  suggestedKategori: KategoriTong;
  suggestedStatus: StatusPilah;
  suggestedTags: string[];
}

export interface ClassRankEntry {
  kelas: string;
  skor: number;
}

export interface ClassViolationEntry {
  kelas: string;
  pola: string;
}

export interface MonthlyRecapInput {
  bulan: string;
  totalOrganikKg: number;
  totalNonOrganikKg: number;
  sesiPagiKg?: number;
  sesiSiangKg?: number;
  sesiInsidentalKg?: number;
  persenTerpilahSempurna: number;
  persenTercampurRingan: number;
  persenTidakDipilah: number;
  topClasses: ClassRankEntry[];
  violationClasses: ClassViolationEntry[];
}

export interface MonthlyReportOutput {
  judul_laporan: string;
  ringkasan_eksekutif: string;
  estimasi_dampak: {
    total_sampah_kg: number;
    rasio_organik_persen: number;
    rasio_non_organik_persen: number;
    estimasi_kompos_kg: number;
    estimasi_daur_ulang_kg: number;
  };
  evaluasi_kedisiplinan: string;
  sorotan_apresiasi: {
    kelas: string;
    skor: number;
    keterangan: string;
  }[];
  sorotan_pembinaan: {
    kelas: string;
    pola_kesalahan: string;
    catatan_pembinaan: string;
  }[];
  rekomendasi_tindak_lanjut: {
    judul: string;
    sasaran: string;
    langkah_konkret: string;
  }[];
}

export type Role = 'Admin' | 'Petugas Timbang' | 'Wali Kelas' | 'Kepala Sekolah';

export interface AuthUser {
  id: string;
  username: string;
  full_name: string;
  role: Role;
}

export interface UserAccount {
  id: string;
  nama: string;
  email: string;
  peran: Role;
  kelasBinaan?: string;
  aktif: boolean;
}

export interface MasterData {
  daftarKelas: string[];
  quickTagsOrganik: string[];
  quickTagsNonOrganik: string[];
  users: UserAccount[];
}


