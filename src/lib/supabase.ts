import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser, Role } from '../types';

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
      'Konfigurasi Supabase belum tersedia. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada Settings > Secrets.'
    );
  }
  return supabase;
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
    full_name: row.full_name,
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
    full_name: row.full_name,
    role: row.role,
  };
}
