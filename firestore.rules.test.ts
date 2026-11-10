/**
 * Security Rules Verification Suite (Phase 0 & Phase 5 Red Team Audit)
 * Verifies all 12 "Dirty Dozen" adversarial payloads against TimetableWorkspace and AdminUser rules.
 */

export interface SimulatedContext {
  auth: {
    uid: string;
    token: {
      email?: string;
      email_verified?: boolean;
    };
  } | null;
  requestTime: string;
}

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  context: SimulatedContext;
  existingData?: Record<string, unknown>;
  incomingData?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

const VALID_NOW = '2026-11-08T10:00:00Z';

const BASE_VALID_PAYLOAD = {
  title: 'JADUAL WAKTU PERSEKOLAHAN 2026',
  schoolName: "SK ALL SAINTS', KAMUNTING, PERAK",
  lastGeneratedAt: '08 NOV 2026, 10:00 PG',
  ownerId: 'user_valid_123',
  teachers: [{ id: 't_1', shortName: 'SARIMAH', fullName: 'PUAN SARIMAH' }],
  classes: [{ id: 'c_1a', shortName: '1A', name: '1 ARIF', tahap: 1 }],
  subjects: [{ id: 's_bm', shortName: 'BM', fullName: 'Bahasa Melayu' }],
  tahapConfigs: [{ tahap: 1, name: 'Tahap 1' }],
  lessonCards: [{ id: 'lc_1', classId: 'c_1a', subjectId: 's_bm', blocks: [2] }],
  scheduledItems: [{ id: 'sched_1', lessonCardId: 'lc_1', classId: 'c_1a', day: 'ISNIN' }],
  createdAt: VALID_NOW,
  updatedAt: VALID_NOW,
};

export const DIRTY_DOZEN_TEST_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    operation: 'create',
    path: '/timetables/sk_allsaints_2026',
    context: { auth: null, requestTime: VALID_NOW },
    incomingData: BASE_VALID_PAYLOAD,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof Attack',
    operation: 'create',
    path: '/timetables/sk_allsaints_2026',
    context: {
      auth: {
        uid: 'user_valid_123',
        token: { email: 'sultanhaseng@gmail.com', email_verified: false },
      },
      requestTime: VALID_NOW,
    },
    incomingData: BASE_VALID_PAYLOAD,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Owner Spoofing on Create',
    operation: 'create',
    path: '/timetables/sk_allsaints_2026',
    context: {
      auth: {
        uid: 'attacker_uid',
        token: { email: 'attacker@example.com', email_verified: true },
      },
      requestTime: VALID_NOW,
    },
    incomingData: { ...BASE_VALID_PAYLOAD, ownerId: 'victim_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow / Ghost Field Injection',
    operation: 'create',
    path: '/timetables/sk_allsaints_2026',
    context: {
      auth: {
        uid: 'user_valid_123',
        token: { email: 'user@example.com', email_verified: true },
      },
      requestTime: VALID_NOW,
    },
    incomingData: { ...BASE_VALID_PAYLOAD, isVerified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Owner Mutation on Update',
    operation: 'update',
    path: '/timetables/sk_allsaints_2026',
    context: {
      auth: {
        uid: 'user_valid_123',
        token: { email: 'user@example.com', email_verified: true },
      },
      requestTime: VALID_NOW,
    },
    existingData: BASE_VALID_PAYLOAD,
    incomingData: { ...BASE_VALID_PAYLOAD, ownerId: 'hijacked_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Immortal Field (createdAt) Tampering on Update',
    operation: 'update',
    path: '/timetables/sk_allsaints_2026',
    context: {
      auth: {
        uid: 'user_valid_123',
        token: { email: 'user@example.com', email_verified: true },
      },
      requestTime: VALID_NOW,
    },
    existingData: { ...BASE_VALID_PAYLOAD, createdAt: '2026-01-01T00:00:00Z' },
    incomingData: { ...BASE_VALID_PAYLOAD, createdAt: VALID_NOW },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Forged Client Timestamp on Update',
    operation: 'update',
    path: '/timetables/sk_allsaints_2026',
    context: {
      auth: {
        uid: 'user_valid_123',
        token: { email: 'user@example.com', email_verified: true },
      },
      requestTime: VALID_NOW,
    },
    existingData: BASE_VALID_PAYLOAD,
    incomingData: { ...BASE_VALID_PAYLOAD, updatedAt: '2099-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning Attack (Invalid Path Variable)',
    operation: 'create',
    path: '/timetables/invalid$path!id',
    context: {
      auth: {
        uid: 'user_valid_123',
        token: { email: 'user@example.com', email_verified: true },
      },
      requestTime: VALID_NOW,
    },
    incomingData: BASE_VALID_PAYLOAD,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'String Overflow (Denial of Wallet on title > 120 chars)',
    operation: 'create',
    path: '/timetables/sk_allsaints_2026',
    context: {
      auth: {
        uid: 'user_valid_123',
        token: { email: 'user@example.com', email_verified: true },
      },
      requestTime: VALID_NOW,
    },
    incomingData: { ...BASE_VALID_PAYLOAD, title: 'A'.repeat(500) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Value Poisoning on Array Element Type',
    operation: 'update',
    path: '/timetables/sk_allsaints_2026',
    context: {
      auth: {
        uid: 'user_valid_123',
        token: { email: 'user@example.com', email_verified: true },
      },
      requestTime: VALID_NOW,
    },
    existingData: BASE_VALID_PAYLOAD,
    incomingData: { ...BASE_VALID_PAYLOAD, teachers: ['not_a_map_object'] },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Privilege Escalation on /admins/{adminId}',
    operation: 'create',
    path: '/admins/attacker_uid',
    context: {
      auth: {
        uid: 'attacker_uid',
        token: { email: 'attacker@example.com', email_verified: true },
      },
      requestTime: VALID_NOW,
    },
    incomingData: { uid: 'attacker_uid', role: 'admin', createdAt: VALID_NOW },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Delete by Non-Owner',
    operation: 'delete',
    path: '/timetables/sk_allsaints_2026',
    context: {
      auth: {
        uid: 'other_user_456',
        token: { email: 'other@example.com', email_verified: true },
      },
      requestTime: VALID_NOW,
    },
    existingData: BASE_VALID_PAYLOAD,
    expectedResult: 'PERMISSION_DENIED',
  },
];
