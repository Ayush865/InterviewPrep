"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const SignOutButton = () => {
  const { signOut } = useClerk();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Button
      onClick={handleSignOut}
      className="btn-secondary"
    >
      Sign Out
    </Button>
  );
};

export default SignOutButton;
