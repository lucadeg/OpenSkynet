import { useState, useEffect, useMemo } from 'react';
import { Trash2, Search, Package, Clock, Code, X, Folder, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { SkeletonCard } from '@/components/shared/Skeleton';
import { Badge } from '@/components/shared/Badge';
import { type Skill } from '@/types';
import { skillRecordingService, RecordedSkill } from '@/services/skills';
import { cn } from '@/lib/utils';

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [recordedSkills, setRecordedSkills] = useState<RecordedSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'installed' | 'available' | 'recorded'>('all');
  const [showCode, setShowCode] = useState<RecordedSkill | null>(null);

  useEffect(() => {
    // Load skills
    const loadSkills = async () => {
      setIsLoading(true);
      try {
        // Load skills from server
        try {
          const response = await fetch('http://localhost:3001/api/skills', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            const data = await response.json();
            setSkills(data.skills || []);
          }
        } catch {
          console.log('Server not available, using empty skills list');
          setSkills([]);
        }

        // Load recorded skills
        const recorded = skillRecordingService.getAllSkills();
        setRecordedSkills(recorded);
      } catch (error) {
        console.error('Failed to load skills:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSkills();

    // Listen for skill updates
    const handleSkillUpdate = () => {
      setRecordedSkills(skillRecordingService.getAllSkills());
    };

    skillRecordingService.on('recording-stopped', handleSkillUpdate);
    skillRecordingService.on('skill-imported', handleSkillUpdate);

    return () => {
      skillRecordingService.off('recording-stopped', handleSkillUpdate);
      skillRecordingService.off('skill-imported', handleSkillUpdate);
    };
  }, []);

  const filteredSkills = skills.filter((skill) => {
    const matchesSearch =
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filter === 'all' ||
      (filter === 'installed' && skill.installed) ||
      (filter === 'available' && !skill.installed);

    return matchesSearch && matchesFilter;
  });

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const groups: Record<string, Skill[]> = {};
    for (const skill of filteredSkills) {
      const category = skill.category || 'general';
      if (!groups[category]) groups[category] = [];
      groups[category].push(skill);
    }
    return groups;
  }, [filteredSkills]);

  const filteredRecordedSkills = recordedSkills.filter((skill) => {
    const matchesSearch =
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch && (filter === 'all' || filter === 'recorded');
  });

  const handleInstall = (skillId: string) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.id === skillId ? { ...skill, installed: true } : skill
      )
    );
  };

  const handleUninstall = (skillId: string) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.id === skillId ? { ...skill, installed: false } : skill
      )
    );
  };

  const handleDeleteRecorded = (skillId: string) => {
    skillRecordingService.deleteSkill(skillId);
    setRecordedSkills(prev => prev.filter(s => s.id !== skillId));
  };

  const handleViewCode = (skill: RecordedSkill) => {
    setShowCode(skill);
  };

  const installedCount = skills.filter((s) => s.installed).length;
  const availableCount = skills.filter((s) => !s.installed).length;
  const recordedCount = recordedSkills.length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <PageHeader
        icon={Package}
        title="Skills"
        subtitle="Extend OpenSkynet capabilities"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{skills.length + recordedCount}</span>
            </div>
            {recordedCount > 0 && (
              <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">{recordedCount} recorded</span>
              </div>
            )}
          </div>
        }
      />

      {/* Search & Filter */}
      <div className="p-6 border-b border-border bg-background space-y-4">
        <div className="relative max-w-3xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 max-w-3xl mx-auto">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({skills.length + recordedCount})
          </Button>
          {recordedCount > 0 && (
            <Button
              variant={filter === 'recorded' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('recorded')}
            >
              <Clock className="w-3 h-3 mr-1" />
              Recorded ({recordedCount})
            </Button>
          )}
          <Button
            variant={filter === 'installed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('installed')}
          >
            Installed ({installedCount})
          </Button>
          <Button
            variant={filter === 'available' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('available')}
          >
            Available ({availableCount})
          </Button>
        </div>
      </div>

      {/* Skills List */}
      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonCard key={i} showAvatar={false} />
              ))}
            </div>
          ) : filteredRecordedSkills.length > 0 || filteredSkills.length > 0 ? (
            <>
              {/* Recorded Skills Section */}
              {filteredRecordedSkills.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Recorded Skills
                  </h2>
                  <div className="border border-border rounded-lg overflow-hidden">
                    {filteredRecordedSkills.map((skill, index) => (
                      <div
                        key={skill.id}
                        className={cn(
                          "flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors",
                          index !== filteredRecordedSkills.length - 1 && "border-b border-border"
                        )}
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted flex-shrink-0">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground">{skill.name}</h4>
                            <Badge variant="default" className="text-xs">
                              {skill.actions.length} actions
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                            {skill.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewCode(skill)}
                          >
                            <Code className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRecorded(skill.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Skills Section */}
              {filteredSkills.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Available Skills ({filteredSkills.length})</h2>
                    {skills.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Folder className="w-4 h-4" />
                        {Object.keys(skillsByCategory).length} categories
                      </div>
                    )}
                  </div>

                  {/* Display by category */}
                  {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                    <div key={category} className="mb-6">
                      <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                        <Folder className="w-4 h-4" />
                        {category}
                        <span className="text-xs">({categorySkills.length})</span>
                      </h3>
                      <div className="border border-border rounded-lg overflow-hidden">
                        {categorySkills.map((skill, index) => (
                          <div
                            key={skill.id}
                            className={cn(
                              "flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors",
                              index !== categorySkills.length - 1 && "border-b border-border"
                            )}
                          >
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted flex-shrink-0">
                              {skill.source ? (
                                <ExternalLink className="w-5 h-5 text-muted-foreground" />
                              ) : (
                                <Package className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-foreground truncate">{skill.name}</h4>
                                <Badge variant="info" className="text-xs">
                                  v{skill.version}
                                </Badge>
                                {skill.source && (
                                  <Badge variant="default" className="text-xs">
                                    {skill.source.split('/')[0]}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                {skill.description}
                              </p>
                            </div>

                            {/* Action */}
                            <Button
                              variant={skill.installed ? 'outline' : 'default'}
                              size="sm"
                              onClick={() =>
                                skill.installed
                                  ? handleUninstall(skill.id)
                                  : handleInstall(skill.id)
                              }
                              className="flex-shrink-0"
                            >
                              {skill.installed ? 'Installed' : 'Install'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {searchQuery || filter !== 'all'
                  ? 'No skills found matching your criteria'
                  : 'No skills available'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Code View Modal */}
      {showCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCode(null)}>
          <div className="rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{showCode.name}</h3>
                <p className="text-sm mt-1 text-muted-foreground">{showCode.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCode(null)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="p-6 overflow-auto max-h-[60hv] bg-muted">
              <pre className="text-sm font-mono p-4 rounded-lg overflow-x-auto bg-background text-foreground">
                {skillRecordingService.skillToExecutable(showCode)}
              </pre>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card">
              <Button
                variant="ghost"
                onClick={() => setShowCode(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const code = skillRecordingService.skillToExecutable(showCode);
                  navigator.clipboard.writeText(code);
                }}
              >
                <Code className="w-4 h-4 mr-2" />
                Copy Code
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
