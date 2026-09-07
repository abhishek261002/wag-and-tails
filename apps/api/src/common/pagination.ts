// Query string params always arrive as strings. Controllers that type their
// query object as `any` give Nest's ValidationPipe no target metadata to
// convert against, so page/pageSize pass through unconverted — and Prisma's
// `take`/`skip` require actual integers, not numeric strings. Coerce them
// here before they reach any service.
export function parsePagination<T extends Record<string, any>>(query: T): T {
  return {
    ...query,
    ...(query['page'] !== undefined ? { page: parseInt(query['page'], 10) } : {}),
    ...(query['pageSize'] !== undefined ? { pageSize: parseInt(query['pageSize'], 10) } : {}),
  };
}
