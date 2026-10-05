import {
  CalendarCheck, ClipboardCheck, FileText, PhoneCall, Receipt, RefreshCcw, Timer, Wrench,
} from 'lucide-react';

/** Each calendar kind's mark, beside its colour (`helpers/agenda#AGENDA_KINDS`) — the two together tell kinds apart for every eye. */
export const KIND_ICONS = {
  response: Timer,
  followUp: PhoneCall,
  visit: ClipboardCheck,
  job: Wrench,
  quotation: FileText,
  invoice: Receipt,
  amcVisit: CalendarCheck,
  renewal: RefreshCcw,
};
