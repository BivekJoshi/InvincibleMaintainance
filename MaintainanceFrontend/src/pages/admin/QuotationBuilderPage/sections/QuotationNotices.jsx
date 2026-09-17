import { Link } from 'react-router-dom';
import { MessageSquareWarning, ShieldCheck, Undo2, UserX } from 'lucide-react';
import { DocumentNotice } from '@/components/documents/DocumentNotice';
import { formatDateTime } from '@/helpers/format';
import { isSelfApproval } from '@/helpers/quotationActions';

/**
 * What a reader must see before touching a quotation: the customer's change request
 * (on the version they answered and on the revision built from it), why it came back to
 * draft, an automatic approval, and the self-approval rule for its own author.
 */
export function QuotationNotices({ quotation: q, can, userId }) {
  const notices = [];

  if (q.status === 'CHANGES_REQUESTED' && q.decisionNote) {
    notices.push(
      <DocumentNotice key="asked" tone="warning" icon={MessageSquareWarning} animate={false} title={`The customer asked for changes${q.decidedAt ? ` · ${formatDateTime(q.decidedAt)}` : ''}`}>
        <span lang="ne" className="block whitespace-pre-wrap text-base font-medium opacity-100" data-testid="customer-message">{q.decisionNote}</span>
        Revise it to send them a new version.
      </DocumentNotice>,
    );
  }
  if (q.requestedChanges) {
    notices.push(
      <DocumentNotice key="answers" tone="info" icon={MessageSquareWarning} animate={false} title={`This version answers the customer's request on v${q.version - 1}`}>
        <span lang="ne" className="block whitespace-pre-wrap text-base font-medium opacity-100" data-testid="requested-changes">{q.requestedChanges}</span>
        {q.parent ? <Link to={`/admin/quotations/${q.parent.id}`} className="underline">Open {q.parent.number}</Link> : null}
      </DocumentNotice>,
    );
  }
  if (q.status === 'REJECTED') {
    notices.push(
      <DocumentNotice key="declined" tone="muted" icon={UserX} animate={false} title="The customer declined">
        {q.decisionNote ? <span className="block whitespace-pre-wrap">{q.decisionNote}</span> : 'They gave no reason.'}
      </DocumentNotice>,
    );
  }
  if (q.status === 'DRAFT' && q.sentBackReason) {
    notices.push(
      <DocumentNotice key="back" tone="warning" icon={Undo2} animate={false} title="Returned to draft">
        <span className="block whitespace-pre-wrap">{q.sentBackReason}</span>
      </DocumentNotice>,
    );
  }
  if (q.autoApproved && ['OFFICE_APPROVED', 'SENT', 'CHANGES_REQUESTED', 'APPROVED', 'CONVERTED', 'REJECTED', 'EXPIRED'].includes(q.status)) {
    notices.push(
      <DocumentNotice key="auto" tone="info" icon={ShieldCheck} animate={false} title="Approved automatically">
        {q.approvalNote ?? 'Its total was below the auto-approval limit.'}
      </DocumentNotice>,
    );
  }
  if (q.status === 'PENDING_APPROVAL' && can('quotations:approve') && isSelfApproval(q, userId)) {
    notices.push(
      <DocumentNotice key="self" tone="muted" icon={UserX} animate={false} title="You prepared this quotation">
        Another manager or admin must approve it.
      </DocumentNotice>,
    );
  }

  if (!notices.length) return null;
  return <div className="mb-4 space-y-3">{notices}</div>;
}
