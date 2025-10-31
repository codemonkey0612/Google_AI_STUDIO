
// Helper functions
export const calculateDaysDifference = (startDateStr: string | undefined | null, endDateStr: string | undefined | null): number => {
  if (!startDateStr || !endDateStr) return 0;
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
    return 0;
  }
  const differenceInTime = endDate.getTime() - startDate.getTime();
  const differenceInDays = Math.round(differenceInTime / (1000 * 3600 * 24)) + 1;
  return differenceInDays;
};

export const formatDate = (date: Date | string | undefined | null, format: string = 'yyyy-MM-dd'): string => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
  if (format === 'yyyy-MM-dd') {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } else if (format === 'yyyy/MM/dd') {
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  } else if (format === 'yy/MM/dd') {
    return `${d.getFullYear().toString().slice(-2)}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  } else if (format === 'yyyy-MM') {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  return d.toLocaleDateString('ja-JP');
};

export const parseDate = (dateStr: string | undefined | null): Date | undefined => {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
};

export const hexToRgba = (hex: string, alpha: number): string => {
    if (!hex || !hex.startsWith('#')) return `rgba(167, 139, 250, ${alpha})`; // default violet
    try {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch (e) {
        return `rgba(167, 139, 250, ${alpha})`;
    }
};

export const formatKpiNumber = (num: number): string => {
  if (Number.isInteger(num)) {
      return num.toLocaleString('ja-JP');
  }
  return num.toLocaleString('ja-JP', { maximumFractionDigits: 1 });
};