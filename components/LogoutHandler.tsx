"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * Component that clears Vapi credentials from localStorage when user logs out
 * or when a different user signs in
 */
export default function LogoutHandler() {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    const clearVapiCredentials = () => {
      localStorage.removeItem('vapi_assistant_id');
      localStorage.removeItem('vapi_tool_id');
      localStorage.removeItem('vapi_web_token');
      localStorage.removeItem('vapi_user_id');
      console.log('Vapi credentials cleared from localStorage');
    };

    // If user is not signed in, clear Vapi credentials
    if (isSignedIn === false) {
      clearVapiCredentials();
      return;
    }

    // If user is signed in, check if it's a different user
    if (isSignedIn && user?.id) {
      const storedUserId = localStorage.getItem('vapi_user_id');

      // If stored userId doesn't match current user, clear credentials
      if (storedUserId && storedUserId !== user.id) {
        console.log('Different user detected, clearing previous user Vapi credentials');
        clearVapiCredentials();
      }

      // Store current user ID
      localStorage.setItem('vapi_user_id', user.id);
    }
  }, [isSignedIn, user?.id]);

  return null; // This component doesn't render anything
}
