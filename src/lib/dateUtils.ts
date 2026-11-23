export function formatLocalYyyyMmDd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalHhMm(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatLocalDateTimeInputValue(date: Date): string {
  return `${formatLocalYyyyMmDd(date)}T${formatLocalHhMm(date)}`;
}

export function getTodayDateInputValue(): string {
  return formatLocalYyyyMmDd(new Date());
}

export function getNowDateTimeLocalValue(): string {
  return formatLocalDateTimeInputValue(new Date());
}

export function toDateInputValue(isoOrDate?: string | null): string {
  if (!isoOrDate) return getTodayDateInputValue();
  const trimmed = isoOrDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return getTodayDateInputValue();
  }
  return formatLocalYyyyMmDd(parsed);
}

export function toDateTimeLocalInputValue(isoOrDate?: string | null): string {
  if (!isoOrDate) return getNowDateTimeLocalValue();
  const trimmed = isoOrDate.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T08:00`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return getNowDateTimeLocalValue();
  }
  return formatLocalDateTimeInputValue(parsed);
}

export function parseDateTimeLocalToParts(dateTimeLocal: string): {
  isoTimestamp: string;
  tanggal: string;
  jamCatat: string;
} {
  const trimmed = dateTimeLocal.trim();
  const parsed = new Date(trimmed);
  const validDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return {
    isoTimestamp: validDate.toISOString(),
    tanggal: formatLocalYyyyMmDd(validDate),
    jamCatat: formatLocalHhMm(validDate),
  };
}

export function formatTanggalSingkat(isoOrDate: string): string {
  try {
    const trimmed = isoOrDate.trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T12:00:00`)
      : new Date(trimmed);
    if (Number.isNaN(date.getTime())) return isoOrDate;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoOrDate;
  }
}

export function formatTanggalJamSingkat(isoOrDate: string): string {
  try {
    const trimmed = isoOrDate.trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T12:00:00`)
      : new Date(trimmed);
    if (Number.isNaN(date.getTime())) return isoOrDate;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoOrDate;
  }
}
