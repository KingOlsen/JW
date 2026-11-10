import React, { useState } from 'react';
import {
  DayKey,
  ScheduledItem,
  SchoolClass,
  Subject,
  TahapPeriodConfig,
  Teacher,
} from '../types/timetable';
import {
  DAYS,
  formatDisplayTime,
  getClassPeriods,
  isInTimeOff,
} from '../utils/timetableEngine';
import { SUBJECT_COLOR_STYLES } from '../data/initialData';
import {
  ExternalLink,
  ArrowRightLeft,
  Lock,
  Ban,
  Plus,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface ClassTimetableViewProps {
  schoolClass: SchoolClass;
  classIndex: number;
  totalClasses: number;
  scheduledItems: ScheduledItem[];
  teachers: Teacher[];
  subjects: Subject[];
  tahapConfigs: TahapPeriodConfig[];
  generatedAt: string;
  onSelectTeacher: (teacherId: string) => void;
  onMoveScheduledItem: (
    itemId: string,
    targetDay: DayKey,
    targetStartPeriodCode: string
  ) => { ok: boolean; reason?: string };
  onOpenLessonCardsForClass: (classId: string) => void;
  onRegenerateAll: () => void;
}

export const ClassTimetableView: React.FC<ClassTimetableViewProps> = ({
  schoolClass,
  classIndex,
  totalClasses,
  scheduledItems,
  teachers,
  subjects,
  tahapConfigs,
  generatedAt,
  onSelectTeacher,
  onMoveScheduledItem,
  onOpenLessonCardsForClass,
  onRegenerateAll,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayKey | 'ALL'>('ALL');
  const [highlightedSubjectId, setHighlightedSubjectId] = useState<string | 'ALL'>('ALL');
  const [colorMode, setColorMode] = useState<'moden' | 'monokrom'>('moden');
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [moveFeedback, setMoveFeedback] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<boolean>(false);

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const classPeriods = getClassPeriods(schoolClass, tahapConfigs);
  const breakPeriod = classPeriods.find((p) => p.isBreak);
  const classTeacher = teacherMap.get(schoolClass.classTeacherId);

  const classItems = scheduledItems.filter((item) => item.classId === schoolClass.id);

  // Compute unique teaching slots occupied (counting parallel groups once per slot)
  const occupiedSlotKeys = new Set<string>();
  classItems.forEach((item) => {
    item.periodCodes.forEach((code) => {
      occupiedSlotKeys.add(`${item.day}_${code}`);
    });
  });
  const totalWeeklyPeriods = occupiedSlotKeys.size;

  // Subjects present in this class for the highlight filter bar
  const classSubjectIds = Array.from(new Set(classItems.map((i) => i.subjectId)));
  const classSubjects = classSubjectIds
    .map((id) => subjectMap.get(id))
    .filter((s): s is Subject => Boolean(s));

  const visibleDays =
    selectedDay === 'ALL' ? DAYS : DAYS.filter((d) => d.key === selectedDay);

  const handleCellClickForMove = (day: DayKey, periodCode: string) => {
    if (!movingItemId) return;
    const res = onMoveScheduledItem(movingItemId, day, periodCode);
    if (res.ok) {
      setMovingItemId(null);
      setMoveFeedback(null);
      setSyncNotice(true);
      setTimeout(() => setSyncNotice(false), 3500);
    } else {
      setMoveFeedback(res.reason || 'Slot tidak sah kerana kekangan masa.');
    }
  };

  const handleTriggerGenerate = () => {
    onRegenerateAll();
    setSyncNotice(true);
    setTimeout(() => setSyncNotice(false), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Main Header Card matching Screenshot 1 */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <span>SK ALL SAINTS&apos;, KAMUNTING, PERAK</span>
              <span aria-hidden="true">·</span>
              <span>Tahap {schoolClass.tahap}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                Halaman {classIndex + 1}/{totalClasses}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                KELAS {schoolClass.name}
              </h1>
              {classTeacher && (
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>Guru Kelas:</span>
                  <button
                    type="button"
                    onClick={() => onSelectTeacher(classTeacher.id)}
                    className="font-bold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{classTeacher.fullName}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Summary Metrics */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Jumlah Waktu Seminggu
              </div>
              <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {totalWeeklyPeriods} Waktu
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Waktu Rehat (Tahap {schoolClass.tahap})
              </div>
              <div className="text-base font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                {breakPeriod
                  ? `${formatDisplayTime(breakPeriod.startTime)} - ${formatDisplayTime(breakPeriod.endTime)}`
                  : 'Tiada'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleTriggerGenerate}
              className="no-print px-3.5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Jana Jadual &amp; Kemaskini Guru</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenLessonCardsForClass(schoolClass.id)}
              className="no-print px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Kad Pengajaran ({classItems.length})</span>
            </button>
          </div>
        </div>

        {/* Live Sync Confirmation Banner when timetable is generated or updated */}
        {syncNotice && (
          <div className="no-print mt-3 px-3.5 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Jadual Kelas &amp; Jadual Guru Dikemaskini:</strong> Semua Jadual Waktu Guru telah dikemaskini secara automatik mengikut penjanaan terkini Jadual Kelas ({generatedAt}).
              </span>
            </div>
            {classTeacher && (
              <button
                type="button"
                onClick={() => onSelectTeacher(classTeacher.id)}
                className="font-bold underline hover:opacity-80 shrink-0 cursor-pointer"
              >
                Semak Jadual Guru →
              </button>
            )}
          </div>
        )}

        {/* Filter Controls Row */}
        <div className="no-print pt-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Day Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
              Hari:
            </span>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setSelectedDay('ALL')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedDay === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Semua Hari
              </button>
              {DAYS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDay(d.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedDay === d.key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {d.label.charAt(0) + d.label.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Highlight Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 shrink-0">
              Sorot Subjek:
            </span>
            <button
              type="button"
              onClick={() => setHighlightedSubjectId('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                highlightedSubjectId === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              Semua
            </button>
            {classSubjects.map((subj) => (
              <button
                key={subj.id}
                type="button"
                onClick={() =>
                  setHighlightedSubjectId(
                    highlightedSubjectId === subj.id ? 'ALL' : subj.id
                  )
                }
                className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  highlightedSubjectId === subj.id
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {subj.shortName}
              </button>
            ))}

            <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
            <button
              type="button"
              onClick={() =>
                setColorMode((prev) => (prev === 'moden' ? 'monokrom' : 'moden'))
              }
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Warna: {colorMode === 'moden' ? 'Moden' : 'Monokrom'}
            </button>
          </div>
        </div>

        {/* Active Move Mode Banner */}
        {movingItemId && (
          <div className="no-print mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 shrink-0" />
              <span>
                <strong>Mod Ubah Slot Aktif:</strong> Klik mana-mana petak waktu kosong pada jadual di bawah untuk memindahkan sesi pengajaran ini (Sistem akan menyemak pertindihan masa guru secara automatik).
              </span>
              {moveFeedback && (
                <span className="font-semibold text-rose-600 dark:text-rose-400 ml-2">
                  ({moveFeedback})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setMovingItemId(null);
                setMoveFeedback(null);
              }}
              className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 font-semibold text-xs shrink-0 cursor-pointer"
            >
              Batal
            </button>
          </div>
        )}
      </div>

      {/* Timetable Matrix Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[1060px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <th className="w-28 p-3 text-left text-xs font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 uppercase">
                  <div>HARI /</div>
                  <div>WAKTU</div>
                </th>
                {classPeriods.map((period) => (
                  <th
                    key={period.id}
                    className={`${
                      period.isBreak ? 'w-16' : 'w-24'
                    } py-2.5 px-1.5 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-800`}
                  >
                    <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                      {period.isBreak ? period.code : `WAKTU ${period.code}`}
                    </div>
                    <div className="mt-0.5 text-[10px] font-mono font-medium tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDisplayTime(period.startTime)} -{' '}
                      {formatDisplayTime(period.endTime)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {visibleDays.map((dayObj) => {
                const day = dayObj.key;
                const dayItems = classItems.filter((i) => i.day === day);

                // Render cells across classPeriods, respecting multi-period colSpan
                const cells: React.ReactNode[] = [];
                let pIdx = 0;

                while (pIdx < classPeriods.length) {
                  const period = classPeriods[pIdx];

                  // 1. Break / Rehat Column
                  if (period.isBreak) {
                    cells.push(
                      <td
                        key={`${day}_${period.code}`}
                        className="bg-slate-100/80 dark:bg-slate-800/50 border-r last:border-r-0 border-slate-200 dark:border-slate-800 text-center align-middle p-1"
                      >
                        <div className="flex items-center justify-center h-28">
                          <span className="text-[10px] font-bold tracking-[0.25em] text-slate-500 dark:text-slate-400 uppercase [writing-mode:vertical-rl] rotate-180 select-none">
                            {period.label || 'REHAT'}
                          </span>
                        </div>
                      </td>
                    );
                    pIdx += 1;
                    continue;
                  }

                  // 2. Find items starting at this periodCode
                  const startingItems = dayItems.filter(
                    (item) => item.startPeriodCode === period.code
                  );

                  if (startingItems.length > 0) {
                    const span = Math.max(
                      1,
                      ...startingItems.map((i) => i.duration)
                    );

                    cells.push(
                      <td
                        key={`${day}_${period.code}`}
                        colSpan={span}
                        className="p-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-800 align-top h-32"
                      >
                        <div className="flex flex-col gap-1.5 h-full">
                          {startingItems.map((item) => {
                            const subject = subjectMap.get(item.subjectId);
                            const style =
                              colorMode === 'moden' && subject
                                ? SUBJECT_COLOR_STYLES[subject.color]
                                : SUBJECT_COLOR_STYLES.slate;

                            const isDimmed =
                              highlightedSubjectId !== 'ALL' &&
                              item.subjectId !== highlightedSubjectId;

                            const isBeingMoved = movingItemId === item.id;

                            const teacherNames = item.teacherIds
                              .map((tid) => ({
                                id: tid,
                                shortName:
                                  teacherMap.get(tid)?.shortName || tid,
                              }));

                            return (
                              <div
                                key={item.id}
                                className={`relative flex-1 flex flex-col justify-between rounded-lg border px-2.5 py-2 transition-opacity ${
                                  style.bg
                                } ${style.border} ${
                                  isDimmed ? 'opacity-25' : 'opacity-100'
                                } ${
                                  isBeingMoved
                                    ? 'ring-2 ring-amber-500'
                                    : ''
                                }`}
                              >
                                {/* Action Icon on Top Right */}
                                <div className="absolute right-1.5 top-1.5">
                                  {!item.isLocked ? (
                                    <button
                                      type="button"
                                      title="Pindah slot waktu ini"
                                      onClick={() => {
                                        setMovingItemId(
                                          isBeingMoved ? null : item.id
                                        );
                                        setMoveFeedback(null);
                                      }}
                                      className="no-print opacity-40 hover:opacity-100 text-slate-600 dark:text-slate-300 p-0.5 rounded cursor-pointer"
                                    >
                                      <ArrowRightLeft className="w-3 h-3" />
                                    </button>
                                  ) : (
                                    <Lock className="w-3 h-3 text-slate-400 opacity-50" />
                                  )}
                                </div>

                                {/* Center Row: Subject Short Code + Teacher Short Names */}
                                <div className="my-auto py-0.5 text-center flex flex-col items-center justify-center leading-tight">
                                  <span
                                    className={`text-xs font-extrabold tracking-tight ${style.codeText}`}
                                  >
                                    {subject?.shortName || item.subjectId}
                                  </span>

                                  <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-1">
                                    {teacherNames.length > 0 ? (
                                      teacherNames.map((t, idx) => (
                                        <React.Fragment key={t.id}>
                                          {idx > 0 && (
                                            <span
                                              className={`text-xs font-bold ${style.teacherText}`}
                                            >
                                              /
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onSelectTeacher(t.id)
                                            }
                                            className={`text-xs font-extrabold underline decoration-current/60 underline-offset-2 hover:opacity-80 cursor-pointer ${style.teacherText}`}
                                          >
                                            {t.shortName}
                                          </button>
                                        </React.Fragment>
                                      ))
                                    ) : (
                                      <span className="text-[11px] text-slate-400">
                                        —
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Bottom Row: Full Subject Name */}
                                <div
                                  className={`text-[11px] font-medium text-center truncate ${style.nameText}`}
                                  title={subject?.fullName}
                                >
                                  {subject?.fullName}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );

                    pIdx += span;
                    continue;
                  }

                  // 3. Empty or Class Time-Off Slot
                  const classOff = isInTimeOff(
                    day,
                    period.startTime,
                    period.endTime,
                    schoolClass.timeOff
                  );

                  cells.push(
                    <td
                      key={`${day}_${period.code}`}
                      onClick={() =>
                        !classOff && handleCellClickForMove(day, period.code)
                      }
                      className={`p-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-800 h-32 align-middle text-center transition-colors ${
                        classOff
                          ? 'bg-slate-50/70 dark:bg-slate-900/40'
                          : movingItemId
                          ? 'hover:bg-amber-50/80 dark:hover:bg-amber-950/30 cursor-pointer'
                          : ''
                      }`}
                    >
                      {classOff ? (
                        <div
                          className="flex flex-col items-center justify-center gap-1 text-slate-300 dark:text-slate-700 select-none"
                          title={classOff.reason || 'Waktu Rehat / Tamat Sesi'}
                        >
                          <Ban className="w-3.5 h-3.5 opacity-40" />
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-600">
                            Tamat
                          </span>
                        </div>
                      ) : movingItemId ? (
                        <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 opacity-70">
                          Letak Sini
                        </div>
                      ) : null}
                    </td>
                  );
                  pIdx += 1;
                }

                return (
                  <tr key={day} className="group">
                    <td className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 align-middle">
                      <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-wide">
                        {dayObj.label}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        {dayObj.engLabel}
                      </div>
                    </td>
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Interactive Tip matching Screenshot 2 */}
        <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Tip Interaktif: Klik pada nama singkatan guru di dalam petak jadual untuk terus membuka Jadual Waktu Guru tersebut.
          </div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
            DIJANA PADA: {generatedAt}
          </div>
        </div>
      </div>

      {/* Ringkasan Statistik Mengajar & Agihan Subjek Kelas */}
      {(() => {
        interface SubjectStatRow {
          subjectId: string;
          shortName: string;
          fullName: string;
          color: Subject['color'];
          teacherIds: string[];
          blocks: number[];
          dailyPeriods: Record<DayKey, number>;
          totalPeriods: number;
          parallelGroups: string[];
        }

        const statMap = new Map<string, SubjectStatRow>();

        for (const item of classItems) {
          const subj = subjectMap.get(item.subjectId);
          const existing = statMap.get(item.subjectId);
          if (!existing) {
            const dailyPeriods: Record<DayKey, number> = {
              ISNIN: 0,
              SELASA: 0,
              RABU: 0,
              KHAMIS: 0,
              JUMAAT: 0,
            };
            dailyPeriods[item.day] += item.duration;

            statMap.set(item.subjectId, {
              subjectId: item.subjectId,
              shortName: subj?.shortName || item.subjectId,
              fullName: subj?.fullName || item.subjectId,
              color: subj?.color || 'slate',
              teacherIds: [...item.teacherIds],
              blocks: [item.duration],
              dailyPeriods,
              totalPeriods: item.duration,
              parallelGroups: item.parallelGroup ? [item.parallelGroup] : [],
            });
          } else {
            existing.totalPeriods += item.duration;
            existing.blocks.push(item.duration);
            existing.dailyPeriods[item.day] += item.duration;
            for (const tid of item.teacherIds) {
              if (!existing.teacherIds.includes(tid)) {
                existing.teacherIds.push(tid);
              }
            }
            if (
              item.parallelGroup &&
              !existing.parallelGroups.includes(item.parallelGroup)
            ) {
              existing.parallelGroups.push(item.parallelGroup);
            }
          }
        }

        const subjectStats = Array.from(statMap.values()).sort((a, b) => {
          if (b.totalPeriods !== a.totalPeriods) {
            return b.totalPeriods - a.totalPeriods;
          }
          return a.shortName.localeCompare(b.shortName);
        });

        subjectStats.forEach((row) => {
          row.blocks.sort((a, b) => b - a);
        });

        const uniqueClassTeacherIds = new Set<string>();
        subjectStats.forEach((row) =>
          row.teacherIds.forEach((tid) => uniqueClassTeacherIds.add(tid))
        );

        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            {/* Section Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/40">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Ringkasan Statistik Mengajar &amp; Senarai Subjek — KELAS{' '}
                  {schoolClass.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Senarai subjek terlibat, nama guru mengajar, agihan waktu harian, dan jumlah waktu seminggu bagi Kelas {schoolClass.shortName}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Subjek Terlibat:{' '}
                  </span>
                  <strong className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {subjectStats.length} Subjek
                  </strong>
                </div>

                <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Guru Terlibat:{' '}
                  </span>
                  <strong className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {uniqueClassTeacherIds.size} Guru
                  </strong>
                </div>

                <div className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs">
                  <span className="text-rose-700 dark:text-rose-300">
                    Jumlah Waktu Kelas Seminggu:{' '}
                  </span>
                  <strong className="font-extrabold text-rose-700 dark:text-rose-200 font-mono tabular-nums">
                    {totalWeeklyPeriods} Waktu
                  </strong>
                </div>
              </div>
            </div>

            {/* Statistics Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4 w-12 text-center border-r border-slate-200 dark:border-slate-800">
                      Bil
                    </th>
                    <th className="py-2.5 px-4 border-r border-slate-200 dark:border-slate-800">
                      Subjek Terlibat (Kod &amp; Nama Penuh)
                    </th>
                    <th className="py-2.5 px-4 border-r border-slate-200 dark:border-slate-800">
                      Nama Guru Mengajar
                    </th>
                    <th className="py-2.5 px-4 w-40 text-right">
                      Jumlah Waktu
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {subjectStats.map((row, idx) => {
                    const style =
                      colorMode === 'moden'
                        ? SUBJECT_COLOR_STYLES[row.color]
                        : SUBJECT_COLOR_STYLES.slate;

                    return (
                      <tr
                        key={row.subjectId}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-4 text-center font-mono text-slate-400 dark:text-slate-500 border-r border-slate-200 dark:border-slate-800 tabular-nums">
                          {idx + 1}
                        </td>

                        <td className="py-2.5 px-4 border-r border-slate-200 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-extrabold tracking-tight ${style.bg} ${style.border} ${style.codeText}`}
                            >
                              {row.shortName}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {row.fullName}
                            </span>
                            {row.parallelGroups.length > 0 && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                Selari
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-4 border-r border-slate-200 dark:border-slate-800">
                          {row.teacherIds.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {row.teacherIds.map((tid) => {
                                const t = teacherMap.get(tid);
                                return (
                                  <div
                                    key={tid}
                                    className="flex flex-wrap items-center gap-1.5"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => onSelectTeacher(tid)}
                                      className="font-bold text-slate-800 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer text-left"
                                    >
                                      <span>{t?.fullName || tid}</span>
                                      <span className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400">
                                        ({t?.shortName || tid})
                                      </span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">
                              Semua Guru / Perhimpunan Rasmi
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-right font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {row.totalPeriods} Waktu
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="bg-slate-50/90 dark:bg-slate-800/70 border-t-2 border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-900 dark:text-white">
                    <td
                      colSpan={3}
                      className="py-3 px-4 text-right uppercase tracking-wide border-r border-slate-200 dark:border-slate-800"
                    >
                      Jumlah Waktu Keseluruhan Seminggu (Slot Jadual Kelas{' '}
                      {schoolClass.shortName})
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                      {totalWeeklyPeriods} Waktu
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
