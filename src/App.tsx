import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  QrCode,
  ClipboardCheck,
  Printer,
  Sparkles,
  FileDown,
  Settings,
  Menu,
  X,
  Leaf,
  UserCog,
  LogOut,
} from 'lucide-react';
import { INITIAL_MASTER_DATA } from './constants';
import type {
  AuthUser,
  BinItem,
  ClassItem,
  EvaluasiRecord,
  KategoriTong,
  MasterData,
  Role,
  SesiPenimbangan,
  StatusPilah,
} from './types';
import {
  buildStandardQrCodeId,
  createBin,
  createClass,
  createDefaultBinsForClass,
  createWeighingLog,
  deleteBin,
  deleteClass,
  deleteWeighingLog,
  fetchBins,
  fetchClasses,
  fetchWeighingLogs,
  updateBin,
  updateClass,
  updateWeighingLog,
} from './lib/supabase';
import { LoginView } from './components/LoginView';
import { AccountSettingsView } from './components/AccountSettingsView';
import { DashboardLeaderboardView } from './components/DashboardLeaderboardView';
import { VerificationWorkbench } from './components/VerificationWorkbench';
import { EvaluationBoard } from './components/EvaluationBoard';
import { QrManagementView } from './components/QrManagementView';
import { MonthlyReportView } from './components/MonthlyReportView';
import { ExportCenterView } from './components/ExportCenterView';
import { MasterDataView } from './components/MasterDataView';

const MASTER_PREFS_STORAGE_KEY = 'kaizeno_master_prefs_v1';

function loadLocalMasterPrefs(): MasterData {
  try {
    const raw = localStorage.getItem(MASTER_PREFS_STORAGE_KEY);
    if (!raw) return INITIAL_MASTER_DATA;
    const parsed = JSON.parse(raw) as Partial<MasterData>;
    return {
      daftarKelas: INITIAL_MASTER_DATA.daftarKelas,
      quickTagsOrganik: Array.isArray(parsed.quickTagsOrganik)
        ? parsed.quickTagsOrganik
        : INITIAL_MASTER_DATA.quickTagsOrganik,
      quickTagsNonOrganik: Array.isArray(parsed.quickTagsNonOrganik)
        ? parsed.quickTagsNonOrganik
        : INITIAL_MASTER_DATA.quickTagsNonOrganik,
      users: Array.isArray(parsed.users) ? parsed.users : INITIAL_MASTER_DATA.users,
    };
  } catch {
    return INITIAL_MASTER_DATA;
  }
}

interface MenuItem {
  id: string;
  label: string;
  shortDesc: string;
  icon: React.ElementType;
  allowedRoles: Role[];
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard & Klasemen',
    shortDesc: 'Grafik Organik vs Non-Organik & Peringkat Kelas',
    icon: LayoutDashboard,
    allowedRoles: ['Admin', 'Petugas Timbang', 'Wali Kelas', 'Kepala Sekolah'],
  },
  {
    id: 'scanner',
    label: 'Scanner QR & Timbang',
    shortDesc: 'Pindai QR tong kelas, timbang, foto bukti & catatan AI',
    icon: QrCode,
    allowedRoles: ['Admin', 'Petugas Timbang'],
  },
  {
    id: 'evaluasi',
    label: 'Papan Evaluasi Kelas',
    shortDesc: 'Log riwayat penimbangan, filter kelas & evaluasi AI',
    icon: ClipboardCheck,
    allowedRoles: ['Admin', 'Petugas Timbang', 'Wali Kelas'],
  },
  {
    id: 'cetak-qr',
    label: 'Manajemen & Cetak QR',
    shortDesc: 'Generator & cetak stiker QR Tong Organik & Non-Organik',
    icon: Printer,
    allowedRoles: ['Admin'],
  },
  {
    id: 'asisten-ai',
    label: 'Asisten Laporan AI',
    shortDesc: 'Evaluasi bulanan Adiwiyata & deteksi pelanggar berulang',
    icon: Sparkles,
    allowedRoles: ['Admin', 'Kepala Sekolah'],
  },
  {
    id: 'unduh-laporan',
    label: 'Pusat Unduh Laporan',
    shortDesc: 'Ekspor rekap berita acara PDF & Excel/CSV',
    icon: FileDown,
    allowedRoles: ['Admin', 'Kepala Sekolah'],
  },
  {
    id: 'data-master',
    label: 'Data Master & Pengguna',
    shortDesc: 'Kelola daftar kelas, quick-tags & akun pengguna',
    icon: Settings,
    allowedRoles: ['Admin'],
  },
  {
    id: 'pengaturan-akun',
    label: 'Pengaturan Akun',
    shortDesc: 'Ganti username dan password akun Anda',
    icon: UserCog,
    allowedRoles: ['Admin', 'Petugas Timbang', 'Wali Kelas', 'Kepala Sekolah'],
  },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [bins, setBins] = useState<BinItem[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluasiRecord[]>([]);
  const [isLoadingBoard, setIsLoadingBoard] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [masterData, setMasterData] = useState<MasterData>(() => loadLocalMasterPrefs());
  const [resetSignal, setResetSignal] = useState<number>(0);

  const fetchInitialData = useCallback(async () => {
    setIsLoadingBoard(true);
    setDataError(null);
    try {
      const [classesList, binsList, logsList] = await Promise.all([
        fetchClasses(),
        fetchBins(),
        fetchWeighingLogs(),
      ]);
      setClasses(classesList);
      setBins(binsList);
      setEvaluations(logsList);
    } catch (err) {
      setDataError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat data dari Supabase. Pastikan skema tabel sudah dijalankan.'
      );
    } finally {
      setIsLoadingBoard(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchInitialData();
    }
  }, [currentUser, fetchInitialData]);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    const permitted = MENU_ITEMS.filter((m) => m.allowedRoles.includes(user.role));
    setActiveMenu(permitted[0]?.id || 'dashboard');
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveMenu('dashboard');
    setMobileMenuOpen(false);
  };

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const currentRole = currentUser.role;
  const visibleMenus = MENU_ITEMS.filter((item) =>
    item.allowedRoles.includes(currentRole)
  );
  const primaryMenus = visibleMenus.filter((m) => m.id !== 'pengaturan-akun');
  const accountMenu = visibleMenus.find((m) => m.id === 'pengaturan-akun');

  const currentMenuObj =
    visibleMenus.find((m) => m.id === activeMenu) || visibleMenus[0];

  const classNames = classes.map((c) => c.name);

  // CRUD Classes (Supabase: classes + default bins)
  const handleAddClass = async (name: string) => {
    const created = await createClass(name);
    setClasses((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
    );
    try {
      const createdBins = await createDefaultBinsForClass(created);
      setBins((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const fresh = createdBins.filter((b) => !existingIds.has(b.id));
        return [...prev, ...fresh];
      });
    } catch {
      // Class creation succeeded; bin sync can be retried from QrManagementView
    }
  };

  const handleUpdateClass = async (classId: string, newName: string) => {
    const prevClass = classes.find((c) => c.id === classId);
    const updated = await updateClass(classId, newName);
    setClasses((prev) =>
      prev
        .map((c) => (c.id === classId ? updated : c))
        .sort((a, b) => a.name.localeCompare(b.name))
    );

    const relatedBins = bins.filter(
      (b) => b.class_id === classId || (prevClass && b.kelas === prevClass.name)
    );
    if (relatedBins.length > 0) {
      const updatedBins = await Promise.all(
        relatedBins.map((b) =>
          updateBin(b.id, {
            kelas: updated.name,
            qr_code_id: buildStandardQrCodeId(updated.name, b.kategori),
          })
        )
      );
      const updatedMap = new Map(updatedBins.map((b) => [b.id, b]));
      setBins((prev) => prev.map((b) => updatedMap.get(b.id) ?? b));
    }
  };

  const handleDeleteClass = async (classId: string, className: string) => {
    await deleteClass(classId);
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    setBins((prev) =>
      prev.filter((b) => b.class_id !== classId && b.kelas !== className)
    );
  };

  // CRUD Bins (Supabase: bins)
  const handleCreateBin = async (input: {
    class_id?: string | null;
    kelas: string;
    kategori: KategoriTong;
    qr_code_id?: string;
  }) => {
    const created = await createBin(input);
    setBins((prev) => [...prev, created]);
  };

  const handleUpdateBin = async (
    binId: string,
    updates: Partial<Pick<BinItem, 'kelas' | 'kategori' | 'qr_code_id' | 'class_id'>>
  ) => {
    const updated = await updateBin(binId, updates);
    setBins((prev) => prev.map((b) => (b.id === binId ? updated : b)));
  };

  const handleDeleteBin = async (binId: string) => {
    await deleteBin(binId);
    setBins((prev) => prev.filter((b) => b.id !== binId));
  };

  const handleSyncBins = async () => {
    for (const c of classes) {
      const hasOrg = bins.some(
        (b) => (b.class_id === c.id || b.kelas === c.name) && b.kategori === 'ORGANIK'
      );
      const hasNon = bins.some(
        (b) => (b.class_id === c.id || b.kelas === c.name) && b.kategori === 'NON-ORGANIK'
      );
      if (!hasOrg || !hasNon) {
        await createDefaultBinsForClass(c);
      }
    }
    const latestBins = await fetchBins();
    setBins(latestBins);
  };

  // CRUD Weighing Logs (Supabase: weighing_logs)
  const handleSaveEvaluation = async (
    record: Omit<EvaluasiRecord, 'id' | 'waktuCatat'>
  ) => {
    const matchedClass = classes.find((c) => c.name === record.kelas);
    const created = await createWeighingLog({
      ...record,
      classId: matchedClass?.id ?? null,
    });
    setEvaluations((prev) => [created, ...prev]);
  };

  const handleUpdateEvaluation = async (
    id: string,
    updates: {
      beratKg: number;
      sesiPenimbangan: SesiPenimbangan;
      keteranganInsidental?: string;
      statusPetugas: StatusPilah;
      hasil: EvaluasiRecord['hasil'];
    }
  ) => {
    const updated = await updateWeighingLog(id, updates);
    setEvaluations((prev) => prev.map((item) => (item.id === id ? updated : item)));
  };

  const handleDeleteEvaluation = async (id: string) => {
    await deleteWeighingLog(id);
    setEvaluations((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateMasterData = async (next: MasterData) => {
    const sanitized: MasterData = {
      ...next,
      daftarKelas: classNames,
    };
    try {
      localStorage.setItem(MASTER_PREFS_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore storage quota errors
    }
    setMasterData(sanitized);
  };

  const handleQuickGoScanner = () => {
    setActiveMenu('scanner');
    setResetSignal((n) => n + 1);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canAccessScanner =
    currentRole === 'Admin' || currentRole === 'Petugas Timbang';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row">
      {/* Sidebar Desktop (Fixed 260px) */}
      <aside className="hidden md:flex md:w-[260px] md:fixed md:inset-y-0 md:left-0 md:flex-col bg-emerald-950 text-white z-20 print:hidden">
        <div className="px-5 py-5 border-b border-emerald-800/60 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-400/30 shrink-0">
            <Leaf className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm leading-tight truncate">
              Laporan KAIZEN-O
            </h1>
            <p className="text-[11px] text-emerald-300 truncate mt-0.5">
              SMAN 1 Karang Bahagia
            </p>
          </div>
        </div>

        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto" aria-label="Menu Utama">
          <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-300/80">
            Menu Utama
          </p>
          {primaryMenus.map((item) => {
            const Icon = item.icon;
            const isActive = currentMenuObj?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveMenu(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[42px] rounded-xl text-left transition-colors ${
                  isActive
                    ? 'bg-[#059669] text-white font-semibold'
                    : 'text-emerald-100/80 hover:bg-emerald-900/70 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="text-sm truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Account Menu & Logout */}
        <div className="p-3.5 border-t border-emerald-800/60 space-y-1.5">
          {accountMenu && (
            <button
              type="button"
              onClick={() => setActiveMenu(accountMenu.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[42px] rounded-xl text-left transition-colors ${
                currentMenuObj?.id === accountMenu.id
                  ? 'bg-[#059669] text-white font-semibold'
                  : 'text-emerald-100/80 hover:bg-emerald-900/70 hover:text-white'
              }`}
            >
              <UserCog className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="text-sm truncate">{accountMenu.label}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[42px] rounded-xl text-left text-emerald-200 hover:bg-red-950/60 hover:text-red-200 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="text-sm truncate">Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header & Drawer */}
      <div className="md:hidden bg-emerald-950 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 border-b border-emerald-800/60 print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <Leaf className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <span className="font-display font-bold text-sm block truncate">
              KAIZEN-O SMAN 1 Karang Bahagia
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-emerald-900 text-emerald-100"
          aria-label={mobileMenuOpen ? 'Tutup Menu' : 'Buka Menu'}
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Menu className="w-5 h-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <nav
          className="md:hidden bg-emerald-900 text-white px-4 py-3 space-y-1 border-b border-emerald-800 print:hidden"
          aria-label="Navigasi Mobile"
        >
          {visibleMenus.map((item) => {
            const Icon = item.icon;
            const isActive = currentMenuObj?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveMenu(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-left ${
                  isActive ? 'bg-[#059669] font-semibold text-white' : 'text-emerald-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-left text-red-200 hover:bg-red-950/50"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Keluar (Logout)</span>
          </button>
        </nav>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-[260px]">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 print:hidden">
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 truncate">
              {currentMenuObj?.label}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              SMAN 1 Karang Bahagia • KAIZEN-O — {currentMenuObj?.shortDesc}
            </p>
          </div>

          {/* Active Profile Bar + Account Shortcut + Logout */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="font-semibold text-slate-900">
                {currentUser.full_name}
              </span>
              <span className="text-slate-400 mx-1.5" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-slate-600">@{currentUser.username}</span>
              <span className="text-slate-400 mx-1.5" aria-hidden="true">
                ·
              </span>
              <span className="font-semibold text-[#059669]">{currentUser.role}</span>
            </div>

            <button
              type="button"
              onClick={() => setActiveMenu('pengaturan-akun')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl transition-colors whitespace-nowrap"
            >
              <UserCog className="w-3.5 h-3.5 text-[#059669]" aria-hidden="true" />
              <span>Pengaturan Akun</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-medium bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-slate-700 rounded-xl transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Active View Content */}
        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-8 space-y-4">
          {dataError && (
            <div
              role="alert"
              className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between gap-3"
            >
              <span>{dataError}</span>
              <button
                type="button"
                onClick={fetchInitialData}
                className="font-semibold underline shrink-0"
              >
                Muat Ulang
              </button>
            </div>
          )}

          {currentMenuObj?.id === 'dashboard' && (
            <DashboardLeaderboardView
              evaluations={evaluations}
              daftarKelas={classNames}
              currentRole={currentRole}
              onNavigate={(id) => setActiveMenu(id)}
            />
          )}

          {currentMenuObj?.id === 'scanner' && (
            <VerificationWorkbench
              daftarKelas={classNames}
              quickTagsOrganik={masterData.quickTagsOrganik}
              quickTagsNonOrganik={masterData.quickTagsNonOrganik}
              onSaveEvaluation={handleSaveEvaluation}
              onOpenBoard={() => setActiveMenu('evaluasi')}
              resetSignal={resetSignal}
            />
          )}

          {currentMenuObj?.id === 'evaluasi' && (
            <EvaluationBoard
              evaluations={evaluations}
              isLoading={isLoadingBoard}
              currentRole={currentRole}
              onUpdateEvaluation={handleUpdateEvaluation}
              onDeleteEvaluation={handleDeleteEvaluation}
              onGoToVerify={handleQuickGoScanner}
            />
          )}

          {currentMenuObj?.id === 'cetak-qr' && (
            <QrManagementView
              classes={classes}
              bins={bins}
              onCreateBin={handleCreateBin}
              onUpdateBin={handleUpdateBin}
              onDeleteBin={handleDeleteBin}
              onSyncBins={handleSyncBins}
            />
          )}

          {currentMenuObj?.id === 'asisten-ai' && (
            <MonthlyReportView evaluations={evaluations} />
          )}

          {currentMenuObj?.id === 'unduh-laporan' && (
            <ExportCenterView evaluations={evaluations} />
          )}

          {currentMenuObj?.id === 'data-master' && (
            <MasterDataView
              classes={classes}
              onAddClass={handleAddClass}
              onUpdateClass={handleUpdateClass}
              onDeleteClass={handleDeleteClass}
              masterData={{ ...masterData, daftarKelas: classNames }}
              onUpdateMasterData={handleUpdateMasterData}
            />
          )}

          {currentMenuObj?.id === 'pengaturan-akun' && (
            <AccountSettingsView
              currentUser={currentUser}
              onUserUpdated={(updated) => setCurrentUser(updated)}
            />
          )}
        </main>
      </div>

      {/* Mobile Floating Quick-Access Button to Scanner QR & Timbang */}
      {canAccessScanner && currentMenuObj?.id !== 'scanner' && (
        <button
          type="button"
          onClick={handleQuickGoScanner}
          className="md:hidden fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 px-4 py-3 min-h-[46px] bg-[#059669] hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-lg print:hidden"
        >
          <QrCode className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Scanner QR & Timbang</span>
        </button>
      )}
    </div>
  );
}
