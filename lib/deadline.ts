import createIsDayOff from "isdayoff";

const isDayOffApi = createIsDayOff({ country: "ru" });

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const cache = new Map<
  string,
  { isWorkday: boolean; expiresAt: number }
>();

function toMsk(date: Date): Date {
  return new Date(date.getTime() + MSK_OFFSET_MS);
}

function fromMsk(date: Date): Date {
  return new Date(date.getTime() - MSK_OFFSET_MS);
}

function getKey(dateMsk: Date): string {
  const year = dateMsk.getUTCFullYear();
  const month = `${dateMsk.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${dateMsk.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

async function isWorkday(dateMsk: Date): Promise<boolean> {
  const key = getKey(dateMsk);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.isWorkday;
  }

  const code = await isDayOffApi.date({
    year: dateMsk.getUTCFullYear(),
    month: dateMsk.getUTCMonth(),
    date: dateMsk.getUTCDate(),
  });
  const isWorking = code === 0 || code === 2 || code === 4;
  cache.set(key, {
    isWorkday: isWorking,
    expiresAt: now + 24 * 60 * 60 * 1000,
  });
  return isWorking;
}

async function nextWorkdayAt16(date: Date): Promise<Date> {
  let cursor = toMsk(date);
  while (true) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (await isWorkday(cursor)) {
      cursor.setUTCHours(16, 0, 0, 0);
      return fromMsk(cursor);
    }
  }
}

async function addWorkdays(base: Date, days: number): Promise<Date> {
  let cursor = toMsk(base);
  let added = 0;
  while (added < days) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (await isWorkday(cursor)) {
      added += 1;
    }
  }
  return fromMsk(cursor);
}

function formatMsk(date: Date): string {
  const msk = toMsk(date);
  const year = msk.getUTCFullYear();
  const month = `${msk.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${msk.getUTCDate()}`.padStart(2, "0");
  const hours = `${msk.getUTCHours()}`.padStart(2, "0");
  const minutes = `${msk.getUTCMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} (МСК)`;
}

export type PermitType = "temporary" | "yearly";

export function resolvePermitType(value: string | number | null | undefined) {
  if (!value) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "временный") {
    return "temporary";
  }
  if (normalized === "6 месяцев" || normalized === "12 месяцев") {
    return "yearly";
  }
  return null;
}

export async function calcPermitReadyAt(
  submittedAt: Date,
  type: PermitType,
): Promise<{ readyAt: Date; readyAtMsk: string }> {
  const submittedMsk = toMsk(submittedAt);
  const hour = submittedMsk.getUTCHours();
  const isSubmittedWorkday = await isWorkday(submittedMsk);

  if (type === "temporary") {
    if (!isSubmittedWorkday || hour >= 16) {
      const readyAt = await nextWorkdayAt16(submittedAt);
      return { readyAt, readyAtMsk: formatMsk(readyAt) };
    }
    const readyAt = await addWorkdays(submittedAt, 1);
    return { readyAt, readyAtMsk: formatMsk(readyAt) };
  }

  const start =
    !isSubmittedWorkday || hour >= 16
      ? await nextWorkdayAt16(submittedAt)
      : submittedAt;
  const readyAt = await addWorkdays(start, 10);
  return { readyAt, readyAtMsk: formatMsk(readyAt) };
}
