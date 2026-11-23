import React, { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import type { MasterData, Role, UserAccount } from '../types';

interface MasterDataViewProps {
  masterData: MasterData;
  onUpdateMasterData: (next: MasterData) => Promise<void>;
}

const ROLES: Role[] = ['Admin', 'Petugas Timbang', 'Wali Kelas', 'Kepala Sekolah'];

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  masterData,
  onUpdateMasterData,
}) => {
  const [newKelas, setNewKelas] = useState('');
  const [newTagOrganik, setNewTagOrganik] = useState('');
  const [newTagNonOrganik, setNewTagNonOrganik] = useState('');
  const [newUser, setNewUser] = useState<{
    nama: string;
    email: string;
    peran: Role;
    kelasBinaan: string;
  }>({
    nama: '',
    email: '',
    peran: 'Petugas Timbang',
    kelasBinaan: '',
  });
  const [savingMsg, setSavingMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const persist = async (next: MasterData, label: string) => {
    setErrorMsg(null);
    try {
      await onUpdateMasterData(next);
      setSavingMsg(label);
      setTimeout(() => setSavingMsg(null), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan data master.');
    }
  };

  const handleAddKelas = async () => {
    const val = newKelas.trim().toUpperCase();
    if (!val || masterData.daftarKelas.includes(val)) return;
    await persist(
      { ...masterData, daftarKelas: [...masterData.daftarKelas, val] },
      `Kelas ${val} ditambahkan`
    );
    setNewKelas('');
  };

  const handleRemoveKelas = async (kelas: string) => {
    await persist(
      {
        ...masterData,
        daftarKelas: masterData.daftarKelas.filter((k) => k !== kelas),
      },
      `Kelas ${kelas} dihapus`
    );
  };

  const handleAddTag = async (type: 'organik' | 'nonOrganik') => {
    const raw = type === 'organik' ? newTagOrganik : newTagNonOrganik;
    const val = raw.trim();
    if (!val) return;
    if (type === 'organik') {
      if (masterData.quickTagsOrganik.includes(val)) return;
      await persist(
        { ...masterData, quickTagsOrganik: [...masterData.quickTagsOrganik, val] },
        'Quick-Tag Organik disimpan'
      );
      setNewTagOrganik('');
    } else {
      if (masterData.quickTagsNonOrganik.includes(val)) return;
      await persist(
        {
          ...masterData,
          quickTagsNonOrganik: [...masterData.quickTagsNonOrganik, val],
        },
        'Quick-Tag Non-Organik disimpan'
      );
      setNewTagNonOrganik('');
    }
  };

  const handleRemoveTag = async (type: 'organik' | 'nonOrganik', tag: string) => {
    if (type === 'organik') {
      await persist(
        {
          ...masterData,
          quickTagsOrganik: masterData.quickTagsOrganik.filter((t) => t !== tag),
        },
        'Quick-Tag dihapus'
      );
    } else {
      await persist(
        {
          ...masterData,
          quickTagsNonOrganik: masterData.quickTagsNonOrganik.filter((t) => t !== tag),
        },
        'Quick-Tag dihapus'
      );
    }
  };

  const handleAddUser = async () => {
    if (!newUser.nama.trim() || !newUser.email.trim()) return;
    const created: UserAccount = {
      id: `usr-${Date.now()}`,
      nama: newUser.nama.trim(),
      email: newUser.email.trim(),
      peran: newUser.peran,
      kelasBinaan: newUser.peran === 'Wali Kelas' ? newUser.kelasBinaan.trim() : undefined,
      aktif: true,
    };
    await persist(
      { ...masterData, users: [...masterData.users, created] },
      'Akun pengguna ditambahkan'
    );
    setNewUser({ nama: '', email: '', peran: 'Petugas Timbang', kelasBinaan: '' });
  };

  const handleToggleUser = async (id: string) => {
    await persist(
      {
        ...masterData,
        users: masterData.users.map((u) => (u.id === id ? { ...u, aktif: !u.aktif } : u)),
      },
      'Status akun diperbarui'
    );
  };

  const handleDeleteUser = async (id: string) => {
    await persist(
      { ...masterData, users: masterData.users.filter((u) => u.id !== id) },
      'Akun pengguna dihapus'
    );
  };

  return (
    <section className="space-y-6">
      {(savingMsg || errorMsg) && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            errorMsg
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-[#059669]'
          }`}
        >
          {!errorMsg && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
          <span>{errorMsg || savingMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Daftar Kelas */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Daftar Kelas</h3>
              <p className="text-xs text-slate-500">
                Tersinkron ke Scanner QR & Generator Stiker
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {masterData.daftarKelas.length} kelas
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newKelas}
              onChange={(e) => setNewKelas(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddKelas()}
              placeholder="Tambah kelas (misal XI-7)"
              className="flex-1 px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
            />
            <button
              type="button"
              onClick={handleAddKelas}
              className="inline-flex items-center gap-1 px-3.5 py-2 min-h-[40px] text-xs font-semibold bg-[#059669] hover:bg-emerald-700 text-white rounded-lg shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Tambah</span>
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
            {masterData.daftarKelas.map((kelas) => (
              <div
                key={kelas}
                className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                <span>{kelas}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveKelas(kelas)}
                  aria-label={`Hapus kelas ${kelas}`}
                  className="text-slate-400 hover:text-red-600 ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Quick-Tags Pelanggaran */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="pb-3 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Quick-Tags Observasi Petugas
            </h3>
            <p className="text-xs text-slate-500">
              Pilihan catatan cepat saat petugas memindai tong Organik maupun Non-Organik
            </p>
          </div>

          {/* Organik tags */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-[#059669]">
              Quick-Tags Tong Organik
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagOrganik}
                onChange={(e) => setNewTagOrganik(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag('organik')}
                placeholder="Tambah quick-tag untuk tong organik..."
                className="flex-1 px-3 py-2 min-h-[38px] text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              />
              <button
                type="button"
                onClick={() => handleAddTag('organik')}
                className="px-3 py-2 min-h-[38px] text-xs font-semibold bg-slate-900 text-white rounded-lg shrink-0"
              >
                Tambah
              </button>
            </div>
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {masterData.quickTagsOrganik.map((tag) => (
                <li
                  key={tag}
                  className="px-3 py-2 flex items-center justify-between text-xs text-slate-700"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag('organik', tag)}
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Hapus tag ${tag}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Non-Organik tags */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold text-[#D97706]">
              Quick-Tags Tong Non-Organik
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagNonOrganik}
                onChange={(e) => setNewTagNonOrganik(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag('nonOrganik')}
                placeholder="Tambah quick-tag untuk tong non-organik..."
                className="flex-1 px-3 py-2 min-h-[38px] text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              />
              <button
                type="button"
                onClick={() => handleAddTag('nonOrganik')}
                className="px-3 py-2 min-h-[38px] text-xs font-semibold bg-slate-900 text-white rounded-lg shrink-0"
              >
                Tambah
              </button>
            </div>
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {masterData.quickTagsNonOrganik.map((tag) => (
                <li
                  key={tag}
                  className="px-3 py-2 flex items-center justify-between text-xs text-slate-700"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag('nonOrganik', tag)}
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Hapus tag ${tag}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Akun Pengguna & Hak Akses */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Akun Pengguna & Hak Akses Peran
            </h3>
            <p className="text-xs text-slate-500">
              Kelola pembina Adiwiyata, petugas timbang pokja, wali kelas, dan pimpinan sekolah
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500">
            {masterData.users.length} pengguna terdaftar
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <input
            type="text"
            value={newUser.nama}
            onChange={(e) => setNewUser((u) => ({ ...u, nama: e.target.value }))}
            placeholder="Nama lengkap & gelar"
            className="px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
          />
          <input
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
            placeholder="Email sekolah / belajar.id"
            className="px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
          />
          <select
            value={newUser.peran}
            onChange={(e) =>
              setNewUser((u) => ({ ...u, peran: e.target.value as Role }))
            }
            className="px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newUser.kelasBinaan}
            disabled={newUser.peran !== 'Wali Kelas'}
            onChange={(e) =>
              setNewUser((u) => ({ ...u, kelasBinaan: e.target.value }))
            }
            placeholder="Kelas binaan (opsional)"
            className="px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAddUser}
            className="px-4 py-2 min-h-[40px] text-xs font-semibold bg-[#059669] hover:bg-emerald-700 text-white rounded-lg"
          >
            Tambah Akun
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-3">Nama</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Peran</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 pl-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {masterData.users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 pr-3 font-semibold text-slate-900">
                    {user.nama}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600">
                    {user.email}
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {user.peran}
                    {user.kelasBinaan ? ` · ${user.kelasBinaan}` : ''}
                  </td>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleToggleUser(user.id)}
                      className={`text-xs font-semibold ${
                        user.aktif ? 'text-[#059669]' : 'text-slate-400'
                      }`}
                    >
                      {user.aktif ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      aria-label={`Hapus akun ${user.nama}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
