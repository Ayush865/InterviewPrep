"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const SignOutButton = () => {
  const { signOut } = useClerk();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      // Clear Vapi credentials from localStorage
      localStorage.removeItem('vapi_assistant_id');
      localStorage.removeItem('vapi_tool_id');
      localStorage.removeItem('vapi_web_token');
      localStorage.removeItem('vapi_user_id');

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
