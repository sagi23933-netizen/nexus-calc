import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { Button, Field, Input } from '../shared/ui';
import { AuthShell } from './AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="שכחתם סיסמה?" subtitle="נשלח לכם קישור לאיפוס הסיסמה">
      {sent ? (
        <div className="card-3d p-6 text-center">
          <MailCheck size={44} className="mx-auto text-lime-600" />
          <h2 className="mt-3 text-xl font-bold">הבקשה התקבלה</h2>
          <p className="mt-2 text-ink-600">אם הכתובת רשומה אצלנו, יישלח אליה קישור לאיפוס בדקות הקרובות. אם המייל לא מגיע — צוות התמיכה יחזור אליכם.</p>
          <Link to="/login" className="btn btn-lime mt-5">
            חזרה לכניסה
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="אימייל">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className="text-right" required />
          </Field>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            שליחת קישור לאיפוס
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-semibold text-leaf-700 hover:underline">
              חזרה לכניסה
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
