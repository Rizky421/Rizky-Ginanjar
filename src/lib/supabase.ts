import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthUser,
  BinItem,
  ClassItem,
  EvaluasiRecord,
  KategoriTong,
  Role,
  SesiPenimbangan,
  StatusPilah,
  VerifikasiHasil,
} from '../types';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

function assertSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Konfigurasi Supabase belum tersedia. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada environment aplikasi.'
    );
  }
  return supabase;
}

function normalizeFullName(fullName: string, role: Role): string {
  if (role === 'Petugas Timbang' && fullName.trim() === 'Kader OSIS Piket') {
    return 'Petugas Caraka';
  }
  return fullName;
}

export async function loginUserRpc(
  username: string,
  password: string
): Promise<AuthUser> {
  const client = assertSupabase();
  const { data, error } = await client.rpc('login_user', {
    p_username: username,
    p_password: password,
  });

  if (error) {
    throw new Error(error.message || 'Gagal melakukan verifikasi login ke Supabase.');
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) {
    throw new Error('Username atau password tidak sesuai. Silakan periksa kembali.');
  }

  const row = rows[0] as {
    id: string;
    username: string;
    full_name: string;
    role: Role;
  };

  return {
    id: row.id,
    username: row.username,
    full_name: normalizeFullName(row.full_name, row.role),
    role: row.role,
  };
}

export async function updateUserCredentialsRpc(params: {
  userId: string;
  newUsername: string;
  oldPassword: string;
  newPassword?: string;
}): Promise<AuthUser> {
  const client = assertSupabase();
  const { data, error } = await client.rpc('update_user_credentials', {
    p_user_id: params.userId,
    p_new_username: params.newUsername,
    p_old_password: params.oldPassword,
    p_new_password: params.newPassword || '',
  });

  if (error) {
    throw new Error(error.message || 'Gagal memperbarui kredensial akun.');
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) {
    throw new Error('Data akun terbaru tidak dikembalikan oleh server.');
  }

  const row = rows[0] as {
    id: string;
    username: string;
    full_name: string;
    role: Role;
  };

  return {
    id: row.id,
    username: row.username,
    full_name: normalizeFullName(row.full_name, row.role),
    role: row.role,
  };
}

// ==========================================
// CRUD: classes
// ==========================================

function mapClassRow(row: Record<string, unknown>): ClassItem {
  const rawName = row.name ?? row.nama ?? row.class_name ?? row.kelas ?? '';
  return {
    id: String(row.id),
    name: String(rawName),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function fetchClasses(): Promise<ClassItem[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('classes')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Gagal memuat daftar kelas dari Supabase.');
  }

  return (data || []).map((row) => mapClassRow(row as Record<string, unknown>));
}

export async function createClass(name: string): Promise<ClassItem> {
  const client = assertSupabase();
  const cleanName = name.trim().toUpperCase();
  const { data, error } = await client
    .from('classes')
    .insert({ name: cleanName })
    .select()
    .single();

  if (error) {
    throw new Error(error.message || `Gagal menambahkan kelas ${cleanName}.`);
  }

  return mapClassRow(data as Record<string, unknown>);
}

export async function updateClass(classId: string, name: string): Promise<ClassItem> {
  const client = assertSupabase();
  const cleanName = name.trim().toUpperCase();
  const { data, error } = await client
    .from('classes')
    .update({ name: cleanName })
    .eq('id', classId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || `Gagal mengubah nama kelas menjadi ${cleanName}.`);
  }

  return mapClassRow(data as Record<string, unknown>);
}

export async function deleteClass(classId: string): Promise<void> {
  const client = assertSupabase();
  const { error } = await client
    .from('classes')
    .delete()
    .eq('id', classId);

  if (error) {
    throw new Error(error.message || 'Gagal menghapus data kelas dari Supabase.');
  }
}

// ==========================================
// CRUD: bins
// ==========================================

export function buildStandardQrCodeId(kelas: string, kategori: KategoriTong): string {
  const cleanKelas = kelas.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `QR-${cleanKelas}-${kategori === 'ORGANIK' ? 'ORG' : 'NON'}`;
}

function mapBinRow(row: Record<string, unknown>): BinItem {
  const rawKat = String(row.kategori ?? row.category ?? 'ORGANIK').toUpperCase();
  const kategori: KategoriTong = rawKat === 'NON-ORGANIK' ? 'NON-ORGANIK' : 'ORGANIK';
  return {
    id: String(row.id),
    class_id: row.class_id ? String(row.class_id) : null,
    kelas: String(row.kelas ?? row.class_name ?? ''),
    kategori,
    qr_code_id: String(row.qr_code_id ?? row.qr_code ?? ''),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function fetchBins(): Promise<BinItem[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('bins')
    .select('*')
    .order('kelas', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Gagal memuat daftar tong QR dari Supabase.');
  }

  return (data || []).map((row) => mapBinRow(row as Record<string, unknown>));
}

export async function createBin(input: {
  class_id?: string | null;
  kelas: string;
  kategori: KategoriTong;
  qr_code_id?: string;
}): Promise<BinItem> {
  const client = assertSupabase();
  const cleanKelas = input.kelas.trim().toUpperCase();
  const qrCodeId = (input.qr_code_id || buildStandardQrCodeId(cleanKelas, input.kategori))
    .trim()
    .toUpperCase();

  const { data, error } = await client
    .from('bins')
    .insert({
      class_id: input.class_id ?? null,
      kelas: cleanKelas,
      kategori: input.kategori,
      qr_code_id: qrCodeId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message || `Gagal menambahkan tong QR ${qrCodeId}.`);
  }

  return mapBinRow(data as Record<string, unknown>);
}

export async function updateBin(
  binId: string,
  updates: Partial<Pick<BinItem, 'class_id' | 'kelas' | 'kategori' | 'qr_code_id'>>
): Promise<BinItem> {
  const client = assertSupabase();
  const payload: Record<string, unknown> = {};
  if (updates.class_id !== undefined) payload.class_id = updates.class_id;
  if (updates.kelas !== undefined) payload.kelas = updates.kelas.trim().toUpperCase();
  if (updates.kategori !== undefined) payload.kategori = updates.kategori;
  if (updates.qr_code_id !== undefined) payload.qr_code_id = updates.qr_code_id.trim().toUpperCase();

  const { data, error } = await client
    .from('bins')
    .update(payload)
    .eq('id', binId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal memperbarui data tong QR.');
  }

  return mapBinRow(data as Record<string, unknown>);
}

export async function deleteBin(binId: string): Promise<void> {
  const client = assertSupabase();
  const { error } = await client
    .from('bins')
    .delete()
    .eq('id', binId);

  if (error) {
    throw new Error(error.message || 'Gagal menghapus tong QR dari Supabase.');
  }
}

export async function createDefaultBinsForClass(classItem: ClassItem): Promise<BinItem[]> {
  const client = assertSupabase();
  const rows = (['ORGANIK', 'NON-ORGANIK'] as KategoriTong[]).map((kategori) => ({
    class_id: classItem.id,
    kelas: classItem.name,
    kategori,
    qr_code_id: buildStandardQrCodeId(classItem.name, kategori),
  }));

  const { data, error } = await client
    .from('bins')
    .upsert(rows, { onConflict: 'qr_code_id' })
    .select();

  if (error) {
    throw new Error(error.message || `Gagal membuat tong QR untuk kelas ${classItem.name}.`);
  }

  return (data || []).map((row) => mapBinRow(row as Record<string, unknown>));
}

// ==========================================
// CRUD: weighing_logs
// ==========================================

function mapWeighingLogRow(row: Record<string, unknown>): EvaluasiRecord {
  const rawKat = String(row.kategori_tong ?? row.kategoriTong ?? 'ORGANIK').toUpperCase();
  const kategoriTong: KategoriTong = rawKat === 'NON-ORGANIK' ? 'NON-ORGANIK' : 'ORGANIK';

  const rawHasil = (row.hasil && typeof row.hasil === 'object' ? row.hasil : {}) as Partial<VerifikasiHasil>;
  const saranStatus = (rawHasil.saran_status_pilah ||
    row.status_petugas ||
    'Tercampur Ringan') as StatusPilah;

  const quickTagsRaw = row.quick_tags ?? row.quickTags;
  const quickTags = Array.isArray(quickTagsRaw)
    ? quickTagsRaw.map((t) => String(t))
    : [];

  const rawImage = row.image_url ?? row.foto_url ?? row.photo_url ?? row.imageUrl ?? null;

  return {
    id: String(row.id),
    kelas: String(row.kelas ?? ''),
    kategoriTong,
    qrCodeId: String(row.qr_code_id ?? row.qrCodeId ?? ''),
    beratKg: Number(row.berat_kg ?? row.beratKg ?? 0),
    sesiPenimbangan: String(
      row.sesi_penimbangan ?? row.sesiPenimbangan ?? 'Sesi Pagi (10.30-11.00)'
    ) as SesiPenimbangan,
    keteranganInsidental: row.keterangan_insidental
      ? String(row.keterangan_insidental)
      : undefined,
    statusPetugas: String(row.status_petugas ?? row.statusPetugas ?? saranStatus) as StatusPilah,
    quickTags,
    imageUrl: rawImage ? String(rawImage) : null,
    petugasNama: String(row.petugas_nama ?? row.petugasNama ?? 'Petugas Caraka'),
    waktuCatat: String(row.waktu_catat ?? row.waktuCatat ?? new Date().toISOString()),
    hasil: {
      kesesuaian_visual: Boolean(rawHasil.kesesuaian_visual ?? saranStatus === 'Terpilah Sempurna'),
      benda_salah_tempat: Array.isArray(rawHasil.benda_salah_tempat)
        ? rawHasil.benda_salah_tempat.map((b) => String(b))
        : [],
      catatan_evaluasi_kelas: String(rawHasil.catatan_evaluasi_kelas ?? ''),
      saran_status_pilah: saranStatus,
    },
  };
}

export async function fetchWeighingLogs(): Promise<EvaluasiRecord[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('weighing_logs')
    .select('*')
    .order('waktu_catat', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Gagal memuat log penimbangan dari Supabase.');
  }

  return (data || []).map((row) => mapWeighingLogRow(row as Record<string, unknown>));
}

export async function createWeighingLog(
  record: Omit<EvaluasiRecord, 'id' | 'waktuCatat'> & { classId?: string | null }
): Promise<EvaluasiRecord> {
  const client = assertSupabase();
  const basePayload = {
    class_id: record.classId ?? null,
    kelas: record.kelas,
    kategori_tong: record.kategoriTong,
    qr_code_id: record.qrCodeId,
    berat_kg: Number(record.beratKg) || 0,
    sesi_penimbangan: record.sesiPenimbangan,
    keterangan_insidental: record.keteranganInsidental?.trim() || null,
    status_petugas: record.statusPetugas,
    quick_tags: Array.isArray(record.quickTags) ? record.quickTags : [],
    petugas_nama: record.petugasNama?.trim() || 'Petugas Caraka',
    waktu_catat: new Date().toISOString(),
    hasil: record.hasil,
  };

  let { data, error } = await client
    .from('weighing_logs')
    .insert({ ...basePayload, image_url: null })
    .select()
    .single();

  if (error && error.message?.toLowerCase().includes('image_url')) {
    const retry = await client
      .from('weighing_logs')
      .insert(basePayload)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(error.message || 'Gagal menyimpan catatan penimbangan ke Supabase.');
  }

  return mapWeighingLogRow(data as Record<string, unknown>);
}

export async function updateWeighingLog(
  id: string,
  updates: Partial<
    Pick<
      EvaluasiRecord,
      | 'kelas'
      | 'kategoriTong'
      | 'qrCodeId'
      | 'beratKg'
      | 'sesiPenimbangan'
      | 'keteranganInsidental'
      | 'statusPetugas'
      | 'hasil'
    >
  >
): Promise<EvaluasiRecord> {
  const client = assertSupabase();
  const payload: Record<string, unknown> = {};
  if (updates.kelas !== undefined) payload.kelas = updates.kelas;
  if (updates.kategoriTong !== undefined) payload.kategori_tong = updates.kategoriTong;
  if (updates.qrCodeId !== undefined) payload.qr_code_id = updates.qrCodeId;
  if (updates.beratKg !== undefined) payload.berat_kg = Number(updates.beratKg) || 0;
  if (updates.sesiPenimbangan !== undefined) payload.sesi_penimbangan = updates.sesiPenimbangan;
  if (updates.keteranganInsidental !== undefined) {
    payload.keterangan_insidental = updates.keteranganInsidental?.trim() || null;
  }
  if (updates.statusPetugas !== undefined) payload.status_petugas = updates.statusPetugas;
  if (updates.hasil !== undefined) payload.hasil = updates.hasil;

  const { data, error } = await client
    .from('weighing_logs')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal memperbarui log penimbangan di Supabase.');
  }

  return mapWeighingLogRow(data as Record<string, unknown>);
}

export async function deleteWeighingLog(id: string): Promise<void> {
  const client = assertSupabase();
  const { error } = await client
    .from('weighing_logs')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message || 'Gagal menghapus log penimbangan dari Supabase.');
  }
}

