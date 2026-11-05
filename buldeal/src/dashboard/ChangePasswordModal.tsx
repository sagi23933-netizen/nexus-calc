import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { Button, Field, Input, Modal } from '../shared/ui';
import { useToast } from '../shared/Toast';

export function ChangePasswordModal({ open, onClose, forced }: { open: boolean; onClose: () => void; forced?: boolean }) {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (form.newPassword !== form.confirm) return setError('הסיסמאות אינן תואמות');
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast('הסיסמה עודכנה בהצלחה');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <KeyRound size={20} className="text-lime-600" /> {forced ? 'יש לבחור סיסמה חדשה' : 'שינוי סיסמה'}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {forced ? 'אחר כך' : 'ביטול'}
          </Button>
          <Button onClick={submit} loading={loading}>
            עדכון סיסמה
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {forced && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">החשבון נפתח עם סיסמה זמנית. מומלץ להחליף אותה עכשיו.</p>}
        <Field label="סיסמה נוכחית">
          <Input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </Field>
        <Field label="סיסמה חדשה" hint="לפחות 8 תווים, אותיות ומספרים">
          <Input type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        </Field>
        <Field label="אימות סיסמה">
          <Input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
