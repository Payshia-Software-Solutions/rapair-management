"use client"

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Trash2, Search, User, Mail, Shield } from 'lucide-react';
import { TECHNICIANS } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';

export default function TechniciansPage() {
  const { toast } = useToast();
  const [techs, setTechs] = useState(TECHNICIANS);
  const [newTech, setNewTech] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTech.trim()) {
      setTechs([...techs, newTech.trim()]);
      setNewTech('');
      toast({ title: "Technician Added", description: `${newTech} is now available.` });
    }
  };

  const handleDelete = (name: string) => {
    setTechs(techs.filter(t => t !== name));
    toast({ title: "Technician Removed", description: `${name} has been removed.`, variant: "destructive" });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Manage Technicians</h1>
          <p className="text-muted-foreground mt-1">Configure your workshop's skilled labor force</p>
        </div>
        <Badge variant="outline" className="w-fit px-3 py-1 bg-indigo-50 text-indigo-700 border-indigo-200">
          {techs.length} Registered Technicians
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Add New Technician</CardTitle>
              <CardDescription>Register a new member to the workshop team</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Full Name" 
                    value={newTech}
                    onChange={(e) => setNewTech(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2 bg-primary">
                  <Plus className="w-4 h-4" />
                  Add Technician
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search technicians..." className="pl-9" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {techs.map((tech) => (
              <Card key={tech} className="border-none shadow-sm group hover:shadow-md transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                      {tech.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{tech}</h3>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Senior Technician</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => handleDelete(tech)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
