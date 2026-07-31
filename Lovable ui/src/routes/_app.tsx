import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/atlas/AppSidebar";
import { TopBar } from "@/components/atlas/TopBar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 px-6 md:px-10 py-8 max-w-[1500px] w-full mx-auto animate-atlas-fade-up">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
