"use client"

import React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Layers, Banknote, ArrowRight, Settings, Gavel } from "lucide-react";
import Link from "next/link";

export default function HRSettingsOverview() {
  const settingsOptions = [
    {
      title: "Staff Departments",
      description: "Define organizational divisions like Finance, Operations, or Technical. Used for grouping and ID generation.",
      icon: <Building2 className="w-10 h-10 text-primary" />,
      href: "/hrm/settings/departments",
      color: "bg-primary/10"
    },
    {
      title: "Staff Categories",
      description: "Manage classifications like Executive, Staff, or Worker to define rank and identification prefixes.",
      icon: <Layers className="w-10 h-10 text-blue-500" />,
      href: "/hrm/settings/categories",
      color: "bg-blue-500/10"
    },
    {
      title: "Salary Schemes",
      description: "Create global payroll templates with standard allowances and deductions to quickly apply to employees.",
      icon: <Banknote className="w-10 h-10 text-green-500" />,
      href: "/hrm/settings/salary-schemes",
      color: "bg-green-500/10"
    },
    {
      title: "Payroll Rules",
      description: "Set automated penalty rates for lateness and absences to be calculated during payroll generation.",
      icon: <Gavel className="w-10 h-10 text-indigo-500" />,
      href: "/hrm/settings/payroll-rules",
      color: "bg-indigo-500/10"
    }
  ];

  return (
    <DashboardLayout>
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
          <Settings className="w-8 h-8 text-primary" />
          HR Configuration Overview
        </h1>
        <p className="text-muted-foreground mt-1">Select a management module to configure your Human Resource parameters</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {settingsOptions.map((opt, idx) => (
          <Link key={idx} href={opt.href} className="group outline-none focus:ring-2 ring-primary ring-offset-4 rounded-3xl transition-transform active:scale-95">
            <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md h-full overflow-hidden relative transition-all group-hover:shadow-primary/10 group-hover:-translate-y-1">
              <div className={`absolute top-0 right-0 w-32 h-32 ${opt.color} rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-125 opacity-50`} />
              
              <CardHeader className="pt-10 pb-4">
                <div className={`p-4 rounded-2xl w-fit mb-4 ${opt.color}`}>
                  {opt.icon}
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter text-foreground group-hover:text-primary transition-colors">{opt.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed text-muted-foreground pt-2">
                  {opt.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pb-8 flex items-center gap-2 text-primary font-bold text-sm">
                Manage Section
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </DashboardLayout>
  );
}

