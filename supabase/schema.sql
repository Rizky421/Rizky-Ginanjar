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
  ('petugas', crypt('petugas123', gen_salt('bf')), 'Petugas Caraka', 'Petugas Timbang'),
  ('walikelas', crypt('wali123', gen_salt('bf')), 'Wali Kelas SMAN 1', 'Wali Kelas'),
  ('kepsek', crypt('kepsek123', gen_salt('bf')), 'Kepala SMAN 1 Karang Bahagia', 'Kepala Sekolah')
ON CONFLICT (username) DO NOTHING;

UPDATE public.app_users
SET full_name = 'Petugas Caraka', updated_at = now()
WHERE full_name = 'Kader OSIS Piket' AND role = 'Petugas Timbang';

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

-- 7. Tabel Daftar Kelas (classes)
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public CRUD on classes" ON public.classes;
CREATE POLICY "Allow public CRUD on classes"
  ON public.classes
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 8. Tabel Tong QR Sampah per Kelas (bins)
CREATE TABLE IF NOT EXISTS public.bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  kelas TEXT NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('ORGANIK', 'NON-ORGANIK')),
  qr_code_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public CRUD on bins" ON public.bins;
CREATE POLICY "Allow public CRUD on bins"
  ON public.bins
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 9. Tabel Log Penimbangan & Evaluasi (weighing_logs)
CREATE TABLE IF NOT EXISTS public.weighing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  kelas TEXT NOT NULL,
  kategori_tong TEXT NOT NULL CHECK (kategori_tong IN ('ORGANIK', 'NON-ORGANIK')),
  qr_code_id TEXT NOT NULL,
  berat_kg NUMERIC NOT NULL DEFAULT 0,
  sesi_penimbangan TEXT NOT NULL,
  keterangan_insidental TEXT,
  status_petugas TEXT NOT NULL,
  quick_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_url TEXT NOT NULL,
  petugas_nama TEXT NOT NULL,
  waktu_catat TIMESTAMPTZ NOT NULL DEFAULT now(),
  hasil JSONB NOT NULL
);

ALTER TABLE public.weighing_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public CRUD on weighing_logs" ON public.weighing_logs;
CREATE POLICY "Allow public CRUD on weighing_logs"
  ON public.weighing_logs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 10. Seed awal daftar kelas & tong QR (idempoten)
INSERT INTO public.classes (name)
VALUES
  ('X-1'), ('X-2'), ('X-3'), ('X-4'), ('X-5'), ('X-6'),
  ('XI-1'), ('XI-2'), ('XI-3'), ('XI-4'), ('XI-5'), ('XI-6'),
  ('XII-1'), ('XII-2'), ('XII-3'), ('XII-4'), ('XII-5'), ('XII-6')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.bins (class_id, kelas, kategori, qr_code_id)
SELECT
  c.id,
  c.name,
  k.kategori,
  'QR-' || regexp_replace(c.name, '[^A-Za-z0-9]', '', 'g') || '-' || CASE WHEN k.kategori = 'ORGANIK' THEN 'ORG' ELSE 'NON' END
FROM public.classes c
CROSS JOIN (VALUES ('ORGANIK'), ('NON-ORGANIK')) AS k(kategori)
ON CONFLICT (qr_code_id) DO NOTHING;
