/**
 * Mock date fixtures for testing time-dependent functions
 */

// Reference date: January 1, 2024, 12:00:00 UTC
export const REFERENCE_DATE = new Date('2024-01-01T12:00:00.000Z')
export const REFERENCE_TIMESTAMP = REFERENCE_DATE.getTime()

// Time constants (in milliseconds)
export const ONE_SECOND = 1000
export const ONE_MINUTE = 60 * ONE_SECOND
export const ONE_HOUR = 60 * ONE_MINUTE
export const ONE_DAY = 24 * ONE_HOUR
export const ONE_WEEK = 7 * ONE_DAY
export const ONE_MONTH = 30 * ONE_DAY
export const ONE_YEAR = 365 * ONE_DAY

/**
 * Date fixtures relative to REFERENCE_DATE
 */

// Just now (less than 1 minute ago)
export const justNow = new Date(REFERENCE_TIMESTAMP - 30 * ONE_SECOND)

// Minutes ago
export const twoMinutesAgo = new Date(REFERENCE_TIMESTAMP - 2 * ONE_MINUTE)
export const thirtyMinutesAgo = new Date(REFERENCE_TIMESTAMP - 30 * ONE_MINUTE)
export const fiftyNineMinutesAgo = new Date(REFERENCE_TIMESTAMP - 59 * ONE_MINUTE)

// Hours ago
export const oneHourAgo = new Date(REFERENCE_TIMESTAMP - ONE_HOUR)
export const twoHoursAgo = new Date(REFERENCE_TIMESTAMP - 2 * ONE_HOUR)
export const twelveHoursAgo = new Date(REFERENCE_TIMESTAMP - 12 * ONE_HOUR)
export const twentyThreeHoursAgo = new Date(REFERENCE_TIMESTAMP - 23 * ONE_HOUR)

// Days ago
export const oneDayAgo = new Date(REFERENCE_TIMESTAMP - ONE_DAY)
export const twoDaysAgo = new Date(REFERENCE_TIMESTAMP - 2 * ONE_DAY)
export const threeDaysAgo = new Date(REFERENCE_TIMESTAMP - 3 * ONE_DAY)
export const sixDaysAgo = new Date(REFERENCE_TIMESTAMP - 6 * ONE_DAY)

// Weeks ago
export const oneWeekAgo = new Date(REFERENCE_TIMESTAMP - ONE_WEEK)
export const twoWeeksAgo = new Date(REFERENCE_TIMESTAMP - 2 * ONE_WEEK)
export const threeWeeksAgo = new Date(REFERENCE_TIMESTAMP - 3 * ONE_WEEK)

// Months ago
export const oneMonthAgo = new Date(REFERENCE_TIMESTAMP - ONE_MONTH)
export const twoMonthsAgo = new Date(REFERENCE_TIMESTAMP - 2 * ONE_MONTH)
export const sixMonthsAgo = new Date(REFERENCE_TIMESTAMP - 6 * ONE_MONTH)
export const elevenMonthsAgo = new Date(REFERENCE_TIMESTAMP - 11 * ONE_MONTH)

// Years ago
export const oneYearAgo = new Date(REFERENCE_TIMESTAMP - ONE_YEAR)
export const twoYearsAgo = new Date(REFERENCE_TIMESTAMP - 2 * ONE_YEAR)
export const fiveYearsAgo = new Date(REFERENCE_TIMESTAMP - 5 * ONE_YEAR)

// Future dates (edge cases)
export const oneMinuteInFuture = new Date(REFERENCE_TIMESTAMP + ONE_MINUTE)
export const oneHourInFuture = new Date(REFERENCE_TIMESTAMP + ONE_HOUR)
export const oneDayInFuture = new Date(REFERENCE_TIMESTAMP + ONE_DAY)
export const oneYearInFuture = new Date(REFERENCE_TIMESTAMP + ONE_YEAR)

// Very old dates
export const tenYearsAgo = new Date(REFERENCE_TIMESTAMP - 10 * ONE_YEAR)
export const twentyYearsAgo = new Date(REFERENCE_TIMESTAMP - 20 * ONE_YEAR)
export const epoch = new Date(0) // January 1, 1970

// Edge case dates
export const leapYearDate = new Date('2024-02-29T12:00:00.000Z') // Leap year
export const endOfYear = new Date('2024-12-31T12:00:00.000Z') // Midday to avoid timezone issues
export const startOfYear = new Date('2024-01-01T12:00:00.000Z')
export const monthBoundary = new Date('2024-01-31T12:00:00.000Z')

/**
 * Expected formatRelativeTime outputs for each fixture
 */
export const expectedRelativeTimeOutputs = {
  justNow: 'just now',
  twoMinutesAgo: '2m ago',
  thirtyMinutesAgo: '30m ago',
  fiftyNineMinutesAgo: '59m ago',
  oneHourAgo: '1h ago',
  twoHoursAgo: '2h ago',
  twelveHoursAgo: '12h ago',
  twentyThreeHoursAgo: '23h ago',
  oneDayAgo: '1d ago',
  twoDaysAgo: '2d ago',
  threeDaysAgo: '3d ago',
  sixDaysAgo: '6d ago',
  oneWeekAgo: '1w ago',
  twoWeeksAgo: '2w ago',
  threeWeeksAgo: '3w ago',
  oneMonthAgo: '1mo ago',
  twoMonthsAgo: '2mo ago',
  sixMonthsAgo: '6mo ago',
  elevenMonthsAgo: '11mo ago',
  oneYearAgo: '1y ago',
  twoYearsAgo: '2y ago',
  fiveYearsAgo: '5y ago',
  tenYearsAgo: '10y ago',
}

/**
 * Expected formatDate outputs for specific dates
 */
export const expectedDateOutputs = {
  referenceDate: 'Jan 1, 2024',
  leapYearDate: 'Feb 29, 2024',
  endOfYear: 'Dec 31, 2024',
  startOfYear: 'Jan 1, 2024',
  epoch: 'Jan 1, 1970',
}

/**
 * Helper to create a date N seconds/minutes/hours/days ago from reference
 */
export function createDateAgo(
  value: number,
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'
): Date {
  const multipliers = {
    seconds: ONE_SECOND,
    minutes: ONE_MINUTE,
    hours: ONE_HOUR,
    days: ONE_DAY,
    weeks: ONE_WEEK,
    months: ONE_MONTH,
    years: ONE_YEAR,
  }

  return new Date(REFERENCE_TIMESTAMP - value * multipliers[unit])
}

/**
 * Helper to create a date N seconds/minutes/hours/days in the future from reference
 */
export function createDateInFuture(
  value: number,
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'
): Date {
  const multipliers = {
    seconds: ONE_SECOND,
    minutes: ONE_MINUTE,
    hours: ONE_HOUR,
    days: ONE_DAY,
    weeks: ONE_WEEK,
    months: ONE_MONTH,
    years: ONE_YEAR,
  }

  return new Date(REFERENCE_TIMESTAMP + value * multipliers[unit])
}
