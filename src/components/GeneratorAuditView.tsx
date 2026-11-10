import React from 'react';
import {
  ConflictReport,
  LessonCard,
  ScheduledItem,
  SchoolClass,
  Subject,
  TahapPeriodConfig,
  Teacher,
} from '../types/timetable';
import { formatDisplayTime } from '../utils/timetableEngine';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Clock,
  ExternalLink,
  LogIn,
  LogOut,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface GeneratorAuditViewProps {
  scheduledItems: ScheduledItem[];
  lessonCards: LessonCard[];
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  tahapConfigs: TahapPeriodConfig[];
  conflicts: ConflictReport[];
  lastGeneratedAt: string;
  userEmail?: string | null;
  workspaceId: string;
  cloudSyncStatus: 'offline' | 'connecting' | 'synced' | 'syncing' | 'error';
  lastCloudSyncedAt?: string | null;
  onChangeWorkspaceId: (newId: string) => void;
  onSignInCloud: () => void;
  onSignOutCloud: () => void;
  onSyncNow: () => void;
  onGenerateNow: () => void;
  onAutoFixOverlaps: () => void;
  onResetDefaults: () => void;
  onSelectTeacher: (teacherId: string) => void;
  onSelectClass: (classId: string) => void;
}

export const GeneratorAuditView: React.FC<GeneratorAuditViewProps> = ({
  scheduledItems,
  lessonCards,
  teachers,
  classes,
  tahapConfigs,
  conflicts,
  lastGeneratedAt,
  userEmail,
  workspaceId,
  cloudSyncStatus,
  lastCloudSyncedAt,
  onChangeWorkspaceId,
  onSignInCloud,
  onSignOutCloud,
  onSyncNow,
  onGenerateNow,
  onAutoFixOverlaps,
  onResetDefaults,
  onSelectTeacher,
  onSelectClass,
}) => {
  const [workspaceInput, setWorkspaceInput] = React.useState(workspaceId);

  React.useEffect(() => {
    setWorkspaceInput(workspaceId);
  }, [workspaceId]);

  const classMap = new Map(classes.map((c) => [c.id, c]));

  const totalRequiredBlocks = lessonCards.reduce(
    (sum, c) => sum + c.blocks.reduce((a, b) => a + b, 0),
    0
  );
  const totalScheduledPeriods = scheduledItems.reduce(
    (sum, item) => sum + item.duration,
    0
  );

  const overlapConflicts = conflicts.filter(
    (c) => c.type === 'TEACHER_OVERLAP' || c.type === 'CLASS_OVERLAP'
  );

  return (
    <div className="space-y-6">
      {/* Multi-Device Cloud Sync Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <Cloud className="w-4 h-4" />
              <span>Penyegerakan Awan Semua Peranti (Cloud Sync)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Simpan dan segerakkan semua data Guru, Kelas, Subjek, Kad Pengajaran, dan Jadual Waktu secara masa nyata merentasi komputer, tablet, dan telefon pintar menggunakan Kod Workspace Sekolah yang sama.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (workspaceInput.trim()) {
                  onChangeWorkspaceId(workspaceInput.trim());
                }
              }}
              className="flex items-center gap-1.5"
            >
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Kod Sync:
              </label>
              <input
                type="text"
                value={workspaceInput}
                onChange={(e) => setWorkspaceInput(e.target.value)}
                placeholder="sk_allsaints_2026"
                className="w-40 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              {workspaceInput.trim() !== workspaceId && (
                <button
                  type="submit"
                  className="px-2.5 py-1.5 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg cursor-pointer"
                >
                  Tukar Kod
                </button>
              )}
            </form>

            {userEmail ? (
              <>
                <button
                  type="button"
                  onClick={onSyncNow}
                  className="px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      cloudSyncStatus === 'syncing' ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {cloudSyncStatus === 'syncing'
                      ? 'Menyegerak...'
                      : 'Segerak Sekarang'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onSignOutCloud}
                  title={`Log keluar (${userEmail})`}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{userEmail}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSignInCloud}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log Masuk Google Untuk Sync Semua Peranti</span>
              </button>
            )}
          </div>
        </div>

        {userEmail && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              Akaun Disambungkan: <strong className="text-slate-800 dark:text-slate-200">{userEmail}</strong> · Kod Workspace Aktif: <strong className="font-mono text-slate-800 dark:text-slate-200">{workspaceId}</strong>
            </span>
            <span className="font-mono tabular-nums">
              {cloudSyncStatus === 'synced'
                ? `Status: Disegerakkan ke semua peranti ${lastCloudSyncedAt ? `(${lastCloudSyncedAt})` : ''}`
                : cloudSyncStatus === 'syncing'
                ? 'Status: Sedang menghantar kemaskini ke awan...'
                : 'Status: Bersambung ke Cloud Firestore'}
            </span>
          </div>
        )}
      </div>

      {/* Hero Generator Control Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Enjin Penjana Jadual Waktu Berasaskan Kekangan Masa Sebenar
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              Jana Jadual Kelas &amp; Jadual Guru Tanpa Pertindihan Sesi
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Enjin ini mengambil semua input <strong>Guru</strong> (berserta Time Off), <strong>Kelas</strong> (Tahap 1, 2, 3), <strong>Subjek</strong>, <strong>Slot Masa</strong>, dan <strong>Kad Pengajaran</strong> untuk menjana jadual waktu lengkap. Pertindihan masa sebenar (contohnya Waktu 5-2 Tahap 2 <span className="font-mono">09:40-10:10</span> berbanding Waktu 5-1 Tahap 1 <span className="font-mono">10:00-10:30</span>) disekat secara automatik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onResetDefaults}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Set Semula Data Asal</span>
            </button>

            <button
              type="button"
              onClick={onGenerateNow}
              className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Jana Jadual Lengkap Sekarang</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="p-4 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Pertindihan Masa Guru &amp; Kelas
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-2xl font-extrabold font-mono tabular-nums ${
                  overlapConflicts.length === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600'
                }`}
              >
                {overlapConflicts.length}
              </span>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {overlapConflicts.length === 0
                  ? 'Sifar Pertindihan (Disahkan)'
                  : 'Perlu Semakan'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Kad Pengajaran Dijadualkan
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {totalScheduledPeriods}/{totalRequiredBlocks}
              </span>
              <span className="text-xs text-slate-500">
                waktu ({lessonCards.length} kad)
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Kelas &amp; Tahap Aktif
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {classes.length} Kelas
              </span>
              <span className="text-xs text-slate-500">
                Tahap 1, 2 &amp; 3
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Masa Penjanaan Terakhir
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                {lastGeneratedAt}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Conflict / Verification Status Box */}
      {conflicts.length === 0 ? (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 flex items-center gap-3 text-emerald-900 dark:text-emerald-200">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-xs leading-relaxed">
            <strong>Semua kekangan masa dipatuhi sepenuhnya:</strong> Tiada guru atau kad pengajaran yang mempunyai sesi pengajaran bertindih masa merentasi kelas Tahap 1, Tahap 2, dan Tahap 3, dan semua tetapan Time Off Guru, Kelas, serta Subjek telah dipatuhi.
          </div>
        </div>
      ) : (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Laporan Konflik / Amaran Kekangan ({conflicts.length})</span>
            </div>
            <button
              type="button"
              onClick={onAutoFixOverlaps}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Baiki Pertindihan Masa Automatik</span>
            </button>
          </div>
          <ul className="space-y-1.5 text-xs text-rose-700 dark:text-rose-300">
            {conflicts.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <span>•</span>
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tahap Period Time Comparison & Teacher Workload Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Cols: Tahap Time Slot Comparison */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Clock className="w-4 h-4 text-rose-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Perbandingan Slot Masa Mengikut Tahap (1, 2, 3)
            </h2>
          </div>

          <div className="space-y-4">
            {tahapConfigs.map((cfg) => {
              const tahapClasses = classes.filter((c) => c.tahap === cfg.tahap);
              return (
                <div
                  key={cfg.tahap}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {cfg.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {tahapClasses.map((c) => c.shortName).join(', ')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cfg.periods.map((p) => (
                      <div
                        key={p.id}
                        className={`px-2 py-1 rounded border text-[10px] font-mono tabular-nums ${
                          p.isBreak
                            ? 'bg-amber-100/80 border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="font-bold">{p.code}:</span>{' '}
                        {formatDisplayTime(p.startTime)}-
                        {formatDisplayTime(p.endTime)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 7 Cols: Teacher Workload & Overlap Audit Table */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Ringkasan Beban Waktu Guru &amp; Status Pertindihan Merentasi Tahap
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  <th className="p-2.5">Guru</th>
                  <th className="p-2.5">Kelas Diajar</th>
                  <th className="p-2.5 text-right">Tahap 1</th>
                  <th className="p-2.5 text-right">Tahap 2/3</th>
                  <th className="p-2.5 text-right">Jumlah Waktu</th>
                  <th className="p-2.5 text-center">Status Masa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {teachers.map((t) => {
                  const tItems = scheduledItems.filter((i) =>
                    i.teacherIds.includes(t.id)
                  );
                  const tClassIds = Array.from(
                    new Set(tItems.map((i) => i.classId))
                  );
                  const t1Periods = tItems
                    .filter((i) => classMap.get(i.classId)?.tahap === 1)
                    .reduce((a, b) => a + b.duration, 0);
                  const t23Periods = tItems
                    .filter((i) => (classMap.get(i.classId)?.tahap || 1) >= 2)
                    .reduce((a, b) => a + b.duration, 0);
                  const total = t1Periods + t23Periods;

                  const hasOverlap = overlapConflicts.some(
                    (c) => c.teacherId === t.id
                  );

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="p-2.5">
                        <button
                          type="button"
                          onClick={() => onSelectTeacher(t.id)}
                          className="font-bold text-slate-900 dark:text-white hover:text-rose-600 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{t.shortName}</span>
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </button>
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                          {t.fullName}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {tClassIds.map((cid) => {
                            const cls = classMap.get(cid);
                            return (
                              <button
                                key={cid}
                                type="button"
                                onClick={() => onSelectClass(cid)}
                                className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                              >
                                {cls?.shortName}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-2.5 text-right font-mono tabular-nums">
                        {t1Periods}w
                      </td>
                      <td className="p-2.5 text-right font-mono tabular-nums">
                        {t23Periods}w
                      </td>
                      <td className="p-2.5 text-right font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {total}w
                      </td>
                      <td className="p-2.5 text-center">
                        {!hasOverlap ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Sah</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Bertindih</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
