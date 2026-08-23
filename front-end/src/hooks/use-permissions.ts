"use client";

import { useState, useEffect } from "react";

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updatePerms = () => {
      try {
        const token = window.localStorage.getItem("auth_token");
        if (token) {
          const part = token.split(".")[1];
          if (part) {
            const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
            if (String(json.role || "").toLowerCase() === "admin") {
              setIsAdmin(true);
              setPermissions(["*"]);
              setLoading(false);
              return;
            }
          }
        }

        const cached = window.localStorage.getItem("perms_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setPermissions(parsed);
            if (parsed.includes("*")) {
              setIsAdmin(true);
            }
          }
        }
      } catch {
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    updatePerms();
    window.addEventListener("rbac:updated", updatePerms);
    window.addEventListener("storage", updatePerms);

    return () => {
      window.removeEventListener("rbac:updated", updatePerms);
      window.removeEventListener("storage", updatePerms);
    };
  }, []);

  const hasPerm = (perm?: string): boolean => {
    if (!perm) return true;
    if (isAdmin || permissions.includes("*")) return true;
    return permissions.includes(perm);
  };

  const canWrite = (modulePrefix: string): boolean => {
    const writeKey = modulePrefix.endsWith(".write")
      ? modulePrefix
      : `${modulePrefix}.write`;
    return hasPerm(writeKey);
  };

  return {
    permissions,
    isAdmin,
    loading,
    hasPerm,
    canWrite,
  };
}
