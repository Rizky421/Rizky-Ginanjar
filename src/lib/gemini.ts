import { GoogleGenAI, Type } from '@google/genai';
import type {
  KategoriTong,
  MonthlyRecapInput,
  MonthlyReportOutput,
  SesiPenimbangan,
  StatusPilah,
  VerifikasiHasil,
} from '../types';

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

function createClientGemini(): GoogleGenAI {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || '';
  if (!apiKey) {
    throw new Error(
      'VITE_GEMINI_API_KEY belum tersedia di environment aplikasi. Tambahkan VITE_GEMINI_API_KEY pada pengaturan Environment Variables (Vercel / .env).'
    );
  }
  return new GoogleGenAI({ apiKey });
}

function formatReadableGeminiError(error: unknown): string {
  const errObj = error as { status?: number; message?: string };
  let rawMessage = errObj?.message || 'Terjadi kendala saat menghubungi layanan Gemini AI.';
  let statusCode = typeof errObj?.status === 'number' ? errObj.status : 0;

  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: { code?: number; message?: string; status?: string };
    };
    if (parsed?.error) {
      if (typeof parsed.error.code === 'number') {
        statusCode = parsed.error.code;
      }
      if (parsed.error.status === 'UNAVAILABLE' || statusCode === 503) {
        return 'Layanan verifikasi AI sedang padat sementara. Silakan coba lagi beberapa saat lagi.';
      }
      if (parsed.error.message) {
        rawMessage = parsed.error.message;
      }
    }
  } catch {
    // Plain text message
  }

  return rawMessage;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar sampel.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (match?.[1]) {
        resolve(match[1]);
      } else {
        reject(new Error('Gagal mengonversi foto sampel ke format base64.'));
      }
    };
    reader.readAsDataURL(blob);
  });
}

async function resolveClientImagePart(params: {
  imageBase64?: string;
  imageMimeType?: string;
  sampleImagePath?: string;
}): Promise<{ mimeType: string; data: string }> {
  if (params.imageBase64 && typeof params.imageBase64 === 'string') {
    const dataUrlMatch = params.imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (dataUrlMatch) {
      return { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] };
    }
    return {
      mimeType:
        params.imageMimeType && params.imageMimeType.startsWith('image/')
          ? params.imageMimeType
          : 'image/jpeg',
      data: params.imageBase64,
    };
  }

  if (params.sampleImagePath && typeof params.sampleImagePath === 'string') {
    const res = await fetch(params.sampleImagePath);
    if (!res.ok) {
      throw new Error('Foto sampel tidak dapat dimuat dari aset aplikasi.');
    }
    const blob = await res.blob();
    const data = await blobToBase64(blob);
    const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
    return { mimeType, data };
  }

  throw new Error('Foto isi tong sampah wajib dilampirkan untuk verifikasi visual.');
}

async function runWithTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
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
        throw new Error(formatReadableGeminiError(err));
      }
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }

  throw new Error(formatReadableGeminiError(lastError));
}

export async function verifyWasteWithGemini(params: {
  kelas: string;
  kategoriTong: KategoriTong;
  sesiPenimbangan?: SesiPenimbangan;
  keteranganInsidental?: string;
  statusPetugas?: StatusPilah;
  quickTags?: string[];
  beratKg?: number;
  imageBase64?: string;
  imageMimeType?: string;
  sampleImagePath?: string;
}): Promise<VerifikasiHasil> {
  const ai = createClientGemini();
  const inlineImage = await resolveClientImagePart({
    imageBase64: params.imageBase64,
    imageMimeType: params.imageMimeType,
    sampleImagePath: params.sampleImagePath,
  });

  const tagsText =
    Array.isArray(params.quickTags) && params.quickTags.length > 0
      ? params.quickTags.join(', ')
      : 'Tidak ada';
  const sesiText =
    params.sesiPenimbangan === 'Insidental' && params.keteranganInsidental?.trim()
      ? `Insidental (${params.keteranganInsidental.trim()})`
      : params.sesiPenimbangan || 'Tidak dicatat';

  const promptText = `Data Penimbangan:
- Kelas: ${params.kelas}
- Sesi Penimbangan: ${sesiText}
- Kategori Tong QR: ${params.kategoriTong}
- Berat Timbangan: ${typeof params.beratKg === 'number' ? `${params.beratKg.toFixed(1)} kg` : 'Tidak dicatat'}
- Status dari Petugas: ${params.statusPetugas || 'Belum ditentukan'}
- Quick-Tags Petugas: ${tagsText}

Analisislah foto isi tong sampah terlampir berdasarkan aturan Program Adiwiyata SMAN 1 Karang Bahagia. Sesuaikan konteks catatan evaluasi kelas dengan sesi penimbangannya (misalnya jajanan istirahat pagi, makan siang, atau kegiatan insidental sekolah) dan berikan hasil terstruktur sesuai skema JSON.`;

  const response = await runWithTransientRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [{ inlineData: inlineImage }, { text: promptText }],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            kesesuaian_visual: {
              type: Type.BOOLEAN,
              description:
                'True jika foto sesuai dengan kategori tong QR, False jika ditemukan sampah yang tercampur.',
            },
            benda_salah_tempat: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                'Daftar jenis sampah yang tidak sesuai kategori tong (kosongkan jika sudah benar).',
            },
            catatan_evaluasi_kelas: {
              type: Type.STRING,
              description:
                'Pesan sopan dan edukatif yang akan ditampilkan di Papan Evaluasi kelas.',
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
    })
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Asisten AI tidak mengembalikan hasil evaluasi. Silakan coba ulang.');
  }

  return JSON.parse(rawText) as VerifikasiHasil;
}

export async function generateMonthlyReportWithGemini(
  input: MonthlyRecapInput
): Promise<MonthlyReportOutput> {
  const ai = createClientGemini();

  const topList = (input.topClasses || [])
    .map((c) => `${c.kelas} (Skor ${c.skor})`)
    .join(', ');
  const violationList = (input.violationClasses || [])
    .map((v, i) => `  ${i + 1}. ${v.kelas} (${v.pola})`)
    .join('\n');

  const sesiBreakdownText =
    input.sesiPagiKg !== undefined ||
    input.sesiSiangKg !== undefined ||
    input.sesiInsidentalKg !== undefined
      ? `\nDistribusi Berat per Sesi Penimbangan:\n- Sesi Pagi (10.30-11.00): ${input.sesiPagiKg ?? 0} kg\n- Sesi Siang (12.30-13.00): ${input.sesiSiangKg ?? 0} kg\n- Insidental (Jumat Bersih & Kegiatan Sekolah): ${input.sesiInsidentalKg ?? 0} kg`
      : '';

  const promptText = `Buatkan Laporan Evaluasi Pengelolaan Sampah Bulan ${input.bulan} berdasarkan rekap data berikut:
- Total Sampah Organik: ${input.totalOrganikKg} kg
- Total Sampah Non-Organik: ${input.totalNonOrganikKg} kg
- Distribusi Status Pilah: Terpilah Sempurna (${input.persenTerpilahSempurna}%), Tercampur Ringan (${input.persenTercampurRingan}%), Tidak Dipilah (${input.persenTidakDipilah}%)${sesiBreakdownText}
- Top 3 Kelas Terdisiplin: ${topList || 'Belum ada data'}
- 3 Kelas dengan Pelanggaran Terbanyak:
${violationList || '  Tidak ada catatan pelanggaran'}

Gunakan perhitungan rasio yang akurat dari total sampah dan susun estimasi dampak positif lingkungan yang realistis (misalnya konversi kompos ~35-45% dari berat organik yang terpilah baik, serta material daur ulang potensial dari sampah non-organik bersih).`;

  const response = await runWithTransientRetry(() =>
    ai.models.generateContent({
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
              description:
                'Judul resmi laporan evaluasi pengelolaan sampah bulanan SMAN 1 Karang Bahagia.',
            },
            ringkasan_eksekutif: {
              type: Type.STRING,
              description:
                'Paragraf ringkasan eksekutif formal mengenai total berat organik, non-organik, rasio pemilahan, serta estimasi dampak positif kompos dan daur ulang.',
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
              description:
                'Analisis formal mengenai tingkat kepatuhan siswa dalam memisahkan sampah berdasarkan distribusi Terpilah Sempurna, Tercampur Ringan, dan Tidak Dipilah.',
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
    })
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Asisten AI tidak mengembalikan laporan evaluasi. Silakan coba ulang.');
  }

  return JSON.parse(rawText) as MonthlyReportOutput;
}
