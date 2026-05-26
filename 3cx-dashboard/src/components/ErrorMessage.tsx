import { AlertTriangle } from 'lucide-react';

export default function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="error-box">
      <AlertTriangle size={18} />
      <span>{message}</span>
    </div>
  );
}
