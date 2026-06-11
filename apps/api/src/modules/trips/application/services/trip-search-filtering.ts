import { TRIP_TIME_FILTER_PATTERN } from '@saferidepro/shared-types';

const ECUADOR_UTC_OFFSET = '-05:00';
const TRIP_SEARCH_TIME_ZONE = 'America/Guayaquil';

const tripTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TRIP_SEARCH_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function parseTripDateFilterStart(value: string): Date {
  return new Date(`${value}T00:00:00.000${ECUADOR_UTC_OFFSET}`);
}

export function parseTripDateFilterEnd(value: string): Date {
  return new Date(`${value}T23:59:59.999${ECUADOR_UTC_OFFSET}`);
}

export function parseTripTimeFilter(value?: string): number | undefined {
  if (!value || !TRIP_TIME_FILTER_PATTERN.test(value)) {
    return undefined;
  }

  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}

export function matchesTripDepartureTimeWindow(
  departureAt: Date,
  timeFromInMinutes?: number,
  timeToInMinutes?: number,
): boolean {
  if (timeFromInMinutes === undefined && timeToInMinutes === undefined) {
    return true;
  }

  const tripMinutes = resolveTripMinutes(departureAt);

  if (timeFromInMinutes !== undefined && timeToInMinutes !== undefined) {
    if (timeFromInMinutes <= timeToInMinutes) {
      return tripMinutes >= timeFromInMinutes && tripMinutes <= timeToInMinutes;
    }

    return tripMinutes >= timeFromInMinutes || tripMinutes <= timeToInMinutes;
  }

  if (timeFromInMinutes !== undefined) {
    return tripMinutes >= timeFromInMinutes;
  }

  return tripMinutes <= (timeToInMinutes as number);
}

function resolveTripMinutes(value: Date): number {
  const formatterParts = tripTimeFormatter.formatToParts(value);
  const hour = Number.parseInt(
    formatterParts.find((part) => part.type === 'hour')!.value,
    10,
  );
  const minute = Number.parseInt(
    formatterParts.find((part) => part.type === 'minute')!.value,
    10,
  );

  return hour * 60 + minute;
}
