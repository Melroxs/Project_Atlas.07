'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import {
  LayoutDashboard,
  Brain,
  FileText,
  MessageSquare,
  DollarSign,
  FolderOpen,
  HardHat,
  Building,
  Home,
  Users,
  FileEdit,
  UserCog,
  Settings,
  BarChart3,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  Target,
  Scale,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/admin/intelligence', label: 'Intelligence', icon: <Brain className="h-4 w-4" /> },
  { href: '/admin/decisions', label: 'Decision Review', icon: <Scale className="h-4 w-4" /> },
  { href: '/admin/claims', label: 'Claims', icon: <FileText className="h-4 w-4" /> },
  { href: '/admin/interviews', label: 'Interviews', icon: <MessageSquare className="h-4 w-4" /> },
  { href: '/admin/supplements', label: 'Supplements', icon: <DollarSign className="h-4 w-4" /> },
  { href: '/admin/documents', label: 'Documents', icon: <FolderOpen className="h-4 w-4" /> },
  { href: '/admin/adjusters', label: 'Adjusters', icon: <HardHat className="h-4 w-4" /> },
  { href: '/admin/companies', label: 'Companies', icon: <Building className="h-4 w-4" /> },
  { href: '/admin/properties', label: 'Properties', icon: <Home className="h-4 w-4" /> },
  { href: '/admin/contacts', label: 'Contacts', icon: <Users className="h-4 w-4" /> },
  { href: '/admin/notes', label: 'Notes', icon: <FileEdit className="h-4 w-4" /> },
  { href: '/admin/users', label: 'Users', icon: <UserCog className="h-4 w-4" /> },
  { href: '/admin/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  { href: '/admin/activity', label: 'Activity', icon: <BarChart3 className="h-4 w-4" /> },
  { href: '/admin/system-health', label: 'System Health', icon: <HeartPulse className="h-4 w-4" /> },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface DemoStatus {
  enabled: boolean;
  hasData: boolean;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile]);

  useEffect(() => {
    const fetchDemoStatus = async () => {
      try {
        const response = await apiFetch('/demo/status');
        setDemoStatus(response as DemoStatus);
      } catch (error) {
        // Demo endpoint might not be available, ignore error
      }
    };
    fetchDemoStatus();
  }, []);

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full bg-surface border-r border-[var(--border)] text-foreground transition-all duration-300 z-50 ${collapsed ? 'w-16' : 'w-64'} ${isMobile && !mobileOpen ? '-translate-x-full' : ''}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          {!collapsed && (
            <div className="relative w-40 h-12">
              <Image
                src="/brand/logo-horizontal.svg"
                alt="Project Atlas"
                fill
                className="object-contain"
              />
            </div>
          )}
          {collapsed && (
            <div className="relative w-8 h-8 mx-auto">
              <Image
                src="/brand/logo-icon.svg"
                alt="Atlas"
                fill
                className="object-contain"
              />
            </div>
          )}
          <button
            onClick={() => {
              setCollapsed(!collapsed);
              if (isMobile && onMobileClose) onMobileClose();
            }}
            className="p-1 rounded hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => isMobile && onMobileClose && onMobileClose()}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="h-4 w-4 flex items-center justify-center">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Demo Badge */}
        {demoStatus?.enabled && !collapsed && (
          <div className="mx-2 p-3 rounded-lg bg-gradient-to-r from-primary to-accent">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4" />
              <span className="text-foreground font-semibold text-sm">Demo Mode Active</span>
            </div>
            <div className="space-y-1 text-xs text-foreground/80">
              <div className="flex justify-between">
                <span>Seed:</span>
                <span className="font-mono">42</span>
              </div>
              <div className="flex justify-between">
                <span>Data:</span>
                <span>{demoStatus.hasData ? 'Generated' : 'None'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Collapse Toggle at Bottom */}
        <div className="absolute bottom-4 left-0 right-0 px-2">
          <button
            onClick={() => {
              setCollapsed(!collapsed);
              if (isMobile && onMobileClose) onMobileClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span>{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</span>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
