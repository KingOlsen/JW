import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  LessonCard,
  ScheduledItem,
  SchoolClass,
  Subject,
  TahapPeriodConfig,
  Teacher,
} from '../types/timetable';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const DEFAULT_SHARED_WORKSPACE_ID = 'sk_allsaints_2026';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

/**
 * Recursively strips `undefined` properties from objects and arrays so Firestore native Map/List serialization succeeds.
 */
export function stripUndefinedDeep<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v !== undefined) {
        clean[k] = stripUndefinedDeep(v);
      }
    }
    return clean as T;
  }
  return input;
}

export interface CloudTimetablePayload {
  title: string;
  schoolName: string;
  lastGeneratedAt: string;
  ownerId: string;
  isSharedWorkspace: boolean;
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  tahapConfigs: TahapPeriodConfig[];
  lessonCards: LessonCard[];
  scheduledItems: ScheduledItem[];
}

/**
 * Enforces blueprint volumetric boundaries and strips undefined keys before saving to `/timetables/{workspaceId}`.
 */
export function sanitizeWorkspacePayload(
  raw: Omit<CloudTimetablePayload, 'ownerId'> & { ownerId?: string },
  currentUid: string
): CloudTimetablePayload {
  const safeTitle = (raw.title || 'JADUAL WAKTU PERSEKOLAHAN 2026')
    .trim()
    .slice(0, 120);
  const safeSchoolName = (
    raw.schoolName || "SK ALL SAINTS', KAMUNTING, PERAK"
  )
    .trim()
    .slice(0, 160);
  const safeLastGen = (raw.lastGeneratedAt || 'TERKINI').trim().slice(0, 64);
  const safeOwnerId = (raw.ownerId || currentUid)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);

  return stripUndefinedDeep({
    title: safeTitle || 'JADUAL WAKTU 2026',
    schoolName: safeSchoolName || 'SK ALL SAINTS',
    lastGeneratedAt: safeLastGen || 'TERKINI',
    ownerId: safeOwnerId,
    isSharedWorkspace: Boolean(raw.isSharedWorkspace),
    teachers: raw.teachers.slice(0, 100),
    classes: raw.classes.slice(0, 50),
    subjects: raw.subjects.slice(0, 50),
    tahapConfigs: raw.tahapConfigs.slice(0, 10),
    lessonCards: raw.lessonCards.slice(0, 300),
    scheduledItems: raw.scheduledItems.slice(0, 600),
  });
}

/**
 * Saves or updates the timetable workspace document in Cloud Firestore so all connected devices receive real-time updates.
 */
export async function saveTimetableToCloud(
  workspaceId: string,
  payload: Omit<CloudTimetablePayload, 'ownerId'>
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const cleanId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `timetables/${cleanId}`;
  const docRef = doc(db, 'timetables', cleanId);

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (existingSnap && existingSnap.exists()) {
    const existingData = existingSnap.data();
    const sanitized = sanitizeWorkspacePayload(
      {
        ...payload,
        ownerId: existingData.ownerId || user.uid,
      },
      user.uid
    );
    try {
      await updateDoc(docRef, {
        title: sanitized.title,
        schoolName: sanitized.schoolName,
        lastGeneratedAt: sanitized.lastGeneratedAt,
        isSharedWorkspace: sanitized.isSharedWorkspace,
        teachers: sanitized.teachers,
        classes: sanitized.classes,
        subjects: sanitized.subjects,
        tahapConfigs: sanitized.tahapConfigs,
        lessonCards: sanitized.lessonCards,
        scheduledItems: sanitized.scheduledItems,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    const sanitized = sanitizeWorkspacePayload(payload, user.uid);
    try {
      await setDoc(docRef, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function signInWithGooglePopup() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutFromCloud() {
  return signOut(auth);
}

export { doc, onSnapshot };
