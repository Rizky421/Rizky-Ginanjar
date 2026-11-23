import React, { useState } from 'react';
import { Check, AlertCircle, KeyRound, Eye, EyeOff } from 'lucide-react';
import { updateUserCredentialsRpc } from '../lib/supabase';
import type { AuthUser } from '../types';

interface AccountSettingsViewProps {
  currentUser: AuthUser;
  onUserUpdated: (updated: AuthUser) => void;
}

export const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({
  currentUser,
  onUserUpdated,
}) => {
  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedUsername = newUsername.trim();
    if (!trimmedUsername) {
      setErrorMsg('Username baru tidak boleh kosong.');
      return;
    }

    if (!oldPassword) {
      setErrorMsg('Password lama wajib diisi untuk verifikasi keamanan.');
      return;
    }

    const trimmedNewPass = newPassword.trim();
    if (trimmedNewPass.length > 0) {
      if (trimmedNewPass.length < 6) {
        setErrorMsg('Password baru minimal terdiri dari 6 karakter.');
        return;
      }
      if (trimmedNewPass !== confirmPassword.trim()) {
        setErrorMsg('Konfirmasi password baru tidak sama.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const updatedUser = await updateUserCredentialsRpc({
        userId: currentUser.id,
        newUsername: trimmedUsername,
        oldPassword,
        newPassword: trimmedNewPass || undefined,
      });

      onUserUpdated(updatedUser);
      setNewUsername(updatedUser.username);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg(
        trimmedNewPass
          ? `Username (@${updatedUser.username}) dan password baru berhasil disimpan.`
          : `Username berhasil diperbarui menjadi @${updatedUser.username}.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memperbarui pengaturan akun.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="max-w-2xl space-y-6">
      {/* Active Profile Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#059669]">
            Profil Akun Aktif
          </p>
          <h3 className="font-display text-lg font-bold text-slate-900">
            {currentUser.full_name}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-mono text-slate-700">@{currentUser.username}</span>
            <span aria-hidden="true">·</span>
            <span>Peran: {currentUser.role}</span>
          </div>
        </div>
      </div>

      {/* Credential Change Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#059669]" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">
              Ganti Username & Password
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowPasswords((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            {showPasswords ? (
              <>
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sembunyikan Sandi</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tampilkan Sandi</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#059669] text-xs font-medium flex items-start gap-2"
          >
            <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="acc-new-username"
              className="block text-xs font-semibold text-slate-800"
            >
              Username Baru
            </label>
            <input
              id="acc-new-username"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 min-h-[42px] text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="acc-old-password"
              className="block text-xs font-semibold text-slate-800"
            >
              Password Lama (Wajib untuk Verifikasi)
            </label>
            <input
              id="acc-old-password"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Masukkan password saat ini"
              className="w-full px-3.5 py-2.5 min-h-[42px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
              <label
                htmlFor="acc-new-password"
                className="block text-xs font-semibold text-slate-800"
              >
                Password Baru (Opsional, min. 6 karakter)
              </label>
              <input
                id="acc-new-password"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Kosongkan jika tidak diubah"
                className="w-full px-3.5 py-2.5 min-h-[42px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="acc-confirm-password"
                className="block text-xs font-semibold text-slate-800"
              >
                Konfirmasi Password Baru
              </label>
              <input
                id="acc-confirm-password"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full px-3.5 py-2.5 min-h-[42px] text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 min-h-[44px] bg-[#059669] hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {isSaving ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Akun'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
