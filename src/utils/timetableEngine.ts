import {
  ConflictReport,
  DayKey,
  LessonCard,
  PeriodSlot,
  ScheduledItem,
  SchoolClass,
  Subject,
  TahapPeriodConfig,
  Teacher,
  TimeOffSlot,
} from '../types/timetable';

export const DAYS: { key: DayKey; label: string; engLabel: string }[] = [
  { key: 'ISNIN', label: 'ISNIN', engLabel: 'Monday' },
  { key: 'SELASA', label: 'SELASA', engLabel: 'Tuesday' },
  { key: 'RABU', label: 'RABU', engLabel: 'Wednesday' },
  { key: 'KHAMIS', label: 'KHAMIS', engLabel: 'Thursday' },
  { key: 'JUMAAT', label: 'JUMAAT', engLabel: 'Friday' },
];

/**
 * Converts a school time string (e.g. "07:40", "12:30", "01:00", "13:00")
 * into minutes since midnight. School hours between 01:00 and 06:59 are treated as PM (13:00-18:59).
 */
export function timeToMinutes(timeStr: string): number {
  const clean = timeStr.trim();
  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  if (h >= 1 && h <= 6) {
    h += 12;
  }
  return h * 60 + m;
}

/**
 * Formats time string into 12-hour school display format matching Malaysian timetables (e.g. "13:00" -> "01:00")
 */
export function formatDisplayTime(timeStr: string): string {
  const [hStr, mStr] = timeStr.trim().split(':');
  let h = parseInt(hStr, 10) || 0;
  if (h > 12) {
    h -= 12;
  }
  return `${String(h).padStart(2, '0')}:${mStr || '00'}`;
}

/**
 * Checks whether two time intervals [startA, endA) and [startB, endB) overlap in real clock time.
 */
export function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && eA > sB;
}

/**
 * Checks if a given day and [startTime, endTime) overlaps with any TimeOffSlot in the list.
 */
export function isInTimeOff(
  day: DayKey,
  startTime: string,
  endTime: string,
  timeOffList: TimeOffSlot[]
): TimeOffSlot | undefined {
  return timeOffList.find(
    (slot) =>
      slot.day === day &&
      intervalsOverlap(startTime, endTime, slot.startTime, slot.endTime)
  );
}

/**
 * Returns the PeriodSlot array for a specific class (either customPeriods or its Tahap's periods).
 */
export function getClassPeriods(
  schoolClass: SchoolClass,
  tahapConfigs: TahapPeriodConfig[]
): PeriodSlot[] {
  if (schoolClass.customPeriods && schoolClass.customPeriods.length > 0) {
    return schoolClass.customPeriods;
  }
  const config = tahapConfigs.find((t) => t.tahap === schoolClass.tahap);
  return config ? config.periods : tahapConfigs[0]?.periods || [];
}

/**
 * Computes the total weekly periods assigned to a specific (classId, subjectId) across LessonCards.
 */
export function getSubjectWeeklyPeriods(
  classId: string,
  subjectId: string,
  lessonCards: LessonCard[]
): number {
  return lessonCards
    .filter((c) => c.classId === classId && c.subjectId === subjectId)
    .reduce((sum, c) => sum + c.blocks.reduce((a, b) => a + b, 0), 0);
}

/**
 * Identifies subjects that are strictly restricted to at most 1 period per day
 * (e.g. Pendidikan Jasmani / PJ: sehari 1 waktu sahaja).
 */
export function isSinglePeriodPerDaySubject(
  subjectOrId?: Subject | string | null
): boolean {
  if (!subjectOrId) return false;
  if (typeof subjectOrId === 'string') {
    const clean = subjectOrId.trim().toUpperCase();
    return clean === 'S_PJ' || clean === 'PJ';
  }
  const code = subjectOrId.shortName.trim().toUpperCase();
  const name = subjectOrId.fullName.trim().toLowerCase();
  return (
    subjectOrId.id === 's_pj' ||
    code === 'PJ' ||
    name.includes('pendidikan jasmani')
  );
}

/**
 * Returns the maximum allowed periods per day for a subject:
 * - Subjek PJ (Pendidikan Jasmani): strictly 1 period/day (sehari 1 waktu sahaja)
 * - Subjects > 10 periods/week: max 3 periods/day (placed as non-consecutive 2 + 1 with a rest gap)
 * - Subjects <= 10 periods/week: max 2 periods/day
 */
export function getMaxDailyPeriodsForSubject(
  weeklyPeriods: number,
  singleBlockDuration = 1,
  subjectOrId?: Subject | string | null
): number {
  if (isSinglePeriodPerDaySubject(subjectOrId)) {
    return 1;
  }
  const cap = weeklyPeriods > 10 ? 3 : 2;
  return Math.max(cap, Math.min(2, singleBlockDuration));
}

/**
 * Checks whether two scheduled windows in the same class on the same day are
 * continuous/adjacent without at least 1 other teaching period in between
 * (e.g. preventing 3 continuous periods `2+1` so the teacher has space to rest).
 */
export function areClassSlotsContinuousOrAdjacent(
  schoolClass: SchoolClass,
  tahapConfigs: TahapPeriodConfig[],
  periodCodesA: string[],
  startTimeA: string,
  endTimeA: string,
  periodCodesB: string[],
  startTimeB: string,
  endTimeB: string
): boolean {
  if (intervalsOverlap(startTimeA, endTimeA, startTimeB, endTimeB)) {
    return true;
  }
  const sA = timeToMinutes(startTimeA);
  const eA = timeToMinutes(endTimeA);
  const sB = timeToMinutes(startTimeB);
  const eB = timeToMinutes(endTimeB);
  if (eA === sB || eB === sA) {
    return true;
  }

  const teachingPeriods = getClassPeriods(schoolClass, tahapConfigs).filter(
    (p) => !p.isBreak
  );
  const firstIdxA = teachingPeriods.findIndex((p) => p.code === periodCodesA[0]);
  const lastIdxA = teachingPeriods.findIndex(
    (p) => p.code === periodCodesA[periodCodesA.length - 1]
  );
  const firstIdxB = teachingPeriods.findIndex((p) => p.code === periodCodesB[0]);
  const lastIdxB = teachingPeriods.findIndex(
    (p) => p.code === periodCodesB[periodCodesB.length - 1]
  );

  if (
    firstIdxA !== -1 &&
    lastIdxA !== -1 &&
    firstIdxB !== -1 &&
    lastIdxB !== -1
  ) {
    // Require at least 1 other teaching period between block A and block B
    if (firstIdxB <= lastIdxA + 1 && firstIdxA <= lastIdxB + 1) {
      return true;
    }
  }

  return false;
}

/**
 * Computes the total continuous teaching minutes a teacher would have around [candStartTime, candEndTime]
 * on a given day if scheduled at that window. Used to prevent > 2 continuous periods (> 60 minutes)
 * without a rest break ("elakkan 3 masa berterusan (2+1).. bagi ruang untuk guru berehat").
 */
export function getTeacherContinuousMinutesWithCandidate(
  scheduledItems: ScheduledItem[],
  teacherId: string,
  day: DayKey,
  candStartTime: string,
  candEndTime: string,
  ignoreItemIds?: Set<string>
): number {
  const cStart = timeToMinutes(candStartTime);
  const cEnd = timeToMinutes(candEndTime);
  const intervals: { start: number; end: number }[] = [
    { start: cStart, end: cEnd },
  ];

  for (const item of scheduledItems) {
    if (ignoreItemIds && ignoreItemIds.has(item.id)) continue;
    if (item.day !== day || !item.teacherIds.includes(teacherId)) continue;
    intervals.push({
      start: timeToMinutes(item.startTime),
      end: timeToMinutes(item.endTime),
    });
  }

  intervals.sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const iv of intervals) {
    if (merged.length === 0) {
      merged.push({ ...iv });
    } else {
      const last = merged[merged.length - 1];
      if (iv.start <= last.end) {
        last.end = Math.max(last.end, iv.end);
      } else {
        merged.push({ ...iv });
      }
    }
  }

  const target = merged.find((m) => m.start <= cStart && m.end >= cEnd);
  return target ? target.end - target.start : cEnd - cStart;
}

/**
 * Resolves the exact clock [startTime, endTime] for a LessonCard's fixedSlot based on its class's Tahap periods.
 */
export function getLessonCardFixedTimeWindow(
  card: LessonCard,
  classes: SchoolClass[],
  tahapConfigs: TahapPeriodConfig[]
): {
  day: DayKey;
  startPeriodCode: string;
  periodCodes: string[];
  startTime: string;
  endTime: string;
} | null {
  if (!card.fixedSlot) return null;
  const cls = classes.find((c) => c.id === card.classId);
  if (!cls) return null;
  const periods = getClassPeriods(cls, tahapConfigs);
  const startIdx = periods.findIndex(
    (p) => p.code === card.fixedSlot?.periodCode
  );
  if (startIdx === -1) return null;
  const duration = card.blocks[0] || 1;
  const slice = periods.slice(startIdx, startIdx + duration);
  if (slice.length === 0 || slice.some((p) => p.isBreak)) return null;
  return {
    day: card.fixedSlot.day,
    startPeriodCode: slice[0].code,
    periodCodes: slice.map((p) => p.code),
    startTime: slice[0].startTime,
    endTime: slice[slice.length - 1].endTime,
  };
}

/**
 * Builds the unified list of teaching PeriodSlots (WAKTU 1, WAKTU 2, ..., WAKTU N)
 * across all Tahap configurations for the Teacher Timetable (Jadual Guru) header columns,
 * avoiding duplicate period columns when Tahap 1, Tahap 2, and Tahap 3 have different clock times.
 */
export function getUnifiedTeacherPeriods(
  tahapConfigs: TahapPeriodConfig[],
  classes: SchoolClass[]
): PeriodSlot[] {
  let maxTeachingPeriods = 0;
  let longestList: PeriodSlot[] = [];

  const registerPeriods = (periods: PeriodSlot[]) => {
    const teaching = periods.filter((p) => !p.isBreak);
    if (teaching.length > maxTeachingPeriods) {
      maxTeachingPeriods = teaching.length;
      longestList = teaching;
    }
  };

  for (const cfg of tahapConfigs) {
    registerPeriods(cfg.periods);
  }
  for (const cls of classes) {
    if (cls.customPeriods && cls.customPeriods.length > 0) {
      registerPeriods(cls.customPeriods);
    }
  }

  return Array.from({ length: maxTeachingPeriods }, (_, idx) => {
    const ref = longestList[idx];
    const num = idx + 1;
    return {
      id: `unified_waktu_${num}`,
      code: String(num),
      label: `WAKTU ${num}`,
      startTime: ref?.startTime || '07:40',
      endTime: ref?.endTime || '08:10',
    };
  });
}

/**
 * Checks Lesson Cards directly for time-based overlaps:
 * 1. Two Lesson Cards with fixedSlot that overlap in real clock time [startTime, endTime) for the same teacher or same class (non-parallel).
 * 2. Two Lesson Cards in the same class and same parallelGroup that share a teacher (since parallel cards run simultaneously at the exact same clock time).
 */
export function checkLessonCardTimeOverlaps(
  lessonCards: LessonCard[],
  teachers: Teacher[],
  classes: SchoolClass[],
  subjects: Subject[],
  tahapConfigs: TahapPeriodConfig[]
): ConflictReport[] {
  const reports: ConflictReport[] = [];
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  for (let i = 0; i < lessonCards.length; i++) {
    const cardA = lessonCards[i];
    const clsA = classMap.get(cardA.classId);
    const subjA = subjectMap.get(cardA.subjectId);

    for (let j = i + 1; j < lessonCards.length; j++) {
      const cardB = lessonCards[j];
      const clsB = classMap.get(cardB.classId);
      const subjB = subjectMap.get(cardB.subjectId);

      // Same class + same parallelGroup => scheduled at the exact same clock time
      if (
        cardA.classId === cardB.classId &&
        cardA.parallelGroup &&
        cardA.parallelGroup === cardB.parallelGroup
      ) {
        const sharedTeachers = cardA.teacherIds.filter((t) =>
          cardB.teacherIds.includes(t)
        );
        for (const tId of sharedTeachers) {
          const t = teacherMap.get(tId);
          reports.push({
            id: `lc_parallel_overlap_${cardA.id}_${cardB.id}_${tId}`,
            type: 'TEACHER_OVERLAP',
            teacherId: tId,
            classId: cardA.classId,
            lessonCardIds: [cardA.id, cardB.id],
            message: `Pertindihan Masa Kad Pengajaran Selari (${cardA.parallelGroup}) di Kelas ${clsA?.shortName}: Guru ${t?.shortName || tId} ditugaskan pada kedua-dua subjek ${subjA?.shortName} dan ${subjB?.shortName} pada masa yang sama.`,
          });
        }
      }

      // Check fixedSlot clock time overlaps between cardA and cardB
      const winA = getLessonCardFixedTimeWindow(cardA, classes, tahapConfigs);
      const winB = getLessonCardFixedTimeWindow(cardB, classes, tahapConfigs);
      if (winA && winB && winA.day === winB.day) {
        if (
          intervalsOverlap(
            winA.startTime,
            winA.endTime,
            winB.startTime,
            winB.endTime
          )
        ) {
          const isParallel =
            cardA.classId === cardB.classId &&
            cardA.parallelGroup &&
            cardA.parallelGroup === cardB.parallelGroup;

          if (cardA.classId === cardB.classId && !isParallel) {
            reports.push({
              id: `lc_fixed_class_overlap_${cardA.id}_${cardB.id}`,
              type: 'CLASS_OVERLAP',
              day: winA.day,
              classId: cardA.classId,
              timeRange: `${formatDisplayTime(winA.startTime)}-${formatDisplayTime(winA.endTime)}`,
              lessonCardIds: [cardA.id, cardB.id],
              message: `Pertindihan Masa Kad Pengajaran Tetap di Kelas ${clsA?.shortName} pada ${winA.day} (${formatDisplayTime(winA.startTime)}-${formatDisplayTime(winA.endTime)}): Subjek ${subjA?.shortName} dan ${subjB?.shortName} dikunci pada waktu yang bertindih.`,
            });
          }

          const sharedTeachers = cardA.teacherIds.filter((t) =>
            cardB.teacherIds.includes(t)
          );
          for (const tId of sharedTeachers) {
            const t = teacherMap.get(tId);
            reports.push({
              id: `lc_fixed_teacher_overlap_${cardA.id}_${cardB.id}_${tId}`,
              type: 'TEACHER_OVERLAP',
              day: winA.day,
              teacherId: tId,
              classId: cardA.classId,
              timeRange: `${formatDisplayTime(winA.startTime)}-${formatDisplayTime(winA.endTime)} & ${formatDisplayTime(winB.startTime)}-${formatDisplayTime(winB.endTime)}`,
              lessonCardIds: [cardA.id, cardB.id],
              message: `Pertindihan Masa Kad Pengajaran Guru ${t?.shortName || tId} pada ${winA.day}: Kelas ${clsA?.shortName} (${subjA?.shortName}, ${formatDisplayTime(winA.startTime)}-${formatDisplayTime(winA.endTime)}) bertindih masa dengan Kelas ${clsB?.shortName} (${subjB?.shortName}, ${formatDisplayTime(winB.startTime)}-${formatDisplayTime(winB.endTime)}).`,
            });
          }
        }
      }
    }
  }

  return reports;
}

/**
 * Validates all scheduled items, daily subject period limits, and unplaced lesson card blocks
 * based on real clock time [startTime, endTime), returning a comprehensive list of conflicts.
 */
export function validateTimetable(
  scheduledItems: ScheduledItem[],
  lessonCards: LessonCard[],
  teachers: Teacher[],
  classes: SchoolClass[],
  subjects: Subject[],
  tahapConfigs: TahapPeriodConfig[]
): ConflictReport[] {
  const conflicts: ConflictReport[] = [];
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  // Include direct Lesson Card time-overlap checks
  const cardConflicts = checkLessonCardTimeOverlaps(
    lessonCards,
    teachers,
    classes,
    subjects,
    tahapConfigs
  );
  conflicts.push(...cardConflicts);

  // 1. Check Teacher & Class Real-Time Overlaps across all classes & Tahap based on [startTime, endTime)
  for (let i = 0; i < scheduledItems.length; i++) {
    const itemA = scheduledItems[i];
    const classA = classMap.get(itemA.classId);
    const subjA = subjectMap.get(itemA.subjectId);

    // Check Teacher Time Off
    for (const tId of itemA.teacherIds) {
      const teacher = teacherMap.get(tId);
      if (!teacher) continue;
      const off = isInTimeOff(
        itemA.day,
        itemA.startTime,
        itemA.endTime,
        teacher.timeOff
      );
      if (off) {
        conflicts.push({
          id: `toff_${itemA.id}_${tId}`,
          type: 'TEACHER_TIME_OFF',
          day: itemA.day,
          teacherId: tId,
          classId: itemA.classId,
          lessonCardIds: [itemA.lessonCardId],
          timeRange: `${formatDisplayTime(itemA.startTime)} - ${formatDisplayTime(itemA.endTime)}`,
          message: `Guru ${teacher.shortName} mempunyai Time Off pada ${itemA.day} (${formatDisplayTime(itemA.startTime)}-${formatDisplayTime(itemA.endTime)}) tetapi dijadualkan di kelas ${classA?.shortName || itemA.classId}.`,
        });
      }
    }

    // Check Class Time Off
    if (classA) {
      const off = isInTimeOff(
        itemA.day,
        itemA.startTime,
        itemA.endTime,
        classA.timeOff
      );
      if (off) {
        conflicts.push({
          id: `coff_${itemA.id}`,
          type: 'CLASS_TIME_OFF',
          day: itemA.day,
          classId: classA.id,
          lessonCardIds: [itemA.lessonCardId],
          timeRange: `${formatDisplayTime(itemA.startTime)} - ${formatDisplayTime(itemA.endTime)}`,
          message: `Kelas ${classA.name} mempunyai Time Off pada ${itemA.day} (${formatDisplayTime(itemA.startTime)}-${formatDisplayTime(itemA.endTime)}).`,
        });
      }
    }

    // Check Subject Time Off
    if (subjA) {
      const off = isInTimeOff(
        itemA.day,
        itemA.startTime,
        itemA.endTime,
        subjA.timeOff
      );
      if (off) {
        conflicts.push({
          id: `soff_${itemA.id}`,
          type: 'SUBJECT_TIME_OFF',
          day: itemA.day,
          subjectId: subjA.id,
          classId: itemA.classId,
          lessonCardIds: [itemA.lessonCardId],
          timeRange: `${formatDisplayTime(itemA.startTime)} - ${formatDisplayTime(itemA.endTime)}`,
          message: `Subjek ${subjA.shortName} mempunyai Time Off pada ${itemA.day} (${formatDisplayTime(itemA.startTime)}-${formatDisplayTime(itemA.endTime)}).`,
        });
      }
    }

    // Compare against itemB for real-time overlap based on [startTime, endTime)
    for (let j = i + 1; j < scheduledItems.length; j++) {
      const itemB = scheduledItems[j];
      if (itemA.day !== itemB.day) continue;

      if (
        !intervalsOverlap(
          itemA.startTime,
          itemA.endTime,
          itemB.startTime,
          itemB.endTime
        )
      ) {
        continue;
      }

      const classB = classMap.get(itemB.classId);
      const subjB = subjectMap.get(itemB.subjectId);

      const isSameClassParallel =
        itemA.classId === itemB.classId &&
        Boolean(itemA.parallelGroup) &&
        itemA.parallelGroup === itemB.parallelGroup;

      // Check Class Overlap (two non-parallel cards in the same class overlapping in time)
      if (itemA.classId === itemB.classId && !isSameClassParallel) {
        conflicts.push({
          id: `class_overlap_${itemA.id}_${itemB.id}`,
          type: 'CLASS_OVERLAP',
          day: itemA.day,
          classId: itemA.classId,
          lessonCardIds: [itemA.lessonCardId, itemB.lessonCardId],
          timeRange: `${formatDisplayTime(itemA.startTime)}-${formatDisplayTime(itemA.endTime)}`,
          message: `Pertindihan Masa Kelas ${classA?.shortName} pada hari ${itemA.day}: Subjek ${subjA?.shortName} (${formatDisplayTime(itemA.startTime)}-${formatDisplayTime(itemA.endTime)}) bertindih masa dengan ${subjB?.shortName} (${formatDisplayTime(itemB.startTime)}-${formatDisplayTime(itemB.endTime)}).`,
        });
      }

      // Check Teacher Real-Time Overlap
      const sharedTeachers = itemA.teacherIds.filter((t) =>
        itemB.teacherIds.includes(t)
      );
      for (const tId of sharedTeachers) {
        const teacher = teacherMap.get(tId);
        conflicts.push({
          id: `overlap_${itemA.id}_${itemB.id}_${tId}`,
          type: 'TEACHER_OVERLAP',
          day: itemA.day,
          teacherId: tId,
          classId: itemA.classId,
          lessonCardIds: [itemA.lessonCardId, itemB.lessonCardId],
          timeRange: `${formatDisplayTime(itemA.startTime)}-${formatDisplayTime(itemA.endTime)} & ${formatDisplayTime(itemB.startTime)}-${formatDisplayTime(itemB.endTime)}`,
          message: `Pertindihan Masa Guru ${teacher?.shortName || tId} pada hari ${itemA.day}: Kelas ${classA?.shortName} (${subjA?.shortName}, ${formatDisplayTime(itemA.startTime)}-${formatDisplayTime(itemA.endTime)}) bertindih dengan Kelas ${classB?.shortName} (${subjB?.shortName}, ${formatDisplayTime(itemB.startTime)}-${formatDisplayTime(itemB.endTime)}).`,
        });
      }
    }
  }

  // 2. Check Daily Subject Period Limit (Max 3w/day for >10w/week subjects, Max 2w/day for <=10w/week subjects)
  for (const cls of classes) {
    for (const dayObj of DAYS) {
      const day = dayObj.key;
      const dayClassItems = scheduledItems.filter(
        (i) => i.classId === cls.id && i.day === day
      );
      const subjectTotals = new Map<
        string,
        { duration: number; cardIds: string[] }
      >();

      for (const item of dayClassItems) {
        const prev = subjectTotals.get(item.subjectId) || {
          duration: 0,
          cardIds: [],
        };
        prev.duration += item.duration;
        if (!prev.cardIds.includes(item.lessonCardId)) {
          prev.cardIds.push(item.lessonCardId);
        }
        subjectTotals.set(item.subjectId, prev);
      }

      for (const [subjId, info] of subjectTotals.entries()) {
        const subj = subjectMap.get(subjId);
        const weeklyPeriods = getSubjectWeeklyPeriods(
          cls.id,
          subjId,
          lessonCards
        );
        const maxDaily = getMaxDailyPeriodsForSubject(
          weeklyPeriods,
          1,
          subj || subjId
        );
        if (info.duration > maxDaily) {
          conflicts.push({
            id: `dailylimit_${cls.id}_${day}_${subjId}`,
            type: 'DAILY_SUBJECT_LIMIT',
            day,
            classId: cls.id,
            subjectId: subjId,
            lessonCardIds: info.cardIds,
            message: isSinglePeriodPerDaySubject(subj || subjId)
              ? `Had Waktu Sehari PJ Dilanggar di Kelas ${cls.shortName} (${day}): Subjek ${subj?.shortName || 'PJ'} dijadualkan ${info.duration} waktu sehari (subjek PJ hanya dibenarkan sehari 1 waktu sahaja).`
              : `Had Waktu Sehari Dilanggar di Kelas ${cls.shortName} (${day}): Subjek ${subj?.shortName || subjId} dijadualkan ${info.duration} waktu sehari (had maksimum ialah ${maxDaily} waktu sehari bagi subjek ${weeklyPeriods} waktu seminggu).`,
          });
        }

        // Check that multiple blocks of the same subject on the same day are not continuous (avoid 2+1 continuous without teacher rest gap)
        const sameSubjItems = dayClassItems.filter(
          (i) => i.subjectId === subjId
        );
        for (let a = 0; a < sameSubjItems.length; a++) {
          for (let b = a + 1; b < sameSubjItems.length; b++) {
            if (
              areClassSlotsContinuousOrAdjacent(
                cls,
                tahapConfigs,
                sameSubjItems[a].periodCodes,
                sameSubjItems[a].startTime,
                sameSubjItems[a].endTime,
                sameSubjItems[b].periodCodes,
                sameSubjItems[b].startTime,
                sameSubjItems[b].endTime
              )
            ) {
              conflicts.push({
                id: `continuous_${cls.id}_${day}_${subjId}_${sameSubjItems[a].id}_${sameSubjItems[b].id}`,
                type: 'DAILY_SUBJECT_LIMIT',
                day,
                classId: cls.id,
                subjectId: subjId,
                lessonCardIds: info.cardIds,
                message: `Masa Berterusan Dilanggar di Kelas ${cls.shortName} (${day}): Subjek ${subj?.shortName || subjId} dijadualkan ${sameSubjItems[a].duration}+${sameSubjItems[b].duration} waktu berterusan tanpa selang waktu rehat guru.`,
              });
            }
          }
        }
      }
    }
  }

  // 3. Check if any LessonCard has unplaced blocks
  for (const card of lessonCards) {
    const requiredTotal = card.blocks.reduce((acc, b) => acc + b, 0);
    const scheduledTotal = scheduledItems
      .filter((item) => item.lessonCardId === card.id)
      .reduce((acc, item) => acc + item.duration, 0);

    if (scheduledTotal < requiredTotal) {
      const cls = classMap.get(card.classId);
      const subj = subjectMap.get(card.subjectId);
      conflicts.push({
        id: `unplaced_${card.id}`,
        type: 'UNPLACED_BLOCK',
        classId: card.classId,
        subjectId: card.subjectId,
        teacherId: card.teacherIds[0],
        lessonCardIds: [card.id],
        message: `Kad Pengajaran ${cls?.shortName} - ${subj?.shortName} belum lengkap dijadualkan (${scheduledTotal}/${requiredTotal} waktu ditempatkan).`,
      });
    }
  }

  return conflicts;
}

/**
 * Synchronizes existing ScheduledItems with the latest LessonCards, Classes, and TahapPeriodConfigs
 * so that Teacher Timetables (Jadual Guru) always reflect the exact current Class Timetables (Jadual Kelas).
 */
export function syncScheduledItemsWithInputs(
  items: ScheduledItem[],
  lessonCards: LessonCard[],
  classes: SchoolClass[],
  tahapConfigs: TahapPeriodConfig[]
): ScheduledItem[] {
  const cardMap = new Map(lessonCards.map((c) => [c.id, c]));
  const classMap = new Map(classes.map((c) => [c.id, c]));

  return items
    .map((item): ScheduledItem | null => {
      const card = cardMap.get(item.lessonCardId);
      if (!card) return null;
      const cls = classMap.get(card.classId);
      if (!cls) return null;

      const periods = getClassPeriods(cls, tahapConfigs);
      const startIdx = periods.findIndex((p) => p.code === item.startPeriodCode);
      const slice =
        startIdx !== -1
          ? periods.slice(startIdx, startIdx + item.duration)
          : [];

      const validSlice =
        slice.length === item.duration && !slice.some((p) => p.isBreak);

      return {
        ...item,
        classId: card.classId,
        subjectId: card.subjectId,
        teacherIds: [...card.teacherIds],
        parallelGroup: card.parallelGroup,
        periodCodes: validSlice ? slice.map((p) => p.code) : item.periodCodes,
        startTime: validSlice ? slice[0].startTime : item.startTime,
        endTime: validSlice
          ? slice[slice.length - 1].endTime
          : item.endTime,
      };
    })
    .filter((i): i is ScheduledItem => i !== null);
}

/**
 * Automatically sanitizes LessonCards that have impossible fixedSlot or parallelGroup teacher overlaps
 * so they can be scheduled without any time overlap.
 */
export function sanitizeLessonCardsForZeroOverlap(
  lessonCards: LessonCard[],
  classes: SchoolClass[],
  tahapConfigs: TahapPeriodConfig[],
  subjects?: Subject[]
): LessonCard[] {
  const subjectMap = new Map((subjects || []).map((s) => [s.id, s]));

  const sanitized = lessonCards.map((c) => {
    const subj = subjectMap.get(c.subjectId);
    const mustBeSinglePeriodPerDay = isSinglePeriodPerDaySubject(
      subj || c.subjectId
    );
    // 1) If a subject is strictly 1 period per day (e.g. PJ), split any multi-period block into 1-period blocks.
    // 2) For all other subjects (including >10 waktu subjects like BM), split any 3+ period block into 2+1 blocks
    //    so it is never scheduled as 3 continuous periods ("elakkan 3 masa berterusan (2+1).. bagi ruang untuk guru berehat").
    const normalizedBlocks = mustBeSinglePeriodPerDay
      ? c.blocks.flatMap((b) =>
          b > 1 ? Array.from({ length: b }, () => 1) : [1]
        )
      : c.blocks.flatMap((b) => {
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

    return {
      ...c,
      teacherIds: [...c.teacherIds],
      blocks: normalizedBlocks,
      fixedSlot: c.fixedSlot ? { ...c.fixedSlot } : undefined,
    };
  });

  // 1. If two cards in the same class & same parallelGroup share a teacher, remove parallelGroup from the second card
  for (let i = 0; i < sanitized.length; i++) {
    for (let j = i + 1; j < sanitized.length; j++) {
      const cardA = sanitized[i];
      const cardB = sanitized[j];
      if (
        cardA.classId === cardB.classId &&
        cardA.parallelGroup &&
        cardA.parallelGroup === cardB.parallelGroup
      ) {
        const sharesTeacher = cardA.teacherIds.some((t) =>
          cardB.teacherIds.includes(t)
        );
        if (sharesTeacher) {
          cardB.parallelGroup = undefined;
        }
      }
    }
  }

  // 2. If two cards have fixedSlot that overlap in clock time for the same teacher or same non-parallel class,
  // unlock the second card's fixedSlot so the solver can place it in a free non-overlapping slot.
  for (let i = 0; i < sanitized.length; i++) {
    const winA = getLessonCardFixedTimeWindow(
      sanitized[i],
      classes,
      tahapConfigs
    );
    if (!winA) continue;

    for (let j = i + 1; j < sanitized.length; j++) {
      const winB = getLessonCardFixedTimeWindow(
        sanitized[j],
        classes,
        tahapConfigs
      );
      if (!winB || winA.day !== winB.day) continue;

      if (
        intervalsOverlap(
          winA.startTime,
          winA.endTime,
          winB.startTime,
          winB.endTime
        )
      ) {
        const isParallel =
          sanitized[i].classId === sanitized[j].classId &&
          sanitized[i].parallelGroup &&
          sanitized[i].parallelGroup === sanitized[j].parallelGroup;

        const sharesTeacher = sanitized[i].teacherIds.some((t) =>
          sanitized[j].teacherIds.includes(t)
        );

        if (
          (sanitized[i].classId === sanitized[j].classId && !isParallel) ||
          sharesTeacher
        ) {
          sanitized[j].fixedSlot = undefined;
        }
      }
    }
  }

  return sanitized;
}

interface SchedulableBundle {
  id: string;
  classId: string;
  cards: LessonCard[];
  duration: number;
  blockIndex: number;
  parallelGroup?: string;
  fixedSlot?: {
    day: DayKey;
    periodCode: string;
  };
  priorityScore: number;
}

interface ClassWindow {
  startPeriodCode: string;
  periodCodes: string[];
  startTime: string;
  endTime: string;
  startIndex: number;
  segmentIndex: number;
  offsetInSegment: number;
  segmentLength: number;
}

/**
 * Internal single-pass solver enforcing:
 * - Max 3 periods/day for subjects > 10 periods/week
 * - Max 2 periods/day for subjects <= 10 periods/week
 * - Even daily subject distribution across all 5 school days
 * - Segment-parity alignment and 1-step/2-step + cross-class swap repair
 */
function runSingleSolverAttempt(
  lessonCards: LessonCard[],
  teachers: Teacher[],
  classes: SchoolClass[],
  subjects: Subject[],
  tahapConfigs: TahapPeriodConfig[],
  attemptSeed: number
): ScheduledItem[] {
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  let seedState = ((attemptSeed || 1) * 16807) % 2147483647;
  if (seedState <= 0) seedState = 16807;
  const nextRand = (): number => {
    if (attemptSeed === 0) return 0;
    seedState = (seedState * 48271) % 2147483647;
    return (seedState & 0x7fffffff) / 2147483647;
  };

  // Precompute available non-TimeOff teaching periods per (classId, day) for even daily load distribution
  const classAvailableSlotsPerDay = new Map<string, number>();
  for (const cls of classes) {
    const teachingPeriods = getClassPeriods(cls, tahapConfigs).filter(
      (p) => !p.isBreak
    );
    for (const d of DAYS) {
      let count = 0;
      for (const p of teachingPeriods) {
        if (!isInTimeOff(d.key, p.startTime, p.endTime, cls.timeOff)) {
          count += 1;
        }
      }
      classAvailableSlotsPerDay.set(`${cls.id}_${d.key}`, Math.max(1, count));
    }
  }

  // Compute total required periods per class so tighter classes (like 1A with 46/47 periods) get higher priority
  const classRequiredPeriods = new Map<string, number>();
  for (const cls of classes) {
    const clsCards = lessonCards.filter((c) => c.classId === cls.id);
    const seenParallel = new Set<string>();
    let total = 0;
    for (const c of clsCards) {
      if (c.parallelGroup) {
        const key = `${cls.id}_${c.parallelGroup}`;
        if (seenParallel.has(key)) continue;
        seenParallel.add(key);
      }
      total += c.blocks.reduce((a, b) => a + b, 0);
    }
    classRequiredPeriods.set(cls.id, total);
  }

  // Group lessonCards into schedulable block bundles.
  const bundles: SchedulableBundle[] = [];
  const processedCardBlocks = new Set<string>();

  for (const card of lessonCards) {
    const classLoadBonus = (classRequiredPeriods.get(card.classId) || 0) * 6;
    const cardTotalPeriods = getSubjectWeeklyPeriods(
      card.classId,
      card.subjectId,
      lessonCards
    );
    // Prioritize subjects that have more blocks/week (e.g. 5-day subjects like BM, BI) so they distribute across all 5 days cleanly
    const subjectSpreadPriority =
      card.blocks.length * 260 + cardTotalPeriods * 30;

    for (let bIdx = 0; bIdx < card.blocks.length; bIdx++) {
      const cardBlockKey = `${card.id}_${bIdx}`;
      if (processedCardBlocks.has(cardBlockKey)) continue;

      const duration = card.blocks[bIdx];

      if (card.parallelGroup) {
        const groupCards: LessonCard[] = [card];
        processedCardBlocks.add(cardBlockKey);

        const usedTeachers = new Set<string>(card.teacherIds);

        for (const other of lessonCards) {
          const otherKey = `${other.id}_${bIdx}`;
          if (processedCardBlocks.has(otherKey)) continue;
          if (
            other.classId === card.classId &&
            other.parallelGroup === card.parallelGroup &&
            other.blocks[bIdx] === duration
          ) {
            const hasTeacherConflict = other.teacherIds.some((t) =>
              usedTeachers.has(t)
            );
            if (!hasTeacherConflict) {
              groupCards.push(other);
              processedCardBlocks.add(otherKey);
              other.teacherIds.forEach((t) => usedTeachers.add(t));
            }
          }
        }

        const fixedSlot =
          bIdx === 0
            ? groupCards.find((c) => c.fixedSlot)?.fixedSlot
            : undefined;

        const subjTimeOffBonus = groupCards.reduce(
          (sum, c) =>
            sum + (subjectMap.get(c.subjectId)?.timeOff.length || 0) * 45,
          0
        );
        const teacherTimeOffBonus = groupCards.reduce(
          (sum, c) =>
            sum +
            c.teacherIds.reduce(
              (tSum, tId) =>
                tSum + (teacherMap.get(tId)?.timeOff.length || 0) * 25,
              0
            ),
          0
        );

        const hasSinglePerDaySubj = groupCards.some((c) =>
          isSinglePeriodPerDaySubject(subjectMap.get(c.subjectId) || c.subjectId)
        );
        const tierBase = fixedSlot
          ? 100000
          : hasSinglePerDaySubj
          ? 32000
          : duration >= 2
          ? 20000 + duration * 2000
          : 1000;

        bundles.push({
          id: `bundle_${card.classId}_${card.parallelGroup}_${card.id}_${bIdx}`,
          classId: card.classId,
          cards: groupCards,
          duration,
          blockIndex: bIdx,
          parallelGroup:
            groupCards.length > 1 ? card.parallelGroup : undefined,
          fixedSlot,
          priorityScore:
            tierBase +
            classLoadBonus +
            subjectSpreadPriority +
            groupCards.length * 180 +
            subjTimeOffBonus +
            teacherTimeOffBonus +
            nextRand() * 25,
        });
      } else {
        processedCardBlocks.add(cardBlockKey);
        const fixedSlot = bIdx === 0 ? card.fixedSlot : undefined;
        const subj = subjectMap.get(card.subjectId);
        const subjTimeOffBonus = (subj?.timeOff.length || 0) * 45;
        const teacherTimeOffBonus = card.teacherIds.reduce(
          (sum, tId) => sum + (teacherMap.get(tId)?.timeOff.length || 0) * 25,
          0
        );

        const isSinglePerDay = isSinglePeriodPerDaySubject(
          subj || card.subjectId
        );
        const tierBase = fixedSlot
          ? 100000
          : isSinglePerDay
          ? 32000
          : duration >= 2
          ? 20000 + duration * 2000
          : 1000;

        bundles.push({
          id: `bundle_${card.id}_${bIdx}`,
          classId: card.classId,
          cards: [card],
          duration,
          blockIndex: bIdx,
          fixedSlot,
          priorityScore:
            tierBase +
            classLoadBonus +
            subjectSpreadPriority +
            card.teacherIds.length * 90 +
            subjTimeOffBonus +
            teacherTimeOffBonus +
            nextRand() * 25,
        });
      }
    }
  }

  bundles.sort((a, b) => b.priorityScore - a.priorityScore);

  const scheduled: ScheduledItem[] = [];

  // Helper: find valid consecutive teaching periods of length `duration` for a class, annotated with segment parity info
  const getValidClassWindows = (
    schoolClass: SchoolClass,
    duration: number
  ): ClassWindow[] => {
    const periods = getClassPeriods(schoolClass, tahapConfigs);
    const windows: ClassWindow[] = [];

    const segments: { startIdx: number; slots: PeriodSlot[] }[] = [];
    let currentSlots: PeriodSlot[] = [];
    let currentStart = 0;

    periods.forEach((p, idx) => {
      if (p.isBreak) {
        if (currentSlots.length > 0) {
          segments.push({ startIdx: currentStart, slots: currentSlots });
          currentSlots = [];
        }
      } else {
        if (currentSlots.length === 0) {
          currentStart = idx;
        }
        currentSlots.push(p);
      }
    });
    if (currentSlots.length > 0) {
      segments.push({ startIdx: currentStart, slots: currentSlots });
    }

    segments.forEach((seg, segIdx) => {
      for (let offset = 0; offset <= seg.slots.length - duration; offset++) {
        const slice = seg.slots.slice(offset, offset + duration);
        windows.push({
          startPeriodCode: slice[0].code,
          periodCodes: slice.map((p) => p.code),
          startTime: slice[0].startTime,
          endTime: slice[slice.length - 1].endTime,
          startIndex: seg.startIdx + offset,
          segmentIndex: segIdx,
          offsetInSegment: offset,
          segmentLength: seg.slots.length,
        });
      }
    });

    return windows;
  };

  // Helper: compute how many periods of `subjectId` are already scheduled in `classId` on `day`
  const getSubjectPeriodsOnDay = (
    classId: string,
    subjectId: string,
    day: DayKey
  ): number =>
    scheduled
      .filter(
        (item) =>
          item.classId === classId &&
          item.day === day &&
          item.subjectId === subjectId
      )
      .reduce((acc, item) => acc + item.duration, 0);

  // Helper: check if bundle can be placed at (day, win) given current `scheduled`
  const canPlaceBundle = (
    bundle: SchedulableBundle,
    day: DayKey,
    win: {
      startPeriodCode: string;
      periodCodes: string[];
      startTime: string;
      endTime: string;
    },
    allowSameSubjectSameDay: boolean
  ): boolean => {
    const schoolClass = classMap.get(bundle.classId);
    if (!schoolClass) return false;

    // 1. Check Class Time Off
    if (isInTimeOff(day, win.startTime, win.endTime, schoolClass.timeOff)) {
      return false;
    }

    // 2. Check if Class already has something scheduled in any overlapping time on this day
    const classBusy = scheduled.some(
      (item) =>
        item.classId === bundle.classId &&
        item.day === day &&
        intervalsOverlap(
          win.startTime,
          win.endTime,
          item.startTime,
          item.endTime
        )
    );
    if (classBusy) return false;

    // 3. Enforce Daily Subject Period Cap (Max 3w/day for >10w/week, Max 2w/day for <=10w/week)
    // AND Even Daily Distribution (`!allowSameSubjectSameDay` requires 0 existing periods of that subject today)
    for (const card of bundle.cards) {
      const existingSubjectPeriodsToday = getSubjectPeriodsOnDay(
        bundle.classId,
        card.subjectId,
        day
      );

      if (!allowSameSubjectSameDay && existingSubjectPeriodsToday > 0) {
        return false;
      }

      const subj = subjectMap.get(card.subjectId);
      const weeklySubjectPeriods = getSubjectWeeklyPeriods(
        bundle.classId,
        card.subjectId,
        lessonCards
      );
      const maxDailyPeriods = getMaxDailyPeriodsForSubject(
        weeklySubjectPeriods,
        bundle.duration,
        subj || card.subjectId
      );

      if (existingSubjectPeriodsToday + bundle.duration > maxDailyPeriods) {
        return false;
      }

      // If this class already has a block of this subject today (e.g. 2 + 1 = 3 waktu for >10w subject like BM, or 1 + 1),
      // forbid placing the second block continuously/adjacently without at least 1 other teaching period in between
      // ("elakkan 3 masa berterusan (2+1).. bagi ruang untuk guru berehat").
      if (existingSubjectPeriodsToday > 0) {
        const existingSameSubjItems = scheduled.filter(
          (item) =>
            item.classId === bundle.classId &&
            item.day === day &&
            item.subjectId === card.subjectId
        );
        for (const existingItem of existingSameSubjItems) {
          if (
            areClassSlotsContinuousOrAdjacent(
              schoolClass,
              tahapConfigs,
              existingItem.periodCodes,
              existingItem.startTime,
              existingItem.endTime,
              win.periodCodes,
              win.startTime,
              win.endTime
            )
          ) {
            return false;
          }
        }
      }
    }

    // 4. Ensure cards within the bundle itself do not share the same teacher
    const seenTeachersInBundle = new Set<string>();
    for (const card of bundle.cards) {
      for (const tId of card.teacherIds) {
        if (seenTeachersInBundle.has(tId)) return false;
        seenTeachersInBundle.add(tId);
      }
    }

    // 5. For each card in the bundle, check Subject Time Off, Teacher Time Off, Real-Time Teacher Overlap,
    //    and prevent > 2 continuous periods (> 60 minutes) for any teacher so they have space to rest
    for (const card of bundle.cards) {
      const subject = subjectMap.get(card.subjectId);
      if (
        subject &&
        isInTimeOff(day, win.startTime, win.endTime, subject.timeOff)
      ) {
        return false;
      }

      for (const tId of card.teacherIds) {
        const teacher = teacherMap.get(tId);
        if (
          teacher &&
          isInTimeOff(day, win.startTime, win.endTime, teacher.timeOff)
        ) {
          return false;
        }

        const teacherBusy = scheduled.some(
          (item) =>
            item.day === day &&
            item.teacherIds.includes(tId) &&
            intervalsOverlap(
              win.startTime,
              win.endTime,
              item.startTime,
              item.endTime
            )
        );
        if (teacherBusy) return false;

        // Prevent 3+ continuous periods (> 60 minutes) for the teacher on the same day so the teacher gets a rest period
        const continuousMinutes = getTeacherContinuousMinutesWithCandidate(
          scheduled,
          tId,
          day,
          win.startTime,
          win.endTime
        );
        if (continuousMinutes > 60) {
          return false;
        }
      }
    }

    return true;
  };

  const commitBundle = (
    bundle: SchedulableBundle,
    day: DayKey,
    win: {
      startPeriodCode: string;
      periodCodes: string[];
      startTime: string;
      endTime: string;
    },
    isLocked = false
  ) => {
    for (const card of bundle.cards) {
      scheduled.push({
        id: `sched_${card.id}_${bundle.blockIndex}`,
        lessonCardId: card.id,
        classId: bundle.classId,
        subjectId: card.subjectId,
        teacherIds: [...card.teacherIds],
        day,
        startPeriodCode: win.startPeriodCode,
        duration: bundle.duration,
        periodCodes: win.periodCodes,
        startTime: win.startTime,
        endTime: win.endTime,
        parallelGroup: bundle.parallelGroup,
        isLocked,
      });
    }
  };

  // Helper: Try direct candidate placement for a bundle with even daily distribution scoring
  const tryDirectPlacement = (
    bundle: SchedulableBundle,
    windows: ClassWindow[],
    allowSameDay: boolean
  ): boolean => {
    const candidates: {
      day: DayKey;
      win: ClassWindow;
      score: number;
    }[] = [];

    for (let dIdx = 0; dIdx < DAYS.length; dIdx++) {
      const day = DAYS[dIdx].key;

      // Count unique slot periods occupied on `day` for `bundle.classId`
      const occupiedCodesOnDay = new Set<string>();
      for (const s of scheduled) {
        if (s.classId === bundle.classId && s.day === day) {
          s.periodCodes.forEach((code) => occupiedCodesOnDay.add(code));
        }
      }
      const classLoadOnDay = occupiedCodesOnDay.size;
      const availableOnDay =
        classAvailableSlotsPerDay.get(`${bundle.classId}_${day}`) || 10;
      const utilizationRatio = classLoadOnDay / availableOnDay;

      // Existing periods of this bundle's subjects on `day` (for Phase B when allowSameDay=true)
      const existingSubjPeriodsToday = bundle.cards.reduce(
        (maxP, c) =>
          Math.max(
            maxP,
            getSubjectPeriodsOnDay(bundle.classId, c.subjectId, day)
          ),
        0
      );

      // For subjects with <= 3 blocks/week, slightly prefer spacing them on non-adjacent days (e.g. Mon/Wed/Fri or Tue/Thu)
      let adjacentDayPenalty = 0;
      const primaryCard = bundle.cards[0];
      if (primaryCard && primaryCard.blocks.length <= 3) {
        const prevDay = dIdx > 0 ? DAYS[dIdx - 1].key : null;
        const nextDay = dIdx < DAYS.length - 1 ? DAYS[dIdx + 1].key : null;
        const hasAdjacent =
          (prevDay &&
            getSubjectPeriodsOnDay(
              bundle.classId,
              primaryCard.subjectId,
              prevDay
            ) > 0) ||
          (nextDay &&
            getSubjectPeriodsOnDay(
              bundle.classId,
              primaryCard.subjectId,
              nextDay
            ) > 0);
        if (hasAdjacent) {
          adjacentDayPenalty = 35;
        }
      }

      const seg0HasSingleAtStart = scheduled.some(
        (s) =>
          s.classId === bundle.classId &&
          s.day === day &&
          s.duration === 1 &&
          s.startPeriodCode === '1'
      );

      for (const win of windows) {
        if (canPlaceBundle(bundle, day, win, allowSameDay)) {
          let parityPenalty = 0;

          if (bundle.duration === 2) {
            if (win.segmentIndex === 0 && seg0HasSingleAtStart) {
              parityPenalty = win.offsetInSegment === 2 ? 0 : 180;
            } else {
              parityPenalty = win.offsetInSegment % 2 === 0 ? 0 : 260;
            }
          } else if (bundle.duration === 1) {
            // For 1-period blocks (like PJ, PK, PMZ, or 1w blocks of BM/BI),
            // prefer pairing with an existing 1-period block in the same 2-slot pair [2k, 2k+1]
            // so even-length segments keep clean 2-period windows for 2w blocks.
            const companionOffset =
              win.offsetInSegment % 2 === 0
                ? win.offsetInSegment + 1
                : win.offsetInSegment - 1;
            const companionWin = windows.find(
              (w) =>
                w.segmentIndex === win.segmentIndex &&
                w.offsetInSegment === companionOffset
            );
            const companionHasSingle =
              companionWin &&
              scheduled.some(
                (s) =>
                  s.classId === bundle.classId &&
                  s.day === day &&
                  s.duration === 1 &&
                  s.startPeriodCode === companionWin.startPeriodCode
              );

            if (companionHasSingle) {
              parityPenalty = -80;
            } else if (
              isSinglePeriodPerDaySubject(
                subjectMap.get(primaryCard?.subjectId || '') ||
                  primaryCard?.subjectId
              )
            ) {
              // For PJ (1 waktu/day morning subject), prefer Waktu 2 (offset 1) or Waktu 1 (offset 0)
              // so Waktu 3-4 (offset 2..3) stays intact for a 2-period block
              parityPenalty =
                win.offsetInSegment === 1
                  ? 0
                  : win.offsetInSegment === 0
                  ? 15
                  : 90;
            }
          }

          // Prefer slots that give the teacher a rest break before and after (avoid even 1+1 back-to-back across classes when possible)
          let teacherRestPenalty = 0;
          for (const card of bundle.cards) {
            for (const tId of card.teacherIds) {
              const contMins = getTeacherContinuousMinutesWithCandidate(
                scheduled,
                tId,
                day,
                win.startTime,
                win.endTime
              );
              const blockMins =
                timeToMinutes(win.endTime) - timeToMinutes(win.startTime);
              if (contMins > blockMins) {
                teacherRestPenalty += 220;
              }
            }
          }

          // When placing a second block of the same subject on the same day (e.g. 2 + 1 = 3w for >10w subject),
          // prefer placing it in a different segment (e.g. one before Rehat, one after Rehat) for maximum rest gap
          let sameDaySegmentBonus = 0;
          if (existingSubjPeriodsToday > 0 && primaryCard) {
            const existingAcrossBreak = scheduled.some(
              (s) =>
                s.classId === bundle.classId &&
                s.day === day &&
                s.subjectId === primaryCard.subjectId &&
                ((win.segmentIndex === 0 &&
                  timeToMinutes(s.startTime) >= 600) ||
                  (win.segmentIndex > 0 && timeToMinutes(s.endTime) <= 600))
            );
            if (existingAcrossBreak) {
              sameDaySegmentBonus = -120;
            }
          }

          const jitter = nextRand() * 12;
          const score =
            existingSubjPeriodsToday * 500 +
            sameDaySegmentBonus +
            teacherRestPenalty +
            parityPenalty +
            adjacentDayPenalty +
            utilizationRatio * 120 +
            win.startIndex * 3 +
            jitter;
          candidates.push({ day, win, score });
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.score - b.score);
      const best = candidates[0];
      commitBundle(bundle, best.day, best.win, false);
      return true;
    }

    return false;
  };

  // Helper: Try Same-Class Swap while respecting `allowSameDay` and daily subject caps
  const trySameClassSwap = (
    bundle: SchedulableBundle,
    schoolClass: SchoolClass,
    windows: ClassWindow[],
    allowSameDay: boolean
  ): boolean => {
    for (const dayObj of DAYS) {
      const day = dayObj.key;
      for (const win of windows) {
        const blockingItems = scheduled.filter(
          (item) =>
            item.classId === bundle.classId &&
            item.day === day &&
            !item.isLocked &&
            intervalsOverlap(
              win.startTime,
              win.endTime,
              item.startTime,
              item.endTime
            )
        );

        if (
          blockingItems.length > 0 &&
          blockingItems.every((b) => !b.parallelGroup)
        ) {
          const backup = [...scheduled];
          const blockingIds = new Set(blockingItems.map((b) => b.id));

          for (let k = scheduled.length - 1; k >= 0; k--) {
            if (blockingIds.has(scheduled[k].id)) {
              scheduled.splice(k, 1);
            }
          }

          if (canPlaceBundle(bundle, day, win, allowSameDay)) {
            commitBundle(bundle, day, win, false);

            let allBlockersRelocated = true;
            for (const blocker of blockingItems) {
              const blockerCard = lessonCards.find(
                (c) => c.id === blocker.lessonCardId
              );
              if (!blockerCard) {
                allBlockersRelocated = false;
                break;
              }
              const blockerBundle: SchedulableBundle = {
                id: `reloc_${blocker.id}`,
                classId: blocker.classId,
                cards: [blockerCard],
                duration: blocker.duration,
                blockIndex: 0,
                priorityScore: 0,
              };
              const blockerWindows = getValidClassWindows(
                schoolClass,
                blocker.duration
              );

              let movedThisBlocker = false;
              for (const allowSameForBlocker of [false, true]) {
                if (movedThisBlocker) break;
                for (const altDayObj of DAYS) {
                  if (movedThisBlocker) break;
                  for (const altWin of blockerWindows) {
                    if (
                      canPlaceBundle(
                        blockerBundle,
                        altDayObj.key,
                        altWin,
                        allowSameForBlocker
                      )
                    ) {
                      scheduled.push({
                        ...blocker,
                        day: altDayObj.key,
                        startPeriodCode: altWin.startPeriodCode,
                        periodCodes: altWin.periodCodes,
                        startTime: altWin.startTime,
                        endTime: altWin.endTime,
                      });
                      movedThisBlocker = true;
                      break;
                    }
                  }
                }
              }

              if (!movedThisBlocker) {
                allBlockersRelocated = false;
                break;
              }
            }

            if (allBlockersRelocated) {
              return true;
            }
          }

          scheduled.length = 0;
          scheduled.push(...backup);
        }
      }
    }
    return false;
  };

  // Helper: Try Cross-Class Teacher Blocker Relocation while respecting `allowSameDay` and daily subject caps
  const tryCrossClassSwap = (
    bundle: SchedulableBundle,
    schoolClass: SchoolClass,
    windows: ClassWindow[],
    allowSameDay: boolean
  ): boolean => {
    for (const dayObj of DAYS) {
      const day = dayObj.key;
      for (const win of windows) {
        if (isInTimeOff(day, win.startTime, win.endTime, schoolClass.timeOff))
          continue;
        const classBusy = scheduled.some(
          (item) =>
            item.classId === bundle.classId &&
            item.day === day &&
            intervalsOverlap(
              win.startTime,
              win.endTime,
              item.startTime,
              item.endTime
            )
        );
        if (classBusy) continue;

        let timeOffOrDailyCapBlocked = false;
        const bundleTeachers = new Set<string>();
        for (const card of bundle.cards) {
          const existingToday = getSubjectPeriodsOnDay(
            bundle.classId,
            card.subjectId,
            day
          );
          if (!allowSameDay && existingToday > 0) {
            timeOffOrDailyCapBlocked = true;
            break;
          }
          const subj = subjectMap.get(card.subjectId);
          const weeklyP = getSubjectWeeklyPeriods(
            bundle.classId,
            card.subjectId,
            lessonCards
          );
          const maxDailyP = getMaxDailyPeriodsForSubject(
            weeklyP,
            bundle.duration,
            subj || card.subjectId
          );
          if (existingToday + bundle.duration > maxDailyP) {
            timeOffOrDailyCapBlocked = true;
            break;
          }
          if (
            subj &&
            isInTimeOff(day, win.startTime, win.endTime, subj.timeOff)
          ) {
            timeOffOrDailyCapBlocked = true;
            break;
          }
          for (const tId of card.teacherIds) {
            bundleTeachers.add(tId);
            const t = teacherMap.get(tId);
            if (
              t &&
              isInTimeOff(day, win.startTime, win.endTime, t.timeOff)
            ) {
              timeOffOrDailyCapBlocked = true;
              break;
            }
          }
        }
        if (timeOffOrDailyCapBlocked) continue;

        const teacherBlockers = scheduled.filter(
          (item) =>
            item.day === day &&
            item.teacherIds.some((tId) => bundleTeachers.has(tId)) &&
            intervalsOverlap(
              win.startTime,
              win.endTime,
              item.startTime,
              item.endTime
            )
        );

        if (
          teacherBlockers.length === 1 &&
          !teacherBlockers[0].isLocked &&
          !teacherBlockers[0].parallelGroup
        ) {
          const tBlocker = teacherBlockers[0];
          const otherClass = classMap.get(tBlocker.classId);
          const otherCard = lessonCards.find(
            (c) => c.id === tBlocker.lessonCardId
          );
          if (!otherClass || !otherCard) continue;

          const backup = [...scheduled];
          const idx = scheduled.findIndex((s) => s.id === tBlocker.id);
          scheduled.splice(idx, 1);

          if (canPlaceBundle(bundle, day, win, allowSameDay)) {
            commitBundle(bundle, day, win, false);

            const otherBundle: SchedulableBundle = {
              id: `reloc_other_${tBlocker.id}`,
              classId: otherClass.id,
              cards: [otherCard],
              duration: tBlocker.duration,
              blockIndex: 0,
              priorityScore: 0,
            };
            const otherWindows = getValidClassWindows(
              otherClass,
              tBlocker.duration
            );
            let relocatedOther = false;
            for (const allowSameForOther of [false, true]) {
              if (relocatedOther) break;
              for (const altDayObj of DAYS) {
                if (relocatedOther) break;
                for (const altWin of otherWindows) {
                  if (
                    canPlaceBundle(
                      otherBundle,
                      altDayObj.key,
                      altWin,
                      allowSameForOther
                    )
                  ) {
                    scheduled.push({
                      ...tBlocker,
                      day: altDayObj.key,
                      startPeriodCode: altWin.startPeriodCode,
                      periodCodes: altWin.periodCodes,
                      startTime: altWin.startTime,
                      endTime: altWin.endTime,
                    });
                    relocatedOther = true;
                    break;
                  }
                }
              }
            }

            if (relocatedOther) {
              return true;
            }
          }

          scheduled.length = 0;
          scheduled.push(...backup);
        }
      }
    }
    return false;
  };

  // Place each bundle
  for (const bundle of bundles) {
    const schoolClass = classMap.get(bundle.classId);
    if (!schoolClass) continue;

    const windows = getValidClassWindows(schoolClass, bundle.duration);

    // 1. Try Fixed Slot first
    if (bundle.fixedSlot) {
      const fixedWin = windows.find(
        (w) => w.startPeriodCode === bundle.fixedSlot?.periodCode
      );
      if (
        fixedWin &&
        canPlaceBundle(bundle, bundle.fixedSlot.day, fixedWin, true)
      ) {
        commitBundle(bundle, bundle.fixedSlot.day, fixedWin, true);
        continue;
      }
    }

    // 2. Phase A: Strictly 1 block per day (`allowSameDay = false`) for even daily distribution!
    // Try direct placement, then Same-Class Swap, then Cross-Class Swap with `allowSameDay = false` first!
    let placed = tryDirectPlacement(bundle, windows, false);

    if (!placed) {
      placed = trySameClassSwap(bundle, schoolClass, windows, false);
    }

    if (!placed) {
      placed = tryCrossClassSwap(bundle, schoolClass, windows, false);
    }

    // 3. Phase B: If a subject has > 5 blocks (e.g. [2,2,2,2,1,1] = 10w where two 1w blocks share Day 5 = 2w/day,
    // or >10w subjects where up to 3w/day is allowed), allow a second block on the same day while strictly enforcing `maxDailyPeriods`!
    if (!placed) {
      placed = tryDirectPlacement(bundle, windows, true);
    }

    if (!placed) {
      placed = trySameClassSwap(bundle, schoolClass, windows, true);
    }

    if (!placed) {
      placed = tryCrossClassSwap(bundle, schoolClass, windows, true);
    }
  }

  return scheduled;
}

/**
 * Generates a complete conflict-free school timetable from LessonCards, Teachers, Classes, Subjects, and TahapPeriodConfigs.
 * Strictly prevents any teacher real-time overlap across classes/Tahap, respects all TimeOff constraints,
 * enforces daily subject caps (max 3w/day for >10w/week, max 2w/day for <=10w/week), and distributes subjects evenly across days.
 */
export function generateCompleteTimetable(
  lessonCards: LessonCard[],
  teachers: Teacher[],
  classes: SchoolClass[],
  subjects: Subject[],
  tahapConfigs: TahapPeriodConfig[],
  variationSeed = 0
): { items: ScheduledItem[]; conflicts: ConflictReport[] } {
  const sanitizedCards = sanitizeLessonCardsForZeroOverlap(
    lessonCards,
    classes,
    tahapConfigs,
    subjects
  );

  let bestItems: ScheduledItem[] = [];
  let bestConflicts: ConflictReport[] = [];

  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const currentSeed =
      attempt === 0
        ? variationSeed
        : (variationSeed || 1) + attempt * 7919;

    const candidateItems = runSingleSolverAttempt(
      sanitizedCards,
      teachers,
      classes,
      subjects,
      tahapConfigs,
      currentSeed
    );

    const candidateConflicts = validateTimetable(
      candidateItems,
      lessonCards,
      teachers,
      classes,
      subjects,
      tahapConfigs
    );

    if (
      attempt === 0 ||
      candidateConflicts.length < bestConflicts.length
    ) {
      bestItems = candidateItems;
      bestConflicts = candidateConflicts;
    }

    if (bestConflicts.length === 0) {
      break;
    }
  }

  return { items: bestItems, conflicts: bestConflicts };
}
