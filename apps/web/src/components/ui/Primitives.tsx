"use client";

import React from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  CircleDashed,
  Clock,
  HelpCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 min-h-[48px] font-semibold text-base transition-all duration-150 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed select-none";
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-forest text-onPrimary hover:bg-forestHover shadow-sm",
    secondary: "bg-surface text-ink border border-borderSubtle hover:bg-mutedSurface",
    ghost: "bg-transparent text-ink hover:bg-mutedSurface",
    danger: "bg-sunrise text-onAlert hover:opacity-95 shadow-sm",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card bg-surface border border-borderSubtle shadow-soft ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Chip({
  active = false,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 min-h-[40px] text-sm font-medium border transition-colors whitespace-nowrap ${
        active
          ? "bg-forest text-onPrimary border-forest font-semibold"
          : "bg-surface text-ink border-borderSubtle hover:bg-mutedSurface"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export type BadgeKind =
  | "approved"
  | "applied"
  | "not_started"
  | "rejected"
  | "expired"
  | "cancelled"
  | "unavailable"
  | "verified"
  | "needs_check"
  | "required"
  | "optional";

export function StatusBadge({
  kind,
  label,
}: {
  kind: BadgeKind;
  label?: string;
}) {
  const cfg: Record<
    BadgeKind,
    { classes: string; icon: React.ReactNode; defaultText: string }
  > = {
    // Staff-checked curated data: River blue + Official Seal icon
    verified: {
      classes: "bg-statusVerifiedBg text-statusVerifiedFg border border-river",
      icon: <BadgeCheck className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Verified",
    },
    // Traveler's own permit status: Forest green + Check icon
    approved: {
      classes: "bg-statusApprovedBg text-statusApprovedFg border border-forest",
      icon: <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Approved",
    },
    // Traveler applied: Tea gold tint + solid gold border + Clock icon
    applied: {
      classes: "bg-statusAppliedBg text-statusAppliedFg border border-teaGold",
      icon: <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Applied",
    },
    // Stale >90d data: Distinct deep amber-orange + 1.5px dashed border + Warning triangle
    needs_check: {
      classes: "bg-statusCheckBg text-statusCheckFg border-[1.5px] border-dashed border-sunrise",
      icon: <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Needs check",
    },
    not_started: {
      classes: "bg-mutedSurface text-inkMuted border border-borderSubtle",
      icon: <CircleDashed className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Not started",
    },
    optional: {
      classes: "bg-mutedSurface text-inkMuted border border-borderSubtle",
      icon: <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Not required",
    },
    required: {
      classes: "bg-statusCheckBg text-statusCheckFg border border-sunrise",
      icon: <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Required",
    },
    // Deep red token separate from SOS orange-red
    rejected: {
      classes: "bg-statusRejectedBg text-statusRejectedFg border-[1.5px] border-rejected",
      icon: <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Rejected",
    },
    expired: {
      classes: "bg-statusRejectedBg text-statusRejectedFg border-[1.5px] border-rejected",
      icon: <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Expired",
    },
    cancelled: {
      classes: "bg-statusRejectedBg text-statusRejectedFg border-[1.5px] border-rejected",
      icon: <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Cancelled",
    },
    unavailable: {
      classes: "bg-mutedSurface text-inkMuted border border-borderSubtle",
      icon: <HelpCircle className="w-4 h-4 shrink-0" aria-hidden="true" />,
      defaultText: "Unavailable",
    },
  };

  const c = cfg[kind] || cfg.not_started;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.classes}`}
    >
      {c.icon}
      <span>{label || c.defaultText}</span>
    </span>
  );
}

export function Skeleton({ className = "h-24 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-mutedSurface ${className}`} aria-hidden="true" />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-6 text-center flex flex-col items-center gap-3">
      {icon && <div className="p-3 rounded-full bg-mutedSurface text-forest">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-inkMuted max-w-md">{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </Card>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="p-5 border-sunrise/60 bg-statusCheckBg/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-sunrise shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-semibold text-ink">Unable to load latest data</p>
          <p className="text-sm text-inkMuted">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      )}
    </Card>
  );
}

export function BottomSheet({
  snap,
  onSnapChange,
  title,
  children,
}: {
  snap: "peek" | "half" | "full";
  onSnapChange: (next: "peek" | "half" | "full") => void;
  title: string;
  children: React.ReactNode;
}) {
  const heightClass =
    snap === "peek" ? "max-h-[150px]" : snap === "half" ? "max-h-[48vh]" : "max-h-[80vh]";

  return (
    <div
      className={`bg-surface border-t border-borderSubtle rounded-t-[20px] shadow-sheet transition-all duration-200 overflow-hidden flex flex-col z-[25] ${heightClass}`}
      role="region"
      aria-label={title}
    >
      <div className="px-4 py-2.5 border-b border-borderSubtle flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onSnapChange(snap === "peek" ? "half" : snap === "half" ? "full" : "peek")}
          className="flex items-center gap-2 text-sm font-semibold text-ink min-h-[40px]"
          aria-label="Toggle panel height"
        >
          <span className="w-8 h-1 rounded-full bg-borderSubtle inline-block" />
          <span>{title}</span>
        </button>
        <div className="flex gap-1">
          {(["peek", "half", "full"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSnapChange(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                snap === s ? "bg-forest text-onPrimary" : "text-inkMuted hover:bg-mutedSurface"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-y-auto p-4 space-y-3">{children}</div>
    </div>
  );
}
