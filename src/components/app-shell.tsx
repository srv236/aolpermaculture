import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/farm.functions";
import { supabase } from "@/integrations/supabase/client";
import { Sprout, Wheat, Users, HardHat, CalendarCheck, LogOut, LayoutGrid, Info } from "lucide-react";
import logoAsset from "@/assets/aol-logo.png.asset.json";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FontSizeToggle } from "@/components/font-size-toggle";

export function useMe() {
  const fn = useServerFn(getMe);
  return useQuery({ queryKey: ["me"], queryFn: () => fn(), staleTime: 60_000 });
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const isAdmin = me?.roles.includes("admin");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const initials = (me?.profile?.full_name || me?.profile?.email || "?")
    .split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 flex items-center gap-3 border-b border-sidebar-border">
          <img src={logoAsset.url} alt="AOL Permaculture" className="size-10 rounded-full shrink-0 bg-white/95 p-0.5" />
          <div className="min-w-0">
            <div className="font-serif text-base leading-tight truncate">AOL Permaculture</div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Farm Management</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 text-sm">
          <NavItem to="/farms" icon={<Sprout className="size-4" />}>Farms</NavItem>
          <NavItem to="/about" icon={<Info className="size-4" />}>About</NavItem>
          <NavItem to="/planning" icon={<LayoutGrid className="size-4" />}>Planning</NavItem>
          <NavItem to="/crops" icon={<Wheat className="size-4" />}>Crop Library</NavItem>
          <NavItem to="/workers" icon={<HardHat className="size-4" />}>Sevaks</NavItem>
          <NavItem to="/attendance" icon={<CalendarCheck className="size-4" />}>Attendance</NavItem>
          {isAdmin && (
            <NavItem to="/admin/users" icon={<Users className="size-4" />}>Users</NavItem>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <FontSizeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent transition">
              <Avatar className="size-8">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-left flex-1 min-w-0">
                <div className="text-sm truncate">{me?.profile?.full_name || me?.profile?.email}</div>
                <div className="text-[10px] uppercase tracking-wider opacity-60">{me?.roles.join(", ")}</div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{me?.profile?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="size-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

function NavItem({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: false }}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition",
        "hover:bg-sidebar-accent",
      )}
      activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
