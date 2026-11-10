export type DayKey = 'ISNIN' | 'SELASA' | 'RABU' | 'KHAMIS' | 'JUMAAT';

export type TahapType = 1 | 2 | 3;

export interface TimeOffSlot {
  day: DayKey;
  /** Either a periodId/code or a time window HH:MM-HH:MM */
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface PeriodSlot {
  id: string;
  code: string; // e.g., '1', '2', '3', '4', 'R1', '5-1', '5-2', '6', '7', '8', '9', '10', '11'
  label: string;
  startTime: string; // e.g., '07:40'
  endTime: string;   // e.g., '08:10'
  isBreak?: boolean;
}

export interface TahapPeriodConfig {
  tahap: TahapType;
  name: string;
  description: string;
  periods: PeriodSlot[];
}

export interface Teacher {
  id: string;
  fullName: string;
  shortName: string;
  role?: string;
  timeOff: TimeOffSlot[];
}

export interface SchoolClass {
  id: string;
  shortName: string; // e.g., '1A', '1B', '4B', '6A'
  name: string;      // e.g., '1 ARIF', '1 BESTARI'
  tahap: TahapType;
  classTeacherId: string;
  timeOff: TimeOffSlot[];
  /** Optional class-specific period overrides; if omitted, uses its TahapPeriodConfig */
  customPeriods?: PeriodSlot[];
}

export type SubjectColorKey =
  | 'amber'
  | 'emerald'
  | 'violet'
  | 'sky'
  | 'rose'
  | 'indigo'
  | 'lime'
  | 'teal'
  | 'orange'
  | 'slate'
  | 'fuchsia'
  | 'cyan';

export interface Subject {
  id: string;
  shortName: string; // e.g., 'BM', 'BI', 'MT', 'SN', 'BA', 'BT', 'QURAN', 'PM'
  fullName: string;  // e.g., 'Bahasa Melayu'
  color: SubjectColorKey;
  timeOff: TimeOffSlot[];
}

export interface LessonCard {
  id: string;
  classId: string;
  subjectId: string;
  /** Primary teacher ID, plus optional co-teacher IDs (e.g. NAZIRAH / ADAWIYAH) */
  teacherIds: string[];
  /**
   * Array of block durations (in periods).
   * For example: [2, 2, 2, 2, 1] = 9 periods/week split across 5 sessions (four double-periods and one single-period).
   */
  blocks: number[];
  /**
   * Optional parallel group tag within the same class.
   * Cards in the same class with the same parallelGroup (e.g. 'ELEKTIF_BAHASA' for BA + BT, or 'AGAMA_MORAL' for JAWI|QURAN + PM)
   * are scheduled simultaneously in the same period slots!
   */
  parallelGroup?: string;
  /**
   * Optional fixed/locked day & starting period code (e.g. Perhimpunan Rasmi on ISNIN period '1')
   */
  fixedSlot?: {
    day: DayKey;
    periodCode: string;
  };
}

export interface ScheduledItem {
  id: string;
  lessonCardId: string;
  classId: string;
  subjectId: string;
  teacherIds: string[];
  day: DayKey;
  /** Starting teaching period code in the class's schedule */
  startPeriodCode: string;
  /** Number of consecutive teaching periods spanned */
  duration: number;
  /** Covered period codes (e.g. ['3', '4']) */
  periodCodes: string[];
  /** Actual clock start and end times (e.g. '08:40' to '09:40') */
  startTime: string;
  endTime: string;
  parallelGroup?: string;
  isLocked?: boolean;
}

export interface ConflictReport {
  id: string;
  type:
    | 'TEACHER_OVERLAP'
    | 'CLASS_OVERLAP'
    | 'DAILY_SUBJECT_LIMIT'
    | 'TEACHER_TIME_OFF'
    | 'CLASS_TIME_OFF'
    | 'SUBJECT_TIME_OFF'
    | 'UNPLACED_BLOCK';
  message: string;
  day?: DayKey;
  teacherId?: string;
  classId?: string;
  subjectId?: string;
  timeRange?: string;
  lessonCardIds?: string[];
}

