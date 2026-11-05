import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <div className="font-display text-8xl text-lime-500 drop-shadow-[0_10px_20px_rgba(110,160,0,.35)]">404</div>
      <h1 className="mt-2 text-3xl font-black">העמוד לא נמצא</h1>
      <p className="mt-2 text-ink-500">אולי הדיל כבר נגמר, או שהקישור שגוי.</p>
      <Link to="/" className="btn btn-lime mt-6">
        לדילים הפעילים
      </Link>
    </div>
  );
}
