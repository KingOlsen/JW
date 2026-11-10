# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default Deny**: All paths not explicitly matched in `/databases/{database}/documents` are unconditionally denied (`allow read, write: if false;`).
2. **Authentication & Email Verification**: All reads and writes require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`), or a bootstrapped/verified admin (`isAdmin()`).
3. **Path Variable Hardening**: Every document ID (`{timetableId}`, `{adminId}`) must satisfy `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
4. **Strict Key & Schema Enforcement (`isValidTimetableWorkspace`)**:
   - Required & allowed keys on `create` and `update`: `['title', 'schoolName', 'lastGeneratedAt', 'ownerId', 'teachers', 'classes', 'subjects', 'tahapConfigs', 'lessonCards', 'scheduledItems', 'createdAt', 'updatedAt']`.
   - Volumetric limits:
     - `title`: string, `1..120` chars
     - `schoolName`: string, `1..160` chars
     - `lastGeneratedAt`: string, `1..64` chars
     - `ownerId`: string, `1..128` chars matching `^[a-zA-Z0-9_\-]+$`
     - `teachers`: list, `1..100` items (`teachers[0] is map`)
     - `classes`: list, `1..50` items (`classes[0] is map`)
     - `subjects`: list, `1..50` items (`subjects[0] is map`)
     - `tahapConfigs`: list, `1..10` items (`tahapConfigs[0] is map`)
     - `lessonCards`: list, `1..300` items (`lessonCards[0] is map`)
     - `scheduledItems`: list, `1..600` items (`scheduledItems[0] is map`)
5. **Immutability & Temporal Integrity**:
   - On `create`: `incoming().ownerId == request.auth.uid && incoming().createdAt == request.time && incoming().updatedAt == request.time`.
   - On `update`: `incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time`.
   - Action-based updates use `incoming().diff(existing()).affectedKeys().hasOnly(['title', 'schoolName', 'lastGeneratedAt', 'teachers', 'classes', 'subjects', 'tahapConfigs', 'lessonCards', 'scheduledItems', 'updatedAt'])`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null` attempting `create` on `/timetables/sk_allsaints_2026`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', token: { email: 'sultanhaseng@gmail.com', email_verified: false } }` attempting `create`.
3. **Owner Spoofing on Create**: `auth.uid = 'attacker'` setting `ownerId: 'victim_uid'` on `create`.
4. **Shadow / Ghost Field Injection**: Adding `isVerified: true` or `adminOverride: true` to `/timetables/sk_allsaints_2026`.
5. **Owner Mutation on Update**: Changing `ownerId` from `existing().ownerId` to another UID during `update`.
6. **CreatedAt Tampering on Update**: Modifying `createdAt` during an `update` operation.
7. **Forged Client Timestamp**: Supplying a past/future timestamp instead of `request.time` for `updatedAt`.
8. **ID Poisoning Attack**: Document ID containing special characters or >128 chars (`/timetables/bad$id!`).
9. **String Overflow (Denial of Wallet)**: Setting `title` to a 5,000-character string (`> 120`).
10. **Array Overflow Attack**: Passing `scheduledItems` with > 600 elements or non-map elements (`scheduledItems: ["bad_string"]`).
11. **Privilege Escalation on `/admins/{adminId}`**: Non-admin user attempting to create or update a document in `/admins/{adminId}`.
12. **Unauthorized Delete by Non-Owner**: Authenticated user `u2` attempting to `delete` a timetable owned by `u1`.
