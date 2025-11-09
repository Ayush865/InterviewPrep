"use client";

import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";

import { auth } from "@/firebase/client";
import { signOut } from "@/lib/actions/auth.action";
import { Button } from "@/components/ui/button";

const SignOutButton = () => {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      // Sign out from Firebase client
      await firebaseSignOut(auth);
      
      // Clear server session cookie
      await signOut();
      
      // Redirect to sign-in page
      router.push("/sign-in");
      router.refresh();
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
