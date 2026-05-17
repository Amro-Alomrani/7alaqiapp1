import { Clock, Eye } from 'lucide-react';
import { Service } from '@/types';
import ServiceIconBadge from './ServiceIconBadge';

interface Props {
  service: Service & { viewCount?: number };
  onView?: () => void;
}

export default function ServiceItem({ service, onView }: Props) {
  return (
    <div
      className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-3 active:scale-[0.98] transition-transform cursor-pointer gap-3"
      onClick={onView}
    >
      <div className="flex-shrink-0">
        {service.photo ? (
          <img
            src={service.photo}
            alt={service.name}
            className="w-14 h-14 rounded-xl object-cover border border-border"
          />
        ) : (
          <ServiceIconBadge icon={service.icon} name={service.name} size="lg" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{service.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1">
            <Clock size={11} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{service.duration} min</span>
          </div>
          {(service.viewCount ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <Eye size={10} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{service.viewCount}</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-base font-bold text-primary flex-shrink-0">{service.price} JOD</p>
    </div>
  );
}
