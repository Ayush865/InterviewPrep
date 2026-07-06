import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { Settings } from "lucide-react";
import LogoutHandler from "@/components/LogoutHandler";

const Layout = async ({ children }: { children: ReactNode }) => {
  const user = await currentUser();

  return (
    <div className="flex min-h-screen flex-col">
      {user && <LogoutHandler />}

      <header className="glass-nav">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="Hired Fox home"
          >
            <Image
              src="/logo.png"
              alt=""
              width={36}
              height={36}
              className="size-9 object-contain"
            />
            <span className="text-[17px] font-semibold tracking-tight text-white">
              Hired<span className="text-accent"> Fox</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  href="/interview"
                  className="hidden rounded-full px-4 py-2 text-sm font-medium text-zinc-300 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white sm:inline-flex"
                >
                  New interview
                </Link>
                <Link
                  href="/settings/vapi"
                  className="inline-flex size-10 items-center justify-center rounded-full text-zinc-300 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
                  aria-label="Vapi settings"
                >
                  <Settings className="size-5" aria-hidden="true" />
                </Link>
                <div className="ml-1">
                  <UserButton
                    appearance={{
                      elements: { avatarBox: "size-9" },
                    }}
                  />
                </div>
              </>
            ) : (
              <Link
                href="/sign-in"
                className="btn-cta !h-9 !px-5 text-sm"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
        {children}
      </main>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt=""
              width={22}
              height={22}
              className="size-[22px] object-contain"
            />
            <span className="text-sm text-zinc-500">
              © {new Date().getFullYear()} Hired Fox
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Built by{" "}
            <Link
              href="https://www.linkedin.com/in/ayush-prakash-2bb65122b/"
              className="font-medium text-zinc-300 transition-colors duration-200 hover:text-accent"
            >
              Ayush Prakash
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
