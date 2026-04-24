import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, Eye } from 'lucide-react';
import { format } from 'date-fns';
import MarkdownPreview from '@/components/MarkdownPreview';

interface Metric { label: string; value: string; }

interface Report {
  id: string;
  title: string;
  body: string;
  metrics: Metric[];
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
}

export default function ImpactReportsPanel({ communityId }: { communityId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Report | 'new' | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('impact_reports')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });
    if (data) setReports(data.map(r => ({ ...r, metrics: Array.isArray(r.metrics) ? (r.metrics as unknown as Metric[]) : [] })) as Report[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [communityId]);

  const startEdit = (r: Report | 'new') => {
    setEditing(r);
    setShowPreview(false);
    if (r === 'new') {
      setTitle(''); setBody(''); setMetrics([]);
    } else {
      setTitle(r.title); setBody(r.body); setMetrics(r.metrics || []);
    }
  };

  const save = async (status: 'draft' | 'published') => {
    if (!user) return;
    if (!title.trim() || !body.trim()) {
      toast({ title: 'Title and body are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const cleanMetrics = metrics.filter(m => m.label.trim() && m.value.trim());
    const payload: any = {
      community_id: communityId,
      author_id: user.id,
      title: title.trim(),
      body,
      metrics: cleanMetrics,
      status,
    };
    if (status === 'published') payload.published_at = new Date().toISOString();

    const isNew = editing === 'new';
    const { error } = isNew
      ? await supabase.from('impact_reports').insert(payload)
      : await supabase.from('impact_reports').update(payload).eq('id', (editing as Report).id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error saving report', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: status === 'published' ? 'Report published!' : 'Draft saved' });
    setEditing(null);
    load();
  };

  const deleteReport = async (id: string) => {
    const { error } = await supabase.from('impact_reports').delete().eq('id', id);
    if (error) { toast({ title: 'Error deleting', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Report deleted' });
    load();
  };

  const updateMetric = (i: number, field: 'label' | 'value', val: string) => {
    setMetrics(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  };

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  if (editing !== null) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{editing === 'new' ? 'New Impact Report' : 'Edit Report'}</CardTitle>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowPreview(p => !p)}>
              <Eye className="h-3.5 w-3.5" /> {showPreview ? 'Edit' : 'Preview'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showPreview ? (
            <div className="border rounded-lg p-4 space-y-3">
              <h2 className="text-xl font-heading font-bold">{title || 'Untitled'}</h2>
              <MarkdownPreview content={body} />
              {metrics.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {metrics.filter(m => m.label && m.value).map((m, i) => (
                    <div key={i} className="border rounded p-2 text-center">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="font-semibold">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Body (markdown supported) *</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[200px] font-mono text-sm" placeholder="## Heading&#10;&#10;Body text. **Bold**, *italic*, lists, etc." />
              </div>
              <div className="space-y-2">
                <Label>Structured metrics (optional)</Label>
                <div className="space-y-2">
                  {metrics.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <Input placeholder="Label (e.g. Amount raised)" value={m.label} onChange={(e) => updateMetric(i, 'label', e.target.value)} />
                      <Input placeholder="Value (e.g. €2,300)" value={m.value} onChange={(e) => updateMetric(i, 'value', e.target.value)} />
                      <Button size="sm" variant="ghost" onClick={() => setMetrics(metrics.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setMetrics([...metrics, { label: '', value: '' }])} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add metric
                  </Button>
                </div>
              </div>
            </>
          )}
          <div className="flex gap-2 pt-2 border-t">
            <Button onClick={() => save('published')} disabled={saving}>Publish</Button>
            <Button variant="outline" onClick={() => save('draft')} disabled={saving}>Save as draft</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-semibold">Impact Reports</h2>
        <Button onClick={() => startEdit('new')} size="sm" className="gap-1"><Plus className="h-4 w-4" /> New Report</Button>
      </div>
      {reports.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No reports yet. Tell your community's story.</p>
            <Button onClick={() => startEdit('new')} variant="outline" className="gap-1"><Plus className="h-4 w-4" /> Write your first report</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <Card key={r.id} className="shadow-card">
              <CardContent className="py-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{r.title}</h3>
                      <Badge variant={r.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.published_at ? `Published ${format(new Date(r.published_at), 'MMM d, yyyy')}` : `Draft · created ${format(new Date(r.created_at), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteReport(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{r.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
