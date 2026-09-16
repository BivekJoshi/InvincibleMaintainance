import { useGetRecordQuery } from '@/api/lookupApi';

/** A project's title from its id, for a list column (the gallery's project). */
export function ProjectName({ id }) {
  const { data, isError } = useGetRecordQuery({ path: '/admin/projects', id }, { skip: !id });
  if (isError) return <span className="text-muted-foreground">Deleted project</span>;
  return <span className="block max-w-[14rem] truncate text-sm">{data?.title ?? '…'}</span>;
}
