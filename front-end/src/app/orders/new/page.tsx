"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  CheckCircle2, 
  Plus, 
  X,
  Loader2,
  Calendar as CalendarIcon,
  ChevronRight
} from 'lucide-react';
import { suggestRepairDetails } from '@/ai/flows/suggest-repair-details-flow';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export default function NewOrderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  const [formData, setFormData] = useState({
    vehicleId: '',
    mileage: '',
    priority: 'Medium',
    expectedTime: '',
    problemDescription: '',
    comments: ''
  });

  const [checklist, setChecklist] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');

  const handleGetAISuggestions = async () => {
    if (!formData.problemDescription) {
      toast({
        title: "Missing description",
        description: "Please provide a problem description first to get AI suggestions.",
        variant: "destructive"
      });
      return;
    }

    setLoadingSuggestions(true);
    try {
      const result = await suggestRepairDetails({ 
        problemDescription: formData.problemDescription 
      });
      setChecklist(prev => Array.from(new Set([...prev, ...result.checklistItems])));
      setCategories(prev => Array.from(new Set([...prev, ...result.categories])));
      toast({
        title: "Suggestions generated",
        description: "AI has added relevant checklist items and categories."
      });
    } catch (error) {
      toast({
        title: "Suggestion error",
        description: "Failed to get AI suggestions. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddItem = () => {
    if (newItem.trim()) {
      setChecklist([...checklist, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Order Created",
      description: `Repair Order for ${formData.vehicleId} has been successfully created.`,
    });
    router.push('/orders');
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Repair Order</h1>
          <p className="text-muted-foreground mt-1">Register a new vehicle for workshop service</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>First Officer</span>
          <ChevronRight className="w-4 h-4" />
          <span className="font-medium text-foreground">New Order</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-md border-none">
            <CardHeader>
              <CardTitle>Vehicle & Problem Details</CardTitle>
              <CardDescription>Enter basic information about the vehicle and reported issue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="vehicleId">Vehicle Plate / ID</Label>
                  <Input 
                    id="vehicleId" 
                    placeholder="e.g. ABC-1234" 
                    required 
                    value={formData.vehicleId}
                    onChange={e => setFormData({...formData, vehicleId: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mileage">Mileage (km)</Label>
                  <Input 
                    id="mileage" 
                    type="number" 
                    placeholder="e.g. 45000" 
                    required
                    value={formData.mileage}
                    onChange={e => setFormData({...formData, mileage: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority Level</Label>
                  <Select 
                    defaultValue="Medium"
                    onValueChange={val => setFormData({...formData, priority: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedTime">Expected Time of Completion</Label>
                  <Input 
                    id="expectedTime" 
                    type="datetime-local" 
                    required
                    value={formData.expectedTime}
                    onChange={e => setFormData({...formData, expectedTime: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="problemDescription">Problem Description</Label>
                <div className="relative">
                  <Textarea 
                    id="problemDescription" 
                    placeholder="Describe the issues reported by the driver..." 
                    className="min-h-[120px]"
                    required
                    value={formData.problemDescription}
                    onChange={e => setFormData({...formData, problemDescription: e.target.value})}
                  />
                  <Button 
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleGetAISuggestions}
                    disabled={loadingSuggestions}
                    className="absolute bottom-3 right-3 gap-2 bg-accent/20 hover:bg-accent/30 text-primary border border-accent/30"
                  >
                    {loadingSuggestions ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    AI Suggestions
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comments">Additional Comments</Label>
                <Textarea 
                  id="comments" 
                  placeholder="Any other notes for the workshop officer..." 
                  value={formData.comments}
                  onChange={e => setFormData({...formData, comments: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-none">
            <CardHeader>
              <CardTitle>Repair Checklist</CardTitle>
              <CardDescription>Items to be inspected or performed during repair</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Add custom checklist item..." 
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                />
                <Button type="button" size="icon" onClick={handleAddItem}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {checklist.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic col-span-2 text-center py-4 bg-muted/20 rounded-lg">
                    No items added yet. Use AI Suggestions to generate a relevant checklist.
                  </p>
                ) : (
                  checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-card border group animate-in fade-in slide-in-from-left-2">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="text-sm font-medium leading-tight">{item}</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeItem(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-md border-none bg-primary text-white">
            <CardHeader>
              <CardTitle className="text-white">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Vehicle</span>
                <span className="font-bold">{formData.vehicleId || 'Not Specified'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Priority</span>
                <Badge className="bg-accent text-primary border-none">{formData.priority}</Badge>
              </div>
              <Separator className="bg-white/10" />
              <div className="space-y-2">
                <span className="text-xs text-white/70 uppercase tracking-wider font-bold">Categories</span>
                <div className="flex flex-wrap gap-1.5">
                  {categories.length > 0 ? categories.map(cat => (
                    <Badge key={cat} variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-none">
                      {cat}
                    </Badge>
                  )) : (
                    <span className="text-xs italic text-white/50">None identified yet</span>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button type="submit" className="w-full bg-accent text-primary hover:bg-accent/90 border-none font-bold py-6 text-lg">
                Create Order
              </Button>
            </CardFooter>
          </Card>

          <Card className="shadow-sm border-dashed border-2">
            <CardContent className="p-6">
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Next Steps
              </h4>
              <ul className="text-xs text-muted-foreground space-y-3">
                <li className="flex gap-2">
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold">1</div>
                  <span>Workshop officer will assign this vehicle to a bay upon arrival.</span>
                </li>
                <li className="flex gap-2">
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold">2</div>
                  <span>Initial vehicle check will be performed to propose actual repair time.</span>
                </li>
                <li className="flex gap-2">
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold">3</div>
                  <span>Status will transition to "In Progress" once assigned.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </form>
    </DashboardLayout>
  );
}