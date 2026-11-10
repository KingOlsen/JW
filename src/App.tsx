import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  DayKey,
  LessonCard,
  ScheduledItem,
  SchoolClass,
  Subject,
  TahapPeriodConfig,
  TahapType,
  Teacher,
} from './types/timetable';
import {
  INITIAL_CLASSES,
  INITIAL_LESSON_CARDS,
  INITIAL_SUBJECTS,
  INITIAL_TAHAP_CONFIGS,
  INITIAL_TEACHERS,
} from './data/initialData';
import {
  areClassSlotsContinuousOrAdjacent,
  formatDisplayTime,
  generateCompleteTimetable,
  getClassPeriods,
  getMaxDailyPeriodsForSubject,
  getSubjectWeeklyPeriods,
  getTeacherContinuousMinutesWithCandidate,
  intervalsOverlap,
  isInTimeOff,
  isSinglePeriodPerDaySubject,
  sanitizeLessonCardsForZeroOverlap,
  syncScheduledItemsWithInputs,
  validateTimetable,
} from './utils/timetableEngine';
import {
  auth,
  db,
  DEFAULT_SHARED_WORKSPACE_ID,
  doc,
  handleFirestoreError,
  onSnapshot,
  OperationType,
  saveTimetableToCloud,
  signInWithGooglePopup,
  signOutFromCloud,
} from './lib/firebase';
import { ClassTimetableView } from './components/ClassTimetableView';
import { TeacherTimetableView } from './components/TeacherTimetableView';
import { LessonCardsManager } from './components/LessonCardsManager';
import { InputsConstraintManager } from './components/InputsConstraintManager';
import { GeneratorAuditView } from './components/GeneratorAuditView';
import {
  CheckCircle2,
  Cloud,
  LogIn,
  Moon,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
} from 'lucide-react';

type ActiveTab =
  | 'jadual_kelas'
  | 'jadual_guru'
  | 'kad_pengajaran'
  | 'data_kekangan'
  | 'jana_jadual';

const STORAGE_KEY = 'sk_allsaints_jadual_2026_v1';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('jadual_kelas');

  // Core Data States
  const [teachers, setTeachers] = useState<Teacher[]>(INITIAL_TEACHERS);
  const [classes, setClasses] = useState<SchoolClass[]>(INITIAL_CLASSES);
  const [subjects, setSubjects] = useState<Subject[]>(INITIAL_SUBJECTS);
  const [tahapConfigs, setTahapConfigs] = useState<TahapPeriodConfig[]>(
    INITIAL_TAHAP_CONFIGS
  );
  const [lessonCards, setLessonCards] = useState<LessonCard[]>(
    INITIAL_LESSON_CARDS
  );

  // Generated Timetable State
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>(() => {
    const initial = generateCompleteTimetable(
      INITIAL_LESSON_CARDS,
      INITIAL_TEACHERS,
      INITIAL_CLASSES,
      INITIAL_SUBJECTS,
      INITIAL_TAHAP_CONFIGS
    );
    return initial.items;
  });

  const formatCurrentDateTime = (d = new Date()) =>
    d
      .toLocaleString('ms-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      .toUpperCase();

  const [lastGeneratedAt, setLastGeneratedAt] = useState<string>(() =>
    formatCurrentDateTime()
  );

  // Directory & Selection States
  const [selectedClassId, setSelectedClassId] = useState<string>(
    INITIAL_CLASSES[0].id
  );
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    't_adawiyah'
  );
  const [sidebarMode, setSidebarMode] = useState<'classes' | 'teachers'>(
    'classes'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tahapFilter, setTahapFilter] = useState<'ALL' | TahapType>('ALL');

  // Deep-link filter states when jumping to LessonCards or Data & Kekangan
  const [lessonCardClassFilter, setLessonCardClassFilter] =
    useState<string>('ALL');
  const [inputsSubTab, setInputsSubTab] = useState<
    'teachers' | 'classes' | 'subjects' | 'periods'
  >('teachers');

  // Cloud Sync (Multi-Device Firestore) States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [workspaceId, setWorkspaceId] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('sk_allsaints_workspace_id') ||
        DEFAULT_SHARED_WORKSPACE_ID
      );
    } catch {
      return DEFAULT_SHARED_WORKSPACE_ID;
    }
  });
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'offline' | 'connecting' | 'synced' | 'syncing' | 'error'
  >('offline');
  const [lastCloudSyncedAt, setLastCloudSyncedAt] = useState<string | null>(
    null
  );

  // Refs to prevent echo loops between incoming Firestore snapshots and outgoing local edits
  const isApplyingRemoteRef = useRef<boolean>(false);
  const lastSyncedHashRef = useRef<string>('');
  const initialCloudLoadCompleteRef = useRef<boolean>(false);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Load saved state from localStorage if available, and auto-repair if stale overlaps exist
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const loadedTeachers: Teacher[] = parsed.teachers?.length
          ? parsed.teachers
          : INITIAL_TEACHERS;
        const loadedClasses: SchoolClass[] = parsed.classes?.length
          ? parsed.classes
          : INITIAL_CLASSES;
        const loadedSubjects: Subject[] = parsed.subjects?.length
          ? parsed.subjects
          : INITIAL_SUBJECTS;
        const loadedTahap: TahapPeriodConfig[] = parsed.tahapConfigs?.length
          ? parsed.tahapConfigs
          : INITIAL_TAHAP_CONFIGS;
        const loadedCards: LessonCard[] = parsed.lessonCards?.length
          ? parsed.lessonCards
          : INITIAL_LESSON_CARDS;
        const loadedScheduled: ScheduledItem[] = parsed.scheduledItems?.length
          ? parsed.scheduledItems
          : [];

        setTeachers(loadedTeachers);
        setClasses(loadedClasses);
        setSubjects(loadedSubjects);
        setTahapConfigs(loadedTahap);

        const synced = syncScheduledItemsWithInputs(
          loadedScheduled,
          loadedCards,
          loadedClasses,
          loadedTahap
        );
        const existingConflicts = validateTimetable(
          synced,
          loadedCards,
          loadedTeachers,
          loadedClasses,
          loadedSubjects,
          loadedTahap
        );

        if (existingConflicts.length > 0 || synced.length === 0) {
          const cleanCards = sanitizeLessonCardsForZeroOverlap(
            loadedCards,
            loadedClasses,
            loadedTahap,
            loadedSubjects
          );
          setLessonCards(cleanCards);
          const repaired = generateCompleteTimetable(
            cleanCards,
            loadedTeachers,
            loadedClasses,
            loadedSubjects,
            loadedTahap,
            0
          );
          setScheduledItems(repaired.items);
        } else {
          setLessonCards(loadedCards);
          setScheduledItems(synced);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          teachers,
          classes,
          subjects,
          tahapConfigs,
          lessonCards,
          scheduledItems,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [teachers, classes, subjects, tahapConfigs, lessonCards, scheduledItems]);

  // 1. Track Firebase Auth state for multi-device cloud sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
      if (!user) {
        setCloudSyncStatus('offline');
        initialCloudLoadCompleteRef.current = false;
      } else {
        setCloudSyncStatus('connecting');
      }
    });
    return () => unsubscribe();
  }, []);

  // Helper to compute deterministic hash of the timetable payload
  const computePayloadHash = (payload: {
    teachers: Teacher[];
    classes: SchoolClass[];
    subjects: Subject[];
    tahapConfigs: TahapPeriodConfig[];
    lessonCards: LessonCard[];
    scheduledItems: ScheduledItem[];
    lastGeneratedAt: string;
  }) =>
    JSON.stringify({
      t: payload.teachers,
      c: payload.classes,
      s: payload.subjects,
      th: payload.tahapConfigs,
      lc: payload.lessonCards,
      si: payload.scheduledItems,
      lg: payload.lastGeneratedAt,
    });

  // Push current state to Firestore
  const pushStateToCloud = async (
    targetWorkspaceId = workspaceId,
    customState?: {
      teachers: Teacher[];
      classes: SchoolClass[];
      subjects: Subject[];
      tahapConfigs: TahapPeriodConfig[];
      lessonCards: LessonCard[];
      scheduledItems: ScheduledItem[];
      lastGeneratedAt: string;
    }
  ) => {
    if (!auth.currentUser) return;
    const stateToSave = customState || {
      teachers,
      classes,
      subjects,
      tahapConfigs,
      lessonCards,
      scheduledItems,
      lastGeneratedAt,
    };

    const hash = computePayloadHash(stateToSave);
    lastSyncedHashRef.current = hash;
    setCloudSyncStatus('syncing');

    try {
      await saveTimetableToCloud(targetWorkspaceId, {
        title: 'JADUAL WAKTU PERSEKOLAHAN 2026',
        schoolName: "SK ALL SAINTS', KAMUNTING, PERAK",
        lastGeneratedAt: stateToSave.lastGeneratedAt,
        isSharedWorkspace: true,
        teachers: stateToSave.teachers,
        classes: stateToSave.classes,
        subjects: stateToSave.subjects,
        tahapConfigs: stateToSave.tahapConfigs,
        lessonCards: stateToSave.lessonCards,
        scheduledItems: stateToSave.scheduledItems,
      });
      setCloudSyncStatus('synced');
      setLastCloudSyncedAt(formatCurrentDateTime(new Date()));
    } catch {
      setCloudSyncStatus('error');
    }
  };

  // 2. Attach real-time Firestore listener when user is authenticated
  useEffect(() => {
    if (!isAuthReady || !currentUser) return;

    const cleanId = workspaceId
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 128);
    const path = `timetables/${cleanId}`;
    const docRef = doc(db, 'timetables', cleanId);

    setCloudSyncStatus('connecting');

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const remoteTeachers = (data.teachers as Teacher[]) || INITIAL_TEACHERS;
          const remoteClasses = (data.classes as SchoolClass[]) || INITIAL_CLASSES;
          const remoteSubjects = (data.subjects as Subject[]) || INITIAL_SUBJECTS;
          const remoteTahap =
            (data.tahapConfigs as TahapPeriodConfig[]) || INITIAL_TAHAP_CONFIGS;
          const remoteCards =
            (data.lessonCards as LessonCard[]) || INITIAL_LESSON_CARDS;
          const remoteScheduled =
            (data.scheduledItems as ScheduledItem[]) || [];
          const remoteGenAt =
            (data.lastGeneratedAt as string) || formatCurrentDateTime();

          const incomingHash = computePayloadHash({
            teachers: remoteTeachers,
            classes: remoteClasses,
            subjects: remoteSubjects,
            tahapConfigs: remoteTahap,
            lessonCards: remoteCards,
            scheduledItems: remoteScheduled,
            lastGeneratedAt: remoteGenAt,
          });

          initialCloudLoadCompleteRef.current = true;
          setCloudSyncStatus('synced');
          setLastCloudSyncedAt(formatCurrentDateTime(new Date()));

          if (incomingHash !== lastSyncedHashRef.current) {
            isApplyingRemoteRef.current = true;
            lastSyncedHashRef.current = incomingHash;
            setTeachers(remoteTeachers);
            setClasses(remoteClasses);
            setSubjects(remoteSubjects);
            setTahapConfigs(remoteTahap);
            setLessonCards(remoteCards);
            setScheduledItems(remoteScheduled);
            setLastGeneratedAt(remoteGenAt);
            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 150);
          }
        } else {
          // Document does not exist in cloud yet; seed cloud with current local state
          initialCloudLoadCompleteRef.current = true;
          void pushStateToCloud(cleanId);
        }
      },
      (error) => {
        setCloudSyncStatus('error');
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, currentUser, workspaceId]);

  // 3. Automatically sync local changes to Cloud Firestore across all devices
  useEffect(() => {
    if (
      !isAuthReady ||
      !currentUser ||
      !initialCloudLoadCompleteRef.current ||
      isApplyingRemoteRef.current
    ) {
      return;
    }

    const currentHash = computePayloadHash({
      teachers,
      classes,
      subjects,
      tahapConfigs,
      lessonCards,
      scheduledItems,
      lastGeneratedAt,
    });

    if (currentHash === lastSyncedHashRef.current) return;

    const timer = setTimeout(() => {
      void pushStateToCloud(workspaceId, {
        teachers,
        classes,
        subjects,
        tahapConfigs,
        lessonCards,
        scheduledItems,
        lastGeneratedAt,
      });
    }, 450);

    return () => clearTimeout(timer);
  }, [
    teachers,
    classes,
    subjects,
    tahapConfigs,
    lessonCards,
    scheduledItems,
    lastGeneratedAt,
    isAuthReady,
    currentUser,
    workspaceId,
  ]);

  const handleChangeWorkspaceId = (newId: string) => {
    const clean =
      newId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) ||
      DEFAULT_SHARED_WORKSPACE_ID;
    initialCloudLoadCompleteRef.current = false;
    setWorkspaceId(clean);
    try {
      localStorage.setItem('sk_allsaints_workspace_id', clean);
    } catch {
      // Ignore storage error
    }
  };

  const handleSignInCloud = async () => {
    try {
      await signInWithGooglePopup();
    } catch (err) {
      console.error('Google Sign-In failed:', err);
    }
  };

  const handleSignOutCloud = async () => {
    try {
      await signOutFromCloud();
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  const teacherMap = useMemo(
    () => new Map(teachers.map((t) => [t.id, t])),
    [teachers]
  );

  // Ensure all scheduledItems stay 100% synchronized with LessonCards, Classes, and TahapPeriodConfigs
  // so Jadual Guru always reflects the exact latest Jadual Kelas state.
  const syncedScheduledItems = useMemo(
    () =>
      syncScheduledItemsWithInputs(
        scheduledItems,
        lessonCards,
        classes,
        tahapConfigs
      ),
    [scheduledItems, lessonCards, classes, tahapConfigs]
  );

  // Live validation report
  const conflicts = useMemo(
    () =>
      validateTimetable(
        syncedScheduledItems,
        lessonCards,
        teachers,
        classes,
        subjects,
        tahapConfigs
      ),
    [syncedScheduledItems, lessonCards, teachers, classes, subjects, tahapConfigs]
  );

  // Run full timetable generation for Jadual Kelas and immediately update Jadual Guru
  const runGenerateTimetable = (
    customCards = lessonCards,
    customTeachers = teachers,
    customClasses = classes,
    customSubjects = subjects,
    customTahap = tahapConfigs,
    useFreshSeed = true
  ) => {
    const seed = useFreshSeed ? (Date.now() % 99991) + 1 : 0;
    const result = generateCompleteTimetable(
      customCards,
      customTeachers,
      customClasses,
      customSubjects,
      customTahap,
      seed
    );
    const synced = syncScheduledItemsWithInputs(
      result.items,
      customCards,
      customClasses,
      customTahap
    );
    setScheduledItems(synced);
    setLastGeneratedAt(formatCurrentDateTime(new Date()));
  };

  // Auto-fix any Lesson Card overlaps (parallel group teacher collisions or fixedSlot time collisions) and regenerate
  const handleAutoFixOverlaps = () => {
    const cleanCards = sanitizeLessonCardsForZeroOverlap(
      lessonCards,
      classes,
      tahapConfigs,
      subjects
    );
    setLessonCards(cleanCards);
    runGenerateTimetable(
      cleanCards,
      teachers,
      classes,
      subjects,
      tahapConfigs,
      true
    );
  };

  const handleResetDefaults = () => {
    setTeachers(INITIAL_TEACHERS);
    setClasses(INITIAL_CLASSES);
    setSubjects(INITIAL_SUBJECTS);
    setTahapConfigs(INITIAL_TAHAP_CONFIGS);
    setLessonCards(INITIAL_LESSON_CARDS);
    runGenerateTimetable(
      INITIAL_LESSON_CARDS,
      INITIAL_TEACHERS,
      INITIAL_CLASSES,
      INITIAL_SUBJECTS,
      INITIAL_TAHAP_CONFIGS
    );
    localStorage.removeItem(STORAGE_KEY);
  };

  // Navigate to a specific teacher's timetable
  const handleSelectTeacherTimetable = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setSidebarMode('teachers');
    setActiveTab('jadual_guru');
  };

  // Navigate to a specific class's timetable
  const handleSelectClassTimetable = (classId: string) => {
    setSelectedClassId(classId);
    setSidebarMode('classes');
    setActiveTab('jadual_kelas');
  };

  // Move a scheduled item to a new day & starting periodCode with full real-time overlap validation
  const handleMoveScheduledItem = (
    itemId: string,
    targetDay: DayKey,
    targetStartPeriodCode: string
  ): { ok: boolean; reason?: string } => {
    const targetItem = scheduledItems.find((i) => i.id === itemId);
    if (!targetItem) return { ok: false, reason: 'Sesi tidak ditemui.' };

    const schoolClass = classes.find((c) => c.id === targetItem.classId);
    if (!schoolClass) return { ok: false, reason: 'Kelas tidak ditemui.' };

    const periods = getClassPeriods(schoolClass, tahapConfigs);
    const startIdx = periods.findIndex((p) => p.code === targetStartPeriodCode);
    if (startIdx === -1) return { ok: false, reason: 'Slot waktu tidak sah.' };

    const slice = periods.slice(startIdx, startIdx + targetItem.duration);
    if (slice.length < targetItem.duration) {
      return {
        ok: false,
        reason: `Memerlukan ${targetItem.duration} waktu berturut-turut.`,
      };
    }
    if (slice.some((p) => p.isBreak)) {
      return {
        ok: false,
        reason: 'Blok pengajaran tidak boleh merentasi waktu REHAT.',
      };
    }

    const newStartTime = slice[0].startTime;
    const newEndTime = slice[slice.length - 1].endTime;
    const newPeriodCodes = slice.map((p) => p.code);

    // Find all sibling items if this item is part of a parallelGroup
    const movingGroupItems = targetItem.parallelGroup
      ? scheduledItems.filter(
          (i) =>
            i.classId === targetItem.classId &&
            i.parallelGroup === targetItem.parallelGroup &&
            i.day === targetItem.day &&
            i.startPeriodCode === targetItem.startPeriodCode
        )
      : [targetItem];

    const movingIds = new Set(movingGroupItems.map((i) => i.id));

    // Check Class Time Off
    const classOff = isInTimeOff(
      targetDay,
      newStartTime,
      newEndTime,
      schoolClass.timeOff
    );
    if (classOff) {
      return {
        ok: false,
        reason: `Kelas mempunyai Time Off pada waktu ini (${classOff.reason || 'Tamat'}).`,
      };
    }

    // Check if class slot is already occupied by another item
    const classOccupied = scheduledItems.some(
      (i) =>
        !movingIds.has(i.id) &&
        i.classId === schoolClass.id &&
        i.day === targetDay &&
        intervalsOverlap(newStartTime, newEndTime, i.startTime, i.endTime)
    );
    if (classOccupied) {
      return {
        ok: false,
        reason: 'Slot kelas ini telah diisi oleh subjek lain.',
      };
    }

    // Check Subject Daily Limit, Subject Time Off, Teacher Time Off & Real-Time Teacher Overlap across all classes/Tahap
    for (const mItem of movingGroupItems) {
      const subj = subjects.find((s) => s.id === mItem.subjectId);
      const weeklyPeriods = getSubjectWeeklyPeriods(
        schoolClass.id,
        mItem.subjectId,
        lessonCards
      );
      const maxDailySubjectPeriods = getMaxDailyPeriodsForSubject(
        weeklyPeriods,
        mItem.duration,
        subj || mItem.subjectId
      );
      const existingSubjectPeriodsOnTargetDay = scheduledItems
        .filter(
          (other) =>
            !movingIds.has(other.id) &&
            other.classId === schoolClass.id &&
            other.day === targetDay &&
            other.subjectId === mItem.subjectId
        )
        .reduce((acc, i) => acc + i.duration, 0);

      if (
        existingSubjectPeriodsOnTargetDay + mItem.duration >
        maxDailySubjectPeriods
      ) {
        return {
          ok: false,
          reason: isSinglePeriodPerDaySubject(subj || mItem.subjectId)
            ? `Subjek ${subj?.shortName || 'PJ'} hanya boleh dijadualkan sehari 1 waktu sahaja.`
            : `Melebihi had harian subjek ${subj?.shortName || mItem.subjectId}: maksimum ${maxDailySubjectPeriods} waktu sehari (jumlah seminggu ${weeklyPeriods}w).`,
        };
      }

      // Prevent continuous 2+1 (or adjacent blocks of the same subject on the same day without a rest gap)
      if (existingSubjectPeriodsOnTargetDay > 0) {
        const sameSubjItemsToday = scheduledItems.filter(
          (other) =>
            !movingIds.has(other.id) &&
            other.classId === schoolClass.id &&
            other.day === targetDay &&
            other.subjectId === mItem.subjectId
        );
        for (const existingItem of sameSubjItemsToday) {
          if (
            areClassSlotsContinuousOrAdjacent(
              schoolClass,
              tahapConfigs,
              existingItem.periodCodes,
              existingItem.startTime,
              existingItem.endTime,
              newPeriodCodes,
              newStartTime,
              newEndTime
            )
          ) {
            return {
              ok: false,
              reason: `Elakkan 3 masa berterusan (2+1) bagi subjek ${subj?.shortName || mItem.subjectId}: perlu ada ruang selang waktu untuk guru berehat.`,
            };
          }
        }
      }

      if (subj) {
        const sOff = isInTimeOff(
          targetDay,
          newStartTime,
          newEndTime,
          subj.timeOff
        );
        if (sOff) {
          return {
            ok: false,
            reason: `Subjek ${subj.shortName} tidak dibenarkan pada waktu ini (${sOff.reason}).`,
          };
        }
      }

      for (const tId of mItem.teacherIds) {
        const teacher = teacherMap.get(tId);
        if (teacher) {
          const tOff = isInTimeOff(
            targetDay,
            newStartTime,
            newEndTime,
            teacher.timeOff
          );
          if (tOff) {
            return {
              ok: false,
              reason: `Guru ${teacher.shortName} mempunyai Time Off pada ${targetDay} (${formatDisplayTime(newStartTime)}-${formatDisplayTime(newEndTime)}).`,
            };
          }
        }

        const overlappingSession = scheduledItems.find(
          (other) =>
            !movingIds.has(other.id) &&
            other.day === targetDay &&
            other.teacherIds.includes(tId) &&
            intervalsOverlap(
              newStartTime,
              newEndTime,
              other.startTime,
              other.endTime
            )
        );
        if (overlappingSession) {
          const otherClass = classes.find(
            (c) => c.id === overlappingSession.classId
          );
          return {
            ok: false,
            reason: `Pertindihan masa Guru ${teacher?.shortName || tId}: sedang mengajar kelas ${otherClass?.shortName} (${formatDisplayTime(overlappingSession.startTime)}-${formatDisplayTime(overlappingSession.endTime)}).`,
          };
        }

        const continuousMins = getTeacherContinuousMinutesWithCandidate(
          scheduledItems,
          tId,
          targetDay,
          newStartTime,
          newEndTime,
          movingIds
        );
        if (continuousMins > 60) {
          return {
            ok: false,
            reason: `Elakkan 3 masa mengajar berterusan bagi Guru ${teacher?.shortName || tId}: beri ruang waktu untuk guru berehat.`,
          };
        }
      }
    }

    // Valid move! Update items
    setScheduledItems((prev) =>
      prev.map((item) =>
        movingIds.has(item.id)
          ? {
              ...item,
              day: targetDay,
              startPeriodCode: targetStartPeriodCode,
              periodCodes: newPeriodCodes,
              startTime: newStartTime,
              endTime: newEndTime,
            }
          : item
      )
    );

    return { ok: true };
  };

  // Filtered directory lists for the sidebar
  const filteredClasses = classes.filter((cls) => {
    if (tahapFilter !== 'ALL' && cls.tahap !== tahapFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const cTeacher = teacherMap.get(cls.classTeacherId);
    return (
      cls.name.toLowerCase().includes(q) ||
      cls.shortName.toLowerCase().includes(q) ||
      (cTeacher && cTeacher.fullName.toLowerCase().includes(q)) ||
      (cTeacher && cTeacher.shortName.toLowerCase().includes(q))
    );
  });

  const filteredTeachers = teachers.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.fullName.toLowerCase().includes(q) ||
      t.shortName.toLowerCase().includes(q)
    );
  });

  const activeClass =
    classes.find((c) => c.id === selectedClassId) || classes[0];
  const activeClassIndex = classes.findIndex((c) => c.id === activeClass?.id);

  const activeTeacher =
    teachers.find((t) => t.id === selectedTeacherId) || teachers[0];
  const activeTeacherIndex = teachers.findIndex(
    (t) => t.id === activeTeacher?.id
  );

  const showDirectorySidebar =
    activeTab === 'jadual_kelas' || activeTab === 'jadual_guru';

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#jadual-kelas"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('jadual_kelas');
            setSidebarMode('classes');
          }}
          className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          Direktori Jadual 2026
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="flex items-center gap-6 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 overflow-x-auto">
          <a
            href="#jadual-kelas"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('jadual_kelas');
              setSidebarMode('classes');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'jadual_kelas'
                ? 'text-rose-600 dark:text-rose-400 border-rose-600 dark:border-rose-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Jadual Kelas
          </a>
          <a
            href="#jadual-guru"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('jadual_guru');
              setSidebarMode('teachers');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'jadual_guru'
                ? 'text-rose-600 dark:text-rose-400 border-rose-600 dark:border-rose-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Jadual Guru
          </a>
          <a
            href="#kad-pengajaran"
            onClick={(e) => {
              e.preventDefault();
              setLessonCardClassFilter('ALL');
              setActiveTab('kad_pengajaran');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'kad_pengajaran'
                ? 'text-rose-600 dark:text-rose-400 border-rose-600 dark:border-rose-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Kad Pengajaran
          </a>
          <a
            href="#data-kekangan"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('data_kekangan');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'data_kekangan'
                ? 'text-rose-600 dark:text-rose-400 border-rose-600 dark:border-rose-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Data &amp; Kekangan
          </a>
          <a
            href="#jana-jadual"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('jana_jadual');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'jana_jadual'
                ? 'text-rose-600 dark:text-rose-400 border-rose-600 dark:border-rose-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Jana Jadual
          </a>
        </nav>

        {/* Zone 3: Cloud Sync + Primary Print Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {currentUser ? (
            <button
              type="button"
              onClick={() => void pushStateToCloud()}
              title={`Disegerakkan ke semua peranti (${currentUser.email}) — Kod: ${workspaceId}`}
              className="px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {cloudSyncStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>
                {cloudSyncStatus === 'syncing'
                  ? 'Menyegerak...'
                  : 'Sync Semua Peranti Aktif'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignInCloud}
              title="Log masuk Google untuk menyegerakkan jadual ke semua peranti secara automatik"
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Sync Semua Peranti</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-bold text-white bg-[#C8102E] hover:bg-[#A60D26] rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Jadual</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Directory Sidebar matching Screenshot 1 */}
        {showDirectorySidebar && (
          <aside className="no-print w-full lg:w-72 shrink-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-3.5 space-y-3">
              {/* Top Sidebar Action & Theme Switch */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => runGenerateTimetable()}
                  className="flex-1 py-2 px-3 rounded-lg border border-rose-200 dark:border-rose-800/80 bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-100/70 text-rose-700 dark:text-rose-300 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Jana Jadual Terkini</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDarkMode((d) => !d)}
                  title="Tukar Tema Cerah / Gelap"
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  {darkMode ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Compact Multi-Device Cloud Sync Strip in Sidebar */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span className="truncate">
                      {currentUser ? 'Cloud Sync Aktif' : 'Cloud Sync Peranti'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">
                    {currentUser
                      ? `Kod: ${workspaceId}`
                      : 'Log masuk untuk segerak'}
                  </div>
                </div>

                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('jana_jadual')}
                    className="px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 cursor-pointer shrink-0"
                  >
                    Tetapan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignInCloud}
                    className="px-2.5 py-1 text-[10px] font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <LogIn className="w-3 h-3" />
                    <span>Log Masuk</span>
                  </button>
                )}
              </div>

              {/* Segmented Switcher: Senarai Kelas vs Senarai Guru */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarMode('classes');
                    setActiveTab('jadual_kelas');
                  }}
                  className={`py-1.5 px-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    sidebarMode === 'classes'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Senarai Kelas ({classes.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSidebarMode('teachers');
                    setActiveTab('jadual_guru');
                  }}
                  className={`py-1.5 px-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    sidebarMode === 'teachers'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Senarai Guru ({teachers.length})
                </button>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    sidebarMode === 'classes'
                      ? 'Cari kelas atau guru kelas...'
                      : 'Cari nama atau singkatan guru...'
                  }
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
                />
              </div>

              {/* Tahap Filter Buttons (Tahap 1, 2, 3) */}
              {sidebarMode === 'classes' && (
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => setTahapFilter('ALL')}
                    className={`py-1 px-1.5 text-[11px] font-bold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      tahapFilter === 'ALL'
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Semua ({classes.length})
                  </button>
                  {([1, 2, 3] as TahapType[]).map((thp) => (
                    <button
                      key={thp}
                      type="button"
                      onClick={() => setTahapFilter(thp)}
                      className={`py-1 px-1.5 text-[11px] font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        tahapFilter === thp
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white font-bold'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Tahap {thp}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable Directory List */}
            <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 border-t border-slate-100 dark:border-slate-800 max-h-[calc(100vh-250px)]">
              {sidebarMode === 'classes' ? (
                filteredClasses.map((cls) => {
                  const isSelected =
                    activeTab === 'jadual_kelas' &&
                    selectedClassId === cls.id;
                  const cTeacher = teacherMap.get(cls.classTeacherId);

                  // Unique teaching periods count
                  const slotSet = new Set<string>();
                  syncedScheduledItems
                    .filter((i) => i.classId === cls.id)
                    .forEach((i) =>
                      i.periodCodes.forEach((code) =>
                        slotSet.add(`${i.day}_${code}`)
                      )
                    );

                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => handleSelectClassTimetable(cls.id)}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-rose-50/70 dark:bg-rose-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                            {cls.shortName}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {cls.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {cTeacher?.fullName || 'Tiada Guru Kelas'}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                          {slotSet.size}w
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                          Tahap {cls.tahap}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                filteredTeachers.map((t) => {
                  const isSelected =
                    activeTab === 'jadual_guru' && selectedTeacherId === t.id;
                  const tPeriods = syncedScheduledItems
                    .filter((i) => i.teacherIds.includes(t.id))
                    .reduce((acc, i) => acc + i.duration, 0);

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTeacherTimetable(t.id)}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-rose-50/70 dark:bg-rose-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                            {t.shortName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                          {t.fullName}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                          {tPeriods}w
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                          {t.timeOff.length > 0
                            ? `${t.timeOff.length} off`
                            : 'Tiada off'}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="mt-auto px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
              <span>JADUAL WAKTU V4 - 2026</span>
              <span>{conflicts.length === 0 ? 'Sifar Konflik' : `${conflicts.length} Isu`}</span>
            </div>
          </aside>
        )}

        {/* Right Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {activeTab === 'jadual_kelas' && activeClass && (
            <ClassTimetableView
              schoolClass={activeClass}
              classIndex={activeClassIndex}
              totalClasses={classes.length}
              scheduledItems={syncedScheduledItems}
              teachers={teachers}
              subjects={subjects}
              tahapConfigs={tahapConfigs}
              generatedAt={lastGeneratedAt}
              onSelectTeacher={handleSelectTeacherTimetable}
              onMoveScheduledItem={(itemId, day, periodCode) => {
                const res = handleMoveScheduledItem(itemId, day, periodCode);
                if (res.ok) {
                  setLastGeneratedAt(formatCurrentDateTime(new Date()));
                }
                return res;
              }}
              onOpenLessonCardsForClass={(cid) => {
                setLessonCardClassFilter(cid);
                setActiveTab('kad_pengajaran');
              }}
              onRegenerateAll={() => runGenerateTimetable()}
            />
          )}

          {activeTab === 'jadual_guru' && activeTeacher && (
            <TeacherTimetableView
              teacher={activeTeacher}
              teacherIndex={activeTeacherIndex}
              totalTeachers={teachers.length}
              scheduledItems={syncedScheduledItems}
              classes={classes}
              subjects={subjects}
              tahapConfigs={tahapConfigs}
              generatedAt={lastGeneratedAt}
              onSelectClass={handleSelectClassTimetable}
              onOpenTimeOffEditor={(tid) => {
                setSelectedTeacherId(tid);
                setInputsSubTab('teachers');
                setActiveTab('data_kekangan');
              }}
              onUpdateTeacher={(updatedT) => {
                const prevT = teachers.find((t) => t.id === updatedT.id);
                const next = teachers.map((t) =>
                  t.id === updatedT.id ? updatedT : t
                );
                setTeachers(next);
                if (
                  prevT &&
                  JSON.stringify(prevT.timeOff) !==
                    JSON.stringify(updatedT.timeOff)
                ) {
                  runGenerateTimetable(
                    lessonCards,
                    next,
                    classes,
                    subjects,
                    tahapConfigs
                  );
                }
              }}
            />
          )}

          {activeTab === 'kad_pengajaran' && (
            <LessonCardsManager
              lessonCards={lessonCards}
              scheduledItems={syncedScheduledItems}
              teachers={teachers}
              classes={classes}
              subjects={subjects}
              tahapConfigs={tahapConfigs}
              conflicts={conflicts}
              initialClassFilter={lessonCardClassFilter}
              onAddLessonCard={(newCard) => {
                const created: LessonCard = {
                  ...newCard,
                  id: `lc_${Date.now()}`,
                };
                const nextCards = [created, ...lessonCards];
                setLessonCards(nextCards);
                runGenerateTimetable(nextCards);
              }}
              onUpdateLessonCard={(updated) => {
                const nextCards = lessonCards.map((c) =>
                  c.id === updated.id ? updated : c
                );
                setLessonCards(nextCards);
                runGenerateTimetable(nextCards);
              }}
              onDeleteLessonCard={(cardId) => {
                const nextCards = lessonCards.filter((c) => c.id !== cardId);
                setLessonCards(nextCards);
                setScheduledItems((prev) =>
                  prev.filter((i) => i.lessonCardId !== cardId)
                );
              }}
              onAutoFixOverlaps={handleAutoFixOverlaps}
              onGenerateTimetable={() => runGenerateTimetable()}
            />
          )}

          {activeTab === 'data_kekangan' && (
            <InputsConstraintManager
              activeSubTab={inputsSubTab}
              selectedTeacherForTimeOff={selectedTeacherId}
              teachers={teachers}
              classes={classes}
              subjects={subjects}
              tahapConfigs={tahapConfigs}
              onAddTeacher={(newT) => {
                const created: Teacher = {
                  ...newT,
                  id: `t_${Date.now()}`,
                };
                setTeachers((prev) => [...prev, created]);
              }}
              onUpdateTeacher={(updatedT) => {
                const prevT = teachers.find((t) => t.id === updatedT.id);
                const next = teachers.map((t) =>
                  t.id === updatedT.id ? updatedT : t
                );
                setTeachers(next);
                if (
                  prevT &&
                  JSON.stringify(prevT.timeOff) !==
                    JSON.stringify(updatedT.timeOff)
                ) {
                  runGenerateTimetable(
                    lessonCards,
                    next,
                    classes,
                    subjects,
                    tahapConfigs
                  );
                }
              }}
              onDeleteTeacher={(id) => {
                if (teachers.length <= 1) return;
                setTeachers((prev) => prev.filter((t) => t.id !== id));
              }}
              onAddClass={(newC) => {
                const created: SchoolClass = {
                  ...newC,
                  id: `c_${Date.now()}`,
                };
                setClasses((prev) => [...prev, created]);
              }}
              onUpdateClass={(updatedC) => {
                const next = classes.map((c) =>
                  c.id === updatedC.id ? updatedC : c
                );
                setClasses(next);
                runGenerateTimetable(
                  lessonCards,
                  teachers,
                  next,
                  subjects,
                  tahapConfigs
                );
              }}
              onDeleteClass={(id) => {
                if (classes.length <= 1) return;
                setClasses((prev) => prev.filter((c) => c.id !== id));
              }}
              onAddSubject={(newS) => {
                const created: Subject = {
                  ...newS,
                  id: `s_${Date.now()}`,
                };
                setSubjects((prev) => [...prev, created]);
              }}
              onUpdateSubject={(updatedS) => {
                const next = subjects.map((s) =>
                  s.id === updatedS.id ? updatedS : s
                );
                setSubjects(next);
                runGenerateTimetable(
                  lessonCards,
                  teachers,
                  classes,
                  next,
                  tahapConfigs
                );
              }}
              onDeleteSubject={(id) => {
                if (subjects.length <= 1) return;
                setSubjects((prev) => prev.filter((s) => s.id !== id));
              }}
              onUpdateTahapConfig={(updatedCfg) => {
                const next = tahapConfigs.map((cfg) =>
                  cfg.tahap === updatedCfg.tahap ? updatedCfg : cfg
                );
                setTahapConfigs(next);
                runGenerateTimetable(
                  lessonCards,
                  teachers,
                  classes,
                  subjects,
                  next
                );
              }}
              onGenerateTimetable={() => runGenerateTimetable()}
            />
          )}

          {activeTab === 'jana_jadual' && (
            <GeneratorAuditView
              scheduledItems={syncedScheduledItems}
              lessonCards={lessonCards}
              teachers={teachers}
              classes={classes}
              subjects={subjects}
              tahapConfigs={tahapConfigs}
              conflicts={conflicts}
              lastGeneratedAt={lastGeneratedAt}
              userEmail={currentUser?.email}
              workspaceId={workspaceId}
              cloudSyncStatus={cloudSyncStatus}
              lastCloudSyncedAt={lastCloudSyncedAt}
              onChangeWorkspaceId={handleChangeWorkspaceId}
              onSignInCloud={handleSignInCloud}
              onSignOutCloud={handleSignOutCloud}
              onSyncNow={() => void pushStateToCloud()}
              onGenerateNow={() => runGenerateTimetable()}
              onAutoFixOverlaps={handleAutoFixOverlaps}
              onResetDefaults={handleResetDefaults}
              onSelectTeacher={handleSelectTeacherTimetable}
              onSelectClass={handleSelectClassTimetable}
            />
          )}
        </main>
      </div>
    </div>
  );
}
