"use client"

import React from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Settings, 
  LogOut, 
  Shield, 
  Bell, 
  Moon,
  ChevronRight,
  Mail,
  Briefcase
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function ProfilePage() {
  const handleLogout = () => {
    // Basic redirect for UI prototype
    window.location.href = '/login';
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col items-center text-center space-y-3 py-6">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
              <AvatarImage src="https://picsum.photos/seed/user/96/96" />
              <AvatarFallback className="text-2xl">FO</AvatarFallback>
            </Avatar>
            <div className="absolute bottom-1 right-1 p-1.5 bg-accent rounded-full border-2 border-white shadow-sm">
              <Shield className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">First Officer</h1>
            <p className="text-muted-foreground text-sm font-medium">Workshop Manager • Bay Area Center</p>
          </div>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg text-primary">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Email</p>
                  <p className="text-sm font-semibold">officer@servicebay.com</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-primary font-bold">Edit</Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Workshop ID</p>
                  <p className="text-sm font-semibold">SB-WEST-992</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="notifications">Push Notifications</Label>
              </div>
              <Switch id="notifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="darkmode">Dark Mode</Label>
              </div>
              <Switch id="darkmode" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button 
            variant="outline" 
            className="w-full justify-between h-14 px-6 rounded-2xl border-none shadow-sm hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold">Security Settings</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Button>

          <Button 
            variant="destructive" 
            className="w-full h-14 rounded-2xl gap-2 font-bold shadow-lg shadow-destructive/20"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold pt-4">
          ServiceBay v1.2.4 • Production
        </p>
      </div>
    </DashboardLayout>
  );
}
