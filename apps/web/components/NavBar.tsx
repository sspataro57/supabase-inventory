"use client";

import { useState } from "react";
import { signOut } from "@/app/(app)/actions";

type Profile = {
  display_name: string | null;
  email: string;
  role: string;
};

export function NavBar({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const isAdmin = profile.role === "admin";
  const displayName = profile.display_name ?? profile.email;

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/catalog", label: "Catalog" },
    { href: "/movements/new", label: "Movement" },
    { href: "/scan", label: "Scan" },
    { href: "/chat", label: "Chat" },
    { href: "/reports", label: "Reports" },
    ...(isAdmin
      ? [
          { href: "/products/new", label: "+ New Ingredient" },
          { href: "/users", label: "Users" },
        ]
      : []),
  ];

  return (
    <>
      <header className="app-chrome bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-14 flex items-center px-4 gap-3 shrink-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
        >
          {open ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        <a
          href="/dashboard"
          className="font-semibold text-gray-900 dark:text-gray-50 shrink-0"
        >
          Inventory
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-1 flex-1 flex-wrap">
          {links.map(({ href, label }) => (
            <DesktopLink key={href} href={href}>
              {label}
            </DesktopLink>
          ))}
        </nav>

        {/* User controls */}
        <div className="flex items-center gap-3 ml-auto shrink-0">
          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
            {displayName}
          </span>
          {isAdmin && (
            <span className="text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded px-1.5 py-0.5 hidden sm:inline">
              admin
            </span>
          )}
          <a
            href="/api/manual"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-50 hidden sm:inline"
            title="Download user manual (PDF)"
          >
            Manual
          </a>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-md">
          <nav className="px-3 py-2 space-y-0.5">
            {links.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 space-y-0.5">
            <div className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500">
              {displayName}
              {isAdmin && " · admin"}
            </div>
            <a
              href="/api/manual"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Manual
            </a>
          </div>
        </div>
      )}
    </>
  );
}

function DesktopLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="px-3 py-1.5 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {children}
    </a>
  );
}
