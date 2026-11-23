import { GoogleGenAI, Type } from '@google/genai';
import type {
  MonthlyRecapInput,
  MonthlyReportOutput,
} from '../types';

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
        return 'Layanan AI sedang padat sementara. Silakan coba lagi beberapa saat lagi.';
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
