import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-100 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl font-bold text-charcoal-900">Page not found</h1>
      <p className="max-w-sm text-sm text-charcoal-600">The page you're looking for doesn't exist or may have moved.</p>
      <Link to="/" className="btn-primary btn">
        Back to home
      </Link>
    </div>
  );
}
