import { ProseBody } from '@/components/site/ProseBody';

/** The service's long description. The rendering rules live in `ProseBody`, shared with the editor's preview. */
export function ServiceBody({ body }) {
  return <ProseBody body={body} />;
}
