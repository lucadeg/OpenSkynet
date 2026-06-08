import { useState, useEffect } from 'react';
import { Server, Check, Key, CheckCircle, AlertCircle, ChevronRight, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/elements/actions/Button';
import { Input } from '@/elements/form/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/elements/data/Card';
import { ScrollArea } from '@/elements/data/ScrollArea';
import { Badge } from '@/elements/feedback/Badge';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProviderInfo {
  name: string;
  display_name?: string;
  category: string;
  needs_api_key: boolean;
  has_key: boolean;
}

export function ProviderPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [statuses, setStatuses] = useState<Record<string, 'connected' | 'disconnected' | 'error'>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  const setProvider = useAppStore((state) => state.setProvider);
  const setModel = useAppStore((state) => state.setModel);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/model/providers', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
      }
    } catch {
      console.error('Failed to load providers');
    }
  };

  const handleSelectProvider = (providerName: string) => {
    setSelectedProvider(providerName);
    // Don't set provider in store yet - wait for backend confirmation
    setExpandedProvider(providerName === expandedProvider ? null : providerName);
    setApiKey('');
  };

  const handleSave = async () => {
    if (!selectedProvider) return;

    try {
      const response = await fetch('http://localhost:3001/api/model/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          api_key: apiKey || undefined
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Only set provider in store after backend confirms
        setProvider(selectedProvider);
        if (result.model) {
          setModel(result.model);
        }
        setStatuses(prev => ({ ...prev, [selectedProvider]: 'connected' }));
        toast.success(`Provider ${selectedProvider} configured successfully`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setStatuses(prev => ({ ...prev, [selectedProvider]: 'error' }));
        toast.error(`Failed to configure provider: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      setStatuses(prev => ({ ...prev, [selectedProvider]: 'error' }));
      toast.error('Failed to configure provider: Network error');
    }
  };

  const getStatusIcon = (providerName: string) => {
    const status = statuses[providerName];
    if (status === 'connected') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
    return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusBadge = (provider: ProviderInfo) => {
    if (provider.has_key) {
      return <Badge variant="success" className="text-xs">Configured</Badge>;
    } else if (provider.needs_api_key) {
      return <Badge variant="warning" className="text-xs">Needs Key</Badge>;
    } else {
      return <Badge variant="info" className="text-xs">No Key Needed</Badge>;
    }
  };

  const filteredProviders = providers.filter((provider) => {
    const query = searchQuery.toLowerCase();
    return (
      provider.name.toLowerCase().includes(query) ||
      (provider.display_name?.toLowerCase() || '').includes(query) ||
      provider.category.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        icon={Server}
        title="Provider"
        subtitle="Configure your LLM provider"
      />

      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
          {/* Search Bar - Industrial-level refinement */}
          <div className="relative">
            <Search className="absolute left-[14px] top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search providers..."
              className={cn(
                'w-full h-10 pl-10 pr-4 rounded-lg text-sm',
                'border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)]',
                'bg-background',
                'placeholder:text-muted-foreground/40',
                'focus:outline-none',
                'focus:border-[rgba(0,0,0,0.15)] dark:focus:border-[rgba(255,255,255,0.2)]',
                'focus:shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_8px_rgba(0,0,0,0.04)]',
                'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]'
              )}
            />
          </div>

          {/* Providers List */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Providers</h2>

            {filteredProviders.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/20 flex items-center justify-center">
                  <Search className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground/70">
                  {searchQuery ? 'No providers match your search' : 'No providers available'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProviders.map((provider) => {
                  const isExpanded = expandedProvider === provider.name;
                  const isSelected = selectedProvider === provider.name;
                  const status = statuses[provider.name];

                  return (
                    <div
                      key={provider.name}
                      className={cn(
                        'group relative rounded-lg border bg-card overflow-hidden',
                        'border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)]',
                        'hover:border-[rgba(0,0,0,0.12)] dark:hover:border-[rgba(255,255,255,0.15)]',
                        'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                        isSelected && 'border-[rgba(0,0,0,0.2)] dark:border-[rgba(255,255,255,0.25)]'
                      )}
                    >
                      {/* Main card content */}
                      <button
                        onClick={() => handleSelectProvider(provider.name)}
                        className="w-full px-4 py-3.5 flex items-start gap-3 text-left"
                      >
                        {/* Status indicator */}
                        <div className={cn(
                          'mt-1 w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-200',
                          status === 'connected' ? 'bg-green-500' :
                          status === 'error' ? 'bg-red-500' :
                          provider.has_key ? 'bg-blue-500' :
                          provider.needs_api_key ? 'bg-yellow-500' :
                          'bg-muted-foreground/40'
                        )} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-foreground truncate">
                              {provider.display_name || provider.name}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                            <span className="capitalize">{provider.category}</span>
                            {provider.needs_api_key && !provider.has_key && (
                              <span>• Requires API key</span>
                            )}
                          </div>
                        </div>

                        {/* Expand icon */}
                        <ChevronRight
                          className={cn(
                            'w-4 h-4 text-muted-foreground/40 flex-shrink-0 transition-transform duration-200',
                            isExpanded && 'rotate-90'
                          )}
                        />
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.06)]">
                          {provider.needs_api_key && !provider.has_key ? (
                            <div className="pt-3 space-y-3">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground/80 mb-1.5 block">
                                  API Key
                                </label>
                                <input
                                  type="password"
                                  value={apiKey}
                                  onChange={(e) => setApiKey(e.target.value)}
                                  placeholder="sk-xxx..."
                                  className={cn(
                                    'w-full h-9 px-3 rounded-md text-sm',
                                    'border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)]',
                                    'bg-background',
                                    'placeholder:text-muted-foreground/40',
                                    'focus:outline-none',
                                    'focus:border-[rgba(0,0,0,0.15)] dark:focus:border-[rgba(255,255,255,0.2)]',
                                    'transition-colors duration-150'
                                  )}
                                />
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSave();
                                }}
                                disabled={!apiKey}
                                className={cn(
                                  'w-full h-9 px-4 rounded-md text-sm font-medium',
                                  'flex items-center justify-center gap-2',
                                  'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                                  apiKey
                                    ? 'bg-foreground text-background hover:bg-foreground/90'
                                    : 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                                )}
                              >
                                <Key className="w-3.5 h-3.5" />
                                Save API Key
                              </button>
                            </div>
                          ) : provider.has_key ? (
                            <div className="pt-3 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>API key configured</span>
                            </div>
                          ) : (
                            <div className="pt-3 text-xs text-muted-foreground/60">
                              No API key required
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
