/**
 * Helpers para cálculo de datas e contagem regressiva utilizando rigidamente
 * o fuso horário de Brasília (America/Sao_Paulo).
 */

/**
 * Retorna o intervalo do dia de hoje (00:00 às 23:59:59 em São Paulo) convertido em UTC.
 * Como São Paulo é UTC-3, 00:00 SP = 03:00 UTC.
 */
export function getTodayRangeSP(now: Date = new Date(), offsetDays = 0) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(now);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  const year = parseInt(partMap.year);
  const month = parseInt(partMap.month) - 1; // 0-indexed
  const day = parseInt(partMap.day);

  // 00:00 local em São Paulo = 03:00 UTC
  const start = new Date(Date.UTC(year, month, day, 3));
  start.setUTCDate(start.getUTCDate() + offsetDays);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  // Formatado no padrão brasileiro DD/MM/YYYY
  const formattedDay = start.getUTCDate().toString().padStart(2, "0");
  const formattedMonth = (start.getUTCMonth() + 1).toString().padStart(2, "0");
  const formattedYear = start.getUTCFullYear();
  const label = `${formattedDay}/${formattedMonth}/${formattedYear}`;

  // String no formato YYYY-MM-DD no fuso de SP para comparação direta
  const dateString = `${formattedYear}-${formattedMonth}-${formattedDay}`;

  return { start, end, label, dateString };
}

/**
 * Retorna a próxima ocorrência do horário de reset (por padrão, meia-noite / 00:00) em São Paulo.
 * Exemplo: se agora é 12:00 do dia 21/05, retorna 00:00 do dia 22/05 (representado em UTC às 03:00).
 */
export function getNextStudyResetAt(now: Date = new Date(), customHour = 0): Date {
  const utcOffsetHour = (customHour + 3) % 24; // Compensação UTC-3

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false
  });
  const parts = fmt.formatToParts(now);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  const year = parseInt(partMap.year);
  const month = parseInt(partMap.month) - 1;
  const day = parseInt(partMap.day);
  const hour = parseInt(partMap.hour);

  const resetDate = new Date(Date.UTC(year, month, day, utcOffsetHour));

  // Se a hora atual em SP já é maior ou igual à hora do reset, o próximo reset é amanhã
  if (hour >= customHour) {
    resetDate.setUTCDate(resetDate.getUTCDate() + 1);
  }

  return resetDate;
}

/**
 * Retorna o tempo que falta até o próximo reset em horas, minutos e segundos.
 */
export function getTimeUntilNextStudyReset(now: Date = new Date(), customHour = 0) {
  const nextReset = getNextStudyResetAt(now, customHour);
  const diffMs = nextReset.getTime() - now.getTime();

  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds, totalMs: diffMs };
}

/**
 * Retorna um label amigável em português para uma data futura em relação a hoje.
 * Exemplo: "Amanhã", "Segunda-feira", etc.
 */
export function getDayLabelSP(dateStr: string, todayDateStr: string): string {
  // dateStr e todayDateStr vêm no formato YYYY-MM-DD
  const date = new Date(dateStr + "T12:00:00Z");
  const today = new Date(todayDateStr + "T12:00:00Z");

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return "Amanhã";
  if (diffDays === 2) return "Depois de amanhã";

  const weekdays = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado"
  ];
  
  return weekdays[date.getUTCDay()];
}
