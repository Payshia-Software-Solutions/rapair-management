"use client"

import React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { LocationForm } from "@/components/admin/location-form";

export default function NewLocationPage() {
  return (
    <DashboardLayout>
      <div className="py-6">
        <LocationForm />
      </div>
    </DashboardLayout>
  );
}
