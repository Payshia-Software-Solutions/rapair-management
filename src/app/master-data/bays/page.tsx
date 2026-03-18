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
import { Grid, Plus, Trash2, MapPin, AlertCircle } from 'lucide-react';
import { BAYS } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';

export default function BaysPage() {
  const { toast } = useToast();
  const [bays, setBays] = useState(BAYS);
  const [newBay, setNewBay] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBay.trim()) {
      setBays([...bays, newBay.trim()]);
      setNewBay('');
      toast({ title: "Bay Created", description: `${newBay} is now listed.` });
    }
  };

  const handleDelete = (name: string) => {
    setBays(bays.filter(b => b !== name));
    toast({ title: "Bay Removed", description: `${name} has been decommissioned.`, variant: "destructive" });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Workshop Bays</h1>
          <p className="text-muted-foreground mt-1">Configure physical repair locations and zones</p>
        </div>
        <Badge variant="outline" className="w-fit px-3 py-1 bg-cyan-50 text-cyan-700 border-cyan-200">
          {bays.length} Active Locations
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Register New Bay</CardTitle>
              <CardDescription>Add a new workspace to the workshop floor</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Bay Name (e.g. Bay 10)" 
                    value={newBay}
                    onChange={(e) => setNewBay(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4" />
                  Add Bay
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-sm bg-cyan-50/50">
            <CardContent className="p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
              <p className="text-xs text-cyan-800 leading-relaxed">
                Bays represent physical slots where vehicles are parked for repair. Ensure names are unique for clear assignment.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {bays.map((bay) => (
              <Card key={bay} className="border-none shadow-sm group hover:ring-2 hover:ring-cyan-200 transition-all">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3 relative">
                  <div className="p-3 bg-cyan-100 rounded-2xl text-cyan-700">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-sm">{bay}</h3>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 h-8 w-8"
                    onClick={() => handleDelete(bay)}
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
