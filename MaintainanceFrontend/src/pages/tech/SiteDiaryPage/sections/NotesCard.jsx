import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** Problems on site, and a note for the office — in the foreman's own words, English or Nepali. */
export function NotesCard({ issues, note, onChange, readOnly, words }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="diary-issues" className="text-base font-semibold">{words.issues.title}</Label>
          <Textarea
            id="diary-issues"
            rows={3}
            lang="ne"
            maxLength={4000}
            value={issues}
            onChange={(e) => onChange({ issues: e.target.value })}
            placeholder={words.issues.placeholder}
            disabled={readOnly}
            className="text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="diary-note" className="text-base font-semibold">{words.note.title}</Label>
          <Textarea
            id="diary-note"
            rows={2}
            lang="ne"
            maxLength={2000}
            value={note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder={words.note.placeholder}
            disabled={readOnly}
            className="text-base"
          />
        </div>
      </CardContent>
    </Card>
  );
}
