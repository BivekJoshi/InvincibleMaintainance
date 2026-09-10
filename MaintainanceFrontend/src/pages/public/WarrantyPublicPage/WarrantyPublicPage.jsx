import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useClaimWarrantyMutation, useGetWarrantyByTokenQuery } from '@/api/publicApi';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { DocumentShell } from '@/components/documents/DocumentShell';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { WarrantyCertificate } from './sections/WarrantyCertificate';
import { WarrantyClaimForm } from './sections/WarrantyClaimForm';

/** A claim in either of these states is already being dealt with. */
const LIVE_CLAIM = ['open', 'accepted'];

/**
 * The warranty certificate, and the claim form under it. Opened from a token
 * link, like the quotation and invoice pages — no account involved.
 */
export default function WarrantyPublicPage() {
  const { token } = useParams();
  const { data, isLoading, error, refetch } = useGetWarrantyByTokenQuery(token);
  const [claim, { isLoading: claiming, error: claimError }] = useClaimWarrantyMutation();
  const { phone } = useSiteSettings();
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <div className="container max-w-2xl py-14"><Skeleton className="h-80 w-full rounded-xl" /></div>;

  const onClaim = async (e) => {
    e.preventDefault();
    const result = await claim({ token, description }).unwrap().catch(() => null);
    if (result) { setSubmitted(true); setDescription(''); }
  };

  const openClaim = data.claims?.some((c) => LIVE_CLAIM.includes(c.status));

  return (
    <DocumentShell width="sm">
      <WarrantyCertificate warranty={data} />

      <section className="mt-6">
        <WarrantyClaimForm
          isValid={data.isValid}
          hasOpenClaim={submitted || openClaim}
          description={description}
          onDescription={setDescription}
          onSubmit={onClaim}
          claiming={claiming}
          error={claimError}
          phone={phone}
        />
      </section>
    </DocumentShell>
  );
}
