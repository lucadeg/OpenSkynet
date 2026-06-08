import { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, Trash2, Search, Play, Calendar, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/elements/actions/Button';
import { Input } from '@/elements/form/Input';
import { Textarea } from '@/elements/form/Textarea';
import { Card } from '@/elements/data/Card';
import { ScrollArea } from '@/elements/data/ScrollArea';
import { Badge } from '@/elements/feedback/Badge';
import { cn } from '@/lib/utils';
import { type CronJob } from '@/types';

const API_BASE = 'http://localhost:3001';

const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 9am', value: '0 9 * * *' },
  { label: 'Every Monday at 9am', value: '0 9 * * 1' },
  { label: 'First of every month', value: '0 0 1 * *' },
];

function formatCronHuman(cron: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === cron);
  if (preset) return preset.label;

  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return cron;

  const [min, hour, dom, month, dow] = parts;

  if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `Every ${min.slice(2)} minutes`;
  }
  if (hour.startsWith('*/') && min === '0' && dom === '*' && month === '*' && dow === '*') {
    return `Every ${hour.slice(2)} hours`;
  }
  if (min === '0' && hour === '0' && dom === '*' && month === '*' && dow === '*') {
    return 'Daily at midnight';
  }

  return cron;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface AddJobForm {
  cron: string;
  task: string;
  skill_name: string;
  provider: string;
}

export function SchedulePage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<AddJobForm>({
    cron: '',
    task: '',
    skill_name: '',
    provider: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  const loadJobs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/schedule`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch {
      // server not reachable
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 10000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const filteredJobs = jobs.filter((job) => {
    const q = searchQuery.toLowerCase();
    return (
      job.task.toLowerCase().includes(q) ||
      job.cron.toLowerCase().includes(q) ||
      (job.skill_name ?? '').toLowerCase().includes(q) ||
      job.id.toLowerCase().includes(q)
    );
  });

  const handleAddJob = async () => {
    setFormError('');

    if (!form.cron.trim()) {
      setFormError('Cron expression is required');
      return;
    }
    if (!form.task.trim()) {
      setFormError('Task description is required');
      return;
    }

    const parts = form.cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      setFormError('Cron must be 5 fields: minute hour day month weekday');
      return;
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, string> = {
        cron: form.cron.trim(),
        task: form.task.trim(),
      };
      if (form.skill_name.trim()) body.skill_name = form.skill_name.trim();
      if (form.provider.trim()) body.provider = form.provider.trim();

      const response = await fetch(`${API_BASE}/api/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setForm({ cron: '', task: '', skill_name: '', provider: '' });
        setShowAddForm(false);
        await loadJobs();
      } else {
        const data = await response.json();
        setFormError(data.message || `Error ${response.status}`);
      }
    } catch {
      setFormError('Failed to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    setDeleting((prev) => new Set(prev).add(jobId));
    try {
      const response = await fetch(`${API_BASE}/api/schedule/${jobId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await loadJobs();
      }
    } catch {
      // ignore
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const enabledCount = jobs.filter((j) => j.enabled).length;

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        icon={Clock}
        title="Schedule"
        subtitle="Cron-based task automation"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{jobs.length}</span>
              {jobs.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({enabledCount} active)
                </span>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Job
            </Button>
          </div>
        }
      />

      <div className="p-6 border-b border-border bg-background space-y-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs..."
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          {showAddForm && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Scheduled Job
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError('');
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Cron Expression
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      minute hour day month weekday
                    </span>
                  </div>
                  <Input
                    value={form.cron}
                    onChange={(e) => setForm({ ...form, cron: e.target.value })}
                    placeholder="*/30 * * * *"
                    className="font-mono"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {CRON_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setForm({ ...form, cron: preset.value })}
                        className={cn(
                          'text-[10px] px-2 py-1 rounded border transition-colors',
                          form.cron === preset.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea
                  label="Task Description"
                  value={form.task}
                  onChange={(e) => setForm({ ...form, task: e.target.value })}
                  placeholder="Describe what the agent should do..."
                  autoResize={false}
                  className="min-h-[80px]"
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Skill Name (optional)"
                    value={form.skill_name}
                    onChange={(e) => setForm({ ...form, skill_name: e.target.value })}
                    placeholder="skill-name"
                  />
                  <Input
                    label="Provider (optional)"
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    placeholder="openai"
                  />
                </div>

                {formError && (
                  <p className="text-xs text-destructive">{formError}</p>
                )}

                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setFormError('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAddJob}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 mr-1" />
                        Schedule
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="border border-border rounded-lg overflow-hidden">
              {filteredJobs.map((job, index) => (
                <div
                  key={job.id}
                  className={cn(
                    'p-4 hover:bg-muted/50 transition-colors',
                    index !== filteredJobs.length - 1 && 'border-b border-border'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted flex-shrink-0 mt-0.5">
                      <Play className={cn(
                        'w-4 h-4',
                        job.enabled ? 'text-primary' : 'text-muted-foreground'
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">
                          {job.cron}
                        </code>
                        <Badge
                          variant={job.enabled ? 'success' : 'default'}
                          size="sm"
                          dot
                        >
                          {job.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        {job.skill_name && (
                          <Badge variant="info" size="sm">
                            {job.skill_name}
                          </Badge>
                        )}
                        {job.provider && job.provider !== 'openai' && (
                          <Badge variant="default" size="sm">
                            {job.provider}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-foreground line-clamp-2">
                        {job.task}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span title={formatCronHuman(job.cron)}>
                          {formatCronHuman(job.cron)}
                        </span>
                        <span className="tabular-nums">
                          Last run: {timeAgo(job.last_run)}
                        </span>
                        <span className="text-[10px] font-mono">
                          {job.id}
                        </span>
                      </div>

                      {job.last_result && (
                        <div className="mt-2 px-3 py-2 bg-muted rounded text-xs text-muted-foreground line-clamp-2 font-mono">
                          {job.last_result}
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteJob(job.id)}
                      disabled={deleting.has(job.id)}
                      className="text-destructive hover:text-destructive h-8"
                    >
                      {deleting.has(job.id) ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="p-16 text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'No scheduled jobs matching your search'
                  : 'No scheduled jobs yet. Click "Add Job" to create one.'}
              </p>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
