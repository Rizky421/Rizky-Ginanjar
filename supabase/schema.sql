-- 1. Aktifkan ekstensi enkripsi password
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Buat tabel akun pengguna
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Petugas Timbang', 'Wali Kelas', 'Kepala Sekolah')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Amankan tabel dengan RLS (password_hash tidak bisa dibaca langsung dari browser)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- 4. Isi data akun default awal untuk semua peran
INSERT INTO public.app_users (username, password_hash, full_name, role)
VALUES
  ('admin', crypt('admin123', gen_salt('bf')), 'Pembina Adiwiyata', 'Admin'),
  ('petugas', crypt('petugas123', gen_salt('bf')), 'Kader OSIS Piket', 'Petugas Timbang'),
  ('walikelas', crypt('wali123', gen_salt('bf')), 'Wali Kelas SMAN 1', 'Wali Kelas'),
  ('kepsek', crypt('kepsek123', gen_salt('bf')), 'Kepala SMAN 1 Karang Bahagia', 'Kepala Sekolah')
ON CONFLICT (username) DO NOTHING;

-- 5. Fungsi RPC untuk Login User
CREATE OR REPLACE FUNCTION public.login_user(p_username TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  full_name TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.full_name, u.role
  FROM public.app_users u
  WHERE LOWER(u.username) = LOWER(TRIM(p_username))
    AND u.password_hash = crypt(p_password, u.password_hash);
END;
$$;

-- 6. Fungsi RPC untuk Ganti Username & Password dari Dashboard
CREATE OR REPLACE FUNCTION public.update_user_credentials(
  p_user_id UUID,
  p_new_username TEXT,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  full_name TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  -- Verifikasi password lama
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE app_users.id = p_user_id
      AND app_users.password_hash = crypt(p_old_password, app_users.password_hash)
  ) INTO v_valid;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Password lama tidak sesuai.';
  END IF;

  -- Cek apakah username baru sudah dipakai akun lain
  IF EXISTS (
    SELECT 1 FROM public.app_users
    WHERE LOWER(app_users.username) = LOWER(TRIM(p_new_username))
      AND app_users.id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'Username sudah digunakan, silakan pilih username lain.';
  END IF;

  -- Simpan perubahan username dan password baru
  UPDATE public.app_users
  SET
    username = LOWER(TRIM(p_new_username)),
    password_hash = CASE
      WHEN p_new_password IS NOT NULL AND LENGTH(TRIM(p_new_password)) >= 6
        THEN crypt(p_new_password, gen_salt('bf'))
      ELSE password_hash
    END,
    updated_at = now()
  WHERE app_users.id = p_user_id;

  RETURN QUERY
  SELECT u.id, u.username, u.full_name, u.role
  FROM public.app_users u
  WHERE u.id = p_user_id;
END;
$$;
