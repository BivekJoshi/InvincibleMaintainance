/**
 * Every zod schema the SPA validates against, in one place. These mirror the
 * backend's schemas — when an API rule changes, change it here in the same
 * commit so the client stops accepting what the server will reject.
 */
export * from './schemas/fields';
export * from './schemas/auth.schema';
export * from './schemas/lead.schema';
export * from './schemas/booking.schema';
export * from './useZodForm';
