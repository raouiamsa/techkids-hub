'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/auth.context';
import { BookOpen, LayoutDashboard, LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@org/ui-components';

const roleLabels: Record<string, string> = {
  STUDENT: 'Élève',
  PARENT: 'Parent',
  TEACHER: 'Enseignant',
  ADMIN: 'Admin',
};

const dashboardPath: Record<string, string> = {
  STUDENT: '/student/dashboard',
  PARENT: '/parent/dashboard',
  TEACHER: '/teacher/dashboard',
  ADMIN: '/admin/dashboard',
};

// Pages where the navbar should be hidden
const HIDDEN_ON = ['/login', '/register', '/verify-email'];

export default function Navbar() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Hide on auth pages
  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight">
            TechKids <span className="text-blue-600">Hub</span>
          </span>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild className="normal-case tracking-normal font-medium text-sm text-slate-600 dark:text-slate-300">
            <Link href="/courses">Catalogue de cours</Link>
          </Button>
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-8 w-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ) : user ? (
            /* User Menu */
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                  {user.email[0].toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none">
                    {user.email.split('@')[0]}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {roleLabels[user.role] ?? user.role}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden"
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="p-2 space-y-1">
                    <Link
                      href={dashboardPath[user.role] ?? '/'}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Mon tableau de bord
                    </Link>
                    <Link
                      href="/courses"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <BookOpen className="h-4 w-4" />
                      Catalogue de cours
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 p-2">
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      className="w-full justify-start gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 normal-case tracking-normal font-medium text-sm"
                    >
                      <LogOut className="h-4 w-4" />
                      Se déconnecter
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Login / Register */
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="normal-case tracking-normal font-medium text-sm">
                <Link href="/login">Connexion</Link>
              </Button>
              <Button size="sm" asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow normal-case tracking-normal font-semibold text-sm rounded-xl">
                <Link href="/register">S&apos;inscrire</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Click-outside overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
}
