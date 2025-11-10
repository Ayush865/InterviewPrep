import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
const Layout = async ({ children }: { children: ReactNode }) => {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="root-layout">
      <nav className="flex items-center justify-between relative z-50">
        <Link href="/" className="flex items-center justify-center gap-2">
          <Image src="/logo.png" alt="MockMate Logo" width={70} height={70} />
          <div className="pt-4">
            <h2 className="text-primary-10">Hired <span className="text-orange">Fox</span></h2>
          </div>
        </Link>

        <UserButton 
          appearance={{
            elements: {
              avatarBox: "w-12 h-12",
            },
          }}
        />
      </nav>
      {children}
    </div>
  );
};

export default Layout;
