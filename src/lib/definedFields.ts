/** Omit absent optional form fields before writing a Firestore document. */
export function definedFields<T extends object>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}
