import React, { useEffect, useState } from 'react';
import {
  DayKey,
  ScheduledItem,
  SchoolClass,
  Subject,
  SubjectColorKey,
  TahapPeriodConfig,
  Teacher,
} from '../types/timetable';
import {
  DAYS,
  formatDisplayTime,
  getClassPeriods,
  getUnifiedTeacherPeriods,
  isInTimeOff,
} from '../utils/timetableEngine';
import { SUBJECT_COLOR_STYLES } from '../data/initialData';
import { Ban, Clock, ExternalLink, Pencil, Save, ShieldCheck, X } from 'lucide-react';

interface TeacherTimetableViewProps {
  teacher: Teacher;
  teacherIndex: number;
  totalTeachers: number;
  scheduledItems: ScheduledItem[];
  classes: SchoolClass[];
  subjects: Subject[];
  tahapConfigs: TahapPeriodConfig[];
  generatedAt: string;
  onSelectClass: (classId: string) => void;
  onOpenTimeOffEditor: (teacherId: string) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
}

const CLASS_COLOR_CYCLE: SubjectColorKey[] = [
  'indigo',
  'violet',
  'emerald',
  'amber',
  'rose',
  'sky',
  'teal',
  'fuchsia',
  'orange',
  'lime',
  'cyan',
];

export const TeacherTimetableView: React.FC<TeacherTimetableViewProps> = ({
  teacher,
  teacherIndex,
  totalTeachers,
  scheduledItems,
  classes,
  subjects,
  tahapConfigs,
  generatedAt,
  onSelectClass,
  onOpenTimeOffEditor,
  onUpdateTeacher,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayKey | 'ALL'>('ALL');
  const [highlightedClassId, setHighlightedClassId] = useState<string | 'ALL'>('ALL');
  const [colorBy, setColorBy] = useState<'class' | 'subject'>('class');
  const [isEditingTeacher, setIsEditingTeacher] = useState<boolean>(false);
  const [editFullName, setEditFullName] = useState<string>(teacher.fullName);
  const [editShortName, setEditShortName] = useState<string>(teacher.shortName);
  const [editRole, setEditRole] = useState<string>(teacher.role || '');

  useEffect(() => {
    setEditFullName(teacher.fullName);
    setEditShortName(teacher.shortName);
    setEditRole(teacher.role || '');
    setIsEditingTeacher(false);
  }, [teacher.id, teacher.fullName, teacher.shortName, teacher.role]);

  const handleSaveEditGuru = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim() || !editShortName.trim()) return;
    onUpdateTeacher({
      ...teacher,
      fullName: editFullName.trim().toUpperCase(),
      shortName: editShortName.trim().toUpperCase(),
      role: editRole.trim() || 'Guru Akademik',
    });
    setIsEditingTeacher(false);
  };

  const classMap = new Map(classes.map((c) => [c.id, c]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  // Map each classId to a consistent color when `Warna: Ikut Kelas` is active
  const classColorMap = new Map<string, SubjectColorKey>();
  classes.forEach((cls, idx) => {
    classColorMap.set(
      cls.id,
      CLASS_COLOR_CYCLE[idx % CLASS_COLOR_CYCLE.length]
    );
  });

  const unifiedPeriods = getUnifiedTeacherPeriods(tahapConfigs, classes);

  // All scheduled items where this teacher is assigned
  const teacherItems = scheduledItems.filter((item) =>
    item.teacherIds.includes(teacher.id)
  );

  // Deduplicate if teacher is somehow listed in parallel group in same class at same time
  const uniqueTeacherSessions: ScheduledItem[] = [];
  teacherItems.forEach((item) => {
    const exists = uniqueTeacherSessions.some(
      (u) =>
        u.day === item.day &&
        u.classId === item.classId &&
        u.startPeriodCode === item.startPeriodCode
    );
    if (!exists) {
      uniqueTeacherSessions.push(item);
    }
  });

  const totalWeeklyPeriods = uniqueTeacherSessions.reduce(
    (sum, item) => sum + item.duration,
    0
  );

  // Classes taught by this teacher
  const taughtClassIds = Array.from(
    new Set(uniqueTeacherSessions.map((i) => i.classId))
  );
  const taughtClasses = taughtClassIds
    .map((id) => classMap.get(id))
    .filter((c): c is SchoolClass => Boolean(c));

  // Homeroom class if any
  const homeroomClass = classes.find((c) => c.classTeacherId === teacher.id);

  const visibleDays =
    selectedDay === 'ALL' ? DAYS : DAYS.filter((d) => d.key === selectedDay);

  return (
    <div className="space-y-4">
      {/* Header & Filter Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <span>JADUAL WAKTU PERSENDIRIAN GURU</span>
              <span aria-hidden="true">·</span>
              <span>Singkatan: {teacher.shortName}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                Guru {teacherIndex + 1}/{totalTeachers}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {teacher.fullName}
              </h1>
              {homeroomClass && (
                <button
                  type="button"
                  onClick={() => onSelectClass(homeroomClass.id)}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Guru Kelas {homeroomClass.name}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
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

            <div className="border border-emerald-200 dark:border-emerald-900/60 rounded-lg px-3.5 py-2 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  Selaras Jadual Kelas Terkini
                </div>
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-100 font-mono tabular-nums">
                  {generatedAt}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingTeacher((v) => !v)}
              className="no-print px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Guru</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenTimeOffEditor(teacher.id)}
              className="no-print px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Set Time Off ({teacher.timeOff.length})</span>
            </button>
          </div>
        </div>

        {/* Inline Edit Guru Form when triggered from Jadual Guru */}
        {isEditingTeacher && (
          <form
            onSubmit={handleSaveEditGuru}
            className="no-print mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Kemaskini Maklumat Guru
              </span>
              <button
                type="button"
                onClick={() => setIsEditingTeacher(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tutup</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Nama Penuh Guru
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Singkatan (Short)
                </label>
                <input
                  type="text"
                  required
                  value={editShortName}
                  onChange={(e) => setEditShortName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Jawatan / Panitia
                </label>
                <input
                  type="text"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filter Bar matching Screenshot 3 */}
        <div className="no-print pt-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Day Filter with Period Counts */}
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
              {DAYS.map((d) => {
                const count = uniqueTeacherSessions
                  .filter((i) => i.day === d.key)
                  .reduce((acc, i) => acc + i.duration, 0);
                const dayTitle =
                  d.label.charAt(0) + d.label.slice(1).toLowerCase();
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setSelectedDay(d.key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                      selectedDay === d.key
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {dayTitle} ({count}w)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Class Highlight Filter (`Sorot Kelas`) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 shrink-0">
              Sorot Kelas:
            </span>
            <button
              type="button"
              onClick={() => setHighlightedClassId('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                highlightedClassId === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              Semua Kelas
            </button>
            {taughtClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() =>
                  setHighlightedClassId(
                    highlightedClassId === cls.id ? 'ALL' : cls.id
                  )
                }
                className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  highlightedClassId === cls.id
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {cls.shortName}
              </button>
            ))}

            <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
            <button
              type="button"
              onClick={() =>
                setColorBy((prev) => (prev === 'class' ? 'subject' : 'class'))
              }
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Warna: {colorBy === 'class' ? 'Ikut Kelas' : 'Ikut Subjek'}
            </button>
          </div>
        </div>
      </div>

      {/* Unified Teacher Timetable Grid matching Screenshot 3 */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[1120px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <th className="w-28 p-3 text-left text-xs font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 uppercase">
                  HARI / WAKTU
                </th>
                {unifiedPeriods.map((period, idx) => (
                  <th
                    key={period.id}
                    className="w-24 p-2.5 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-800"
                  >
                    <div className="text-xs font-extrabold tracking-wide text-slate-700 dark:text-slate-200 uppercase">
                      WAKTU {idx + 1}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {visibleDays.map((dayObj) => {
                const day = dayObj.key;
                const daySessions = uniqueTeacherSessions.filter(
                  (s) => s.day === day
                );
                const dayPeriodCount = daySessions.reduce(
                  (acc, s) => acc + s.duration,
                  0
                );

                // Resolve the 0-based teaching period column range [startCol, endCol] for each session
                const getSessionColumnRange = (
                  s: ScheduledItem
                ): { startCol: number; endCol: number } => {
                  const cls = classMap.get(s.classId);
                  if (cls) {
                    const teachingPeriods = getClassPeriods(
                      cls,
                      tahapConfigs
                    ).filter((p) => !p.isBreak);
                    const indices = s.periodCodes
                      .map((code) =>
                        teachingPeriods.findIndex((p) => p.code === code)
                      )
                      .filter((idx) => idx !== -1);
                    if (indices.length > 0) {
                      const minIdx = Math.min(...indices);
                      const maxIdx = Math.max(...indices);
                      return { startCol: minIdx, endCol: maxIdx };
                    }
                  }
                  const parsed = parseInt(s.startPeriodCode, 10);
                  const startCol = Number.isNaN(parsed)
                    ? 0
                    : Math.max(0, parsed - 1);
                  return {
                    startCol,
                    endCol: startCol + Math.max(1, s.duration) - 1,
                  };
                };

                const sessionRanges = daySessions.map((s) => ({
                  session: s,
                  ...getSessionColumnRange(s),
                }));

                const cells: React.ReactNode[] = [];
                let uIdx = 0;

                while (uIdx < unifiedPeriods.length) {
                  const uPeriod = unifiedPeriods[uIdx];

                  // Find a session covering this column index `uIdx`
                  const matched = sessionRanges.find(
                    (r) => uIdx >= r.startCol && uIdx <= r.endCol
                  );

                  if (matched) {
                    const { session, endCol } = matched;
                    const colSpan = Math.max(
                      1,
                      Math.min(unifiedPeriods.length - 1, endCol) - uIdx + 1
                    );

                    const cls = classMap.get(session.classId);
                    const subject = subjectMap.get(session.subjectId);
                    const colorKey: SubjectColorKey =
                      colorBy === 'class'
                        ? classColorMap.get(session.classId) || 'indigo'
                        : subject?.color || 'indigo';
                    const style = SUBJECT_COLOR_STYLES[colorKey];

                    const isDimmed =
                      highlightedClassId !== 'ALL' &&
                      session.classId !== highlightedClassId;

                    cells.push(
                      <td
                        key={`${day}_${uPeriod.code}_${uIdx}`}
                        colSpan={colSpan}
                        className="p-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-800 align-top h-28"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectClass(session.classId)}
                          className={`w-full h-full flex flex-col justify-between rounded-lg border px-2.5 py-2 text-center transition-all hover:brightness-97 cursor-pointer ${
                            style.bg
                          } ${style.border} ${
                            isDimmed ? 'opacity-25' : 'opacity-100'
                          }`}
                        >
                          {/* Centre Top: Actual Session Teaching Time (e.g. 07:40 - 08:40) */}
                          <div className="w-full flex items-center justify-center">
                            <span
                              className={`text-[11px] font-bold font-mono tabular-nums tracking-tight px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/70 border border-black/5 dark:border-white/10 whitespace-nowrap ${style.codeText}`}
                            >
                              {formatDisplayTime(session.startTime)} -{' '}
                              {formatDisplayTime(session.endTime)}
                            </span>
                          </div>

                          {/* Center: Class Short Code (e.g. 5B, 6A, 1A) & Subject Short Code */}
                          <div className="my-auto text-center">
                            <div
                              className={`text-lg font-extrabold tracking-tight leading-tight ${style.teacherText}`}
                            >
                              {cls?.shortName || session.classId}
                            </div>
                            <div
                              className={`text-[10px] font-extrabold tracking-tight uppercase mt-0.5 ${style.codeText}`}
                            >
                              {subject?.shortName || session.subjectId}
                            </div>
                          </div>

                          {/* Bottom Center: Full Subject Name */}
                          <div
                            className={`w-full text-[11px] font-medium text-center truncate ${style.nameText}`}
                          >
                            {subject?.fullName}
                          </div>
                        </button>
                      </td>
                    );

                    uIdx += colSpan;
                    continue;
                  }

                  // Check if teacher has a TimeOff slot covering this period
                  const offSlot = isInTimeOff(
                    day,
                    uPeriod.startTime,
                    uPeriod.endTime,
                    teacher.timeOff
                  );

                  cells.push(
                    <td
                      key={`${day}_${uPeriod.code}_${uIdx}`}
                      className={`p-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-800 h-28 align-middle text-center ${
                        offSlot
                          ? 'bg-rose-50/40 dark:bg-rose-950/20'
                          : ''
                      }`}
                    >
                      {offSlot && (
                        <div
                          className="flex flex-col items-center justify-center gap-1 text-rose-400 dark:text-rose-500/70 select-none"
                          title={`${offSlot.reason || 'Time Off Guru'} (${formatDisplayTime(offSlot.startTime)} - ${formatDisplayTime(offSlot.endTime)})`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">
                            Time Off
                          </span>
                          <span className="text-[10px] font-mono tabular-nums">
                            {formatDisplayTime(offSlot.startTime)}-
                            {formatDisplayTime(offSlot.endTime)}
                          </span>
                        </div>
                      )}
                    </td>
                  );

                  uIdx += 1;
                }

                return (
                  <tr key={day}>
                    <td className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 align-middle">
                      <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-wide">
                        {dayObj.label}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
                        {dayPeriodCount} waktu
                      </div>
                    </td>
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Interactive Tip matching Screenshot 3 */}
        <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Tip Interaktif: Klik pada kod kelas (contoh: 4B, 1A, 3B) di dalam petak jadual untuk terus membuka Jadual Waktu Kelas berkenaan.
          </div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
            DIJANA PADA: {generatedAt}
          </div>
        </div>
      </div>

      {/* Ringkasan Statistik Mengajar & Senarai Subjek Guru */}
      {(() => {
        interface TeacherSubjectStatRow {
          subjectId: string;
          shortName: string;
          fullName: string;
          color: Subject['color'];
          classBreakdown: Map<string, number>;
          totalPeriods: number;
          parallelGroups: string[];
        }

        const statMap = new Map<string, TeacherSubjectStatRow>();

        for (const item of teacherItems) {
          const subj = subjectMap.get(item.subjectId);
          const existing = statMap.get(item.subjectId);
          if (!existing) {
            const classBreakdown = new Map<string, number>();
            classBreakdown.set(item.classId, item.duration);
            statMap.set(item.subjectId, {
              subjectId: item.subjectId,
              shortName: subj?.shortName || item.subjectId,
              fullName: subj?.fullName || item.subjectId,
              color: subj?.color || 'slate',
              classBreakdown,
              totalPeriods: item.duration,
              parallelGroups: item.parallelGroup ? [item.parallelGroup] : [],
            });
          } else {
            existing.totalPeriods += item.duration;
            existing.classBreakdown.set(
              item.classId,
              (existing.classBreakdown.get(item.classId) || 0) + item.duration
            );
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

        const totalAllSubjectPeriods = subjectStats.reduce(
          (sum, row) => sum + row.totalPeriods,
          0
        );

        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            {/* Section Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/40">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Ringkasan Statistik Mengajar &amp; Senarai Subjek —{' '}
                  {teacher.fullName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Senarai subjek terlibat, nama kelas mengajar, dan jumlah waktu seminggu bagi Guru {teacher.shortName}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Subjek Diajar:{' '}
                  </span>
                  <strong className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {subjectStats.length} Subjek
                  </strong>
                </div>

                <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Kelas Terlibat:{' '}
                  </span>
                  <strong className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {taughtClasses.length} Kelas
                  </strong>
                </div>

                <div className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs">
                  <span className="text-rose-700 dark:text-rose-300">
                    Jumlah Waktu Seminggu:{' '}
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
                      Nama Kelas Mengajar
                    </th>
                    <th className="py-2.5 px-4 w-40 text-right">
                      Jumlah Waktu
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {subjectStats.length > 0 ? (
                    subjectStats.map((row, idx) => {
                      const style = SUBJECT_COLOR_STYLES[row.color];
                      const classEntries = Array.from(
                        row.classBreakdown.entries()
                      );

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
                            <div className="flex flex-wrap items-center gap-2">
                              {classEntries.map(([clsId, clsPeriods]) => {
                                const cls = classMap.get(clsId);
                                return (
                                  <button
                                    key={clsId}
                                    type="button"
                                    onClick={() => onSelectClass(clsId)}
                                    className="px-2.5 py-1 rounded-md bg-slate-100/80 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span>{cls?.name || clsId}</span>
                                    <span className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400">
                                      ({cls?.shortName || clsId})
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                                      · {clsPeriods}w
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          <td className="py-2.5 px-4 text-right font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {row.totalPeriods} Waktu
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 px-4 text-center text-slate-400 dark:text-slate-500 italic"
                      >
                        Tiada sesi pengajaran dijadualkan untuk guru ini.
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot>
                  <tr className="bg-slate-50/90 dark:bg-slate-800/70 border-t-2 border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-900 dark:text-white">
                    <td
                      colSpan={3}
                      className="py-3 px-4 text-right uppercase tracking-wide border-r border-slate-200 dark:border-slate-800"
                    >
                      Jumlah Waktu Keseluruhan Seminggu (Jadual Guru{' '}
                      {teacher.shortName})
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                      {totalAllSubjectPeriods} Waktu
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
