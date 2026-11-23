import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  EvaluasiRecord,
  KategoriTong,
  MasterData,
  MonthlyRecapInput,
  MonthlyReportOutput,
  SesiPenimbangan,
  StatusPilah,
  VerifikasiHasil,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'evaluations.json');
const MASTER_FILE = path.join(DATA_DIR, 'master.json');
const IMAGES_DIR = path.join(__dirname, 'src', 'assets', 'images');

const SYSTEM_INSTRUCTION = `Anda adalah Asisten Digital Program Adiwiyata di SMAN 1 Karang Bahagia. Tugas Anda adalah memverifikasi foto sampah dari tong kelas dan menyusun catatan evaluasi pemilahan sampah (Organik vs Non-Organik).

Aturan Penilaian:
1. Bandingkan isi sampah pada foto dengan "Kategori Tong QR" yang dipindai (ORGANIK atau NON-ORGANIK) serta "Input Petugas".
2. Sampah ORGANIK meliputi: sisa makanan, daun kering, kulit buah, ampas teh/kopi, dan bahan mudah terurai lainnya.
3. Sampah NON-ORGANIK meliputi: botol plastik, kemasan makanan ringan, kertas, kardus, kaleng, dan kaca.
4. Susun "catatan_evaluasi_kelas" dalam bahasa Indonesia yang sopan, edukatif, objektif, dan memotivasi (hindari nada menyalahkan atau kasar karena catatan ini dibaca oleh siswa dan wali kelas).
5. Jika sampah sudah terpilah dengan benar, berikan apresiasi singkat yang positif. Jika masih tercampur, sebutkan benda spesifik yang salah tempat beserta saran perbaikannya dalam maksimal 2-3 kalimat.`;

const MONTHLY_CONSULTANT_INSTRUCTION = `Anda adalah Konsultan Evaluasi Lingkungan & Program Sekolah Adiwiyata untuk SMAN 1 Karang Bahagia. Anda bertugas menganalisis data rekapitulasi penimbangan sampah bulanan sekolah dan menyusunnya menjadi laporan evaluasi resmi.

Struktur Laporan Wajib:
1. Ringkasan Eksekutif: Total berat sampah organik, non-organik, rasio pemilahan, dan estimasi dampak positif lingkungan (kompos & daur ulang).
2. Evaluasi Kedisiplinan Pemilahan: Analisis tingkat kepatuhan siswa dalam memisahkan sampah organik dan non-organik berdasarkan tren status pemilahan.
3. Sorotan Kelas (Apresiasi & Pembinaan): Sebutkan 3 kelas dengan kedisiplinan terbaik untuk diberikan apresiasi, serta 3 kelas yang paling sering mendapat catatan pelanggaran beserta pola kesalahannya.
4. Rekomendasi Tindak Lanjut: 3 langkah konkret bagi Tim Adiwiyata dan Wali Kelas untuk bulan berikutnya.

Gunakan bahasa Indonesia baku, formal, terstruktur dengan jelas, objektif, dan berbasis data yang diberikan.`;

const INITIAL_EVALUATIONS: EvaluasiRecord[] = [
  {
    id: 'eval-seed-1',
    kelas: 'X-2',
    kategoriTong: 'ORGANIK',
    qrCodeId: 'QR-X2-ORG',
    beratKg: 2.8,
    sesiPenimbangan: 'Sesi Pagi (10.30-11.00)',
    statusPetugas: 'Terpilah Sempurna',
    quickTags: ['Organik bersih sesuai aturan'],
    imageUrl: '/src/assets/images/sample_organik_bersih_1795446550268.jpg',
    petugasNama: 'Tim Pokja Adiwiyata',
    waktuCatat: '2026-11-23T03:45:00.000Z',
    hasil: {
      kesesuaian_visual: true,
      benda_salah_tempat: [],
      catatan_evaluasi_kelas:
        'Apresiasi untuk kelas X-2 pada Sesi Pagi! Seluruh isi tong organik sudah terisi daun kering, kulit buah, dan ampas teh tanpa campuran plastik sehingga siap langsung diolah menjadi kompos sekolah.',
      saran_status_pilah: 'Terpilah Sempurna',
    },
  },
  {
    id: 'eval-seed-2',
    kelas: 'XII-1',
    kategoriTong: 'NON-ORGANIK',
    qrCodeId: 'QR-XII1-NON',
    beratKg: 1.9,
    sesiPenimbangan: 'Sesi Siang (12.30-13.00)',
    statusPetugas: 'Terpilah Sempurna',
    quickTags: ['Non-organik kering dan bersih'],
    imageUrl: '/src/assets/images/sample_nonorganik_bersih_1795446550814.jpg',
    petugasNama: 'Tim Pokja Adiwiyata',
    waktuCatat: '2026-11-23T05:40:00.000Z',
    hasil: {
      kesesuaian_visual: true,
      benda_salah_tempat: [],
      catatan_evaluasi_kelas:
        'Kerja bagus, kelas XII-1! Pada penimbangan Sesi Siang, botol plastik kosong, kaleng, kertas, dan kardus sudah terpilah rapi dalam kondisi kering dan siap disetorkan ke Bank Sampah sekolah.',
      saran_status_pilah: 'Terpilah Sempurna',
    },
  },
  {
    id: 'eval-seed-3',
    kelas: 'XI-5',
    kategoriTong: 'NON-ORGANIK',
    qrCodeId: 'QR-XI5-NON',
    beratKg: 3.2,
    sesiPenimbangan: 'Sesi Siang (12.30-13.00)',
    statusPetugas: 'Tidak Dipilah',
    quickTags: ['Sisa makanan di tong non-organik', 'Kulit buah basah tercampur'],
    imageUrl: '/src/assets/images/sample_nonorganik_tercampur_1795446550485.jpg',
    petugasNama: 'Tim Pokja Adiwiyata',
    waktuCatat: '2026-11-23T05:50:00.000Z',
    hasil: {
      kesesuaian_visual: false,
      benda_salah_tempat: ['Sisa roti dan makanan', 'Kulit pisang dan kulit jeruk', 'Bungkus makanan basah'],
      catatan_evaluasi_kelas:
        'Terima kasih atas partisipasi kelas XI-5 pada penimbangan Sesi Siang. Terlihat sisa roti, kulit buah, dan tisu basah masih masuk ke tong non-organik; mari kita pisahkan sisa makanan makan siang ke tong hijau terlebih dahulu agar plastik di tong kuning tetap bersih untuk didaur ulang.',
      saran_status_pilah: 'Tidak Dipilah',
    },
  },
  {
    id: 'eval-seed-4',
    kelas: 'XI-1',
    kategoriTong: 'ORGANIK',
    qrCodeId: 'QR-XI1-ORG',
    beratKg: 4.5,
    sesiPenimbangan: 'Insidental',
    keteranganInsidental: 'Jumat Bersih',
    statusPetugas: 'Tercampur Ringan',
    quickTags: ['Plastik di tong organik'],
    imageUrl: '/src/assets/images/sample_organik_tercampur_1795446549597.jpg',
    petugasNama: 'Tim Pokja Adiwiyata',
    waktuCatat: '2026-11-20T01:30:00.000Z',
    hasil: {
      kesesuaian_visual: false,
      benda_salah_tempat: ['Gelas plastik dengan sedotan', 'Kemasan makanan ringan'],
      catatan_evaluasi_kelas:
        'Terima kasih kelas XI-1 sudah aktif dalam kegiatan Jumat Bersih. Sebagian besar daun kering sudah masuk tong organik, namun masih terlihat satu gelas plastik dan bungkus snack di dalamnya; yuk pindahkan ke tong kuning agar kompos tetap bersih.',
      saran_status_pilah: 'Tercampur Ringan',
    },
  },
];

function ensureDataStore(): EvaluasiRecord[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_EVALUATIONS, null, 2), 'utf-8');
    return INITIAL_EVALUATIONS;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_EVALUATIONS;
    return parsed.map((item: EvaluasiRecord) => ({
      ...item,
      sesiPenimbangan: item.sesiPenimbangan || 'Sesi Pagi (10.30-11.00)',
    }));
  } catch {
    return INITIAL_EVALUATIONS;
  }
}

function saveDataStore(records: EvaluasiRecord[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

const DEFAULT_MASTER_DATA: MasterData = {
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

function ensureMasterStore(): MasterData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MASTER_FILE)) {
    fs.writeFileSync(MASTER_FILE, JSON.stringify(DEFAULT_MASTER_DATA, null, 2), 'utf-8');
    return DEFAULT_MASTER_DATA;
  }
  try {
    const raw = fs.readFileSync(MASTER_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<MasterData>;
    return {
      daftarKelas: Array.isArray(parsed.daftarKelas) ? parsed.daftarKelas : DEFAULT_MASTER_DATA.daftarKelas,
      quickTagsOrganik: Array.isArray(parsed.quickTagsOrganik) ? parsed.quickTagsOrganik : DEFAULT_MASTER_DATA.quickTagsOrganik,
      quickTagsNonOrganik: Array.isArray(parsed.quickTagsNonOrganik) ? parsed.quickTagsNonOrganik : DEFAULT_MASTER_DATA.quickTagsNonOrganik,
      users: Array.isArray(parsed.users) ? parsed.users : DEFAULT_MASTER_DATA.users,
    };
  } catch {
    return DEFAULT_MASTER_DATA;
  }
}

function saveMasterStore(data: MasterData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(MASTER_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function resolveImagePart(
  imageBase64?: string,
  imageMimeType?: string,
  sampleImagePath?: string
): { mimeType: string; data: string } {
  if (imageBase64 && typeof imageBase64 === 'string') {
    const dataUrlMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (dataUrlMatch) {
      return { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] };
    }
    return {
      mimeType: imageMimeType && imageMimeType.startsWith('image/') ? imageMimeType : 'image/jpeg',
      data: imageBase64,
    };
  }

  if (sampleImagePath && typeof sampleImagePath === 'string') {
    const normalizedRel = sampleImagePath.replace(/^\/+/, '');
    const resolvedPath = path.resolve(__dirname, normalizedRel);
    const allowedPrefix = IMAGES_DIR + path.sep;
    if (!resolvedPath.startsWith(allowedPrefix) || !fs.existsSync(resolvedPath)) {
      throw new Error('Path foto sampel tidak valid atau tidak ditemukan.');
    }
    const buffer = fs.readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { mimeType, data: buffer.toString('base64') };
  }

  throw new Error('Foto isi tong sampah wajib dilampirkan untuk verifikasi visual.');
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum tersedia di konfigurasi server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateVerificationWithRetry(
  ai: GoogleGenAI,
  inlineImage: { mimeType: string; data: string },
  promptText: string
) {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: inlineImage },
            { text: promptText },
          ],
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              kesesuaian_visual: {
                type: Type.BOOLEAN,
                description: 'True jika foto sesuai dengan kategori tong QR, False jika ditemukan sampah yang tercampur.',
              },
              benda_salah_tempat: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Daftar jenis sampah yang tidak sesuai kategori tong (kosongkan jika sudah benar).',
              },
              catatan_evaluasi_kelas: {
                type: Type.STRING,
                description: 'Pesan sopan dan edukatif yang akan ditampilkan di Papan Evaluasi kelas.',
              },
              saran_status_pilah: {
                type: Type.STRING,
                enum: ['Terpilah Sempurna', 'Tercampur Ringan', 'Tidak Dipilah'],
                description: 'Rekomendasi status pemilahan berdasarkan analisis foto.',
              },
            },
            required: [
              'kesesuaian_visual',
              'benda_salah_tempat',
              'catatan_evaluasi_kelas',
              'saran_status_pilah',
            ],
          },
        },
      });
    } catch (err: unknown) {
      lastError = err;
      const errObj = err as { status?: number; message?: string };
      const msg = errObj?.message || '';
      const isTransient =
        errObj?.status === 503 ||
        errObj?.status === 429 ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('RESOURCE_EXHAUSTED');

      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }

  throw lastError;
}

async function generateMonthlyReportWithRetry(ai: GoogleGenAI, promptText: string) {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          systemInstruction: MONTHLY_CONSULTANT_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              judul_laporan: {
                type: Type.STRING,
                description: 'Judul resmi laporan evaluasi pengelolaan sampah bulanan SMAN 1 Karang Bahagia.',
              },
              ringkasan_eksekutif: {
                type: Type.STRING,
                description: 'Paragraf ringkasan eksekutif formal mengenai total berat organik, non-organik, rasio pemilahan, serta estimasi dampak positif kompos dan daur ulang.',
              },
              estimasi_dampak: {
                type: Type.OBJECT,
                properties: {
                  total_sampah_kg: { type: Type.NUMBER },
                  rasio_organik_persen: { type: Type.NUMBER },
                  rasio_non_organik_persen: { type: Type.NUMBER },
                  estimasi_kompos_kg: { type: Type.NUMBER },
                  estimasi_daur_ulang_kg: { type: Type.NUMBER },
                },
                required: [
                  'total_sampah_kg',
                  'rasio_organik_persen',
                  'rasio_non_organik_persen',
                  'estimasi_kompos_kg',
                  'estimasi_daur_ulang_kg',
                ],
              },
              evaluasi_kedisiplinan: {
                type: Type.STRING,
                description: 'Analisis formal mengenai tingkat kepatuhan siswa dalam memisahkan sampah berdasarkan distribusi Terpilah Sempurna, Tercampur Ringan, dan Tidak Dipilah.',
              },
              sorotan_apresiasi: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    kelas: { type: Type.STRING },
                    skor: { type: Type.NUMBER },
                    keterangan: { type: Type.STRING },
                  },
                  required: ['kelas', 'skor', 'keterangan'],
                },
              },
              sorotan_pembinaan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    kelas: { type: Type.STRING },
                    pola_kesalahan: { type: Type.STRING },
                    catatan_pembinaan: { type: Type.STRING },
                  },
                  required: ['kelas', 'pola_kesalahan', 'catatan_pembinaan'],
                },
              },
              rekomendasi_tindak_lanjut: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    judul: { type: Type.STRING },
                    sasaran: { type: Type.STRING },
                    langkah_konkret: { type: Type.STRING },
                  },
                  required: ['judul', 'sasaran', 'langkah_konkret'],
                },
              },
            },
            required: [
              'judul_laporan',
              'ringkasan_eksekutif',
              'estimasi_dampak',
              'evaluasi_kedisiplinan',
              'sorotan_apresiasi',
              'sorotan_pembinaan',
              'rekomendasi_tindak_lanjut',
            ],
          },
        },
      });
    } catch (err: unknown) {
      lastError = err;
      const errObj = err as { status?: number; message?: string };
      const msg = errObj?.message || '';
      const isTransient =
        errObj?.status === 503 ||
        errObj?.status === 429 ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('RESOURCE_EXHAUSTED');

      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }

  throw lastError;
}

function formatReadableError(error: unknown): { statusCode: number; message: string } {
  const errObj = error as { status?: number; message?: string };
  let rawMessage = errObj?.message || 'Terjadi kendala saat memverifikasi foto sampah.';
  let statusCode =
    typeof errObj?.status === 'number' && errObj.status >= 400 && errObj.status < 600
      ? errObj.status
      : 500;

  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: { code?: number; message?: string; status?: string };
    };
    if (parsed?.error) {
      if (typeof parsed.error.code === 'number') {
        statusCode = parsed.error.code;
      }
      if (parsed.error.status === 'UNAVAILABLE' || statusCode === 503) {
        return {
          statusCode: 503,
          message: 'Layanan verifikasi AI sedang padat sementara. Silakan klik Verifikasi Ulang beberapa saat lagi.',
        };
      }
      if (parsed.error.message) {
        rawMessage = parsed.error.message;
      }
    }
  } catch {
    // rawMessage is plain text
  }

  return { statusCode, message: rawMessage };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/evaluations', (_req, res) => {
    const records = ensureDataStore();
    res.json({ evaluations: records });
  });

  app.get('/api/master-data', (_req, res) => {
    const master = ensureMasterStore();
    res.json({ masterData: master });
  });

  app.put('/api/master-data', (req, res) => {
    const body = req.body as Partial<MasterData>;
    if (!Array.isArray(body.daftarKelas) || !Array.isArray(body.users)) {
      res.status(400).json({ error: 'Format data master tidak valid.' });
      return;
    }
    const nextMaster: MasterData = {
      daftarKelas: body.daftarKelas,
      quickTagsOrganik: Array.isArray(body.quickTagsOrganik) ? body.quickTagsOrganik : DEFAULT_MASTER_DATA.quickTagsOrganik,
      quickTagsNonOrganik: Array.isArray(body.quickTagsNonOrganik) ? body.quickTagsNonOrganik : DEFAULT_MASTER_DATA.quickTagsNonOrganik,
      users: body.users,
    };
    saveMasterStore(nextMaster);
    res.json({ masterData: nextMaster });
  });

  app.post('/api/evaluations', (req, res) => {
    const body = req.body as Partial<EvaluasiRecord>;
    if (!body.kelas || !body.kategoriTong || !body.hasil) {
      res.status(400).json({ error: 'Data evaluasi kelas belum lengkap.' });
      return;
    }

    const records = ensureDataStore();
    const newRecord: EvaluasiRecord = {
      id: `eval-${Date.now()}`,
      kelas: String(body.kelas),
      kategoriTong: body.kategoriTong as KategoriTong,
      qrCodeId: body.qrCodeId || `QR-${String(body.kelas).replace(/[^A-Za-z0-9]/g, '')}-${body.kategoriTong === 'ORGANIK' ? 'ORG' : 'NON'}`,
      beratKg: Number(body.beratKg) || 0,
      sesiPenimbangan: (body.sesiPenimbangan || 'Sesi Pagi (10.30-11.00)') as SesiPenimbangan,
      keteranganInsidental: body.keteranganInsidental?.trim() || undefined,
      statusPetugas: (body.statusPetugas || body.hasil.saran_status_pilah) as StatusPilah,
      quickTags: Array.isArray(body.quickTags) ? body.quickTags : [],
      imageUrl: body.imageUrl || '/src/assets/images/sample_organik_tercampur_1795446549597.jpg',
      petugasNama: body.petugasNama?.trim() || 'Tim Pokja Adiwiyata',
      waktuCatat: new Date().toISOString(),
      hasil: body.hasil,
    };

    const updated = [newRecord, ...records];
    saveDataStore(updated);
    res.status(201).json({ evaluation: newRecord });
  });

  app.delete('/api/evaluations/:id', (req, res) => {
    const { id } = req.params;
    const records = ensureDataStore();
    const filtered = records.filter((item) => item.id !== id);
    if (filtered.length === records.length) {
      res.status(404).json({ error: 'Catatan evaluasi tidak ditemukan.' });
      return;
    }
    saveDataStore(filtered);
    res.json({ deletedId: id });
  });

  app.post('/api/verify-waste', async (req, res) => {
    try {
      const {
        kelas,
        kategoriTong,
        sesiPenimbangan,
        keteranganInsidental,
        statusPetugas,
        quickTags,
        beratKg,
        imageBase64,
        imageMimeType,
        sampleImagePath,
      } = req.body as {
        kelas?: string;
        kategoriTong?: KategoriTong;
        sesiPenimbangan?: SesiPenimbangan;
        keteranganInsidental?: string;
        statusPetugas?: StatusPilah;
        quickTags?: string[];
        beratKg?: number;
        imageBase64?: string;
        imageMimeType?: string;
        sampleImagePath?: string;
      };

      if (!kelas || (kategoriTong !== 'ORGANIK' && kategoriTong !== 'NON-ORGANIK')) {
        res.status(400).json({ error: 'Kelas dan Kategori Tong QR (ORGANIK / NON-ORGANIK) wajib dipilih.' });
        return;
      }

      const inlineImage = resolveImagePart(imageBase64, imageMimeType, sampleImagePath);
      const ai = createGeminiClient();

      const tagsText = Array.isArray(quickTags) && quickTags.length > 0 ? quickTags.join(', ') : 'Tidak ada';
      const sesiText =
        sesiPenimbangan === 'Insidental' && keteranganInsidental?.trim()
          ? `Insidental (${keteranganInsidental.trim()})`
          : sesiPenimbangan || 'Tidak dicatat';

      const promptText = `Data Penimbangan:
- Kelas: ${kelas}
- Sesi Penimbangan: ${sesiText}
- Kategori Tong QR: ${kategoriTong}
- Berat Timbangan: ${typeof beratKg === 'number' ? `${beratKg.toFixed(1)} kg` : 'Tidak dicatat'}
- Status dari Petugas: ${statusPetugas || 'Belum ditentukan'}
- Quick-Tags Petugas: ${tagsText}

Analisislah foto isi tong sampah terlampir berdasarkan aturan Program Adiwiyata SMAN 1 Karang Bahagia. Sesuaikan konteks catatan evaluasi kelas dengan sesi penimbangannya (misalnya jajanan istirahat pagi, makan siang, atau kegiatan insidental sekolah) dan berikan hasil terstruktur sesuai skema JSON.`;

      const response = await generateVerificationWithRetry(ai, inlineImage, promptText);

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({ error: 'Asisten AI tidak mengembalikan hasil evaluasi. Silakan coba ulang.' });
        return;
      }

      const parsed = JSON.parse(rawText) as VerifikasiHasil;
      res.json({ result: parsed });
    } catch (error: unknown) {
      const { statusCode, message } = formatReadableError(error);
      res.status(statusCode).json({ error: message });
    }
  });

  app.post('/api/monthly-report', async (req, res) => {
    try {
      const body = req.body as Partial<MonthlyRecapInput>;
      if (!body.bulan || body.totalOrganikKg === undefined || body.totalNonOrganikKg === undefined) {
        res.status(400).json({ error: 'Data rekapitulasi bulanan belum lengkap.' });
        return;
      }

      const ai = createGeminiClient();
      const topList = (body.topClasses || [])
        .map((c) => `${c.kelas} (Skor ${c.skor})`)
        .join(', ');
      const violationList = (body.violationClasses || [])
        .map((v, i) => `  ${i + 1}. ${v.kelas} (${v.pola})`)
        .join('\n');

      const sesiBreakdownText =
        body.sesiPagiKg !== undefined ||
        body.sesiSiangKg !== undefined ||
        body.sesiInsidentalKg !== undefined
          ? `\nDistribusi Berat per Sesi Penimbangan:\n- Sesi Pagi (10.30-11.00): ${body.sesiPagiKg ?? 0} kg\n- Sesi Siang (12.30-13.00): ${body.sesiSiangKg ?? 0} kg\n- Insidental (Jumat Bersih & Kegiatan Sekolah): ${body.sesiInsidentalKg ?? 0} kg`
          : '';

      const promptText = `Buatkan Laporan Evaluasi Pengelolaan Sampah Bulan ${body.bulan} berdasarkan rekap data berikut:
- Total Sampah Organik: ${body.totalOrganikKg} kg
- Total Sampah Non-Organik: ${body.totalNonOrganikKg} kg
- Distribusi Status Pilah: Terpilah Sempurna (${body.persenTerpilahSempurna}%), Tercampur Ringan (${body.persenTercampurRingan}%), Tidak Dipilah (${body.persenTidakDipilah}%)${sesiBreakdownText}
- Top 3 Kelas Terdisiplin: ${topList || 'Belum ada data'}
- 3 Kelas dengan Pelanggaran Terbanyak:
${violationList || '  Tidak ada catatan pelanggaran'}

Gunakan perhitungan rasio yang akurat dari total sampah dan susun estimasi dampak positif lingkungan yang realistis (misalnya konversi kompos ~35-45% dari berat organik yang terpilah baik, serta material daur ulang potensial dari sampah non-organik bersih).`;

      const response = await generateMonthlyReportWithRetry(ai, promptText);
      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({ error: 'Asisten AI tidak mengembalikan laporan evaluasi. Silakan coba ulang.' });
        return;
      }

      const parsed = JSON.parse(rawText) as MonthlyReportOutput;
      res.json({ report: parsed });
    } catch (error: unknown) {
      const { statusCode, message } = formatReadableError(error);
      res.status(statusCode).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Adiwiyata berjalan di http://0.0.0.0:${PORT}`);
  });
}

startServer();
