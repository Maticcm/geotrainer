"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Play, BookOpen, Trophy, Settings } from "lucide-react";
import { useT } from "@/lib/hooks";

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useT();

  // Hide bottom navigation on active game screens so map has full height
  if (pathname.startsWith("/play/") && pathname !== "/play") {
    return null;
  }

  const navItems = [
    {
      href: "/",
      label: t("nav.home"),
      icon: Compass,
      isActive: pathname === "/",
    },
    {
      href: "/play",
      label: t("nav.play"),
      icon: Play,
      isActive: pathname === "/play",
    },
    {
      href: "/practice",
      label: t("nav.practice"),
      icon: BookOpen,
      isActive: pathname.startsWith("/practice"),
    },
    {
      href: "/progress",
      label: t("nav.progress"),
      icon: Trophy,
      isActive: pathname.startsWith("/progress"),
    },
    {
      href: "/settings",
      label: t("nav.settings"),
      icon: Settings,
      isActive: pathname.startsWith("/settings"),
    },
  ];

  return (
    <nav
      aria-label="Mobilna navigacija"
      className="md:hidden shrink-0 z-40 border-t border-[var(--border)] bg-[var(--card)]/92 backdrop-blur-xl transition-colors pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
    >
      <div className="flex h-14 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-all active:scale-95 touch-manipulation min-h-[44px] ${
                active
                  ? "text-blue-600 dark:text-blue-400 font-bold"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 line-clamp-1">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
