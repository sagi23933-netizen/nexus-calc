export const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export const INPUT_CLASS = 'field-input';

export const ABSENCE_TYPE_LABELS: Record<string, string> = {
  vacation: 'חופשה', vacation_partial: 'חופשה חלקית',
  sick: 'מחלה', sick_half: 'חצי יום מחלה', sick_no_pay: 'מחלה ללא תשלום',
  unpaid: 'חל"ת', reserve: 'מילואים',
  maternity: 'חופשת לידה', bereavement: 'אבל',
  work_accident: 'תאונת עבודה', pregnancy_hours: 'שעות הריון',
  parental_hour: 'שעת הורות', holiday_work: 'עבודה בחג',
  authorized: 'היעדרות מאושרת', offset_overtime: 'קיזוז ש"נ גלובלי',
  other: 'אחר'
};
