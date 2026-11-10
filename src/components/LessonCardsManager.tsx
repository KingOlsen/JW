import React, { useMemo, useState } from 'react';
import {
  ConflictReport,
  DayKey,
  LessonCard,
  ScheduledItem,
  SchoolClass,
  Subject,
  TahapPeriodConfig,
  Teacher,
} from '../types/timetable';
import { SUBJECT_COLOR_STYLES } from '../data/initialData';
import {
  DAYS,
  formatDisplayTime,
  getClassPeriods,
  getMaxDailyPeriodsForSubject,
  getSubjectWeeklyPeriods,
  intervalsOverlap,
  isInTimeOff,
  isSinglePeriodPerDaySubject,
} from '../utils/timetableEngine';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface LessonCardsManagerProps {
  lessonCards: LessonCard[];
  scheduledItems: ScheduledItem[];
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  tahapConfigs: TahapPeriodConfig[];
  conflicts: ConflictReport[];
  initialClassFilter?: string;
  onAddLessonCard: (card: Omit<LessonCard, 'id'>) => void;
  onUpdateLessonCard: (card: LessonCard) => void;
  onDeleteLessonCard: (cardId: string) => void;
  onAutoFixOverlaps: () => void;
  onGenerateTimetable: () => void;
}

const PRESET_BLOCK_PATTERNS: { label: string; blocks: number[] }[] = [
  { label: '1 Waktu (1) — Maks 2w/hari', blocks: [1] },
  { label: '2 Waktu (2 - Berkembar) — Maks 2w/hari', blocks: [2] },
  { label: '2 Waktu (1 + 1) — Maks 2w/hari', blocks: [1, 1] },
  { label: '3 Waktu (2 + 1) — Maks 2w/hari', blocks: [2, 1] },
  { label: '3 Waktu (1 + 1 + 1) — Maks 2w/hari', blocks: [1, 1, 1] },
  { label: '4 Waktu (2 + 2) — Maks 2w/hari', blocks: [2, 2] },
  { label: '5 Waktu (2 + 2 + 1) — Maks 2w/hari', blocks: [2, 2, 1] },
  { label: '6 Waktu (2 + 2 + 2) — Maks 2w/hari', blocks: [2, 2, 2] },
  { label: '8 Waktu (2 + 2 + 2 + 2) — Maks 2w/hari', blocks: [2, 2, 2, 2] },
  { label: '9 Waktu (2 + 2 + 2 + 2 + 1) — Maks 2w/hari', blocks: [2, 2, 2, 2, 1] },
  { label: '10 Waktu (2 + 2 + 2 + 2 + 2) — Maks 2w/hari', blocks: [2, 2, 2, 2, 2] },
  { label: '10 Waktu (2 + 2 + 2 + 2 + 1 + 1) — Maks 2w/hari', blocks: [2, 2, 2, 2, 1, 1] },
  {
    label: '11 Waktu (2 + 2 + 2 + 2 + 2 + 1) — Maks 3w/hari (2+1 Berjarak, Elak 3 Masa Berterusan)',
    blocks: [2, 2, 2, 2, 2, 1],
  },
  {
    label: '12 Waktu (2 + 2 + 2 + 2 + 2 + 1 + 1) — Maks 3w/hari (2+1 Berjarak, Elak 3 Masa Berterusan)',
    blocks: [2, 2, 2, 2, 2, 1, 1],
  },
  {
    label: '13 Waktu (2 + 2 + 2 + 2 + 2 + 1 + 1 + 1) — Maks 3w/hari (2+1 Berjarak, Elak 3 Masa Berterusan)',
    blocks: [2, 2, 2, 2, 2, 1, 1, 1],
  },
  {
    label: '14 Waktu (2 + 2 + 2 + 2 + 2 + 1 + 1 + 1 + 1) — Maks 3w/hari (2+1 Berjarak, Elak 3 Masa Berterusan)',
    blocks: [2, 2, 2, 2, 2, 1, 1, 1, 1],
  },
  {
    label: '15 Waktu (2 + 2 + 2 + 2 + 2 + 1 + 1 + 1 + 1 + 1) — Maks 3w/hari (2+1 Berjarak, Elak 3 Masa Berterusan)',
    blocks: [2, 2, 2, 2, 2, 1, 1, 1, 1, 1],
  },
];

export const LessonCardsManager: React.FC<LessonCardsManagerProps> = ({
  lessonCards,
  scheduledItems,
  teachers,
  classes,
  subjects,
  tahapConfigs,
  conflicts,
  initialClassFilter = 'ALL',
  onAddLessonCard,
  onUpdateLessonCard,
  onDeleteLessonCard,
  onAutoFixOverlaps,
  onGenerateTimetable,
}) => {
  const [filterClassId, setFilterClassId] = useState<string>(initialClassFilter);
  const [filterTeacherId, setFilterTeacherId] = useState<string>('ALL');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('ALL');

  // Add / Edit Lesson Card Form State
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string>(
    initialClassFilter !== 'ALL' ? initialClassFilter : classes[0]?.id || ''
  );
  const [subjectId, setSubjectId] = useState<string>(
    subjects[1]?.id || subjects[0]?.id || ''
  );
  const [primaryTeacherId, setPrimaryTeacherId] = useState<string>(
    teachers[0]?.id || ''
  );
  const [coTeacherId, setCoTeacherId] = useState<string>('NONE');
  const [blockPatternIndex, setBlockPatternIndex] = useState<number>(4); // default 3 Waktu (1+1+1) or 4 Waktu (2+2)
  const [parallelGroup, setParallelGroup] = useState<string>('');
  const [useFixedSlot, setUseFixedSlot] = useState<boolean>(false);
  const [fixedDay, setFixedDay] = useState<DayKey>('ISNIN');
  const [fixedPeriodCode, setFixedPeriodCode] = useState<string>('1');

  const teacherMap = useMemo(
    () => new Map(teachers.map((t) => [t.id, t])),
    [teachers]
  );
  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );
  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const selectedFormClass = classMap.get(classId) || classes[0];
  const selectedClassTeachingPeriods = useMemo(() => {
    if (!selectedFormClass) return [];
    return getClassPeriods(selectedFormClass, tahapConfigs).filter(
      (p) => !p.isBreak
    );
  }, [selectedFormClass, tahapConfigs]);

  // Compute live time-based overlap & capacity warnings for the form's current inputs
  const formTimeWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!selectedFormClass) return warnings;

    const activeTeacherIds: string[] = [];
    if (primaryTeacherId && primaryTeacherId !== 'NONE') {
      activeTeacherIds.push(primaryTeacherId);
    }
    if (
      coTeacherId &&
      coTeacherId !== 'NONE' &&
      coTeacherId !== primaryTeacherId
    ) {
      activeTeacherIds.push(coTeacherId);
    }

    const selectedBlocks =
      PRESET_BLOCK_PATTERNS[blockPatternIndex]?.blocks || [2];
    const firstBlockDuration = selectedBlocks[0] || 1;
    const cleanParallel = parallelGroup.trim();
    const selectedSubjectObj = subjectMap.get(subjectId);

    // 0. Check PJ 1-period-per-day constraint
    if (
      isSinglePeriodPerDaySubject(selectedSubjectObj || subjectId) &&
      selectedBlocks.some((b) => b > 1)
    ) {
      warnings.push(
        `Peraturan Subjek PJ: Subjek ${selectedSubjectObj?.shortName || 'PJ'} hanya boleh dijadualkan sehari 1 waktu sahaja. Blok berkembar (${selectedBlocks.join('+')}) akan dipecahkan secara automatik kepada blok 1 waktu (${selectedBlocks.flatMap((b) => Array.from({ length: b }, () => 1)).join('+')}) pada hari berbeza.`
      );
    }

    // 1. Check parallelGroup teacher overlap in the same class
    if (cleanParallel) {
      const siblingCards = lessonCards.filter(
        (c) =>
          c.id !== editingCardId &&
          c.classId === classId &&
          c.parallelGroup === cleanParallel
      );
      for (const sib of siblingCards) {
        const shared = sib.teacherIds.filter((t) =>
          activeTeacherIds.includes(t)
        );
        for (const tId of shared) {
          const tName = teacherMap.get(tId)?.shortName || tId;
          const sibSubj = subjectMap.get(sib.subjectId)?.shortName || sib.subjectId;
          warnings.push(
            `Pertindihan Masa Kumpulan Selari (${cleanParallel}): Guru ${tName} sudah ditugaskan mengajar ${sibSubj} dalam kumpulan masa selari yang sama.`
          );
        }
      }
    }

    // 2. Check fixedSlot real clock time overlap [startTime, endTime)
    if (useFixedSlot) {
      const allPeriods = getClassPeriods(selectedFormClass, tahapConfigs);
      const startIdx = allPeriods.findIndex((p) => p.code === fixedPeriodCode);
      if (startIdx === -1) {
        warnings.push(
          `Kod waktu "${fixedPeriodCode}" tidak wujud dalam jadual Tahap ${selectedFormClass.tahap}.`
        );
      } else {
        const slice = allPeriods.slice(
          startIdx,
          startIdx + firstBlockDuration
        );
        if (
          slice.length < firstBlockDuration ||
          slice.some((p) => p.isBreak)
        ) {
          warnings.push(
            `Slot tetap pada Waktu ${fixedPeriodCode} (${firstBlockDuration} waktu) melangkaui waktu REHAT atau tamat sesi.`
          );
        } else {
          const winStart = slice[0].startTime;
          const winEnd = slice[slice.length - 1].endTime;

          // Check Class Time Off
          const cOff = isInTimeOff(
            fixedDay,
            winStart,
            winEnd,
            selectedFormClass.timeOff
          );
          if (cOff) {
            warnings.push(
              `Kelas ${selectedFormClass.shortName} mempunyai Time Off pada ${fixedDay} (${formatDisplayTime(winStart)}-${formatDisplayTime(winEnd)}).`
            );
          }

          // Check Teacher Time Off & Teacher Scheduled Overlaps at [winStart, winEnd)
          for (const tId of activeTeacherIds) {
            const teacher = teacherMap.get(tId);
            if (teacher) {
              const tOff = isInTimeOff(
                fixedDay,
                winStart,
                winEnd,
                teacher.timeOff
              );
              if (tOff) {
                warnings.push(
                  `Guru ${teacher.shortName} mempunyai Time Off pada ${fixedDay} (${formatDisplayTime(winStart)}-${formatDisplayTime(winEnd)}).`
                );
              }
            }

            const overlappingScheduled = scheduledItems.find(
              (item) =>
                item.lessonCardId !== editingCardId &&
                item.day === fixedDay &&
                item.teacherIds.includes(tId) &&
                intervalsOverlap(winStart, winEnd, item.startTime, item.endTime)
            );
            if (overlappingScheduled) {
              const otherCls = classMap.get(overlappingScheduled.classId);
              const otherSubj = subjectMap.get(overlappingScheduled.subjectId);
              warnings.push(
                `Pertindihan Masa Sebenar (${formatDisplayTime(winStart)}-${formatDisplayTime(winEnd)}): Guru ${teacher?.shortName || tId} sedang mengajar ${otherCls?.shortName} (${otherSubj?.shortName}, ${formatDisplayTime(overlappingScheduled.startTime)}-${formatDisplayTime(overlappingScheduled.endTime)}) pada hari ${fixedDay}.`
              );
            }
          }
        }
      }
    }

    // 3. Check Class Weekly Available Slot Capacity
    let availableWeeklySlots = 0;
    for (const d of DAYS) {
      for (const p of selectedClassTeachingPeriods) {
        if (
          !isInTimeOff(
            d.key,
            p.startTime,
            p.endTime,
            selectedFormClass.timeOff
          )
        ) {
          availableWeeklySlots += 1;
        }
      }
    }

    const otherClassCards = lessonCards.filter(
      (c) => c.classId === classId && c.id !== editingCardId
    );
    const seenGroups = new Set<string>();
    let usedPeriods = 0;
    for (const c of otherClassCards) {
      if (c.parallelGroup) {
        if (seenGroups.has(c.parallelGroup)) continue;
        seenGroups.add(c.parallelGroup);
      }
      usedPeriods += c.blocks.reduce((a, b) => a + b, 0);
    }

    const newCardPeriods =
      cleanParallel && seenGroups.has(cleanParallel)
        ? 0
        : selectedBlocks.reduce((a, b) => a + b, 0);

    if (usedPeriods + newCardPeriods > availableWeeklySlots) {
      warnings.push(
        `Jumlah waktu Kelas ${selectedFormClass.shortName} (${usedPeriods + newCardPeriods} waktu) melebihi kapasiti slot masa mingguan kelas (${availableWeeklySlots} waktu).`
      );
    }

    return warnings;
  }, [
    selectedFormClass,
    primaryTeacherId,
    coTeacherId,
    blockPatternIndex,
    parallelGroup,
    useFixedSlot,
    fixedDay,
    fixedPeriodCode,
    lessonCards,
    editingCardId,
    classId,
    tahapConfigs,
    teacherMap,
    subjectMap,
    classMap,
    scheduledItems,
    selectedClassTeachingPeriods,
    subjectId,
  ]);

  const handleStartEditCard = (card: LessonCard) => {
    setEditingCardId(card.id);
    setClassId(card.classId);
    setSubjectId(card.subjectId);
    setPrimaryTeacherId(card.teacherIds[0] || 'NONE');
    setCoTeacherId(card.teacherIds[1] || 'NONE');

    const matchIdx = PRESET_BLOCK_PATTERNS.findIndex(
      (p) =>
        p.blocks.length === card.blocks.length &&
        p.blocks.every((val, i) => val === card.blocks[i])
    );
    setBlockPatternIndex(matchIdx !== -1 ? matchIdx : 4);
    setParallelGroup(card.parallelGroup || '');
    if (card.fixedSlot) {
      setUseFixedSlot(true);
      setFixedDay(card.fixedSlot.day);
      setFixedPeriodCode(card.fixedSlot.periodCode);
    } else {
      setUseFixedSlot(false);
      setFixedDay('ISNIN');
      setFixedPeriodCode('1');
    }
  };

  const handleCancelEditCard = () => {
    setEditingCardId(null);
    setParallelGroup('');
    setUseFixedSlot(false);
  };

  const handleSubmitCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !subjectId) return;

    const teacherIds: string[] = [];
    if (primaryTeacherId && primaryTeacherId !== 'NONE') {
      teacherIds.push(primaryTeacherId);
    }
    if (
      coTeacherId &&
      coTeacherId !== 'NONE' &&
      coTeacherId !== primaryTeacherId
    ) {
      teacherIds.push(coTeacherId);
    }

    const rawBlocks =
      PRESET_BLOCK_PATTERNS[blockPatternIndex]?.blocks || [2];
    const selectedSubj = subjectMap.get(subjectId);
    const blocks = isSinglePeriodPerDaySubject(selectedSubj || subjectId)
      ? rawBlocks.flatMap((b) =>
          b > 1 ? Array.from({ length: b }, () => 1) : [1]
        )
      : rawBlocks.flatMap((b) => {
          if (b <= 2) return [b];
          const parts: number[] = [];
          let rem = b;
          while (rem > 0) {
            const step = rem >= 2 ? 2 : 1;
            parts.push(step);
            rem -= step;
          }
          return parts;
        });

    const payload = {
      classId,
      subjectId,
      teacherIds,
      blocks,
      parallelGroup: parallelGroup.trim() || undefined,
      fixedSlot: useFixedSlot
        ? { day: fixedDay, periodCode: fixedPeriodCode }
        : undefined,
    };

    if (editingCardId) {
      onUpdateLessonCard({
        id: editingCardId,
        ...payload,
      });
      setEditingCardId(null);
    } else {
      onAddLessonCard(payload);
    }
  };

  const filteredCards = lessonCards.filter((card) => {
    if (filterClassId !== 'ALL' && card.classId !== filterClassId) return false;
    if (
      filterTeacherId !== 'ALL' &&
      !card.teacherIds.includes(filterTeacherId)
    )
      return false;
    if (filterSubjectId !== 'ALL' && card.subjectId !== filterSubjectId)
      return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner + Time Overlap Status */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Pengurusan Kad Pengajaran &amp; Semakan Pertindihan Masa
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Setiap Kad Pengajaran disemak berdasarkan waktu sebenar (<span className="font-mono">startTime - endTime</span>) merentasi Tahap 1, Tahap 2, dan Tahap 3 supaya tiada guru atau kelas mengalami pertindihan masa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {conflicts.length > 0 && (
            <button
              type="button"
              onClick={onAutoFixOverlaps}
              className="px-4 py-2.5 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-xs"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Baiki Pertindihan Masa Automatik ({conflicts.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onGenerateTimetable}
            className="px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Jana Semula Semua Jadual (0 Pertindihan)</span>
          </button>
        </div>
      </div>

      {/* Live Overlap Audit Alert Banner */}
      {conflicts.length === 0 ? (
        <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>Semakan Masa Kad Pengajaran Disahkan:</strong> Sifar pertindihan masa guru &amp; kelas berdasarkan waktu mula dan tamat sebenar (<span className="font-mono">07:40 - 01:30</span>) bagi semua {lessonCards.length} kad pengajaran.
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-rose-800 dark:text-rose-200 uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Dikesan {conflicts.length} Isu Pertindihan Masa / Kekangan Kad Pengajaran
              </span>
            </div>
            <button
              type="button"
              onClick={onAutoFixOverlaps}
              className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer shrink-0"
            >
              Selesaikan Semua Pertindihan Sekarang
            </button>
          </div>
          <ul className="space-y-1 text-xs text-rose-700 dark:text-rose-300">
            {conflicts.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <span>•</span>
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Add / Edit Lesson Card Form */}
        <form
          onSubmit={handleSubmitCard}
          className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {editingCardId ? (
                <>
                  <Pencil className="w-4 h-4 text-rose-600" />
                  <span>Kemaskini Kad Pengajaran</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-rose-600" />
                  <span>Tambah Kad Pengajaran Baru</span>
                </>
              )}
            </h2>
            {editingCardId && (
              <button
                type="button"
                onClick={handleCancelEditCard}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Batal</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kelas (Tahap 1 / 2 / 3)
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.shortName} - {cls.name} (Tahap {cls.tahap})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subjek
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.shortName} — {subj.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Guru Utama
              </label>
              <select
                value={primaryTeacherId}
                onChange={(e) => setPrimaryTeacherId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="NONE">-- Tiada Guru (Contoh: Perhimpunan) --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName} — {t.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Guru Kedua / Bersama (Pilihan, cth: Tasmik / Al-Quran)
              </label>
              <select
                value={coTeacherId}
                onChange={(e) => setCoTeacherId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="NONE">-- Tiada Guru Kedua --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName} — {t.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pecahan Blok Waktu Seminggu
              </label>
              <select
                value={blockPatternIndex}
                onChange={(e) => setBlockPatternIndex(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {PRESET_BLOCK_PATTERNS.map((p, idx) => (
                  <option key={p.label} value={idx}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <strong>Peraturan Pembahagian Sama Rata &amp; Ruang Rehat Guru:</strong> Subjek <strong>PJ</strong> dihadkan <strong>1 waktu sehari sahaja</strong>; subjek ≤ 10 waktu/minggu maksimum <strong>2 waktu sehari</strong>; subjek &gt; 10 waktu/minggu (cth: <strong>BM</strong>) maksimum <strong>3 waktu sehari (2+1 berjarak)</strong> — mengelakkan 3 masa berterusan bagi memberi ruang guru berehat.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kod Kumpulan Selari / Elektif (Pilihan)
              </label>
              <input
                type="text"
                value={parallelGroup}
                onChange={(e) => setParallelGroup(e.target.value)}
                placeholder="Cth: ELEKTIF_BAHASA atau ISLAM_MORAL_1"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Kad dalam kelas sama dengan kod kumpulan selari yang sama akan dijadualkan serentak pada slot masa yang sama (guru mestilah berbeza).
              </p>
            </div>

            <div className="pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useFixedSlot}
                  onChange={(e) => setUseFixedSlot(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Kunci pada Hari &amp; Waktu Tetap (Contoh: PH Isnin Waktu 1)</span>
              </label>

              {useFixedSlot && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    value={fixedDay}
                    onChange={(e) => setFixedDay(e.target.value as DayKey)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {DAYS.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={fixedPeriodCode}
                    onChange={(e) => setFixedPeriodCode(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  >
                    {selectedClassTeachingPeriods.map((p) => (
                      <option key={p.id} value={p.code}>
                        Waktu {p.code} ({formatDisplayTime(p.startTime)}-
                        {formatDisplayTime(p.endTime)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Live Pre-Check Time Overlap Feedback Box */}
            {formTimeWarnings.length > 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 space-y-1.5 text-[11px] text-amber-900 dark:text-amber-200">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Amaran Semakan Masa Kad Pengajaran:</span>
                </div>
                {formTimeWarnings.map((w, idx) => (
                  <div key={idx} className="leading-relaxed">
                    • {w}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 flex items-center gap-2 text-[11px] text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>
                  Tiada pertindihan masa dikesan untuk tetapan kad ini.
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            {editingCardId
              ? 'Simpan Perubahan Kad & Susun Jadual'
              : 'Simpan Kad Pengajaran & Susun Jadual'}
          </button>
        </form>

        {/* Right 8 Cols: Lesson Cards List & Filters */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Tapis Mengikut Kelas
              </label>
              <select
                value={filterClassId}
                onChange={(e) => setFilterClassId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="ALL">Semua Kelas ({classes.length})</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.shortName} - {cls.name} (Tahap {cls.tahap})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Tapis Mengikut Guru
              </label>
              <select
                value={filterTeacherId}
                onChange={(e) => setFilterTeacherId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="ALL">Semua Guru ({teachers.length})</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName} — {t.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Tapis Mengikut Subjek
              </label>
              <select
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="ALL">Semua Subjek ({subjects.length})</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shortName} — {s.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[680px] overflow-y-auto pr-1">
            {filteredCards.map((card) => {
              const cls = classMap.get(card.classId);
              const subj = subjectMap.get(card.subjectId);
              const style = subj
                ? SUBJECT_COLOR_STYLES[subj.color]
                : SUBJECT_COLOR_STYLES.slate;

              const cardSessions = scheduledItems.filter(
                (i) => i.lessonCardId === card.id
              );
              const totalPeriods = card.blocks.reduce((a, b) => a + b, 0);
              const placedPeriods = cardSessions.reduce(
                (a, b) => a + b.duration,
                0
              );
              const subjectWeeklyTotal = getSubjectWeeklyPeriods(
                card.classId,
                card.subjectId,
                lessonCards
              );
              const maxDailyCap = getMaxDailyPeriodsForSubject(
                subjectWeeklyTotal,
                Math.max(...card.blocks, 1),
                subj || card.subjectId
              );

              const cardConflicts = conflicts.filter((c) =>
                c.lessonCardIds?.includes(card.id)
              );

              const cardTeachers = card.teacherIds
                .map((id) => teacherMap.get(id)?.shortName || id)
                .join(' / ');

              const isBeingEdited = editingCardId === card.id;

              return (
                <div
                  key={card.id}
                  className={`rounded-lg border p-3.5 flex flex-col justify-between gap-2.5 transition-all ${
                    style.bg
                  } ${style.border} ${
                    isBeingEdited ? 'ring-2 ring-rose-500' : ''
                  } ${
                    cardConflicts.length > 0
                      ? 'ring-2 ring-rose-600'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-extrabold">
                        <span className={style.codeText}>
                          {cls?.shortName} ({cls?.name})
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className={style.codeText}>
                          {subj?.shortName}
                        </span>
                      </div>
                      <div
                        className={`text-xs font-medium mt-0.5 ${style.nameText}`}
                      >
                        {subj?.fullName}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditCard(card)}
                        title="Edit kad pengajaran"
                        className="text-slate-500 hover:text-slate-900 dark:hover:text-white p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteLessonCard(card.id)}
                        title="Padam kad pengajaran"
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                      <Users className="w-3.5 h-3.5 opacity-60" />
                      <span>{cardTeachers || 'Tiada Guru'}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        [{card.blocks.join('+')}]={totalPeriods}w (Maks {maxDailyCap}w/hari)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          placedPeriods === totalPeriods &&
                          cardConflicts.length === 0
                            ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'text-rose-600 font-bold'
                        }
                      >
                        {placedPeriods}/{totalPeriods}
                      </span>
                    </div>
                  </div>

                  {/* Scheduled Clock Time Slots for this Lesson Card */}
                  {cardSessions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      {cardSessions.map((sess) => (
                        <span
                          key={sess.id}
                          className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/70 border border-black/10 dark:border-white/10 text-[10px] font-mono tabular-nums text-slate-700 dark:text-slate-300"
                        >
                          {sess.day.slice(0, 3)}{' '}
                          {formatDisplayTime(sess.startTime)}-
                          {formatDisplayTime(sess.endTime)}
                        </span>
                      ))}
                    </div>
                  )}

                  {(card.parallelGroup || card.fixedSlot) && (
                    <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 pt-0.5">
                      {card.parallelGroup && (
                        <span className="inline-flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>Selari: {card.parallelGroup}</span>
                        </span>
                      )}
                      {card.fixedSlot && (
                        <span className="inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>
                            Tetap: {card.fixedSlot.day} Waktu{' '}
                            {card.fixedSlot.periodCode}
                          </span>
                        </span>
                      )}
                    </div>
                  )}

                  {cardConflicts.length > 0 && (
                    <div className="p-2 rounded bg-rose-100/90 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200 font-medium">
                      {cardConflicts[0].message}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCards.length === 0 && (
              <div className="col-span-2 py-12 text-center text-xs text-slate-500">
                <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-40" />
                Tiada kad pengajaran ditemui untuk tapisan ini.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
