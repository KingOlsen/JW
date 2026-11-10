import React, { useEffect, useState } from 'react';
import {
  DayKey,
  PeriodSlot,
  SchoolClass,
  Subject,
  SubjectColorKey,
  TahapPeriodConfig,
  TahapType,
  Teacher,
  TimeOffSlot,
} from '../types/timetable';
import {
  DAYS,
  formatDisplayTime,
  getUnifiedTeacherPeriods,
  isInTimeOff,
} from '../utils/timetableEngine';
import { SUBJECT_COLOR_STYLES } from '../data/initialData';
import {
  Ban,
  BookOpen,
  Check,
  Clock,
  GraduationCap,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface InputsConstraintManagerProps {
  activeSubTab?: 'teachers' | 'classes' | 'subjects' | 'periods';
  selectedTeacherForTimeOff?: string;
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  tahapConfigs: TahapPeriodConfig[];
  onAddTeacher: (t: Omit<Teacher, 'id'>) => void;
  onUpdateTeacher: (t: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  onAddClass: (c: Omit<SchoolClass, 'id'>) => void;
  onUpdateClass: (c: SchoolClass) => void;
  onDeleteClass: (id: string) => void;
  onAddSubject: (s: Omit<Subject, 'id'>) => void;
  onUpdateSubject: (s: Subject) => void;
  onDeleteSubject: (id: string) => void;
  onUpdateTahapConfig: (cfg: TahapPeriodConfig) => void;
  onGenerateTimetable: () => void;
}

const COLOR_OPTIONS: { key: SubjectColorKey; label: string }[] = [
  { key: 'amber', label: 'Kuning Amber (BM/Ulum)' },
  { key: 'emerald', label: 'Hijau Emerald (BI)' },
  { key: 'violet', label: 'Ungu Violet (MT)' },
  { key: 'rose', label: 'Merah Rose (SN/PK)' },
  { key: 'indigo', label: 'Biru Indigo (BA/TAS)' },
  { key: 'fuchsia', label: 'Merah Jambu (BT)' },
  { key: 'teal', label: 'Hijau Teal (Quran/Jawi)' },
  { key: 'lime', label: 'Hijau Lime (PM)' },
  { key: 'sky', label: 'Biru Langit (PSV/RBT)' },
  { key: 'orange', label: 'Jingga (PJ/SEJ)' },
  { key: 'cyan', label: 'Sian (PMZ)' },
  { key: 'slate', label: 'Kelabu Slate (PH)' },
];

export const InputsConstraintManager: React.FC<InputsConstraintManagerProps> = ({
  activeSubTab = 'teachers',
  selectedTeacherForTimeOff,
  teachers,
  classes,
  subjects,
  tahapConfigs,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
  onUpdateTahapConfig,
  onGenerateTimetable,
}) => {
  const [subTab, setSubTab] = useState<'teachers' | 'classes' | 'subjects' | 'periods'>(
    activeSubTab
  );

  // Selected entity for Time-Off Matrix editing
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    selectedTeacherForTimeOff || teachers[0]?.id || ''
  );
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || ''
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects.find((s) => s.shortName === 'PJ')?.id || subjects[0]?.id || ''
  );
  const [selectedTahap, setSelectedTahap] = useState<TahapType>(1);

  // Forms for adding or editing a teacher in the left column
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [tFullName, setTFullName] = useState('');
  const [tShortName, setTShortName] = useState('');
  const [tRole, setTRole] = useState('');

  // Inline Edit Guru state for the active teacher in the right panel
  const [editActiveFullName, setEditActiveFullName] = useState('');
  const [editActiveShortName, setEditActiveShortName] = useState('');
  const [editActiveRole, setEditActiveRole] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const [cShortName, setCShortName] = useState('');
  const [cName, setCName] = useState('');
  const [cTahap, setCTahap] = useState<TahapType>(1);
  const [cTeacherId, setCTeacherId] = useState(teachers[0]?.id || '');

  const [sShortName, setSShortName] = useState('');
  const [sFullName, setSFullName] = useState('');
  const [sColor, setSColor] = useState<SubjectColorKey>('amber');

  const unifiedPeriods = getUnifiedTeacherPeriods(tahapConfigs, classes);

  // Helper to toggle a TimeOffSlot in a list
  const toggleTimeOffSlot = (
    list: TimeOffSlot[],
    day: DayKey,
    startTime: string,
    endTime: string,
    defaultReason: string
  ): TimeOffSlot[] => {
    const exactMatch = list.find(
      (slot) =>
        slot.day === day &&
        slot.startTime === startTime &&
        slot.endTime === endTime
    );
    if (exactMatch) {
      return list.filter((item) => item !== exactMatch);
    }
    const overlapping = isInTimeOff(day, startTime, endTime, list);
    if (overlapping) {
      return list.filter((item) => item !== overlapping);
    }
    return [...list, { day, startTime, endTime, reason: defaultReason }];
  };

  const activeTeacher =
    teachers.find((t) => t.id === selectedTeacherId) || teachers[0];
  const activeClass =
    classes.find((c) => c.id === selectedClassId) || classes[0];
  const activeSubject =
    subjects.find((s) => s.id === selectedSubjectId) || subjects[0];
  const activeTahapConfig =
    tahapConfigs.find((t) => t.tahap === selectedTahap) || tahapConfigs[0];

  // Keep right-panel Edit Guru inputs synced when activeTeacher changes
  useEffect(() => {
    if (activeTeacher) {
      setEditActiveFullName(activeTeacher.fullName);
      setEditActiveShortName(activeTeacher.shortName);
      setEditActiveRole(activeTeacher.role || '');
      setSavedNotice(false);
    }
  }, [activeTeacher?.id, activeTeacher?.fullName, activeTeacher?.shortName, activeTeacher?.role]);

  const handleStartEditTeacher = (teacher: Teacher) => {
    setSelectedTeacherId(teacher.id);
    setEditingTeacherId(teacher.id);
    setTFullName(teacher.fullName);
    setTShortName(teacher.shortName);
    setTRole(teacher.role || '');
  };

  const handleCancelEditTeacher = () => {
    setEditingTeacherId(null);
    setTFullName('');
    setTShortName('');
    setTRole('');
  };

  const handleAddOrUpdateTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tFullName.trim() || !tShortName.trim()) return;

    if (editingTeacherId) {
      const existing = teachers.find((t) => t.id === editingTeacherId);
      if (existing) {
        onUpdateTeacher({
          ...existing,
          fullName: tFullName.trim().toUpperCase(),
          shortName: tShortName.trim().toUpperCase(),
          role: tRole.trim() || 'Guru Akademik',
        });
      }
      setEditingTeacherId(null);
    } else {
      onAddTeacher({
        fullName: tFullName.trim().toUpperCase(),
        shortName: tShortName.trim().toUpperCase(),
        role: tRole.trim() || 'Guru Akademik',
        timeOff: [],
      });
    }

    setTFullName('');
    setTShortName('');
    setTRole('');
  };

  const handleSaveActiveTeacherProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeacher || !editActiveFullName.trim() || !editActiveShortName.trim()) {
      return;
    }
    onUpdateTeacher({
      ...activeTeacher,
      fullName: editActiveFullName.trim().toUpperCase(),
      shortName: editActiveShortName.trim().toUpperCase(),
      role: editActiveRole.trim() || 'Guru Akademik',
    });
    if (editingTeacherId === activeTeacher.id) {
      setEditingTeacherId(null);
      setTFullName('');
      setTShortName('');
      setTRole('');
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleAddClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cShortName.trim() || !cName.trim()) return;
    onAddClass({
      shortName: cShortName.trim().toUpperCase(),
      name: cName.trim().toUpperCase(),
      tahap: cTahap,
      classTeacherId: cTeacherId,
      timeOff: [
        { day: 'JUMAAT', startTime: '12:00', endTime: '13:30', reason: 'Solat Jumaat' },
      ],
    });
    setCShortName('');
    setCName('');
  };

  const handleAddSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sShortName.trim() || !sFullName.trim()) return;
    onAddSubject({
      shortName: sShortName.trim().toUpperCase(),
      fullName: sFullName.trim(),
      color: sColor,
      timeOff: [],
    });
    setSShortName('');
    setSFullName('');
  };

  const handlePeriodChange = (
    periodId: string,
    field: keyof PeriodSlot,
    value: string | boolean
  ) => {
    if (!activeTahapConfig) return;
    const updatedPeriods = activeTahapConfig.periods.map((p) =>
      p.id === periodId ? { ...p, [field]: value } : p
    );
    onUpdateTahapConfig({
      ...activeTahapConfig,
      periods: updatedPeriods,
    });
  };

  const handleAddPeriodToTahap = () => {
    if (!activeTahapConfig) return;
    const nextNum = activeTahapConfig.periods.length + 1;
    const newPeriod: PeriodSlot = {
      id: `t${activeTahapConfig.tahap}_${Date.now()}`,
      code: String(nextNum),
      label: `Waktu ${nextNum}`,
      startTime: '13:00',
      endTime: '13:30',
      isBreak: false,
    };
    onUpdateTahapConfig({
      ...activeTahapConfig,
      periods: [...activeTahapConfig.periods, newPeriod],
    });
  };

  const handleDeletePeriodFromTahap = (periodId: string) => {
    if (!activeTahapConfig || activeTahapConfig.periods.length <= 2) return;
    onUpdateTahapConfig({
      ...activeTahapConfig,
      periods: activeTahapConfig.periods.filter((p) => p.id !== periodId),
    });
  };

  return (
    <div className="space-y-5">
      {/* Header & Sub-Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Input Data &amp; Kekangan Masa (Guru · Kelas · Subjek · Waktu Tahap)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Urus senarai Guru (Tambah &amp; Edit Guru), Kelas (Tahap 1, 2, 3), Subjek, serta tetapan Waktu Mula/Tamat dan Time Off (waktu tidak lapang).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('teachers')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'teachers'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Guru ({teachers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('classes')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'classes'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Kelas ({classes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('subjects')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'subjects'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Subjek ({subjects.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('periods')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'periods'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Slot Masa (Tahap 1/2/3)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onGenerateTimetable}
            className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Jana Jadual</span>
          </button>
        </div>
      </div>

      {/* ================= 1. GURU & TIME OFF ================= */}
      {subTab === 'teachers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Teacher List + Add/Edit Teacher */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingTeacherId ? 'Edit Maklumat Guru' : 'Tambah Guru Baru'}
              </h2>
              {editingTeacherId && (
                <button
                  type="button"
                  onClick={handleCancelEditTeacher}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Batal Edit</span>
                </button>
              )}
            </div>
            <form onSubmit={handleAddOrUpdateTeacherSubmit} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Nama Penuh Guru
                  </label>
                  <input
                    type="text"
                    required
                    value={tFullName}
                    onChange={(e) => setTFullName(e.target.value)}
                    placeholder="PUAN SITI AISYAH BINTI ALI"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Singkatan (Short)
                  </label>
                  <input
                    type="text"
                    required
                    value={tShortName}
                    onChange={(e) => setTShortName(e.target.value)}
                    placeholder="AISYAH"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tRole}
                  onChange={(e) => setTRole(e.target.value)}
                  placeholder="Jawatan / Panitia (Pilihan)"
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg cursor-pointer shrink-0 ${
                    editingTeacherId
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-slate-900 dark:bg-white dark:text-slate-900'
                  }`}
                >
                  {editingTeacherId ? 'Simpan Guru' : '+ Tambah Guru'}
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Senarai Guru (Klik untuk Edit Guru &amp; Time Off)
              </div>
              <div className="space-y-1.5 max-h-[430px] overflow-y-auto pr-1">
                {teachers.map((t) => {
                  const isSelected = activeTeacher?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTeacherId(t.id)}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                          : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                            {t.shortName}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {t.fullName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {t.role ? `${t.role} · ` : ''}Time Off: {t.timeOff.length} slot
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditTeacher(t);
                          }}
                          className="text-slate-500 hover:text-slate-900 dark:hover:text-white p-1.5 rounded hover:bg-white/80 dark:hover:bg-slate-700 cursor-pointer"
                          title="Edit maklumat guru"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTeacher(t.id);
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-white/80 dark:hover:bg-slate-700 cursor-pointer"
                          title="Padam guru"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Edit Active Guru Form + Interactive Teacher Time-Off Matrix */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
            {activeTeacher && (
              <>
                {/* Direct Edit Guru Profile Section */}
                <form
                  onSubmit={handleSaveActiveTeacherProfile}
                  className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Pencil className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Edit Maklumat Guru Dipilih
                      </span>
                    </div>
                    {savedNotice && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Perubahan Disimpan</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Nama Penuh Guru
                      </label>
                      <input
                        type="text"
                        required
                        value={editActiveFullName}
                        onChange={(e) => setEditActiveFullName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Singkatan (Short)
                      </label>
                      <input
                        type="text"
                        required
                        value={editActiveShortName}
                        onChange={(e) => setEditActiveShortName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400"
                      />
                    </div>
                    <div className="sm:col-span-3 flex items-end">
                      <button
                        type="submit"
                        className="w-full py-1.5 px-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Simpan Edit</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Jawatan / Panitia
                    </label>
                    <input
                      type="text"
                      value={editActiveRole}
                      onChange={(e) => setEditActiveRole(e.target.value)}
                      placeholder="Contoh: Ketua Panitia Bahasa Melayu"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                </form>

                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase">
                      Tetapan Time Off (Waktu Tidak Lapang Guru)
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {activeTeacher.fullName} ({activeTeacher.shortName})
                    </h3>
                  </div>
                  {activeTeacher.timeOff.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTeacher({ ...activeTeacher, timeOff: [] })
                      }
                      className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 cursor-pointer"
                    >
                      Kosongkan Semua Time Off
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Klik pada mana-mana slot waktu di bawah untuk menandakan waktu tersebut sebagai <strong>Time Off (Tidak Lapang)</strong>. Penjana jadual tidak akan meletakkan kelas untuk {activeTeacher.shortName} pada waktu yang bertindih.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-center">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                        <th className="p-2 text-left text-[11px] font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                          HARI
                        </th>
                        {unifiedPeriods.map((p) => (
                          <th
                            key={`${p.code}_${p.startTime}`}
                            className="p-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-800"
                          >
                            <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                              {p.code}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                              {formatDisplayTime(p.startTime)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {DAYS.map((d) => (
                        <tr key={d.key}>
                          <td className="p-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                            {d.label}
                          </td>
                          {unifiedPeriods.map((p) => {
                            const off = isInTimeOff(
                              d.key,
                              p.startTime,
                              p.endTime,
                              activeTeacher.timeOff
                            );
                            return (
                              <td
                                key={`${d.key}_${p.code}_${p.startTime}`}
                                onClick={() => {
                                  const nextOff = toggleTimeOffSlot(
                                    activeTeacher.timeOff,
                                    d.key,
                                    p.startTime,
                                    p.endTime,
                                    'Tidak Lapang'
                                  );
                                  onUpdateTeacher({
                                    ...activeTeacher,
                                    timeOff: nextOff,
                                  });
                                }}
                                className={`p-2 border-r last:border-r-0 border-slate-200 dark:border-slate-800 cursor-pointer transition-colors ${
                                  off
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                    : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600'
                                }`}
                              >
                                {off ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <Ban className="w-3.5 h-3.5" />
                                    <span className="text-[9px] font-bold">
                                      OFF
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-0.5 opacity-40">
                                    <Check className="w-3.5 h-3.5" />
                                    <span className="text-[9px]">OK</span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= 2. KELAS (TAHAP 1, 2, 3) & TIME OFF ================= */}
      {subTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Tambah Kelas Baru
            </h2>
            <form onSubmit={handleAddClassSubmit} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Kod (Cth: 1C)
                  </label>
                  <input
                    type="text"
                    required
                    value={cShortName}
                    onChange={(e) => setCShortName(e.target.value)}
                    placeholder="1C"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Nama Kelas (Cth: 1 CEMERLANG)
                  </label>
                  <input
                    type="text"
                    required
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="1 CEMERLANG"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Tahap Kelas (1, 2, atau 3)
                  </label>
                  <select
                    value={cTahap}
                    onChange={(e) =>
                      setCTahap(Number(e.target.value) as TahapType)
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={1}>Tahap 1</option>
                    <option value={2}>Tahap 2</option>
                    <option value={3}>Tahap 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Guru Kelas
                  </label>
                  <select
                    value={cTeacherId}
                    onChange={(e) => setCTeacherId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.shortName} - {t.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg cursor-pointer"
              >
                + Tambah Kelas
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {classes.map((cls) => {
                const isSelected = activeClass?.id === cls.id;
                const cTeacher = teachers.find(
                  (t) => t.id === cls.classTeacherId
                );
                return (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                          {cls.shortName}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {cls.name}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          · Tahap {cls.tahap}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Guru Kelas: {cTeacher?.shortName || '—'} · Time Off:{' '}
                        {cls.timeOff.length} slot
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClass(cls.id);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Class Time-Off Matrix & Tahap Selector */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            {activeClass && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase">
                      Tetapan Kelas &amp; Time Off Kelas
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      KELAS {activeClass.name} ({activeClass.shortName}) — Tahap{' '}
                      {activeClass.tahap}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Tukar Tahap:
                    </span>
                    {([1, 2, 3] as TahapType[]).map((thp) => (
                      <button
                        key={thp}
                        type="button"
                        onClick={() =>
                          onUpdateClass({ ...activeClass, tahap: thp })
                        }
                        className={`px-2.5 py-1 text-xs font-bold rounded border cursor-pointer ${
                          activeClass.tahap === thp
                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Tahap {thp}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Klik pada petak waktu di bawah untuk menetapkan waktu kelas tamat awal / tidak aktif (Contoh: Jumaat selepas 12:00 tengah hari).
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-center">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                        <th className="p-2 text-left text-[11px] font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                          HARI
                        </th>
                        {(
                          tahapConfigs.find(
                            (t) => t.tahap === activeClass.tahap
                          )?.periods || []
                        )
                          .filter((p) => !p.isBreak)
                          .map((p) => (
                            <th
                              key={p.id}
                              className="p-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-800"
                            >
                              <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                                {p.code}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                                {formatDisplayTime(p.startTime)}
                              </div>
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {DAYS.map((d) => (
                        <tr key={d.key}>
                          <td className="p-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                            {d.label}
                          </td>
                          {(
                            tahapConfigs.find(
                              (t) => t.tahap === activeClass.tahap
                            )?.periods || []
                          )
                            .filter((p) => !p.isBreak)
                            .map((p) => {
                              const off = isInTimeOff(
                                d.key,
                                p.startTime,
                                p.endTime,
                                activeClass.timeOff
                              );
                              return (
                                <td
                                  key={`${d.key}_${p.code}`}
                                  onClick={() => {
                                    const nextOff = toggleTimeOffSlot(
                                      activeClass.timeOff,
                                      d.key,
                                      p.startTime,
                                      p.endTime,
                                      'Tamat Sesi Kelas'
                                    );
                                    onUpdateClass({
                                      ...activeClass,
                                      timeOff: nextOff,
                                    });
                                  }}
                                  className={`p-2 border-r last:border-r-0 border-slate-200 dark:border-slate-800 cursor-pointer transition-colors ${
                                    off
                                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                      : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600'
                                  }`}
                                >
                                  {off ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <Ban className="w-3.5 h-3.5" />
                                      <span className="text-[9px] font-bold">
                                        OFF
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center gap-0.5 opacity-40">
                                      <Check className="w-3.5 h-3.5" />
                                      <span className="text-[9px]">AKTIF</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= 3. SUBJEK & TIME OFF ================= */}
      {subTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Tambah Subjek Baru
            </h2>
            <form onSubmit={handleAddSubjectSubmit} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Singkatan (Short)
                  </label>
                  <input
                    type="text"
                    required
                    value={sShortName}
                    onChange={(e) => setSShortName(e.target.value)}
                    placeholder="TMK"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Nama Penuh Subjek
                  </label>
                  <input
                    type="text"
                    required
                    value={sFullName}
                    onChange={(e) => setSFullName(e.target.value)}
                    placeholder="Teknologi Maklumat & Komunikasi"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Tema Warna Subjek
                </label>
                <select
                  value={sColor}
                  onChange={(e) =>
                    setSColor(e.target.value as SubjectColorKey)
                  }
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {COLOR_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg cursor-pointer"
              >
                + Tambah Subjek
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {subjects.map((s) => {
                const isSelected = activeSubject?.id === s.id;
                const style = SUBJECT_COLOR_STYLES[s.color];
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSubjectId(s.id)}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-rose-500'
                        : ''
                    } ${style.bg} ${style.border}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-extrabold ${style.codeText}`}>
                          {s.shortName}
                        </span>
                        <span className={`text-xs font-bold ${style.teacherText}`}>
                          {s.fullName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Time Off Subjek: {s.timeOff.length} slot disekat
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSubject(s.id);
                      }}
                      className="text-slate-500 hover:text-rose-600 p-1 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Subject Time Off Matrix */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            {activeSubject && (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase">
                      Tetapan Time Off Subjek
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {activeSubject.shortName} — {activeSubject.fullName}
                    </h3>
                  </div>

                  {activeSubject.timeOff.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSubject({ ...activeSubject, timeOff: [] })
                      }
                      className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 cursor-pointer"
                    >
                      Buka Semua Waktu
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tandakan waktu di mana subjek <strong>{activeSubject.shortName}</strong> TIDAK dibenarkan dijadualkan (Contoh: Pendidikan Jasmani hanya pada waktu pagi sebelum rehat).
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-center">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                        <th className="p-2 text-left text-[11px] font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                          HARI
                        </th>
                        {unifiedPeriods.map((p) => (
                          <th
                            key={`${p.code}_${p.startTime}`}
                            className="p-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-800"
                          >
                            <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                              {p.code}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                              {formatDisplayTime(p.startTime)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {DAYS.map((d) => (
                        <tr key={d.key}>
                          <td className="p-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                            {d.label}
                          </td>
                          {unifiedPeriods.map((p) => {
                            const off = isInTimeOff(
                              d.key,
                              p.startTime,
                              p.endTime,
                              activeSubject.timeOff
                            );
                            return (
                              <td
                                key={`${d.key}_${p.code}_${p.startTime}`}
                                onClick={() => {
                                  const nextOff = toggleTimeOffSlot(
                                    activeSubject.timeOff,
                                    d.key,
                                    p.startTime,
                                    p.endTime,
                                    'Sekatan Waktu Subjek'
                                  );
                                  onUpdateSubject({
                                    ...activeSubject,
                                    timeOff: nextOff,
                                  });
                                }}
                                className={`p-2 border-r last:border-r-0 border-slate-200 dark:border-slate-800 cursor-pointer transition-colors ${
                                  off
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                    : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600'
                                }`}
                              >
                                {off ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <Ban className="w-3.5 h-3.5" />
                                    <span className="text-[9px] font-bold">
                                      OFF
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-0.5 opacity-40">
                                    <Check className="w-3.5 h-3.5" />
                                    <span className="text-[9px]">BOLEH</span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= 4. SLOT MASA MENGIKUT TAHAP (1, 2, 3) ================= */}
      {subTab === 'periods' && activeTahapConfig && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Konfigurasi Slot Waktu Mengikut Tahap Kelas (Tahap 1, Tahap 2, Tahap 3)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Setiap Tahap mempunyai waktu mula dan tamat tersendiri (Contoh: Waktu Rehat &amp; Waktu 5-1 / 5-2 berbeza antara Tahap 1 dan Tahap 2/3). Sistem menyemak pertindihan masa sebenar (real-time clock overlap) bagi setiap guru merentasi semua tahap.
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                {([1, 2, 3] as TahapType[]).map((thp) => (
                  <button
                    key={thp}
                    type="button"
                    onClick={() => setSelectedTahap(thp)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      selectedTahap === thp
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Tahap {thp}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    <th className="p-3">Kod Waktu</th>
                    <th className="p-3">Label</th>
                    <th className="p-3">Masa Mula (HH:MM)</th>
                    <th className="p-3">Masa Tamat (HH:MM)</th>
                    <th className="p-3">Jenis Slot</th>
                    <th className="p-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {activeTahapConfig.periods.map((period) => (
                    <tr
                      key={period.id}
                      className={
                        period.isBreak
                          ? 'bg-amber-50/40 dark:bg-amber-950/20'
                          : ''
                      }
                    >
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={period.code}
                          onChange={(e) =>
                            handlePeriodChange(
                              period.id,
                              'code',
                              e.target.value
                            )
                          }
                          className="w-20 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={period.label}
                          onChange={(e) =>
                            handlePeriodChange(
                              period.id,
                              'label',
                              e.target.value
                            )
                          }
                          className="w-36 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={period.startTime}
                          onChange={(e) =>
                            handlePeriodChange(
                              period.id,
                              'startTime',
                              e.target.value
                            )
                          }
                          className="w-24 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono tabular-nums text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={period.endTime}
                          onChange={(e) =>
                            handlePeriodChange(
                              period.id,
                              'endTime',
                              e.target.value
                            )
                          }
                          className="w-24 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono tabular-nums text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="p-2.5">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(period.isBreak)}
                            onChange={(e) =>
                              handlePeriodChange(
                                period.id,
                                'isBreak',
                                e.target.checked
                              )
                            }
                            className="rounded border-slate-300"
                          />
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {period.isBreak ? 'Waktu Rehat (REHAT)' : 'Sesi PdP'}
                          </span>
                        </label>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeletePeriodFromTahap(period.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                type="button"
                onClick={handleAddPeriodToTahap}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Slot Waktu (Tahap {selectedTahap})</span>
              </button>

              <button
                type="button"
                onClick={onGenerateTimetable}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg cursor-pointer"
              >
                Kemas Kini &amp; Jana Semula Jadual
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
